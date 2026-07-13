const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');

const CANDIDATES_DIR = '/Users/aap/.gemini/antigravity-ide/brain/306ed7bb-ecc4-412d-bf5d-1c414febc237/candidates';
const ORIG_GRID_PATH = '/Users/aap/.gemini/antigravity-ide/brain/306ed7bb-ecc4-412d-bf5d-1c414febc237/candidates_grid.png';
const WARP_GRID_PATH = '/Users/aap/.gemini/antigravity-ide/brain/306ed7bb-ecc4-412d-bf5d-1c414febc237/warped_grid.png';

if (!fs.existsSync(CANDIDATES_DIR)) {
  fs.mkdirSync(CANDIDATES_DIR, { recursive: true });
}

async function fetchSearchImageUrls() {
  console.log('Fetching candidate image URLs from Dev Server /api/search/images...');
  const queries = [
    'stm32 f103 board',
    'stm32 blue pill',
    'stm32 minimum system board'
  ];
  
  const urls = [];
  for (const q of queries) {
    try {
      const url = `http://localhost:5173/api/search/images?query=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const results = await res.json();
      for (const imgUrl of results) {
        if (!imgUrl) continue;
        if (!imgUrl.startsWith('http')) continue;
        
        const lowerUrl = imgUrl.toLowerCase();
        const skipKeywords = [
          'no_goods_pic', 'default_pic', 'default.png', 'no_image', 'placeholder', 'blank', 
          'no-image', 'default-image', 'notfound', 'not-found', 'pixel.gif', 'spacer.gif',
          'products/default'
        ];
        if (skipKeywords.some(kw => lowerUrl.includes(kw))) {
          console.log(`[Skipping] URL matches placeholder/default keyword: ${imgUrl}`);
          continue;
        }
        
        if (!urls.includes(imgUrl)) {
          urls.push(imgUrl);
        }
      }
    } catch (e) {
      console.error(`Search failed for "${q}":`, e);
    }
  }
  return urls;
}

async function downloadImages(urls, maxCount = 40) {
  console.log(`Downloading up to ${maxCount} images...`);
  const downloadedFiles = [];
  let count = 0;
  
  for (const url of urls) {
    if (count >= maxCount) break;
    const ext = path.extname(url.split('?')[0]) || '.jpg';
    if (!['.jpg', '.jpeg', '.png'].includes(ext.toLowerCase())) continue;
    
    const filePath = path.join(CANDIDATES_DIR, `candidate_${count}${ext}`);
    console.log(`[${count + 1}] Downloading: ${url}`);
    
    try {
      // Use curl to download image with 5s timeout
      execSync(`curl -s -L --max-time 5 -o "${filePath}" "${url}"`);
      // Verify image size is valid and check magic bytes to discard HTML document texts
      const stats = fs.statSync(filePath);
      if (stats.size > 2000) {
        const buffer = fs.readFileSync(filePath);
        const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
        const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8;
        const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
        const isWebp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
        
        if (isPng || isJpg || isGif || isWebp) {
          downloadedFiles.push(filePath);
          count++;
        } else {
          console.warn(`[Skipping] Downloaded file is not a valid image format (HTML/text block): ${url}`);
          fs.unlinkSync(filePath);
        }
      } else {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.warn(`Failed to download ${url}:`, e.message);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch(_) {}
      }
    }
  }
  return downloadedFiles;
}

async function run() {
  const imageUrls = await fetchSearchImageUrls();
  console.log(`Found ${imageUrls.length} total potential candidate URLs.`);
  
  const files = await downloadImages(imageUrls, 40);
  console.log(`Successfully downloaded ${files.length} candidate images.`);
  
  if (files.length === 0) {
    console.error('No images downloaded, exiting.');
    process.exit(1);
  }
  
  console.log('Launching Puppeteer to create original and warped grids...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  // --- 1. RENDER ORIGINAL GRID ---
  console.log('Generating original grid image...');
  let gridHtml = `
    <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 20px;
            background-color: #f3f4f6;
            font-family: system-ui, sans-serif;
          }
          h1 {
            text-align: center;
            color: #111827;
            margin-bottom: 20px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 15px;
            width: 1200px;
            margin: 0 auto;
          }
          .card {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px;
          }
          .card img {
            width: 180px;
            height: 180px;
            object-fit: contain;
            background: #f9fafb;
            border-radius: 4px;
          }
          .label {
            margin-top: 8px;
            font-size: 12px;
            color: #4b5563;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <h1>Original STM32 Candidates Grid</h1>
        <div class="grid">
  `;
  
  files.forEach((file, index) => {
    const base64 = fs.readFileSync(file).toString('base64');
    const ext = path.extname(file).replace('.', '');
    gridHtml += `
      <div class="card">
        <img src="data:image/${ext};base64,${base64}" />
        <div class="label">Candidate #${index}</div>
      </div>
    `;
  });
  
  gridHtml += `
        </div>
      </body>
    </html>
  `;
  
  await page.setContent(gridHtml);
  // Wait for images to load
  await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll('img'));
    await Promise.all(imgs.map(img => {
      if (img.complete) return;
      return new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
    }));
  });
  
  await page.screenshot({ path: ORIG_GRID_PATH, fullPage: true });
  console.log(`Original candidates grid saved successfully to: ${ORIG_GRID_PATH}`);
  
  // --- 2. RUN CALIBRATION & RENDER WARPED GRID ---
  console.log('Running autoCalibrateAndWarp on all candidates...');
  
  // Read calibration code from test_calibration.cjs
  const testCalibrationContent = fs.readFileSync('test_calibration.cjs', 'utf-8');
  const startIdx = testCalibrationContent.indexOf('const pageContextCode = `');
  const endIdx = testCalibrationContent.indexOf('`;', startIdx);
  const pcbWarpLogic = testCalibrationContent.substring(startIdx + 'const pageContextCode = `'.length, endIdx);
  
  await page.evaluate(pcbWarpLogic);
  
  const warpedResults = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const base64 = fs.readFileSync(file).toString('base64');
    const ext = path.extname(file).replace('.', '').toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'webp') mimeType = 'image/webp';
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    console.log(`Calibrating Candidate #${i}...`);
    try {
      const result = await page.evaluate(async (imgUrl) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            try {
              // Downscale to max 400px to speed up batch testing
              const maxDim = 400;
              let w = img.naturalWidth;
              let h = img.naturalHeight;
              if (w > maxDim || h > maxDim) {
                const scale = maxDim / Math.max(w, h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
              }
              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, w, h);
              
               const resizedImg = new Image();
              resizedImg.onload = () => {
                try {
                  const res = window.autoCalibrateAndWarp(resizedImg, 50);
                  if (res && res.fullDataUrl) {
                    resolve({ success: true, url: res.fullDataUrl });
                  } else {
                    resolve({ success: false, error: 'Calibration returned null' });
                  }
                } catch (e) {
                  resolve({ success: false, error: e.message || e.toString() });
                }
              };
              resizedImg.onerror = () => resolve({ success: false, error: 'Resized image load failed' });
              resizedImg.src = canvas.toDataURL();
            } catch (e) {
              resolve({ success: false, error: e.toString() });
            }
          };
          img.onerror = () => resolve({ success: false, error: 'Image load failed' });
          img.src = imgUrl;
        });
      }, dataUrl);
      
      warpedResults.push({ index: i, ...result });
    } catch (e) {
      warpedResults.push({ index: i, success: false, error: e.toString() });
    }
  }
  
  // Render warped grid
  let warpGridHtml = `
    <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 20px;
            background-color: #111827;
            font-family: system-ui, sans-serif;
            color: #f3f4f6;
          }
          h1 {
            text-align: center;
            margin-bottom: 20px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 15px;
            width: 1200px;
            margin: 0 auto;
          }
          .card {
            background: #1f2937;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #374151;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px;
          }
          .card img {
            width: 180px;
            height: 180px;
            object-fit: contain;
            background: #111827;
            border-radius: 4px;
          }
          .label {
            margin-top: 8px;
            font-size: 12px;
            color: #9ca3af;
            font-weight: 600;
          }
          .error {
            color: #ef4444;
            font-size: 11px;
            width: 180px;
            height: 180px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: #311;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <h1>Warped STM32 Results Grid</h1>
        <div class="grid">
  `;
  
  warpedResults.forEach((res) => {
    if (res && res.success && res.url) {
      warpGridHtml += `
        <div class="card">
          <img src="${res.url}" />
          <div class="label">Warped #${res.index}</div>
        </div>
      `;
    } else {
      warpGridHtml += `
        <div class="card">
          <div class="error">FAIL<br/>${(res && res.error) || 'Unknown Error'}</div>
          <div class="label" style="color:#ef4444;">Warped #${res ? res.index : 'Unknown'} (FAIL)</div>
        </div>
      `;
    }
  });
  
  warpGridHtml += `
        </div>
      </body>
    </html>
  `;
  
  await page.setContent(warpGridHtml);
  // Wait for images to load
  await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll('img'));
    await Promise.all(imgs.map(img => {
      if (img.complete) return;
      return new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
    }));
  });
  
  await page.screenshot({ path: WARP_GRID_PATH, fullPage: true });
  console.log(`Warped candidates grid saved successfully to: ${WARP_GRID_PATH}`);
  
  await browser.close();
}

run();
