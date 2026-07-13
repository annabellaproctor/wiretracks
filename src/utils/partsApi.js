/**
 * Unified Component Search APIs client
 * Orchestrates live lookups from:
 * 1. LCSC Official API (Signature-based Auth via App ID + Access Key + Secret Key)
 * 2. DigiKey API (OAuth-based via Client ID + Secret)
 * 3. Mouser catalog (with VITE_MOUSER_API_KEY)
 * 4. LCSC public global search (No-Auth fallback)
 * 5. EasyEDA client catalog search (No-Auth fallback)
 * 6. Wikipedia summary extracts (No-Auth)
 * 7. Brave Search / Tavily image fetches (if keys are configured)
 *
 * Implements session-based in-memory caching (Map) instead of browser LocalStorage persistence.
 */
import { deduplicateComponents } from './componentMerger';
// -------------------------------------------------------------
// 🧮 Native MD5 implementation for LCSC API signature generation
// -------------------------------------------------------------
function md5(str) {
  var k = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ];
  var r = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];
  var x = [];
  var n = str.length;
  var i;
  for(i=0; i<n; i++) {
    x[i>>2] |= (str.charCodeAt(i) & 0xff) << ((i%4)*8);
  }
  x[n>>2] |= 0x80 << ((n%4)*8);
  var len = n*8;
  x[(((n+8)>>6)+1)<<4] = 0;
  x[(((n+8)>>6)+1)*16 - 2] = len & 0xffffffff;
  x[(((n+8)>>6)+1)*16 - 1] = Math.floor(len / 4294967296);

  var a = 0x67452301;
  var b = 0xefcdab89;
  var c = 0x98badcfe;
  var d = 0x10325476;

  for(i=0; i<x.length; i+=16) {
    var olda = a, oldb = b, oldc = c, oldd = d;
    for(var j=0; j<64; j++) {
      var f, g;
      if(j<16) {
        f = (b & c) | ((~b) & d);
        g = j;
      } else if(j<32) {
        f = (d & b) | ((~d) & c);
        g = (5*j + 1) % 16;
      } else if(j<48) {
        f = b ^ c ^ d;
        g = (3*j + 5) % 16;
      } else {
        f = c ^ (b | (~d));
        g = (7*j) % 16;
      }
      var temp = d;
      d = c;
      c = b;
      b = (b + rotateLeft((a + f + k[j] + (x[i+g]||0)), r[j])) | 0;
      a = temp;
    }
    a = (a + olda) | 0;
    b = (b + oldb) | 0;
    c = (c + oldc) | 0;
    d = (d + oldd) | 0;
  }
  
  function rotateLeft(l, val) {
    return (l << val) | (l >>> (32 - val));
  }

  var hex = "";
  var words = [a, b, c, d];
  for(i=0; i<4; i++) {
    var word = words[i];
    for(var j=0; j<4; j++) {
      var byte = (word >> (j*8)) & 0xff;
      hex += byte.toString(16).padStart(2, '0');
    }
  }
  return hex;
}

const queryCache = new Map();

function getCachedResult(query) {
  const key = query.toLowerCase().trim();
  if (queryCache.has(key)) {
    const cached = queryCache.get(key);
    if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.data;
    }
  }
  return null;
}

function setCachedResult(query, data) {
  queryCache.set(query.toLowerCase().trim(), {
    timestamp: Date.now(),
    data
  });
}

// -------------------------------------------------------------
// 📦 LCSC Developer Open API Client (Signature-based Auth)
// -------------------------------------------------------------
export async function searchLCSCOfficialAPI(query) {
  try {
    const response = await fetch(`/api/search/lcsc-official?query=${encodeURIComponent(query)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error('LCSC Official API error:', e);
    return null;
  }
}

// -------------------------------------------------------------
// 🔑 DigiKey API Client (OAuth Client Credentials Flow)
// -------------------------------------------------------------
export async function searchDigiKeyParts(query) {
  try {
    const response = await fetch(`/api/search/digikey?query=${encodeURIComponent(query)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error('DigiKey search failed:', e);
    return null;
  }
}

// -------------------------------------------------------------
// Mouser API lookup
// -------------------------------------------------------------
export async function searchMouserParts(query) {
  try {
    const response = await fetch(`/api/search/mouser?query=${encodeURIComponent(query)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error('Mouser API error:', e);
    return null;
  }
}

// -------------------------------------------------------------
// EasyEDA Public CAD search
// -------------------------------------------------------------
export async function searchEasyEDAParts(query) {
  try {
    const url = `/api/search/easyeda?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.result?.lists || [];
    return list.map(item => ({
      mfr: item.brand || 'Unknown',
      partNumber: item.number || 'Unknown',
      description: item.description || 'No description available',
      package: item.package || 'N/A',
      price: item.price || 'Contact',
      stock: item.stock ? `${item.stock} In Stock` : 'Stock Check',
      datasheet: item.datasheet || '',
      url: `https://lcsc.com/product-detail/${item.uuid}.html`,
      image: item.package_detail?.image || null,
      source: 'EasyEDA'
    }));
  } catch (e) {
    console.error('EasyEDA public API error:', e);
    return [];
  }
}

// -------------------------------------------------------------
// LCSC Global public search
// -------------------------------------------------------------
export async function searchLCSCParts(query) {
  try {
    const url = `/api/search/lcsc?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.result?.data || [];
    return list.map(item => ({
      mfr: item.brandNameEn || 'Unknown',
      partNumber: item.productModel || 'Unknown',
      description: item.productDescEn || 'No description available',
      package: item.encapStandard || 'N/A',
      price: item.priceList?.[0]?.price ? `$${item.priceList[0].price}` : 'Contact',
      stock: item.stockNumber ? `${item.stockNumber} In Stock` : 'Stock Check',
      datasheet: item.pdfUrl || '',
      url: `https://lcsc.com/product-detail/${item.productCode}.html`,
      image: item.productImages?.[0] || null,
      source: 'LCSC'
    }));
  } catch (e) {
    console.error('LCSC public API error:', e);
    return [];
  }
}

export async function searchJLCPartCode(query) {
  try {
    const url = `/api/search/jlc?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.data?.componentPageInfo?.list || [];
    return list.map(item => ({
      mfr: item.componentBrandEn || 'Unknown',
      partNumber: item.componentCode || 'Unknown', // This is the Cxxxx code!
      model: item.productModel || 'Unknown',       // MPN
      description: item.describe || 'No description available',
      package: item.componentSpecificationEn || 'N/A',
      price: item.componentPrices?.[0]?.productPrice ? `$${item.componentPrices[0].productPrice}` : 'Contact',
      stock: item.stockCount ? `${item.stockCount} In Stock` : 'Stock Check',
      datasheet: item.datasheet || '',
      url: `https://lcsc.com/product-detail/${item.componentCode}.html`,
      image: item.productImages?.[0] || null,
      source: 'JLCPCB Sourcing'
    }));
  } catch (e) {
    console.error('JLCPCB public search error:', e);
    return [];
  }
}

// -------------------------------------------------------------
// Wikipedia REST Summary API
// -------------------------------------------------------------
export async function fetchWikipediaSummary(query) {
  try {
    const res = await fetch(`/api/search/wikipedia?query=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('Wikipedia API error:', e);
    return null;
  }
}

// -------------------------------------------------------------
// Image search
// -------------------------------------------------------------
export async function searchComponentImages(query, returnAll = false) {
  try {
    const res = await fetch(`/api/search/images?query=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const urls = await res.json();
    if (returnAll) {
      return urls;
    }
    return urls[0] || null;
  } catch (e) {
    console.error('[partsApi] searchComponentImages proxy error:', e);
    return [];
  }
}

export async function searchAmazonParts(query) {
  try {
    const res = await fetch(`/api/search/amazon-serp?query=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('Amazon search error:', e);
    return [];
  }
}

// DataForSEO API client (Amazon products query)
export async function searchDataForSEO(query) {
  try {
    const response = await fetch(`/api/search/dataforseo?query=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (err) {
    console.error('DataForSEO query failed:', err);
    return [];
  }
}

// Google Merchant Center Content API for Shopping (v2 Deprecated/Legacy Client)
export async function searchGoogleMerchantAPI(query) {
  try {
    const response = await fetch(`/api/search/google-merchant?query=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (err) {
    console.error('Google Merchant API error:', err);
    return [];
  }
}

// Unified orchestrator with caching and provider routing
export async function searchPartsUnified(query, provider = 'all') {
  const cacheKey = `${provider}_${query}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  const results = [];
  const serpapiKey = import.meta.env.VITE_SERPAPI_API_KEY;
  const dataforseoLogin = import.meta.env.VITE_DATAFORSEO_LOGIN;
  const googleMerchantId = import.meta.env.VITE_GOOGLE_MERCHANT_ID;
  const saEmail = import.meta.env.VITE_GCP_SERVICE_ACCOUNT_EMAIL;
  const saPrivateKey = import.meta.env.VITE_GCP_SERVICE_ACCOUNT_PRIVATE_KEY;

  try {
    if (provider === 'all') {
      // Tier 1: Largest, cheapest, public, good-enough providers
      const tier1Promises = [
        searchEasyEDAParts(query),
        searchLCSCParts(query),
        searchJLCPartCode(query)
      ];

      const tier1Results = await Promise.all(tier1Promises);
      const [easyeda, lcsc, jlc] = tier1Results;

      const totalTier1Results = (easyeda?.length || 0) + (lcsc?.length || 0) + (jlc?.length || 0);
      const anyTier1Failed = !easyeda || !lcsc || !jlc;

      if (totalTier1Results > 0 && !anyTier1Failed) {
        // Tier 1 succeeded and returned component matches!
        if (easyeda) results.push(...easyeda);
        if (lcsc) results.push(...lcsc);
        if (jlc) results.push(...jlc);
      } else {
        // Fallback Tier 2: Query Mouser, DigiKey, Official LCSC API, and other premium/configured providers
        console.log("[searchPartsUnified] Tier 1 rate-limited, failed, or returned zero results. Querying Tier 2 providers...");
        
        const tier2Promises = [
          searchLCSCOfficialAPI(query),
          searchDigiKeyParts(query),
          searchMouserParts(query),
          fetchWikipediaSummary(query)
        ];

        if (serpapiKey) tier2Promises.push(searchAmazonParts(query));
        if (dataforseoLogin) tier2Promises.push(searchDataForSEO(query));
        if (googleMerchantId && saEmail && saPrivateKey) {
          tier2Promises.push(searchGoogleMerchantAPI(query));
        }

        const tier2Results = await Promise.all(tier2Promises);
        const [lcscOfficial, digikey, mouser, wiki] = tier2Results;

        if (lcscOfficial) results.push(...lcscOfficial);
        if (digikey) results.push(...digikey);
        if (mouser) results.push(...mouser);
        
        // Include any remaining Tier 1 results
        if (easyeda) results.push(...easyeda);
        if (lcsc) results.push(...lcsc);
        if (jlc) results.push(...jlc);

        let nextIdx = 4;
        if (serpapiKey) {
          const amazon = tier2Results[nextIdx++];
          if (amazon) results.push(...amazon);
        }
        if (dataforseoLogin) {
          const dataforseo = tier2Results[nextIdx++];
          if (dataforseo) results.push(...dataforseo);
        }
        if (googleMerchantId && saEmail && saPrivateKey) {
          const googleMerchant = tier2Results[nextIdx++];
          if (googleMerchant) results.push(...googleMerchant);
        }

        // Enrich with Wikipedia summaries
        if (wiki && wiki.summary) {
          results.forEach(part => {
            const checkStr = wiki.title.toLowerCase();
            if (part.partNumber.toLowerCase().includes(checkStr) || checkStr.includes(part.partNumber.toLowerCase())) {
              part.description = `${wiki.summary} | ${part.description}`;
              if (!part.image) part.image = wiki.thumbnail;
            }
          });
        }
      }
    } else if (provider === 'lcsc_official') {
      const lcscOfficial = await searchLCSCOfficialAPI(query);
      if (lcscOfficial) results.push(...lcscOfficial);
    } else if (provider === 'digikey') {
      const digikey = await searchDigiKeyParts(query);
      if (digikey) results.push(...digikey);
    } else if (provider === 'mouser') {
      const mouser = await searchMouserParts(query);
      if (mouser) results.push(...mouser);
    } else if (provider === 'lcsc_public') {
      const lcsc = await searchLCSCParts(query);
      if (lcsc) results.push(...lcsc);
    } else if (provider === 'easyeda') {
      const easyeda = await searchEasyEDAParts(query);
      if (easyeda) results.push(...easyeda);
    } else if (provider === 'amazon') {
      const amazon = await searchAmazonParts(query);
      if (amazon) results.push(...amazon);
    } else if (provider === 'dataforseo') {
      const dataforseo = await searchDataForSEO(query);
      if (dataforseo) results.push(...dataforseo);
    } else if (provider === 'google_shopping') {
      const googleMerchant = await searchGoogleMerchantAPI(query);
      if (googleMerchant) results.push(...googleMerchant);
    }
  } catch (e) {
    console.warn(`Dynamic lookup failed for provider "${provider}", falling back to cache:`, e);
    // Offline fallback: try to look up query in map cache directly
    const offlineFallback = getCachedResult(query);
    if (offlineFallback) return offlineFallback;
  }

  // Deduplicate by model code using our programmatic merge conflict resolver
  const uniqueParts = deduplicateComponents(results);
  const finalResults = uniqueParts.slice(0, 15);
  
  setCachedResult(cacheKey, finalResults);

  // Pre-cache each individual component item under its own part number and LCSC ID
  finalResults.forEach(part => {
    if (part.partNumber) {
      setCachedResult(part.partNumber, [part]);
    }
    if (part.url && part.url.includes('/product-detail/')) {
      const match = part.url.match(/product-detail\/([^.]+)/);
      if (match) {
        setCachedResult(match[1], [part]);
      }
    }
  });

  return finalResults;
}

// AI Component Search Results Ranker
export async function rankSearchResultsWithAI(query, results, geminiKey) {
  if (!geminiKey || results.length === 0) return results;

  const prompt = `You are a professional electronic component selector and design expert. 
Review the following list of component search results for user query "${query}". 
Sort and rank the best 8 component candidates, clean up any messy descriptions, highlight stock options, and return a valid JSON array matching the exact structure of the input components list.
Do not wrap your output in markdown JSON blocks. Do not add conversational text.

Input Search Results:
${JSON.stringify(results, null, 2)}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      console.warn("AI Ranker HTTP error:", response.status);
      return results;
    }

    const data = await response.json();
    const textOut = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOut) return results;

    let cleanJson = textOut.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
    }

    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("AI ranking failed, returning raw results:", e);
    return results;
  }
}

export async function searchTextWeb(query) {
  const tavilyKey = import.meta.env.VITE_TAVILY_API_KEY;
  const braveKey = import.meta.env.VITE_BRAVE_API_KEY;

  if (tavilyKey) {
    try {
      console.log(`[Web Search] Querying Tavily for: "${query}"`);
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: query,
          max_results: 5,
          search_depth: 'advanced'
        })
      });
      if (res.ok) {
        const data = await res.json();
        return (data.results || []).map(r => ({
          title: r.title,
          content: r.content,
          url: r.url,
          source: 'Tavily Web Search'
        }));
      }
    } catch (e) {
      console.error('Tavily Text Search error:', e);
    }
  }

  if (braveKey) {
    try {
      console.log(`[Web Search] Querying Brave Search for: "${query}"`);
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': braveKey
        }
      });
      if (res.ok) {
        const data = await res.json();
        return (data.web?.results || []).map(r => ({
          title: r.title,
          content: r.description,
          url: r.url,
          source: 'Brave Search'
        }));
      }
    } catch (e) {
      console.error('Brave Text Search error:', e);
    }
  }

  return [];
}

