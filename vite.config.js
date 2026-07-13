import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

let digikeyToken = null;
let digikeyTokenExpires = 0;

function easyeda2kicadPlugin(env) {
  return {
    name: 'easyeda2kicad-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url.startsWith('/api/search/lcsc-official')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const query = urlObj.searchParams.get('query');
          
          const appId = env.VITE_LCSC_APP_ID || env.VITE_JLCPCB_APP_ID;
          const accessKey = env.VITE_LCSC_ACCESS_KEY || env.VITE_JLCPCB_API_KEY;
          const secretKey = env.VITE_LCSC_SECRET_KEY || env.VITE_JLCPCB_API_SECRET;
          
          if (!appId || !accessKey || !secretKey) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
            return;
          }
          
          try {
            const timestamp = Math.floor(Date.now() / 1000);
            const bodyParams = {
              accessKey: accessKey,
              appId: appId,
              keyword: query,
              pageSize: "5",
              timestamp: String(timestamp)
            };
            const sortedKeys = Object.keys(bodyParams).sort();
            const paramPairs = sortedKeys.map(k => `${k}=${bodyParams[k]}`);
            const paramStr = paramPairs.join('&');
            const signatureSource = secretKey + paramStr + secretKey;
            const signature = crypto.createHash('md5').update(signatureSource).digest('hex').toUpperCase();
            
            const response = await fetch('https://ips.lcsc.com/v1/products/search', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-LCSC-App-Id': appId,
                'X-LCSC-Timestamp': String(timestamp),
                'X-LCSC-Signature': signature
              },
              body: JSON.stringify(bodyParams)
            });
            
            if (!response.ok) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
            
            const data = await response.json();
            const products = data?.result?.data || [];
            const results = products.map(p => ({
              mfr: p.brandNameEn || 'Unknown',
              partNumber: p.productModel || 'Unknown',
              description: p.productDescEn || 'No description available',
              package: p.encapStandard || 'N/A',
              price: p.priceList?.[0]?.price ? `$${p.priceList[0].price}` : 'Contact',
              stock: p.stockNumber ? `${p.stockNumber} In Stock` : 'Stock Check',
              datasheet: p.pdfUrl || '',
              url: `https://lcsc.com/product-detail/${p.productCode}.html`,
              image: p.productImages?.[0] || null,
              source: 'LCSC Official'
            }));
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(results));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
          }
          return;
        }

        if (req.url.startsWith('/api/search/digikey')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const query = urlObj.searchParams.get('query');
          
          const clientId = env.VITE_DIGIKEY_CLIENT_ID;
          const clientSecret = env.VITE_DIGIKEY_CLIENT_SECRET;
          
          if (!clientId || !clientSecret) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
            return;
          }
          
          try {
            let token = digikeyToken;
            if (!token || Date.now() >= digikeyTokenExpires) {
              const tokRes = await fetch('https://api.digikey.com/v1/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  grant_type: 'client_credentials',
                  client_id: clientId,
                  client_secret: clientSecret
                })
              });
              if (tokRes.ok) {
                const tokData = await tokRes.json();
                digikeyToken = tokData.access_token;
                digikeyTokenExpires = Date.now() + (tokData.expires_in - 60) * 1000;
                token = digikeyToken;
              }
            }
            
            if (!token) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
            
            const response = await fetch('https://api.digikey.com/products/v1/search/keyword', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-DIGIKEY-Client-Id': clientId
              },
              body: JSON.stringify({
                Keywords: query,
                RecordCount: 5
              })
            });
            
            if (!response.ok) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
            
            const data = await response.json();
            const products = data?.Products || [];
            const results = products.map(p => ({
              mfr: p.Manufacturer?.Value || 'Unknown',
              partNumber: p.ManufacturerPartNumber || 'Unknown',
              description: p.DetailedDescription || 'No description available',
              package: p.Packaging?.Value || 'N/A',
              price: p.UnitPrice ? `$${p.UnitPrice}` : 'Contact',
              stock: p.QuantityAvailable ? `${p.QuantityAvailable} In Stock` : 'Stock Check',
              datasheet: p.PrimaryDatasheet || '',
              url: p.ProductUrl || '',
              image: p.PrimaryPhoto || null,
              source: 'DigiKey'
            }));
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(results));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
          }
          return;
        }

        if (req.url.startsWith('/api/search/mouser')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const query = urlObj.searchParams.get('query');
          
          const apiKey = env.VITE_MOUSER_API_KEY;
          if (!apiKey) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
            return;
          }
          
          try {
            const response = await fetch(`https://api.mouser.com/api/v1.0/search/keyword?apiKey=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                SearchByKeywordRequest: {
                  keyword: query,
                  records: 5,
                  startingRecord: 0
                }
              })
            });
            
            if (!response.ok) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
            
            const data = await response.json();
            const parts = data?.SearchResults?.Parts || [];
            const results = parts.map(p => ({
              mfr: p.Manufacturer || 'Unknown',
              partNumber: p.ManufacturerPartNumber || 'Unknown',
              description: p.Description || 'No description available',
              package: p.UnitPackage || 'N/A',
              price: p.PriceBreaks?.[0]?.Price || 'Contact',
              stock: p.Availability || 'Out of stock',
              datasheet: p.DatasheetUrl || '',
              url: p.ProductDetailUrl || '',
              image: p.ImagePath || null,
              source: 'Mouser'
            }));
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(results));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
          }
          return;
        }

        if (req.url.startsWith('/api/search/amazon-serp')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const query = urlObj.searchParams.get('query');
          
          const serpapiKey = env.VITE_SERPAPI_API_KEY;
          if (!serpapiKey) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
            return;
          }
          
          try {
            const resSerp = await fetch(`https://serpapi.com/search.json?engine=amazon&query=${encodeURIComponent(query)}&api_key=${serpapiKey}`);
            if (!resSerp.ok) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
            
            const data = await resSerp.json();
            const products = data.amazon_results || [];
            const results = products.slice(0, 4).map(p => ({
              mfr: 'Amazon Seller',
              partNumber: p.asin || 'ASIN',
              description: p.title || 'Amazon Product',
              package: 'Commercial Box',
              price: p.price?.raw || 'View Link',
              stock: p.delivery || 'Prime Delivery Available',
              datasheet: '',
              url: p.link || 'https://amazon.com',
              image: p.image || p.thumbnail || null,
              source: 'Amazon'
            }));
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(results));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
          }
          return;
        }

        if (req.url.startsWith('/api/search/dataforseo')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const query = urlObj.searchParams.get('query');
          
          const login = env.VITE_DATAFORSEO_LOGIN;
          const password = env.VITE_DATAFORSEO_PASSWORD;
          if (!login || !password) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
            return;
          }
          
          try {
            const postData = [{
              "keyword": query,
              "location_code": 2840,
              "language_code": "en"
            }];
            
            const response = await fetch('https://api.dataforseo.com/v3/merchant/amazon/products/live', {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + Buffer.from(login + ':' + password).toString('base64'),
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(postData)
            });
            
            if (!response.ok) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
            
            const json = await response.json();
            const items = json?.tasks?.[0]?.result?.[0]?.items || [];
            const results = items.slice(0, 4).map(item => ({
              mfr: 'Amazon (DataForSEO)',
              partNumber: item.asin || 'ASIN',
              description: item.title || 'Product Sourced via DataForSEO',
              package: 'Retail Package',
              price: item.price?.value ? `$${item.price.value}` : 'Compare',
              stock: item.is_prime ? 'Prime Available' : 'In Stock',
              datasheet: '',
              url: item.url || 'https://amazon.com',
              image: item.image || null,
              source: 'Amazon (DataForSEO)'
            }));
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(results));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
          }
          return;
        }

        if (req.url.startsWith('/api/search/google-merchant')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const query = urlObj.searchParams.get('query');
          
          const merchantId = env.VITE_GOOGLE_MERCHANT_ID;
          const rawEmail = env.VITE_GCP_SERVICE_ACCOUNT_EMAIL;
          const rawKey = env.VITE_GCP_SERVICE_ACCOUNT_PRIVATE_KEY;
          
          if (!rawKey || !merchantId) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
            return;
          }
          
          let email = rawEmail;
          let privateKey = rawKey;
          if (rawKey.trim().startsWith("{")) {
            try {
              const parsed = JSON.parse(rawKey);
              privateKey = parsed.private_key;
              if (parsed.client_email && !email) {
                email = parsed.client_email;
              }
            } catch (err) {
              console.error("[Google Merchant API] Failed to parse raw service account JSON string:", err);
            }
          }
          
          if (!email || !privateKey) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
            return;
          }
          
          try {
            const header = { alg: "RS256", typ: "JWT" };
            const iat = Math.floor(Date.now() / 1000);
            const claims = {
              iss: email,
              scope: "https://www.googleapis.com/auth/content",
              aud: "https://oauth2.googleapis.com/token",
              exp: iat + 3600,
              iat: iat
            };
            
            const tokenInput = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
            const signer = crypto.createSign('RSA-SHA256');
            signer.update(tokenInput);
            const signature = signer.sign(privateKey, 'base64url');
            const jwt = `${tokenInput}.${signature}`;
            
            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
            });
            
            if (!tokenRes.ok) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
            
            const tokenData = await tokenRes.json();
            const accessToken = tokenData.access_token;
            
            const response = await fetch(`https://shoppingcontent.googleapis.com/content/v2.1/${merchantId}/products?maxResults=5&q=${encodeURIComponent(query)}`, {
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/json"
              }
            });
            
            if (!response.ok) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
            
            const data = await response.json();
            const products = data.resources || [];
            const results = products.map(p => ({
              mfr: p.brand || 'Google Merchant',
              partNumber: p.offerId || 'OfferId',
              description: p.title || 'Product Listing',
              package: 'Commercial Package',
              price: p.price?.value && p.price?.currency ? `${p.price.value} ${p.price.currency}` : 'Compare',
              stock: p.availability || 'In Stock',
              datasheet: '',
              url: p.link || 'https://google.com/shopping',
              image: p.imageLink || null,
              source: 'Google Merchant'
            }));
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(results));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
          }
          return;
        }

        if (req.url.startsWith('/api/search/wikipedia')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const query = urlObj.searchParams.get('query');
          try {
            const resWiki = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
            if (!resWiki.ok) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(null));
              return;
            }
            const data = await resWiki.json();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              title: data.title,
              summary: data.extract,
              thumbnail: data.thumbnail?.source || null,
              url: data.content_urls?.desktop?.page || ''
            }));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(null));
          }
          return;
        }

        if (req.url.startsWith('/api/search/easyeda')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const query = urlObj.searchParams.get('query');
          try {
            const response = await fetch(`https://components.easyeda.com/api/parts/search?keyword=${encodeURIComponent(query)}&version=6.4.19.4`);
            const data = await response.json();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
          }
          return;
        }

        if (req.url.startsWith('/api/search/lcsc')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const query = urlObj.searchParams.get('query');
          try {
            const response = await fetch(`https://wmsc.lcsc.com/ftsn/search/global?keyword=${encodeURIComponent(query)}`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
              }
            });
            const data = await response.json();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
          }
          return;
        }

        if (req.url.startsWith('/api/search/jlc')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const query = urlObj.searchParams.get('query');
          try {
            const response = await fetch('https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://jlcpcb.com',
                'Referer': 'https://jlcpcb.com/parts'
              },
              body: JSON.stringify({
                keyword: query,
                currentPage: 1,
                pageSize: 10
              })
            });
            const data = await response.json();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.url.startsWith('/api/proxy-image')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const imageUrl = urlObj.searchParams.get('url');
          if (!imageUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing url' }));
            return;
          }
          try {
            console.log(`[Vite Server] Proxying image from: ${imageUrl}`);
            const targetOrigin = new URL(imageUrl).origin;
            const response = await fetch(imageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/*',
                'Referer': targetOrigin,
                'Origin': targetOrigin
              }
            });
            if (!response.ok) {
              res.statusCode = response.status;
              res.end(JSON.stringify({ error: `Failed to fetch image: ${response.statusText}` }));
              return;
            }
            const buffer = await response.arrayBuffer();
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(Buffer.from(buffer));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.url.startsWith('/api/search/images')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const query = urlObj.searchParams.get('query');
          if (!query) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing query' }));
            return;
          }
          
          const braveKey = env.VITE_BRAVE_API_KEY;
          const tavilyKey = env.VITE_TAVILY_API_KEY;
          const serpapiKey = env.VITE_SERPAPI_API_KEY;
          
          const searchQuery = `${query} lcsc`;
          const urls = [];
          
          if (braveKey) {
            try {
              const braveRes = await fetch(`https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(searchQuery)}&count=12`, {
                headers: {
                  'Accept': 'application/json',
                  'X-Subscription-Token': braveKey
                }
              });
              if (braveRes.ok) {
                const data = await braveRes.json();
                const results = data?.results || [];
                for (const r of results) {
                  const u = r?.properties?.url;
                  if (u && !urls.includes(u)) urls.push(u);
                }
              }
            } catch (e) {
              console.error('[Image Search] Brave error:', e);
            }
          }
          
          if (tavilyKey) {
            try {
              const tavilyRes = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  api_key: tavilyKey,
                  query: searchQuery,
                  include_images: true,
                  max_results: 5
                })
              });
              if (tavilyRes.ok) {
                const data = await tavilyRes.json();
                const images = data?.images || [];
                for (const u of images) {
                  if (u && !urls.includes(u)) urls.push(u);
                }
              }
            } catch (e) {
              console.error('[Image Search] Tavily error:', e);
            }
          }
          
          if (serpapiKey) {
            try {
              const serpRes = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(searchQuery)}&engine=google_images&api_key=${serpapiKey}`);
              if (serpRes.ok) {
                const data = await serpRes.json();
                const results = data?.images_results || [];
                for (const r of results) {
                  const u = r?.original;
                  if (u && !urls.includes(u)) urls.push(u);
                }
              }
            } catch (e) {
              console.error('[Image Search] SerpApi error:', e);
            }
          }
          
          if (urls.length < 3 && braveKey) {
            try {
              const braveRes = await fetch(`https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=12`, {
                headers: {
                  'Accept': 'application/json',
                  'X-Subscription-Token': braveKey
                }
              });
              if (braveRes.ok) {
                const data = await braveRes.json();
                const results = data?.results || [];
                for (const r of results) {
                  const u = r?.properties?.url;
                  if (u && !urls.includes(u)) urls.push(u);
                }
              }
            } catch (e) {
              console.error('[Image Search] Fallback Brave error:', e);
            }
          }
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(urls));
          return;
        }

        if (req.url.startsWith('/api/easyeda2kicad')) {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const lcscId = urlObj.searchParams.get('lcscId');
          if (!lcscId) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing lcscId' }));
            return;
          }

          console.log(`[Vite Server] Invoking easyeda2kicad tool for LCSC ID: ${lcscId}`);
          const tempBase = path.join(process.cwd(), `temp_${lcscId}_${Date.now()}`);
          
          // Command to run python-based easyeda2kicad converter
          const cmd = `python3 -m easyeda2kicad --lcsc_id=${lcscId} --footprint --symbol --output="${tempBase}"`;

          exec(cmd, (error, stdout, stderr) => {
            if (error) {
              console.error('[Vite Server] easyeda2kicad failed:', stderr || stdout);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'easyeda2kicad execution failed', details: stderr || stdout }));
              return;
            }

            try {
              const symFile = `${tempBase}.kicad_sym`;
              const prettyDir = `${tempBase}.pretty`;
              
              let symbolContent = '';
              let footprintContent = '';
              let footprintName = '';

              if (fs.existsSync(symFile)) {
                symbolContent = fs.readFileSync(symFile, 'utf8');
                fs.unlinkSync(symFile);
              }

              if (fs.existsSync(prettyDir)) {
                const files = fs.readdirSync(prettyDir);
                const modFile = files.find(f => f.endsWith('.kicad_mod'));
                if (modFile) {
                  footprintName = modFile.replace('.kicad_mod', '');
                  footprintContent = fs.readFileSync(path.join(prettyDir, modFile), 'utf8');
                  fs.unlinkSync(path.join(prettyDir, modFile));
                }
                fs.rmdirSync(prettyDir);
              }

              console.log(`[Vite Server] Successfully parsed converted CAD libraries for: ${lcscId}`);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                lcscId,
                symbol: symbolContent,
                footprint: footprintContent,
                footprintName
              }));
            } catch (err) {
              console.error('[Vite Server] File read error:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to read converted files', details: err.message }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), easyeda2kicadPlugin(env)],
  };
});
