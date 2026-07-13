const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const IMAGE_URL = 'https://pg-cdn-a2.datacaciques.com/00/NDAy/17/12/16/9e54ifgdt2zm4pk9/6fec5ff2017d7c73.jpg';
const OUTPUT_PATH = '/Users/aap/.gemini/antigravity-ide/brain/306ed7bb-ecc4-412d-bf5d-1c414febc237/warped_result.png';
const FULL_OUTPUT_PATH = '/Users/aap/.gemini/antigravity-ide/brain/306ed7bb-ecc4-412d-bf5d-1c414febc237/warped_full.png';

async function run() {
  console.log(`[1/4] Downloading image via curl...`);
  let base64Image;
  try {
    const buffer = execSync(`curl -s -L "${IMAGE_URL}"`, { maxBuffer: 20 * 1024 * 1024 });
    base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
    console.log(`Downloaded image size: ${buffer.length} bytes`);
  } catch (err) {
    console.error(`Failed to download image:`, err);
    process.exit(1);
  }

  console.log(`[2/4] Launching headless Chrome...`);
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  const page = await browser.newPage();

  console.log(`[3/4] Running calibration inside page canvas context...`);

  const pageContextCode = `
    window.solveLinearSystem = (A, B) => {
      const n = B.length;
      for (let i = 0; i < n; i++) {
        let maxEl = Math.abs(A[i][i]);
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
          if (Math.abs(A[k][i]) > maxEl) {
            maxEl = Math.abs(A[k][i]);
            maxRow = k;
          }
        }
        for (let k = i; k < n; k++) {
          const tmp = A[maxRow][k];
          A[maxRow][k] = A[i][k];
          A[i][k] = tmp;
        }
        const tmp = B[maxRow];
        B[maxRow] = B[i];
        B[i] = tmp;
        for (let k = i + 1; k < n; k++) {
          const c = -A[k][i] / A[i][i];
          for (let j = i; j < n; j++) {
            if (i === j) {
              A[k][j] = 0;
            } else {
              A[k][j] += c * A[i][j];
            }
          }
          B[k] += c * B[i];
        }
      }
      const x = new Array(n).fill(0);
      for (let i = n - 1; i >= 0; i--) {
        x[i] = B[i] / A[i][i];
        for (let k = i - 1; k >= 0; k--) {
          B[k] -= A[k][i] * x[i];
        }
      }
      return x;
    };

    window.getHomography = (srcPoints, destPoints) => {
      const A = [];
      const B = [];
      for (let i = 0; i < 4; i++) {
        const sx = srcPoints[i].x;
        const sy = srcPoints[i].y;
        const dx = destPoints[i].x;
        const dy = destPoints[i].y;
        A.push([dx, dy, 1, 0, 0, 0, -dx * sx, -dy * sx]);
        B.push(sx);
        A.push([0, 0, 0, dx, dy, 1, -dx * sy, -dy * sy]);
        B.push(sy);
      }
      const h = window.solveLinearSystem(A, B);
      return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
    };

    window.invertHomography = (H) => {
      const [a, b, c, d, e, f, g, h, i] = H;
      const A = e*i - f*h;
      const B = -(b*i - c*h);
      const C = b*f - c*e;
      const D = -(d*i - f*g);
      const E = a*i - c*g;
      const F = -(a*f - c*d);
      const G = d*h - e*g;
      const H_ = -(a*h - b*g);
      const I = a*e - b*d;
      const det = a*A + b*D + c*G;
      if (Math.abs(det) < 1e-8) return null;
      return [A/det, B/det, C/det, D/det, E/det, F/det, G/det, H_/det, I/det];
    };

    window.processPerspectiveWarp = (srcCanvas, taperFactor = 0, shearFactor = 0) => {
      if (taperFactor === 0 && shearFactor === 0) return srcCanvas;
      
      const w = srcCanvas.width;
      const h = srcCanvas.height;
      const destCanvas = document.createElement('canvas');
      destCanvas.width = w;
      destCanvas.height = h;
      const destCtx = destCanvas.getContext('2d', { willReadFrequently: true });
      
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      const srcData = srcCtx.getImageData(0, 0, w, h);
      const destData = destCtx.createImageData(w, h);
      
      const srcPixels = srcData.data;
      const destPixels = destData.data;
      
      const centerX = w / 2;
      
      for (let y = 0; y < h; y++) {
        const taper = 1 + taperFactor * (y / h - 0.5);
        const shearOffset = shearFactor * (y - h / 2);
        
        for (let x = 0; x < w; x++) {
          const srcX = Math.round(centerX + (x - centerX) * taper + shearOffset);
          const destIdx = (y * w + x) * 4;
          
          if (srcX >= 0 && srcX < w) {
            const srcIdx = (y * w + srcX) * 4;
            destPixels[destIdx] = srcPixels[srcIdx];
            destPixels[destIdx+1] = srcPixels[srcIdx+1];
            destPixels[destIdx+2] = srcPixels[srcIdx+2];
            destPixels[destIdx+3] = srcPixels[srcIdx+3];
          } else {
            destPixels[destIdx+3] = 0;
          }
        }
      }
      
      destCtx.putImageData(destData, 0, 0);
      return destCanvas;
    };

    window.isPointInQuad = (p, p0, p1, p2, p3) => {
      const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const c0 = cross(p0, p1, p);
      const c1 = cross(p1, p3, p);
      const c2 = cross(p3, p2, p);
      const c3 = cross(p2, p0, p);
      return (c0 >= 0 && c1 >= 0 && c2 >= 0 && c3 >= 0) || 
             (c0 <= 0 && c1 <= 0 && c2 <= 0 && c3 <= 0);
    };

    window.autoCalibrateAndWarp = (img, tolerance = 50) => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        
        const rawCanvas = document.createElement('canvas');
        rawCanvas.width = w;
        rawCanvas.height = h;
        const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
        rawCtx.drawImage(img, 0, 0);
        
        const rawImgData = rawCtx.getImageData(0, 0, w, h);
        const data = rawImgData.data;
        
        // Sample background color at corner
        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = 1;
        baseCanvas.height = 1;
        const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
        baseCtx.drawImage(img, 5, 5, 5, 5, 0, 0, 1, 1);
        const baseCorner = baseCtx.getImageData(0, 0, 1, 1).data;
        const bgR = baseCorner[0];
        const bgG = baseCorner[1];
        const bgB = baseCorner[2];
        const bgA = baseCorner[3];
        const isBgTransparent = bgA < 50;
        
        // Key out background first
        const isBackground = new Uint8Array(w * h);
        if (!isBgTransparent && tolerance > 0) {
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              const r = data[idx];
              const g = data[idx+1];
              const b = data[idx+2];
              const dist = Math.sqrt(
                Math.pow(r - bgR, 2) +
                Math.pow(g - bgG, 2) +
                Math.pow(b - bgB, 2)
              );
              if (dist < tolerance) {
                data[idx+3] = 0;
                isBackground[y * w + x] = 1;
              }
            }
          }
          rawCtx.putImageData(rawImgData, 0, 0);
        }
        
        // Create PCB mask
        const pcbMask = new Uint8Array(w * h);
        let chromaticPixelCount = 0;
        
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            if (isBackground[y * w + x] === 1) continue;
            
            const r = data[idx];
            const g = data[idx+1];
            const b = data[idx+2];
            
            const maxCh = Math.max(r, g, b);
            const minCh = Math.min(r, g, b);
            const saturation = maxCh - minCh;
            
            if (saturation > 25 && maxCh > 35) {
              pcbMask[y * w + x] = 1;
              chromaticPixelCount++;
            }
          }
        }
        
        const totalForegroundPixels = w * h - isBackground.reduce((a, b) => a + b, 0);
        const useChromatic = chromaticPixelCount > totalForegroundPixels * 0.15;
        console.log("Chromatic foreground pixels:", chromaticPixelCount, "use chromatic mode:", useChromatic);
        
        const boardMask = useChromatic ? pcbMask : new Uint8Array(w * h).map((_, idx) => 1 - isBackground[idx]);

        // Color Saturation Check (reject monochrome schematic drawings)
        let totalSaturation = 0;
        let foregroundCount = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (isBackground[y * w + x] === 1) continue;
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx+1];
            const b = data[idx+2];
            const sat = Math.max(r, g, b) - Math.min(r, g, b);
            totalSaturation += sat;
            foregroundCount++;
          }
        }
        const avgSaturation = foregroundCount > 0 ? (totalSaturation / foregroundCount) : 0;
        console.log("Foreground pixel count:", foregroundCount, "average saturation:", avgSaturation);
        
        if (foregroundCount > 0 && avgSaturation < 8) {
          throw new Error("Monochrome drawing/schematic detected (saturation: " + avgSaturation.toFixed(2) + "), rejecting.");
        }
        
        // Foreground Area Ratio Check (reject empty/nearly empty frames)
        const areaRatio = foregroundCount / (w * h);
        if (foregroundCount > 0 && areaRatio < 0.01) {
          throw new Error("Foreground area is too small (" + (areaRatio * 100).toFixed(2) + "% of canvas), rejecting.");
        }
        
        // Auto-Crop Pre-Pass for Tiny Boards
        let minX = w, maxX = 0;
        let minY = h, maxY = 0;
        let hasBoard = false;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (boardMask[y * w + x] === 1) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              hasBoard = true;
            }
          }
        }
        
        if (!hasBoard) {
          throw new Error("No PCB board mask detected!");
        }
        
        const boardW = maxX - minX + 1;
        const boardH = maxY - minY + 1;
        const boardAreaRatio = (boardW * boardH) / (w * h);
        console.log("Board mask bounds relative to canvas: w =", boardW, "h =", boardH, "ratio =", boardAreaRatio);
        
        // If the board occupies a small fraction of the image (e.g. < 35%), run auto-crop pre-pass
        // but only if the width and height are reasonably large to avoid cropping noise
        if (boardAreaRatio < 0.35 && w > 100 && h > 100) {
          console.log("Board occupies only a small region of the canvas. Applying auto-crop pre-pass...");
          const padX = Math.round(boardW * 0.05);
          const padY = Math.round(boardH * 0.05);
          
          const cropX = Math.max(0, minX - padX);
          const cropY = Math.max(0, minY - padY);
          const cropW = Math.min(w - cropX, boardW + 2 * padX);
          const cropH = Math.min(h - cropY, boardH + 2 * padY);
          
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = cropW;
          cropCanvas.height = cropH;
          const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
          cropCtx.drawImage(rawCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          
          const subRes = window.autoCalibrateAndWarp(cropCanvas, tolerance);
          if (subRes) {
            subRes.pcbBounds.left += cropX;
            subRes.pcbBounds.top += cropY;
            return subRes;
          }
        }
        
        // Find boundary points of the blue PCB mask
        const boundaryPoints = [];
        const pad = 5;
        for (let y = pad; y < h - pad; y++) {
          for (let x = pad; x < w - pad; x++) {
            if (boardMask[y * w + x] === 0) continue;
            
            const leftVal = boardMask[y * w + x - 1];
            const rightVal = boardMask[y * w + x + 1];
            const upVal = boardMask[(y - 1) * w + x];
            const downVal = boardMask[(y + 1) * w + x];
            
            if (leftVal === 0 || rightVal === 0 || upVal === 0 || downVal === 0) {
              boundaryPoints.push({ x, y });
            }
          }
        }
        
        if (boundaryPoints.length < 4) {
          throw new Error("No PCB boundary points detected!");
        }
        
        // Find optimal box orientation for the blue PCB
        let minArea = Infinity;
        let bestTheta = 0;
        
        for (let theta = 0; theta < 90; theta += 0.5) {
          const rad = (theta * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          
          const step = Math.max(1, Math.round(boundaryPoints.length / 500));
          for (let i = 0; i < boundaryPoints.length; i += step) {
            const p = boundaryPoints[i];
            const rx = p.x * cos - p.y * sin;
            const ry = p.x * sin + p.y * cos;
            
            if (rx < minX) minX = rx;
            if (rx > maxX) maxX = rx;
            if (ry < minY) minY = ry;
            if (ry > maxY) maxY = ry;
          }
          
          const area = (maxX - minX) * (maxY - minY);
          if (area < minArea) {
            minArea = area;
            bestTheta = theta;
          }
        }
        
        console.log("Optimal Box Angle:", bestTheta);
        
        // Find 4 vertices of the blue PCB
        const rad = (bestTheta * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        let tlPt = null, trPt = null, blPt = null, brPt = null;
        let minTL = Infinity, minBL = Infinity, maxTR = -Infinity, maxBR = -Infinity;
        
        for (let i = 0; i < boundaryPoints.length; i++) {
          const p = boundaryPoints[i];
          const rx = p.x * cos - p.y * sin;
          const ry = p.x * sin + p.y * cos;
          
          const scoreTL = rx + ry;
          if (scoreTL < minTL) {
            minTL = scoreTL;
            tlPt = p;
          }
          const scoreBL = rx - ry;
          if (scoreBL < minBL) {
            minBL = scoreBL;
            blPt = p;
          }
          const scoreTR = rx - ry;
          if (scoreTR > maxTR) {
            maxTR = scoreTR;
            trPt = p;
          }
          const scoreBR = rx + ry;
          if (scoreBR > maxBR) {
            maxBR = scoreBR;
            brPt = p;
          }
        }
        
        // Expand PCB corners slightly outwards (~0.7%) so it shows the edge
        const cx = (tlPt.x + trPt.x + blPt.x + brPt.x) / 4;
        const cy = (tlPt.y + trPt.y + blPt.y + brPt.y) / 4;
        const shrinkFactor = -0.007;
        
        const shrinkCorner = (p) => {
          return {
            x: Math.round(p.x + (cx - p.x) * shrinkFactor),
            y: Math.round(p.y + (cy - p.y) * shrinkFactor)
          };
        };
        
        const tlShrunk = shrinkCorner(tlPt);
        const trShrunk = shrinkCorner(trPt);
        const blShrunk = shrinkCorner(blPt);
        const brShrunk = shrinkCorner(brPt);
        
        // Restore opacity inside PCB polygon to prevent transparent holes in labels/chips
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (window.isPointInQuad({x, y}, tlShrunk, trShrunk, blShrunk, brShrunk)) {
              const idx = (y * w + x) * 4;
              data[idx+3] = 255;
            }
          }
        }
        rawCtx.putImageData(rawImgData, 0, 0);
        
        // Determine aspect ratio from shrunk PCB corners
        const topW = Math.sqrt(Math.pow(trShrunk.x - tlShrunk.x, 2) + Math.pow(trShrunk.y - tlShrunk.y, 2));
        const botW = Math.sqrt(Math.pow(brShrunk.x - blShrunk.x, 2) + Math.pow(brShrunk.y - blShrunk.y, 2));
        const leftH = Math.sqrt(Math.pow(blShrunk.x - tlShrunk.x, 2) + Math.pow(blShrunk.y - tlShrunk.y, 2));
        const rightH = Math.sqrt(Math.pow(brShrunk.x - trShrunk.x, 2) + Math.pow(brShrunk.y - trShrunk.y, 2));
        
        const destW = Math.round((topW + botW) / 2);
        const destH = Math.round((leftH + rightH) / 2);
        
        let outW = destW;
        let outH = destH;
        let pTL = tlShrunk, pTR = trShrunk, pBL = blShrunk, pBR = brShrunk;
        
        if (destW > destH) {
          outW = destH;
          outH = destW;
          pTL = trShrunk;
          pTR = brShrunk;
          pBL = tlShrunk;
          pBR = blShrunk;
        }
        
        // Perform baseline PCB crop warp
        const destCanvas = document.createElement('canvas');
        destCanvas.width = outW;
        destCanvas.height = outH;
        const destCtx = destCanvas.getContext('2d', { willReadFrequently: true });
        const destImgData = destCtx.createImageData(outW, outH);
        const destPixels = destImgData.data;
        
        const srcCorners = [pTL, pTR, pBL, pBR];
        const destCorners = [
          { x: 0, y: 0 },
          { x: outW - 1, y: 0 },
          { x: 0, y: outH - 1 },
          { x: outW - 1, y: outH - 1 }
        ];
        
        const H = window.getHomography(srcCorners, destCorners);
        
        for (let v = 0; v < outH; v++) {
          for (let u = 0; u < outW; u++) {
            const denom = H[6] * u + H[7] * v + H[8];
            const srcX = Math.round((H[0] * u + H[1] * v + H[2]) / denom);
            const srcY = Math.round((H[3] * u + H[4] * v + H[5]) / denom);
            
            const destIdx = (v * outW + u) * 4;
            if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
              const srcIdx = (srcY * w + srcX) * 4;
              destPixels[destIdx] = data[srcIdx];
              destPixels[destIdx+1] = data[srcIdx+1];
              destPixels[destIdx+2] = data[srcIdx+2];
              destPixels[destIdx+3] = data[srcIdx+3];
            } else {
              destPixels[destIdx+3] = 0;
            }
          }
        }
        destCtx.putImageData(destImgData, 0, 0);
        
        // --- PASS 6: Fine-Tuning Rotation and Shear Optimization ---
        let bestFineAngle = 0;
        let bestFineShear = 0;
        let maxVar = 0;
        let totalVar = 0;
        let varCount = 0;
        
        const fineCanvas = document.createElement('canvas');
        fineCanvas.width = outW;
        fineCanvas.height = outH;
        const fineCtx = fineCanvas.getContext('2d', { willReadFrequently: true });
        
        const innerStart = Math.round(outW * 0.1);
        const innerEnd = Math.round(outW * 0.9);
        
        for (let angle = -3.0; angle <= 3.0; angle += 0.2) {
          const aRad = (angle * Math.PI) / 180;
          for (let shear = -0.05; shear <= 0.05; shear += 0.005) {
            fineCtx.clearRect(0, 0, outW, outH);
            fineCtx.save();
            fineCtx.translate(outW / 2, outH / 2);
            fineCtx.rotate(aRad);
            fineCtx.drawImage(destCanvas, -outW / 2, -outH / 2);
            fineCtx.restore();
            
            const sheared = window.processPerspectiveWarp(fineCanvas, 0, shear);
            const warpedData = sheared.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, outW, outH).data;
            
            const colGradients = new Array(outW).fill(0);
            for (let y = Math.round(outH * 0.15); y < Math.round(outH * 0.85); y++) {
              for (let x = innerStart; x < innerEnd; x++) {
                const idx = (y * outW + x) * 4;
                const idxRight = (y * outW + x + 1) * 4;
                if (warpedData[idx+3] < 50 || warpedData[idxRight+3] < 50) continue;
                
                const b1 = (warpedData[idx] + warpedData[idx+1] + warpedData[idx+2]) / 3;
                const b2 = (warpedData[idxRight] + warpedData[idxRight+1] + warpedData[idxRight+2]) / 3;
                colGradients[x] += Math.abs(b2 - b1);
              }
            }
            
            const subGradients = colGradients.slice(innerStart, innerEnd);
            const mean = subGradients.reduce((a, b) => a + b, 0) / subGradients.length;
            const variance = subGradients.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / subGradients.length;
            
            totalVar += variance;
            varCount++;
            
            if (variance > maxVar) {
              maxVar = variance;
              bestFineAngle = angle;
              bestFineShear = shear;
            }
          }
        }
        
        const avgVar = varCount > 0 ? (totalVar / varCount) : 1;
        const confidenceRatio = maxVar / avgVar;
        console.log("Optimal fine rotation:", bestFineAngle, "fine shear:", bestFineShear, "Confidence ratio:", confidenceRatio.toFixed(3));
        
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = outW;
        finalCanvas.height = outH;
        const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });
        
        finalCtx.clearRect(0, 0, outW, outH);
        finalCtx.save();
        finalCtx.translate(outW / 2, outH / 2);
        finalCtx.rotate((bestFineAngle * Math.PI) / 180);
        finalCtx.drawImage(destCanvas, -outW / 2, -outH / 2);
        finalCtx.restore();
        
        const finalWarped = window.processPerspectiveWarp(finalCanvas, 0, bestFineShear);
        
        // --- SECOND WARP: Warp the ENTIRE original image using the same homography! ---
        const invH = window.invertHomography(H);
        
        const mapPoint = (ih, px, py) => {
          const denom = ih[6] * px + ih[7] * py + ih[8];
          return {
            x: (ih[0] * px + ih[1] * py + ih[2]) / denom,
            y: (ih[3] * px + ih[4] * py + ih[5]) / denom
          };
        };
        
        const imgCorners = [
          mapPoint(invH, 0, 0),
          mapPoint(invH, w - 1, 0),
          mapPoint(invH, 0, h - 1),
          mapPoint(invH, w - 1, h - 1)
        ];
        
        const minU = Math.min(...imgCorners.map(c => c.x));
        const maxU = Math.max(...imgCorners.map(c => c.x));
        const minV = Math.min(...imgCorners.map(c => c.y));
        const maxV = Math.max(...imgCorners.map(c => c.y));
        
        const fullW = Math.round(maxU - minU);
        const fullH = Math.round(maxV - minV);
        
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = fullW;
        fullCanvas.height = fullH;
        const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
        const fullImgData = fullCtx.createImageData(fullW, fullH);
        const fullPixels = fullImgData.data;
        
        for (let v = 0; v < fullH; v++) {
          for (let u = 0; u < fullW; u++) {
            const destU = u + minU;
            const destV = v + minV;
            
            const denom = H[6] * destU + H[7] * destV + H[8];
            const srcX = Math.round((H[0] * destU + H[1] * destV + H[2]) / denom);
            const srcY = Math.round((H[3] * destU + H[4] * destV + H[5]) / denom);
            
            const destIdx = (v * fullW + u) * 4;
            if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
              const srcIdx = (srcY * w + srcX) * 4;
              fullPixels[destIdx] = data[srcIdx];
              fullPixels[destIdx+1] = data[srcIdx+1];
              fullPixels[destIdx+2] = data[srcIdx+2];
              fullPixels[destIdx+3] = data[srcIdx+3];
            } else {
              fullPixels[destIdx+3] = 0;
            }
          }
        }
        fullCtx.putImageData(fullImgData, 0, 0);
        
        const finalFullCanvas = document.createElement('canvas');
        finalFullCanvas.width = fullW;
        finalFullCanvas.height = fullH;
        const finalFullCtx = finalFullCanvas.getContext('2d', { willReadFrequently: true });
        
        finalFullCtx.clearRect(0, 0, fullW, fullH);
        finalFullCtx.save();
        finalFullCtx.translate(fullW / 2, fullH / 2);
        finalFullCtx.rotate((bestFineAngle * Math.PI) / 180);
        finalFullCtx.drawImage(fullCanvas, -fullW / 2, -fullH / 2);
        finalFullCtx.restore();
        
        const finalFullWarped = window.processPerspectiveWarp(finalFullCanvas, 0, bestFineShear);
        
        // --- PASS 7: Crop to Peripheral Bounds ---
        // Find the bounding box of all active foreground pixels in the warped image
        const finalFullWarpedCtx = finalFullWarped.getContext('2d', { willReadFrequently: true });
        const finalFullData = finalFullWarpedCtx.getImageData(0, 0, fullW, fullH).data;
        
        let activeMinU = fullW, activeMaxU = 0;
        let activeMinV = fullH, activeMaxV = 0;
        let hasActive = false;
        
        for (let v = 0; v < fullH; v++) {
          for (let u = 0; u < fullW; u++) {
            const idx = (v * fullW + u) * 4;
            if (finalFullData[idx+3] >= 50) { // Active pixel (not transparent)
              if (u < activeMinU) activeMinU = u;
              if (u > activeMaxU) activeMaxU = u;
              if (v < activeMinV) activeMinV = v;
              if (v > activeMaxV) activeMaxV = v;
              hasActive = true;
            }
          }
        }
        
        if (!hasActive) {
          activeMinU = 0; activeMaxU = fullW - 1;
          activeMinV = 0; activeMaxV = fullH - 1;
        }
        
        // Add a tiny padding margin around the peripheral crop (e.g. 5 pixels)
        const cropMargin = 5;
        const cropU = Math.max(0, activeMinU - cropMargin);
        const cropV = Math.max(0, activeMinV - cropMargin);
        const cropW = Math.min(fullW - cropU, (activeMaxU - activeMinU + 1) + 2 * cropMargin);
        const cropH = Math.min(fullH - cropV, (activeMaxV - activeMinV + 1) + 2 * cropMargin);
        
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropW;
        croppedCanvas.height = cropH;
        const croppedCtx = croppedCanvas.getContext('2d', { willReadFrequently: true });
        croppedCtx.drawImage(finalFullWarped, cropU, cropV, cropW, cropH, 0, 0, cropW, cropH);
        
        // Recalculate original PCB's bounds relative to this new cropped canvas
        const pcbLeftRel = Math.round(0 - minU);
        const pcbTopRel = Math.round(0 - minV);
        
        // Shift them by the crop origin
        const finalPcbLeft = pcbLeftRel - cropU;
        const finalPcbTop = pcbTopRel - cropV;
        
        return {
          width: outW,
          height: outH,
          dataUrl: finalWarped.toDataURL(),
          fullWidth: cropW,
          fullHeight: cropH,
          fullDataUrl: croppedCanvas.toDataURL(),
          pcbBounds: {
            left: finalPcbLeft,
            top: finalPcbTop,
            width: outW,
            height: outH
          }
        };
      } catch (err) {
        console.error(err);
        return null;
      }
    };
  `;

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.evaluate(pageContextCode);

  try {
    const result = await page.evaluate(async (imgUrl) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            resolve(window.autoCalibrateAndWarp(img, 50));
          } catch(e) {
            reject(e.toString());
          }
        };
        img.onerror = () => reject("Image load failed");
        img.src = imgUrl;
      });
    }, base64Image);

    console.log(`[4/4] Calibration and projective warp succeeded!`);
    console.log(`Output Image Dimensions: ${result.width}x${result.height}`);
    console.log(`Cropped Full Image Dimensions: ${result.fullWidth}x${result.fullHeight}`);
    console.log(`PCB Bounds inside cropped image:`, JSON.stringify(result.pcbBounds));

    const base64Data = result.dataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(OUTPUT_PATH, base64Data, 'base64');
    console.log(`Warped output image saved successfully to: ${OUTPUT_PATH}`);

    const fullBase64Data = result.fullDataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(FULL_OUTPUT_PATH, fullBase64Data, 'base64');
    console.log(`Warped FULL image saved successfully to: ${FULL_OUTPUT_PATH}`);
  } catch (err) {
    console.error(`Calibration runtime error inside page:`, err);
  }

  await browser.close();
}

run();
