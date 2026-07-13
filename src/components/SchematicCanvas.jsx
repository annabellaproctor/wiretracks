import React, { useRef, useEffect, useState } from 'react';
import { findOrthogonalPath } from '../utils/router';
import { Lock, Unlock, Trash2, RotateCw, Settings, Search, Edit3, Navigation, Move, HelpCircle, Type, Square, Ruler, Layers } from 'lucide-react';
import { searchComponentImages, searchJLCPartCode } from '../utils/partsApi';
const processPerspectiveWarp = (srcCanvas, taperFactor = 0, shearFactor = 0) => {
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
    // taperFactor scales horizontal span linearly from top to bottom
    const taper = 1 + taperFactor * (y / h - 0.5);
    // shearFactor shifts rows horizontally relative to center vertical line
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
        destPixels[destIdx+3] = 0; // Out of bounds is transparent
      }
    }
  }
  
  destCtx.putImageData(destData, 0, 0);
  return destCanvas;
};

const processImageBackground = (img, tolerance = 20, doCrop = true, deskewAngle = 0, subCrop = { x: 0, y: 0, w: 100, h: 100 }, taperFactor = 0, shearFactor = 0) => {
  try {
    if (!img || img.naturalWidth === 0) return null;
    
    // 1. First, crop to user-selected sub-region (if not 0, 0, 100, 100)
    let preCropCanvas = document.createElement('canvas');
    let preCropCtx = preCropCanvas.getContext('2d', { willReadFrequently: true });
    
    const sX = subCrop && subCrop.x !== undefined ? subCrop.x : 0;
    const sY = subCrop && subCrop.y !== undefined ? subCrop.y : 0;
    const sW = subCrop && subCrop.w !== undefined ? subCrop.w : 100;
    const sH = subCrop && subCrop.h !== undefined ? subCrop.h : 100;
    
    const cropX = Math.round((sX / 100) * img.naturalWidth);
    const cropY = Math.round((sY / 100) * img.naturalHeight);
    const cropW = Math.max(10, Math.round((sW / 100) * img.naturalWidth));
    const cropH = Math.max(10, Math.round((sH / 100) * img.naturalHeight));
    
    preCropCanvas.width = cropW;
    preCropCanvas.height = cropH;
    preCropCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    
    // 2. Next, rotate/deskew the pre-cropped region
    let workingCanvas = document.createElement('canvas');
    let workingCtx = workingCanvas.getContext('2d', { willReadFrequently: true });
    
    if (deskewAngle !== 0) {
      const angleRad = (deskewAngle * Math.PI) / 180;
      const absCos = Math.abs(Math.cos(angleRad));
      const absSin = Math.abs(Math.sin(angleRad));
      
      const newWidth = Math.round(cropW * absCos + cropH * absSin);
      const newHeight = Math.round(cropW * absSin + cropH * absCos);
      
      workingCanvas.width = newWidth;
      workingCanvas.height = newHeight;
      
      workingCtx.translate(newWidth / 2, newHeight / 2);
      workingCtx.rotate(angleRad);
      workingCtx.drawImage(preCropCanvas, -cropW / 2, -cropH / 2);
    } else {
      workingCanvas.width = cropW;
      workingCanvas.height = cropH;
      workingCtx.drawImage(preCropCanvas, 0, 0);
    }
    
    const imgData = workingCtx.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
    const data = imgData.data;
    
    // Robust perimeter background sampling (immune to local border/text noise)
    const preCropImgData = preCropCtx.getImageData(0, 0, cropW, cropH);
    const preCropPixels = preCropImgData.data;
    
    let sumR = 0, sumG = 0, sumB = 0, sumCount = 0;
    const edgePad = Math.max(2, Math.round(Math.min(cropW, cropH) * 0.02));
    
    // Sample top and bottom rows
    for (let x = edgePad; x < cropW - edgePad; x += Math.max(1, Math.round(cropW / 30))) {
      const idxTop = (edgePad * cropW + x) * 4;
      const idxBot = ((cropH - edgePad - 1) * cropW + x) * 4;
      sumR += preCropPixels[idxTop] + preCropPixels[idxBot];
      sumG += preCropPixels[idxTop+1] + preCropPixels[idxBot+1];
      sumB += preCropPixels[idxTop+2] + preCropPixels[idxBot+2];
      sumCount += 2;
    }
    // Sample left and right columns
    for (let y = edgePad; y < cropH - edgePad; y += Math.max(1, Math.round(cropH / 30))) {
      const idxLeft = (y * cropW + edgePad) * 4;
      const idxRight = (y * cropW + cropW - edgePad - 1) * 4;
      sumR += preCropPixels[idxLeft] + preCropPixels[idxRight];
      sumG += preCropPixels[idxLeft+1] + preCropPixels[idxRight+1];
      sumB += preCropPixels[idxLeft+2] + preCropPixels[idxRight+2];
      sumCount += 2;
    }
    const bgR = sumCount > 0 ? Math.round(sumR / sumCount) : 255;
    const bgG = sumCount > 0 ? Math.round(sumG / sumCount) : 255;
    const bgB = sumCount > 0 ? Math.round(sumB / sumCount) : 255;
    
    if (tolerance > 0) {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const a = data[i+3];
        
        // Skip already transparent pixels from rotation border spacing
        if (a === 0) continue;
        
        const dist = Math.sqrt(
          Math.pow(r - bgR, 2) +
          Math.pow(g - bgG, 2) +
          Math.pow(b - bgB, 2)
        );
        if (dist < tolerance) {
          data[i+3] = 0; // Transparent
        }
      }
      workingCtx.putImageData(imgData, 0, 0);
    }
    
    // Apply perspective taper/shear warp if taperFactor !== 0 or shearFactor !== 0
    if (taperFactor !== 0 || shearFactor !== 0) {
      workingCanvas = processPerspectiveWarp(workingCanvas, taperFactor, shearFactor);
      workingCtx = workingCanvas.getContext('2d', { willReadFrequently: true });
    }
    
    if (doCrop && tolerance > 0) {
      let minX = workingCanvas.width;
      let minY = workingCanvas.height;
      let maxX = 0;
      let maxY = 0;
      let hasPixels = false;
      
      for (let y = 0; y < workingCanvas.height; y++) {
        for (let x = 0; x < workingCanvas.width; x++) {
          const alpha = data[(y * workingCanvas.width + x) * 4 + 3];
          if (alpha > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            hasPixels = true;
          }
        }
      }
      
      if (hasPixels && (minX > 0 || minY > 0 || maxX < workingCanvas.width - 1 || maxY < workingCanvas.height - 1)) {
        const finalW = maxX - minX + 1;
        const finalH = maxY - minY + 1;
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = finalW;
        cropCanvas.height = finalH;
        const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
        cropCtx.drawImage(workingCanvas, minX, minY, finalW, finalH, 0, 0, finalW, finalH);
        return cropCanvas;
      }
    }
    
    return workingCanvas;
  } catch (err) {
    console.error("[processImageBackground] caught CORS or drawing exception:", err);
    return img;
  }
};

const autoCalibrateImageSkin = (img, tolerance = 20) => {
  try {
    if (!img || img.naturalWidth === 0) return null;
    
    // Use a higher resolution (300px max) to preserve the thin header pins!
    const scale = Math.min(1, 300 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    
    const testCanvas = document.createElement('canvas');
    const testCtx = testCanvas.getContext('2d', { willReadFrequently: true });
    
    // --- PASS 1: Rough search (-90 to +90 degrees in 5-degree steps) ---
    let bestAngle = 0;
    let maxVariance = 0;
    
    for (let angle = -90; angle <= 90; angle += 5) {
      const angleRad = (angle * Math.PI) / 180;
      const absCos = Math.abs(Math.cos(angleRad));
      const absSin = Math.abs(Math.sin(angleRad));
      const rotW = Math.round(w * absCos + h * absSin);
      const rotH = Math.round(w * absSin + h * absCos);
      
      testCanvas.width = rotW;
      testCanvas.height = rotH;
      
      testCtx.clearRect(0, 0, rotW, rotH);
      testCtx.save();
      testCtx.translate(rotW / 2, rotH / 2);
      testCtx.rotate(angleRad);
      testCtx.drawImage(img, -w / 2, -h / 2, w, h);
      testCtx.restore();
      
      const imgData = testCtx.getImageData(0, 0, rotW, rotH);
      const data = imgData.data;
      
      // Calculate vertical gradients (horizontal brightness changes)
      const colGradients = new Array(rotW).fill(0);
      for (let y = 0; y < rotH; y++) {
        for (let x = 0; x < rotW - 1; x++) {
          const idx = (y * rotW + x) * 4;
          const idxRight = (y * rotW + x + 1) * 4;
          const b1 = (data[idx] + data[idx+1] + data[idx+2]) / 3;
          const b2 = (data[idxRight] + data[idxRight+1] + data[idxRight+2]) / 3;
          colGradients[x] += Math.abs(b2 - b1);
        }
      }
      
      const mean = colGradients.reduce((a, b) => a + b, 0) / rotW;
      const variance = colGradients.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rotW;
      if (variance > maxVariance) {
        maxVariance = variance;
        bestAngle = angle;
      }
    }
    
    // Early exit check: if rough alignment has very low variance, it is likely not a board/headers drawing
    if (maxVariance < 150) {
      console.log("[autoCalibrateImageSkin] Low rough variance, aborting early:", maxVariance);
      return {
        deskewAngle: 0,
        taperFactor: 0,
        shearFactor: 0,
        subCropX: 0, subCropY: 0, subCropW: 100, subCropH: 100,
        startMargin: 12, endMargin: 88,
        confidence: Math.min(15, Math.round(maxVariance / 10)),
        lowQuality: true
      };
    }
    
    // --- PASS 2: Fine search around bestAngle (-4 to +4 in 0.5-degree steps) ---
    let fineBestAngle = bestAngle;
    for (let angle = bestAngle - 4; angle <= bestAngle + 4; angle += 0.5) {
      const angleRad = (angle * Math.PI) / 180;
      const absCos = Math.abs(Math.cos(angleRad));
      const absSin = Math.abs(Math.sin(angleRad));
      const rotW = Math.round(w * absCos + h * absSin);
      const rotH = Math.round(w * absSin + h * absCos);
      
      testCanvas.width = rotW;
      testCanvas.height = rotH;
      
      testCtx.clearRect(0, 0, rotW, rotH);
      testCtx.save();
      testCtx.translate(rotW / 2, rotH / 2);
      testCtx.rotate(angleRad);
      testCtx.drawImage(img, -w / 2, -h / 2, w, h);
      testCtx.restore();
      
      const imgData = testCtx.getImageData(0, 0, rotW, rotH);
      const data = imgData.data;
      
      const colGradients = new Array(rotW).fill(0);
      for (let y = 0; y < rotH; y++) {
        for (let x = 0; x < rotW - 1; x++) {
          const idx = (y * rotW + x) * 4;
          const idxRight = (y * rotW + x + 1) * 4;
          const b1 = (data[idx] + data[idx+1] + data[idx+2]) / 3;
          const b2 = (data[idxRight] + data[idxRight+1] + data[idxRight+2]) / 3;
          colGradients[x] += Math.abs(b2 - b1);
        }
      }
      
      const mean = colGradients.reduce((a, b) => a + b, 0) / rotW;
      const variance = colGradients.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rotW;
      if (variance > maxVariance) {
        maxVariance = variance;
        fineBestAngle = angle;
      }
    }
    bestAngle = fineBestAngle;
    
    // 2. Perform deskew, transparency keying, and auto-crop to get bounds of the physical board
    let deskewedCanvas = document.createElement('canvas');
    let deskewedCtx = deskewedCanvas.getContext('2d', { willReadFrequently: true });
    
    let angleRad = (bestAngle * Math.PI) / 180;
    let absCos = Math.abs(Math.cos(angleRad));
    let absSin = Math.abs(Math.sin(angleRad));
    let rotW = Math.round(img.naturalWidth * absCos + img.naturalHeight * absSin);
    let rotH = Math.round(img.naturalWidth * absSin + img.naturalHeight * absCos);
    
    deskewedCanvas.width = rotW;
    deskewedCanvas.height = rotH;
    deskewedCtx.translate(rotW / 2, rotH / 2);
    deskewedCtx.rotate(angleRad);
    deskewedCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    
    let rotData = deskewedCtx.getImageData(0, 0, rotW, rotH);
    let rotPixels = rotData.data;
    
    // Robust perimeter background sampling (immune to local border/text noise)
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0, sumCount = 0;
    const edgePad = Math.max(2, Math.round(Math.min(rotW, rotH) * 0.02));
    
    // Sample top and bottom rows
    for (let x = edgePad; x < rotW - edgePad; x += Math.max(1, Math.round(rotW / 30))) {
      const idxTop = (edgePad * rotW + x) * 4;
      const idxBot = ((rotH - edgePad - 1) * rotW + x) * 4;
      sumR += rotPixels[idxTop] + rotPixels[idxBot];
      sumG += rotPixels[idxTop+1] + rotPixels[idxBot+1];
      sumB += rotPixels[idxTop+2] + rotPixels[idxBot+2];
      sumA += rotPixels[idxTop+3] + rotPixels[idxBot+3];
      sumCount += 2;
    }
    // Sample left and right columns
    for (let y = edgePad; y < rotH - edgePad; y += Math.max(1, Math.round(rotH / 30))) {
      const idxLeft = (y * rotW + edgePad) * 4;
      const idxRight = (y * rotW + rotW - edgePad - 1) * 4;
      sumR += rotPixels[idxLeft] + rotPixels[idxRight];
      sumG += rotPixels[idxLeft+1] + rotPixels[idxRight+1];
      sumB += rotPixels[idxLeft+2] + rotPixels[idxRight+2];
      sumA += rotPixels[idxLeft+3] + rotPixels[idxRight+3];
      sumCount += 2;
    }
    const bgR = sumCount > 0 ? Math.round(sumR / sumCount) : 255;
    const bgG = sumCount > 0 ? Math.round(sumG / sumCount) : 255;
    const bgB = sumCount > 0 ? Math.round(sumB / sumCount) : 255;
    const bgA = sumCount > 0 ? Math.round(sumA / sumCount) : 255;
    const isBgTransparent = bgA < 50;
    console.log("[autoCalibrateImageSkin] Detected background color:", bgR, bgG, bgB, "Alpha:", bgA, "Transparent:", isBgTransparent);
    
    let minX = rotW, minY = rotH, maxX = 0, maxY = 0;
    let hasPixels = false;
    
    for (let y = 0; y < rotH; y++) {
      for (let x = 0; x < rotW; x++) {
        const idx = (y * rotW + x) * 4;
        if (rotPixels[idx+3] < 50) continue;
        
        if (!isBgTransparent) {
          const dist = Math.sqrt(
            Math.pow(rotPixels[idx] - bgR, 2) +
            Math.pow(rotPixels[idx+1] - bgG, 2) +
            Math.pow(rotPixels[idx+2] - bgB, 2)
          );
          if (dist < tolerance) continue;
        }
        
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasPixels = true;
      }
    }
    
    let subCrop = { x: 0, y: 0, w: 100, h: 100 };
    if (hasPixels) {
      subCrop = {
        x: Math.round((minX / rotW) * 100),
        y: Math.round((minY / rotH) * 100),
        w: Math.round(((maxX - minX) / rotW) * 100),
        h: Math.round(((maxY - minY) / rotH) * 100)
      };
    }
    
    // Enforce longways-vertical (portrait) layout!
    if (hasPixels && (maxX - minX) > (maxY - minY)) {
      bestAngle = (bestAngle + 90) % 360;
      angleRad = (bestAngle * Math.PI) / 180;
      absCos = Math.abs(Math.cos(angleRad));
      absSin = Math.abs(Math.sin(angleRad));
      rotW = Math.round(img.naturalWidth * absCos + img.naturalHeight * absSin);
      rotH = Math.round(img.naturalWidth * absSin + img.naturalHeight * absCos);
      
      deskewedCanvas = document.createElement('canvas');
      deskewedCanvas.width = rotW;
      deskewedCanvas.height = rotH;
      deskewedCtx = deskewedCanvas.getContext('2d', { willReadFrequently: true });
      deskewedCtx.translate(rotW / 2, rotH / 2);
      deskewedCtx.rotate(angleRad);
      deskewedCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      
      rotData = deskewedCtx.getImageData(0, 0, rotW, rotH);
      rotPixels = rotData.data;
      
      minX = rotW; minY = rotH; maxX = 0; maxY = 0;
      hasPixels = false;
      
      for (let y = 0; y < rotH; y++) {
        for (let x = 0; x < rotW; x++) {
          const idx = (y * rotW + x) * 4;
          if (rotPixels[idx+3] < 50) continue;
          
          if (!isBgTransparent) {
            const dist = Math.sqrt(
              Math.pow(rotPixels[idx] - bgR, 2) +
              Math.pow(rotPixels[idx+1] - bgG, 2) +
              Math.pow(rotPixels[idx+2] - bgB, 2)
            );
            if (dist < tolerance) continue;
          }
          
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasPixels = true;
        }
      }
      
      if (hasPixels) {
        subCrop = {
          x: Math.round((minX / rotW) * 100),
          y: Math.round((minY / rotH) * 100),
          w: Math.round(((maxX - minX) / rotW) * 100),
          h: Math.round(((maxY - minY) / rotH) * 100)
        };
      }
    }
    
    // --- PASS 3: Crop-focused Double-Run Refinement (-3 to +3 in 0.1-degree steps) ---
    // This runs directly on the isolated board region to maximize precision!
    let refineBestAngle = 0;
    let refineMaxVariance = 0;
    
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const cropTestCanvas = document.createElement('canvas');
    cropTestCanvas.width = cropW;
    cropTestCanvas.height = cropH;
    const cropTestCtx = cropTestCanvas.getContext('2d', { willReadFrequently: true });
    cropTestCtx.drawImage(deskewedCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    
    const refScale = Math.min(1, 200 / Math.max(cropW, cropH));
    const refW = Math.round(cropW * refScale);
    const refH = Math.round(cropH * refScale);
    
    const refCanvas = document.createElement('canvas');
    const refCtx = refCanvas.getContext('2d', { willReadFrequently: true });
    
    for (let dAngle = -3; dAngle <= 3; dAngle += 0.1) {
      const angleRadRef = (dAngle * Math.PI) / 180;
      const absCosRef = Math.abs(Math.cos(angleRadRef));
      const absSinRef = Math.abs(Math.sin(angleRadRef));
      const rotWRef = Math.round(refW * absCosRef + refH * absSinRef);
      const rotHRef = Math.round(refW * absSinRef + refH * absCosRef);
      
      refCanvas.width = rotWRef;
      refCanvas.height = rotHRef;
      
      refCtx.clearRect(0, 0, rotWRef, rotHRef);
      refCtx.save();
      refCtx.translate(rotWRef / 2, rotHRef / 2);
      refCtx.rotate(angleRadRef);
      refCtx.drawImage(cropTestCanvas, -refW / 2, -refH / 2, refW, refH);
      refCtx.restore();
      
      const imgDataRef = refCtx.getImageData(0, 0, rotWRef, rotHRef);
      const dataRef = imgDataRef.data;
      
      const colGradientsRef = new Array(rotWRef).fill(0);
      for (let y = Math.round(rotHRef * 0.15); y < Math.round(rotHRef * 0.85); y++) {
        for (let x = 0; x < rotWRef - 1; x++) {
          const idx = (y * rotWRef + x) * 4;
          const idxRight = (y * rotWRef + x + 1) * 4;
          const b1 = (dataRef[idx] + dataRef[idx+1] + dataRef[idx+2]) / 3;
          const b2 = (dataRef[idxRight] + dataRef[idxRight+1] + dataRef[idxRight+2]) / 3;
          colGradientsRef[x] += Math.abs(b2 - b1);
        }
      }
      
      const meanRef = colGradientsRef.reduce((a, b) => a + b, 0) / rotWRef;
      const varianceRef = colGradientsRef.reduce((sum, val) => sum + Math.pow(val - meanRef, 2), 0) / rotWRef;
      if (varianceRef > refineMaxVariance) {
        refineMaxVariance = varianceRef;
        refineBestAngle = dAngle;
      }
    }
    
    // Apply final sub-degree refinement
    bestAngle = (bestAngle + refineBestAngle) % 360;
    
    // Re-crop final board at refined best angle
    angleRad = (bestAngle * Math.PI) / 180;
    absCos = Math.abs(Math.cos(angleRad));
    absSin = Math.abs(Math.sin(angleRad));
    rotW = Math.round(img.naturalWidth * absCos + img.naturalHeight * absSin);
    rotH = Math.round(img.naturalWidth * absSin + img.naturalHeight * absCos);
    
    deskewedCanvas = document.createElement('canvas');
    deskewedCanvas.width = rotW;
    deskewedCanvas.height = rotH;
    deskewedCtx = deskewedCanvas.getContext('2d', { willReadFrequently: true });
    deskewedCtx.translate(rotW / 2, rotH / 2);
    deskewedCtx.rotate(angleRad);
    deskewedCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    
    rotData = deskewedCtx.getImageData(0, 0, rotW, rotH);
    rotPixels = rotData.data;
    
    minX = rotW; minY = rotH; maxX = 0; maxY = 0;
    hasPixels = false;
    
    for (let y = 0; y < rotH; y++) {
      for (let x = 0; x < rotW; x++) {
        const idx = (y * rotW + x) * 4;
        if (rotPixels[idx+3] < 50) continue;
        
        if (!isBgTransparent) {
          const dist = Math.sqrt(
            Math.pow(rotPixels[idx] - bgR, 2) +
            Math.pow(rotPixels[idx+1] - bgG, 2) +
            Math.pow(rotPixels[idx+2] - bgB, 2)
          );
          if (dist < tolerance) continue;
        }
        
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasPixels = true;
      }
    }
    
    if (hasPixels) {
      subCrop = {
        x: Math.round((minX / rotW) * 100),
        y: Math.round((minY / rotH) * 100),
        w: Math.round(((maxX - minX) / rotW) * 100),
        h: Math.round(((maxY - minY) / rotH) * 100)
      };
    }
    
    // 3. Find left/right margins for pin headers in the cropped image
    const finalW = maxX - minX + 1;
    const finalH = maxY - minY + 1;
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = finalW;
    boardCanvas.height = finalH;
    const boardCtx = boardCanvas.getContext('2d', { willReadFrequently: true });
    boardCtx.drawImage(deskewedCanvas, minX, minY, finalW, finalH, 0, 0, finalW, finalH);
    
    const boardData = boardCtx.getImageData(0, 0, finalW, finalH).data;
    
    const colContrast = new Array(finalW).fill(0);
    for (let x = 0; x < finalW; x++) {
      for (let y = 1; y < finalH - 1; y++) {
        const idx = (y * finalW + x) * 4;
        const idxAbove = ((y - 1) * finalW + x) * 4;
        const diff = Math.abs(boardData[idx] - boardData[idxAbove]) + 
                     Math.abs(boardData[idx+1] - boardData[idxAbove+1]) + 
                     Math.abs(boardData[idx+2] - boardData[idxAbove+2]);
        colContrast[x] += diff;
      }
    }
    
    const smooth = [...colContrast];
    for (let i = 2; i < finalW - 2; i++) {
      smooth[i] = (colContrast[i-2] + colContrast[i-1] + colContrast[i] + colContrast[i+1] + colContrast[i+2]) / 5;
    }
    
    let leftPeakIdx = Math.round(finalW * 0.12);
    let leftMax = 0;
    for (let x = Math.round(finalW * 0.05); x < Math.round(finalW * 0.40); x++) {
      if (smooth[x] > leftMax) {
        leftMax = smooth[x];
        leftPeakIdx = x;
      }
    }
    
    let rightPeakIdx = Math.round(finalW * 0.88);
    let rightMax = 0;
    for (let x = Math.round(finalW * 0.60); x < Math.round(finalW * 0.95); x++) {
      if (smooth[x] > rightMax) {
        rightMax = smooth[x];
        rightPeakIdx = x;
      }
    }
    
    const startMargin = Math.round((leftPeakIdx / finalW) * 100);
    const endMargin = Math.round((rightPeakIdx / finalW) * 100);
    
    // --- PASS 4: Perspective Taper Correction Search ---
    let bestTaper = 0;
    let maxTaperVariance = 0;
    
    const warpTestCanvas = document.createElement('canvas');
    warpTestCanvas.width = finalW;
    warpTestCanvas.height = finalH;
    const warpTestCtx = warpTestCanvas.getContext('2d', { willReadFrequently: true });
    warpTestCtx.drawImage(deskewedCanvas, minX, minY, finalW, finalH, 0, 0, finalW, finalH);
    
    const innerStart = Math.round(finalW * 0.1);
    const innerEnd = Math.round(finalW * 0.9);
    
    for (let taper = -0.35; taper <= 0.35; taper += 0.01) {
      const warped = processPerspectiveWarp(warpTestCanvas, taper, 0);
      const warpedData = warped.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, finalW, finalH).data;
      
      const colGradients = new Array(finalW).fill(0);
      for (let y = Math.round(finalH * 0.15); y < Math.round(finalH * 0.85); y++) {
        for (let x = innerStart; x < innerEnd; x++) {
          const idx = (y * finalW + x) * 4;
          const idxRight = (y * finalW + x + 1) * 4;
          if (warpedData[idx+3] < 50 || warpedData[idxRight+3] < 50) continue;
          
          const b1 = (warpedData[idx] + warpedData[idx+1] + warpedData[idx+2]) / 3;
          const b2 = (warpedData[idxRight] + warpedData[idxRight+1] + warpedData[idxRight+2]) / 3;
          colGradients[x] += Math.abs(b2 - b1);
        }
      }
      
      const subGradients = colGradients.slice(innerStart, innerEnd);
      const mean = subGradients.reduce((a, b) => a + b, 0) / subGradients.length;
      const variance = subGradients.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / subGradients.length;
      
      if (variance > maxTaperVariance) {
        maxTaperVariance = variance;
        bestTaper = taper;
      }
    }
    
    // --- PASS 5: Perspective Shear Correction Search ---
    let bestShear = 0;
    let maxShearVariance = 0;
    
    for (let shear = -0.20; shear <= 0.20; shear += 0.01) {
      const warped = processPerspectiveWarp(warpTestCanvas, bestTaper, shear);
      const warpedData = warped.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, finalW, finalH).data;
      
      const colGradients = new Array(finalW).fill(0);
      for (let y = Math.round(finalH * 0.15); y < Math.round(finalH * 0.85); y++) {
        for (let x = innerStart; x < innerEnd; x++) {
          const idx = (y * finalW + x) * 4;
          const idxRight = (y * finalW + x + 1) * 4;
          if (warpedData[idx+3] < 50 || warpedData[idxRight+3] < 50) continue;
          
          const b1 = (warpedData[idx] + warpedData[idx+1] + warpedData[idx+2]) / 3;
          const b2 = (warpedData[idxRight] + warpedData[idxRight+1] + warpedData[idxRight+2]) / 3;
          colGradients[x] += Math.abs(b2 - b1);
        }
      }
      
      const subGradients = colGradients.slice(innerStart, innerEnd);
      const mean = subGradients.reduce((a, b) => a + b, 0) / subGradients.length;
      const variance = subGradients.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / subGradients.length;
      
      if (variance > maxShearVariance) {
        maxShearVariance = variance;
        bestShear = shear;
      }
    }
    
    // --- PASS 6: Final Fine Rotation Refinement ---
    let finalFineAngle = 0;
    let maxFineVariance = 0;
    
    const fineTestCanvas = document.createElement('canvas');
    fineTestCanvas.width = finalW;
    fineTestCanvas.height = finalH;
    const fineTestCtx = fineTestCanvas.getContext('2d', { willReadFrequently: true });
    
    const warpedBoard = processPerspectiveWarp(warpTestCanvas, bestTaper, bestShear);
    
    for (let fineAngle = -1.5; fineAngle <= 1.5; fineAngle += 0.1) {
      const fineAngleRad = (fineAngle * Math.PI) / 180;
      fineTestCanvas.width = finalW;
      fineTestCanvas.height = finalH;
      fineTestCtx.clearRect(0, 0, finalW, finalH);
      fineTestCtx.save();
      fineTestCtx.translate(finalW / 2, finalH / 2);
      fineTestCtx.rotate(fineAngleRad);
      fineTestCtx.drawImage(warpedBoard, -finalW / 2, -finalH / 2);
      fineTestCtx.restore();
      
      const warpedData = fineTestCtx.getImageData(0, 0, finalW, finalH).data;
      
      const colGradients = new Array(finalW).fill(0);
      for (let y = Math.round(finalH * 0.15); y < Math.round(finalH * 0.85); y++) {
        for (let x = innerStart; x < innerEnd; x++) {
          const idx = (y * finalW + x) * 4;
          const idxRight = (y * finalW + x + 1) * 4;
          if (warpedData[idx+3] < 50 || warpedData[idxRight+3] < 50) continue;
          
          const b1 = (warpedData[idx] + warpedData[idx+1] + warpedData[idx+2]) / 3;
          const b2 = (warpedData[idxRight] + warpedData[idxRight+1] + warpedData[idxRight+2]) / 3;
          colGradients[x] += Math.abs(b2 - b1);
        }
      }
      
      const subGradients = colGradients.slice(innerStart, innerEnd);
      const mean = subGradients.reduce((a, b) => a + b, 0) / subGradients.length;
      const variance = subGradients.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / subGradients.length;
      
      if (variance > maxFineVariance) {
        maxFineVariance = variance;
        finalFineAngle = fineAngle;
      }
    }
    
    bestAngle = bestAngle + finalFineAngle;
    
    return {
      deskewAngle: bestAngle,
      taperFactor: bestTaper,
      shearFactor: bestShear,
      subCropX: subCrop.x,
      subCropY: subCrop.y,
      subCropW: subCrop.w,
      subCropH: subCrop.h,
      startMargin: Math.max(1, startMargin),
      endMargin: Math.min(99, endMargin),
      confidence: Math.min(100, Math.round((maxFineVariance || 0) / 100))
    };
  } catch (err) {
    console.error("[autoCalibrateImageSkin] failed:", err);
    return null;
  }
};

const compressImageToDataUrl = (imageUrl, maxWidth = 250, quality = 0.6) => {
  return new Promise((resolve) => {
    if (!imageUrl) return resolve(null);
    if (imageUrl.startsWith('data:')) return resolve(imageUrl);
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        
        if (width > maxWidth || height > maxWidth) {
          const ratio = Math.min(maxWidth / width, maxWidth / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      } catch (e) {
        console.error('[Compression] failed to read pixels:', e);
        resolve(imageUrl);
      }
    };
    img.onerror = () => {
      console.error('[Compression] failed to load image:', imageUrl);
      resolve(imageUrl);
    };
  });
};

const distributePinsBySides = (pins, sidesMap, pitch, width, height, pinOffsets = {}) => {
  const leftPins = pins.filter(p => sidesMap[p.name] === 'left');
  const rightPins = pins.filter(p => sidesMap[p.name] === 'right');
  const topPins = pins.filter(p => sidesMap[p.name] === 'top');
  const bottomPins = pins.filter(p => sidesMap[p.name] === 'bottom');
  
  const result = [];
  
  leftPins.forEach((p, i) => {
    const defaultY = i * pitch + 15;
    let customY = pinOffsets[p.name] !== undefined ? pinOffsets[p.name] : defaultY;
    customY = Math.max(8, Math.min(height - 8, customY));
    result.push({
      ...p,
      x: 0,
      y: customY,
      dir: 'left'
    });
  });
  
  rightPins.forEach((p, i) => {
    const defaultY = i * pitch + 15;
    let customY = pinOffsets[p.name] !== undefined ? pinOffsets[p.name] : defaultY;
    customY = Math.max(8, Math.min(height - 8, customY));
    result.push({
      ...p,
      x: width,
      y: customY,
      dir: 'right'
    });
  });
  
  topPins.forEach((p, i) => {
    const defaultX = i * pitch + 15;
    let customX = pinOffsets[p.name] !== undefined ? pinOffsets[p.name] : defaultX;
    customX = Math.max(8, Math.min(width - 8, customX));
    result.push({
      ...p,
      x: customX,
      y: 0,
      dir: 'up'
    });
  });
  
  bottomPins.forEach((p, i) => {
    const defaultX = i * pitch + 15;
    let customX = pinOffsets[p.name] !== undefined ? pinOffsets[p.name] : defaultX;
    customX = Math.max(8, Math.min(width - 8, customX));
    result.push({
      ...p,
      x: customX,
      y: height,
      dir: 'down'
    });
  });
  
  return result;
};

export default function SchematicCanvas({
  components,
  setComponents,
  traces,
  setTraces,
  customTexts,
  setCustomTexts,
  customShapes,
  setCustomShapes,
  selectedComponentId,
  setSelectedComponentId,
  selectedTraceId,
  setSelectedTraceId,
  cameraTarget,
  setCameraTarget,
  gridSize = 15,
  layersVisibility
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // Transform and size states
  const [pan, setPan] = useState({ x: 100, y: 80 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Toolbelt: 'select', 'pan', 'wire', 'text', 'shape', 'ruler', 'eraser'
  const [activeTool, setActiveTool] = useState('select'); 
  const [spacePressed, setSpacePressed] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); 
  const [skinPicker, setSkinPicker] = useState(null); // { compId, partNumber, images: [], selectedUrl: '', customUrl: '', loading: false }
  const [visibleCount, setVisibleCount] = useState(12);

  const imageCache = useRef({});
  const previewCanvasRef = useRef(null);
  const [prevZoom, setPrevZoom] = useState(1);
  const [prevPan, setPrevPan] = useState({ x: 0, y: 0 });
  const [isPrevPanning, setIsPrevPanning] = useState(false);
  const [prevPanStart, setPrevPanStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!skinPicker || !previewCanvasRef.current) return;
    const canvasEl = previewCanvasRef.current;
    const ctx = canvasEl.getContext('2d');
    const imgUrl = skinPicker.customUrl || skinPicker.selectedUrl;
    
    const finalPins = distributePinsBySides(
      skinPicker.rawPins,
      skinPicker.sidesMap,
      skinPicker.pitch,
      skinPicker.width,
      skinPicker.height,
      skinPicker.pinOffsets
    );
    
    const drawPreview = (processedImg) => {
      canvasEl.width = canvasEl.clientWidth || 300;
      canvasEl.height = canvasEl.clientHeight || 160;
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      
      ctx.save();
      // Apply preview zoom and pan matrix
      ctx.translate(canvasEl.width / 2 + prevPan.x, canvasEl.height / 2 + prevPan.y);
      ctx.scale(prevZoom, prevZoom);
      ctx.translate(-canvasEl.width / 2, -canvasEl.height / 2);
      
      const boundsW = skinPicker.width + 40;
      const boundsH = skinPicker.height + 40;
      const scale = Math.min(canvasEl.width / boundsW, canvasEl.height / boundsH) * 0.92;
      
      const ox = (canvasEl.width - skinPicker.width * scale) / 2;
      const oy = (canvasEl.height - skinPicker.height * scale) / 2;
      
      if (processedImg) {
        ctx.save();
        ctx.globalAlpha = skinPicker.opacity;
        
        const pcx = ox + (skinPicker.width * scale) / 2;
        const pcy = oy + (skinPicker.height * scale) / 2;
        
        ctx.translate(pcx, pcy);
        
        const flipH = skinPicker.flipH || false;
        const flipV = skinPicker.flipV || false;
        const rot = skinPicker.rotation || 0;
        const aspect = skinPicker.aspect || 'stretch';
        
        if (flipH) ctx.scale(-1, 1);
        if (flipV) ctx.scale(1, -1);
        if (rot !== 0) ctx.rotate((rot * Math.PI) / 180);
        
        let drawW = skinPicker.width * scale;
        let drawH = skinPicker.height * scale;
        let dx = -drawW / 2;
        let dy = -drawH / 2;
        
        if (aspect === 'fit' || aspect === 'fill') {
          const imgRatio = processedImg.width / processedImg.height;
          const compRatio = skinPicker.width / skinPicker.height;
          
          if (aspect === 'fit') {
            if (imgRatio > compRatio) {
              drawW = skinPicker.width * scale;
              drawH = (skinPicker.width * scale) / imgRatio;
            } else {
              drawH = skinPicker.height * scale;
              drawW = (skinPicker.height * scale) * imgRatio;
            }
          } else { // fill
            if (imgRatio > compRatio) {
              drawH = skinPicker.height * scale;
              drawW = (skinPicker.height * scale) * imgRatio;
            } else {
              drawW = skinPicker.width * scale;
              drawH = (skinPicker.width * scale) / imgRatio;
            }
          }
          dx = -drawW / 2;
          dy = -drawH / 2;
        }
        
        ctx.drawImage(processedImg, dx, dy, drawW, drawH);
        ctx.restore();
      }
      
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox, oy, skinPicker.width * scale, skinPicker.height * scale);
      
      finalPins.forEach(pin => {
        const px = ox + pin.x * scale;
        const py = oy + pin.y * scale;
        
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        let tx = px;
        let ty = py;
        const pinLen = 6 * scale;
        if (pin.dir === 'left') tx -= pinLen;
        else if (pin.dir === 'right') tx += pinLen;
        else if (pin.dir === 'up') ty -= pinLen;
        else if (pin.dir === 'down') ty += pinLen;
        ctx.lineTo(tx, ty);
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#334155';
        ctx.beginPath();
        ctx.arc(tx, ty, 2 * scale, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        ctx.font = `${Math.max(5, Math.round(6 * scale))}px monospace`;
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = pin.dir === 'left' ? 'left' : (pin.dir === 'right' ? 'right' : 'center');
        
        let labelX = px;
        let labelY = py + 2.5 * scale;
        const textMargin = 3 * scale;
        if (pin.dir === 'left') labelX += textMargin;
        else if (pin.dir === 'right') labelX -= textMargin;
        else if (pin.dir === 'up') labelY += textMargin + 2 * scale;
        else if (pin.dir === 'down') labelY -= textMargin;
        ctx.fillText(pin.name, labelX, labelY);
      });

      // Draw Visual Bezel Margin Guidelines
      const startPct = (skinPicker.startMargin !== undefined ? skinPicker.startMargin : 12) / 100;
      const endPct = (skinPicker.endMargin !== undefined ? skinPicker.endMargin : 88) / 100;
      
      const leftCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'left').length;
      const rightCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'right').length;
      const topCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'top').length;
      const bottomCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'bottom').length;
      
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      
      const hasVerticalPins = leftCount > 0 || rightCount > 0;
      const hasHorizontalPins = topCount > 0 || bottomCount > 0;
      
      if (hasVerticalPins) {
        // Draw horizontal dashed lines at start and end bounds
        const startY = oy + skinPicker.height * scale * startPct;
        const endY = oy + skinPicker.height * scale * endPct;
        
        ctx.strokeStyle = '#f97316'; // Orange for start boundary
        ctx.beginPath();
        ctx.moveTo(ox - 15, startY);
        ctx.lineTo(ox + skinPicker.width * scale + 15, startY);
        ctx.stroke();
        
        ctx.strokeStyle = '#a855f7'; // Purple for end boundary
        ctx.beginPath();
        ctx.moveTo(ox - 15, endY);
        ctx.lineTo(ox + skinPicker.width * scale + 15, endY);
        ctx.stroke();
        
        // Draw helpful margin text tags
        ctx.font = `${Math.max(6, Math.round(7 * scale))}px sans-serif`;
        ctx.fillStyle = '#f97316';
        ctx.textAlign = 'right';
        ctx.fillText(`Bezel Start: ${Math.round(startPct * 100)}%`, ox - 20, startY + 3);
        
        ctx.fillStyle = '#a855f7';
        ctx.fillText(`Bezel End: ${Math.round(endPct * 100)}%`, ox - 20, endY + 3);
      }
      
      if (hasHorizontalPins) {
        // Draw vertical dashed lines
        const startX = ox + skinPicker.width * scale * startPct;
        const endX = ox + skinPicker.width * scale * endPct;
        
        ctx.strokeStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(startX, oy - 15);
        ctx.lineTo(startX, oy + skinPicker.height * scale + 15);
        ctx.stroke();
        
        ctx.strokeStyle = '#a855f7';
        ctx.beginPath();
        ctx.moveTo(endX, oy - 15);
        ctx.lineTo(endX, oy + skinPicker.height * scale + 15);
        ctx.stroke();
      }
      
      ctx.restore();
      ctx.restore();
    };
    
    if (imgUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imgUrl.startsWith('data:') ? imgUrl : `/api/proxy-image?url=${encodeURIComponent(imgUrl)}`;
      img.onload = () => {
        const processed = processImageBackground(
          img,
          skinPicker.tolerance,
          skinPicker.doCrop,
          skinPicker.deskewAngle || 0,
          {
            x: skinPicker.subCropX !== undefined ? skinPicker.subCropX : 0,
            y: skinPicker.subCropY !== undefined ? skinPicker.subCropY : 0,
            w: skinPicker.subCropW !== undefined ? skinPicker.subCropW : 100,
            h: skinPicker.subCropH !== undefined ? skinPicker.subCropH : 100
          },
          skinPicker.taperFactor || 0,
          skinPicker.shearFactor || 0
        );
        
        // Auto-fit component dimensions to fit image aspect ratio NICELY without whitespace (horizontally or vertically)
        if (skinPicker.lastLoadedUrl !== imgUrl) {
          const cal = autoCalibrateImageSkin(img, skinPicker.tolerance);
          
          let activeDeskew = skinPicker.deskewAngle || 0;
          let activeSubCropX = skinPicker.subCropX !== undefined ? skinPicker.subCropX : 0;
          let activeSubCropY = skinPicker.subCropY !== undefined ? skinPicker.subCropY : 0;
          let activeSubCropW = skinPicker.subCropW !== undefined ? skinPicker.subCropW : 100;
          let activeSubCropH = skinPicker.subCropH !== undefined ? skinPicker.subCropH : 100;
          let activeStartMargin = skinPicker.startMargin !== undefined ? skinPicker.startMargin : 12;
          let activeEndMargin = skinPicker.endMargin !== undefined ? skinPicker.endMargin : 88;
          let activeTaper = skinPicker.taperFactor || 0;
          let activeShear = skinPicker.shearFactor || 0;
          
          if (cal) {
            activeDeskew = cal.deskewAngle;
            activeSubCropX = cal.subCropX;
            activeSubCropY = cal.subCropY;
            activeSubCropW = cal.subCropW;
            activeSubCropH = cal.subCropH;
            activeStartMargin = cal.startMargin;
            activeEndMargin = cal.endMargin;
            activeTaper = cal.taperFactor;
            activeShear = cal.shearFactor;
          }
          
          const autoProcessed = processImageBackground(
            img,
            skinPicker.tolerance,
            skinPicker.doCrop,
            activeDeskew,
            { x: activeSubCropX, y: activeSubCropY, w: activeSubCropW, h: activeSubCropH },
            activeTaper,
            activeShear
          );
          
          const imgRatio = autoProcessed.width / autoProcessed.height;
          const leftCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'left').length;
          const rightCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'right').length;
          const topCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'top').length;
          const bottomCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'bottom').length;
          
          let newH = skinPicker.height;
          let newW = skinPicker.width;
          
          if (imgRatio < 1) { // Vertical board
            newH = Math.max(60, Math.max(leftCount, rightCount) * skinPicker.pitch + 30);
            newW = Math.max(60, Math.round((newH * imgRatio) / 15) * 15);
          } else { // Horizontal board
            newW = Math.max(60, Math.max(topCount, bottomCount) * skinPicker.pitch + 30);
            newH = Math.max(60, Math.round((newW / imgRatio) / 15) * 15);
          }
          
          // --- AUTOMATIC COMPUTER VISION ALIGNMENT ON LOAD ---
          const w = autoProcessed.width;
          const h = autoProcessed.height;
          const ctxOff = autoProcessed.getContext('2d', { willReadFrequently: true });
          const imgData = ctxOff.getImageData(0, 0, w, h);
          
          const leftPins = skinPicker.rawPins.filter(p => skinPicker.sidesMap[p.name] === 'left');
          const rightPins = skinPicker.rawPins.filter(p => skinPicker.sidesMap[p.name] === 'right');
          const topPins = skinPicker.rawPins.filter(p => skinPicker.sidesMap[p.name] === 'top');
          const bottomPins = skinPicker.rawPins.filter(p => skinPicker.sidesMap[p.name] === 'bottom');
          
          const nextOffsets = { ...skinPicker.pinOffsets };
          const startPctVal = activeStartMargin / 100;
          const endPctVal = activeEndMargin / 100;
          
          const detectPeaks = (sidePins, side, limit) => {
            if (sidePins.length === 0) return;
            let startX, endX, startY, endY;
            const intensities = [];
            
            if (side === 'left' || side === 'right') {
              if (side === 'left') {
                startX = Math.round(w * 0.04);
                endX = Math.round(w * 0.16);
              } else {
                startX = Math.round(w * 0.84);
                endX = Math.round(w * 0.96);
              }
              const stripW = Math.max(1, endX - startX);
              for (let y = 0; y < h; y++) {
                let sum = 0;
                for (let x = startX; x < endX; x++) {
                  const idx = (y * w + x) * 4;
                  sum += 0.299 * imgData.data[idx] + 0.587 * imgData.data[idx + 1] + 0.114 * imgData.data[idx + 2];
                }
                intensities.push(sum / stripW);
              }
            } else {
              if (side === 'top') {
                startY = Math.round(h * 0.04);
                endY = Math.round(h * 0.16);
              } else {
                startY = Math.round(h * 0.84);
                endY = Math.round(h * 0.96);
              }
              const stripH = Math.max(1, endY - startY);
              for (let x = 0; x < w; x++) {
                let sum = 0;
                for (let y = startY; y < endY; y++) {
                  const idx = (y * w + x) * 4;
                  sum += 0.299 * imgData.data[idx] + 0.587 * imgData.data[idx + 1] + 0.114 * imgData.data[idx + 2];
                }
                intensities.push(sum / stripH);
              }
            }
            
            const signalLen = intensities.length;
            const peaks = [];
            for (let idx = 5; idx < signalLen - 5; idx++) {
              const val = intensities[idx];
              let isMax = true;
              let isMin = true;
              const windowSize = Math.max(3, Math.round(signalLen / (sidePins.length * 2.5)));
              for (let di = -windowSize; di <= windowSize; di++) {
                if (di === 0) continue;
                if (intensities[idx + di] >= val) isMax = false;
                if (intensities[idx + di] <= val) isMin = false;
              }
              if (isMax || isMin) peaks.push(idx);
            }
            
            let firstPeak = Math.round(signalLen * startPctVal);
            let lastPeak = Math.round(signalLen * endPctVal);
            if (peaks.length >= 2) {
              peaks.sort((a, b) => a - b);
              firstPeak = peaks[0];
              lastPeak = peaks[peaks.length - 1];
            }
            
            const scaleToLimit = limit / signalLen;
            const startVal = firstPeak * scaleToLimit;
            const endVal = lastPeak * scaleToLimit;
            const span = endVal - startVal;
            const interval = span / Math.max(1, sidePins.length - 1);
            
            sidePins.forEach((p, idx) => {
              nextOffsets[p.name] = Math.round(startVal + idx * interval);
            });
          };
          
          detectPeaks(leftPins, 'left', newH);
          detectPeaks(rightPins, 'right', newH);
          detectPeaks(topPins, 'top', newW);
          detectPeaks(bottomPins, 'bottom', newW);
          
          setSkinPicker(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              width: newW,
              height: newH,
              pinOffsets: nextOffsets,
              deskewAngle: activeDeskew,
              subCropX: activeSubCropX,
              subCropY: activeSubCropY,
              subCropW: activeSubCropW,
              subCropH: activeSubCropH,
              startMargin: activeStartMargin,
              endMargin: activeEndMargin,
              lastLoadedUrl: imgUrl
            };
          });
        }
        
        drawPreview(processed);
      };
      img.onerror = () => {
        drawPreview(null);
        ctx.fillStyle = '#ef4444';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("Preview failed (CORS/404)", canvasEl.width / 2, canvasEl.height / 2);
      };
    } else {
      drawPreview(null);
    }
  }, [skinPicker, prevZoom, prevPan]);

  // macOS Slide-out Options Panel settings
  const [wireColor, setWireColor] = useState('#2563eb'); // '#2563eb', '#dc2626', '#16a34a', '#d97706'
  const [autoPenaltyMode, setAutoPenaltyMode] = useState('high'); // 'high', 'low'

  // Dragging and custom shape/ruler states
  const [draggingCompId, setDraggingCompId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggingNodule, setDraggingNodule] = useState(null); // { traceId, index }
  
  const [drawingWireFrom, setDrawingWireFrom] = useState(null); 
  const [drawingShapeStart, setDrawingShapeStart] = useState(null); 
  const [rulerStart, setRulerStart] = useState(null); 
  const [rulerEnd, setRulerEnd] = useState(null); 

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // ResizeObserver setup
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(100, rect.width),
          height: Math.max(100, rect.height)
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(() => handleResize());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  // Listen for Spacebar key toggles
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (
        activeEl && 
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)
      ) {
        return;
      }

      if (e.key === ' ' && !spacePressed) {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'v') setActiveTool('select');
      if (key === 'h') setActiveTool('pan');
      if (key === 'w') setActiveTool('wire');
      if (key === 't') setActiveTool('text');
      if (key === 's') setActiveTool('shape');
      if (key === 'm') setActiveTool('ruler');
      if (key === 'e') setActiveTool('eraser');
    };

    const handleKeyUp = (e) => {
      if (e.key === ' ') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [spacePressed]);

  // Center camera targets during tours
  useEffect(() => {
    if (cameraTarget) {
      const targetPanX = (dimensions.width / 2) - cameraTarget.x * cameraTarget.zoom;
      const targetPanY = (dimensions.height / 2) - cameraTarget.y * cameraTarget.zoom;
      setPan({ x: targetPanX, y: targetPanY });
      setZoom(cameraTarget.zoom);
      setCameraTarget(null);
    }
  }, [cameraTarget, dimensions]);

  // Close context menu on click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [contextMenu]);

  // Override browser trackpad horizontal sweeps, browser history shifts, and page-zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      
      if (e.ctrlKey) {
        const zoomFactor = 1.08;
        setZoom(prev => {
          const next = e.deltaY < 0 ? prev * zoomFactor : prev / zoomFactor;
          return Math.max(0.4, Math.min(3, next));
        });
      } else {
        setPan(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
    };

    const handleGestureStart = (e) => e.preventDefault();

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('gesturestart', handleGestureStart, { passive: false });
    canvas.addEventListener('gesturechange', handleGestureStart, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('gesturestart', handleGestureStart);
      canvas.removeEventListener('gesturechange', handleGestureStart);
    };
  }, []);

  const screenToWorld = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return { x, y };
  };

  const snapToGrid = (val) => {
    return Math.round(val / gridSize) * gridSize;
  };

  const recalculateAllRoutes = (currentComps = components, currentTraces = traces) => {
    const sortedTraces = [...currentTraces].sort((a, b) => {
      if (a.isLocked && !b.isLocked) return -1;
      if (!a.isLocked && b.isLocked) return 1;
      return 0;
    });

    const updatedTraces = [];
    
    sortedTraces.forEach((trace) => {
      // Keep manual paths intact if locked
      if (trace.isLocked && trace.path && trace.path.length > 0) {
        updatedTraces.push(trace);
        return;
      }

      const [startCompId, startPinName] = trace.from.split('.');
      const [endCompId, endPinName] = trace.to.split('.');

      const startComp = currentComps.find(c => c.id === startCompId);
      const endComp = currentComps.find(c => c.id === endCompId);

      if (!startComp || !endComp) return;

      const startPin = startComp.pins.find(p => p.name === startPinName);
      const endPin = endComp.pins.find(p => p.name === endPinName);

      if (!startPin || !endPin) return;

      const startPos = {
        x: startComp.x + startPin.x,
        y: startComp.y + startPin.y
      };
      const endPos = {
        x: endComp.x + endPin.x,
        y: endComp.y + endPin.y
      };

      const path = findOrthogonalPath(
        startPos, 
        endPos, 
        currentComps, 
        updatedTraces,
        gridSize
      );

      updatedTraces.push({
        ...trace,
        path
      });
    });

    setTraces(updatedTraces);
  };

  useEffect(() => {
    if (components.length > 0) {
      recalculateAllRoutes();
    }
  }, [components, gridSize]);

  // Main Drawing Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 1. Draw Grid Lines
    if (layersVisibility.grid) {
      ctx.strokeStyle = '#f1ebde';
      ctx.lineWidth = 0.5;

      const startX = Math.floor((-pan.x / zoom) / gridSize) * gridSize;
      const endX = Math.ceil(((-pan.x + dimensions.width) / zoom) / gridSize) * gridSize;
      for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, -pan.y / zoom);
        ctx.lineTo(x, (-pan.y + dimensions.height) / zoom);
        ctx.stroke();
      }

      const startY = Math.floor((-pan.y / zoom) / gridSize) * gridSize;
      const endY = Math.ceil(((-pan.y + dimensions.height) / zoom) / gridSize) * gridSize;
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-pan.x / zoom, y);
        ctx.lineTo((-pan.x + dimensions.width) / zoom, y);
        ctx.stroke();
      }

      // Major grid guides (every 5th cell)
      ctx.strokeStyle = '#e3d9c5';
      ctx.lineWidth = 1.2;
      const majorStep = gridSize * 5;

      const mStartX = Math.floor((-pan.x / zoom) / majorStep) * majorStep;
      const mEndX = Math.ceil(((-pan.x + dimensions.width) / zoom) / majorStep) * majorStep;
      for (let x = mStartX; x <= mEndX; x += majorStep) {
        ctx.beginPath();
        ctx.moveTo(x, -pan.y / zoom);
        ctx.lineTo(x, (-pan.y + dimensions.height) / zoom);
        ctx.stroke();
      }

      const mStartY = Math.floor((-pan.y / zoom) / majorStep) * majorStep;
      const mEndY = Math.ceil(((-pan.y + dimensions.height) / zoom) / majorStep) * majorStep;
      for (let y = mStartY; y <= mEndY; y += majorStep) {
        ctx.beginPath();
        ctx.moveTo(-pan.x / zoom, y);
        ctx.lineTo((-pan.x + dimensions.width) / zoom, y);
        ctx.stroke();
      }
    }

    // 2. Draw custom outline shapes
    if (layersVisibility.shapes) {
      customShapes.forEach(shape => {
        ctx.strokeStyle = shape.color || '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(shape.x1, shape.y1, shape.x2 - shape.x1, shape.y2 - shape.y1);
        ctx.setLineDash([]);
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
        ctx.fillRect(Math.min(shape.x1, shape.x2), Math.min(shape.y1, shape.y2), 65, 14);
        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = '#1d4ed8';
        ctx.fillText("Boundary Box", Math.min(shape.x1, shape.x2) + 5, Math.min(shape.y1, shape.y2) + 10);
      });

      if (activeTool === 'shape' && drawingShapeStart) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        const gx = snapToGrid(mousePos.x);
        const gy = snapToGrid(mousePos.y);
        ctx.strokeRect(drawingShapeStart.x, drawingShapeStart.y, gx - drawingShapeStart.x, gy - drawingShapeStart.y);
        ctx.setLineDash([]);
      }
    }

    // 3. Draw electrical traces
    traces.forEach((trace) => {
      const isSelected = trace.id === selectedTraceId;
      const isVisible = trace.isLocked ? layersVisibility.lockedTraces : layersVisibility.traces;
      if (!isVisible || !trace.path || trace.path.length < 2) return;

      ctx.lineWidth = trace.isLocked ? 3.5 : (isSelected ? 3 : 2);
      
      // Inherit custom color settings if saved
      ctx.strokeStyle = trace.color || (trace.isLocked ? '#d97706' : (isSelected ? '#ef4444' : '#2563eb'));

      ctx.beginPath();
      ctx.moveTo(trace.path[0].x, trace.path[0].y);
      for (let i = 1; i < trace.path.length; i++) {
        ctx.lineTo(trace.path[i].x, trace.path[i].y);
      }
      ctx.stroke();

      if (isSelected || trace.isLocked) {
        ctx.fillStyle = trace.isLocked ? '#fbbf24' : '#ef4444';
        trace.path.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.2, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
    });

    // 4. Draw wire pencil preview
    if (drawingWireFrom) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = wireColor;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(drawingWireFrom.x, drawingWireFrom.y);
      ctx.lineTo(mousePos.x, drawingWireFrom.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Draw component blocks
    if (layersVisibility.components) {
      components.forEach((comp) => {
        const isSelected = comp.id === selectedComponentId;
        
        if (isSelected) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
          ctx.fillRect(comp.x - 4, comp.y - 4, comp.width + 8, comp.height + 8);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(comp.x - 4, comp.y - 4, comp.width + 8, comp.height + 8);
        }

        if (!comp.image) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(comp.x, comp.y, comp.width, comp.height);
        }

        if (comp.image) {
          const tolerance = comp.imageTolerance !== undefined ? comp.imageTolerance : 50;
          const doCrop = comp.imageCrop !== undefined ? comp.imageCrop : true;
          const deskewAngle = comp.imageDeskew !== undefined ? comp.imageDeskew : 0;
          const taperFactor = comp.imageTaper !== undefined ? comp.imageTaper : 0;
          const shearFactor = comp.imageShear !== undefined ? comp.imageShear : 0;
          const scX = comp.imageSubCropX !== undefined ? comp.imageSubCropX : 0;
          const scY = comp.imageSubCropY !== undefined ? comp.imageSubCropY : 0;
          const scW = comp.imageSubCropW !== undefined ? comp.imageSubCropW : 100;
          const scH = comp.imageSubCropH !== undefined ? comp.imageSubCropH : 100;
          
          const cacheKey = `raw_${comp.image}`;
          const processedKey = `processed_${tolerance}_${doCrop}_${deskewAngle}_${taperFactor}_${shearFactor}_${scX}_${scY}_${scW}_${scH}_${comp.image}`;
          
          let cachedImg = imageCache.current[cacheKey];
          if (!cachedImg) {
            cachedImg = new Image();
            cachedImg.crossOrigin = "anonymous";
            
            // Bypass CORS issues dynamically using our Node server proxy
            const srcUrl = comp.image.startsWith('data:') 
              ? comp.image 
              : `/api/proxy-image?url=${encodeURIComponent(comp.image)}`;
            cachedImg.src = srcUrl;
            
            cachedImg.onload = () => {
              console.log(`[Onload Calibration Check] comp: ${comp.id}, imageDeskew: ${comp.imageDeskew}, imageTaper: ${comp.imageTaper}, imageShear: ${comp.imageShear}, imageSubCropW: ${comp.imageSubCropW}`);
              if (!comp.rawImage && (comp.imageDeskew === undefined || comp.imageTaper === undefined || comp.imageShear === undefined || comp.imageSubCropW === undefined || comp.imageSubCropW === 100)) {
                console.log(`[Onload Calibration Run] Running autoCalibrateImageSkin for comp: ${comp.id}...`);
                const cal = autoCalibrateImageSkin(cachedImg, tolerance);
                console.log(`[Onload Calibration Done] Result:`, cal);
                if (cal) {
                  setComponents(prev => prev.map(c => {
                    if (c.id === comp.id) {
                      const autoProcessed = processImageBackground(
                        cachedImg,
                        tolerance,
                        doCrop,
                        cal.deskewAngle,
                        { x: cal.subCropX, y: cal.subCropY, w: cal.subCropW, h: cal.subCropH },
                        cal.taperFactor || 0,
                        cal.shearFactor || 0
                      );
                      
                      const imgRatio = autoProcessed.width / autoProcessed.height;
                      const pitch = 15;
                      
                      const sidesMap = {};
                      (c.pins || []).forEach(p => {
                        if (p.dir === 'up') sidesMap[p.name] = 'top';
                        else if (p.dir === 'down') sidesMap[p.name] = 'bottom';
                        else if (p.dir === 'right') sidesMap[p.name] = 'right';
                        else sidesMap[p.name] = 'left';
                      });
                      
                      const leftCount = Object.values(sidesMap).filter(s => s === 'left').length;
                      const rightCount = Object.values(sidesMap).filter(s => s === 'right').length;
                      const topCount = Object.values(sidesMap).filter(s => s === 'top').length;
                      const bottomCount = Object.values(sidesMap).filter(s => s === 'bottom').length;
                      
                      let newH = c.height || 300;
                      let newW = c.width || 120;
                      if (imgRatio < 1) { // Vertical board
                        newH = Math.max(60, Math.max(leftCount, rightCount) * pitch + 30);
                        newW = Math.max(60, Math.round((newH * imgRatio) / 15) * 15);
                      } else { // Horizontal board
                        newW = Math.max(60, Math.max(topCount, bottomCount) * pitch + 30);
                        newH = Math.max(60, Math.round((newW / imgRatio) / 15) * 15);
                      }
                      
                      const leftPins = (c.pins || []).filter(p => sidesMap[p.name] === 'left');
                      const rightPins = (c.pins || []).filter(p => sidesMap[p.name] === 'right');
                      const topPins = (c.pins || []).filter(p => sidesMap[p.name] === 'top');
                      const bottomPins = (c.pins || []).filter(p => sidesMap[p.name] === 'bottom');
                      
                      const nextOffsets = {};
                      const startVal = newH * 0.04;
                      const endVal = newH * 0.96;
                      const span = endVal - startVal;
                      
                      const leftInterval = span / Math.max(1, leftPins.length - 1);
                      leftPins.forEach((p, idx) => {
                        nextOffsets[p.name] = Math.round(startVal + idx * leftInterval);
                      });
                      
                      const rightInterval = span / Math.max(1, rightPins.length - 1);
                      rightPins.forEach((p, idx) => {
                        nextOffsets[p.name] = Math.round(startVal + idx * rightInterval);
                      });
                      
                      const topStart = newW * (cal.startMargin / 100);
                      const topEnd = newW * (cal.endMargin / 100);
                      const topSpan = topEnd - topStart;
                      const topInterval = topSpan / Math.max(1, topPins.length - 1);
                      topPins.forEach((p, idx) => {
                        nextOffsets[p.name] = Math.round(topStart + idx * topInterval);
                      });
                      
                      const bottomStart = newW * (cal.startMargin / 100);
                      const bottomEnd = newW * (cal.endMargin / 100);
                      const bottomSpan = bottomEnd - bottomStart;
                      const bottomInterval = bottomSpan / Math.max(1, bottomPins.length - 1);
                      bottomPins.forEach((p, idx) => {
                        nextOffsets[p.name] = Math.round(bottomStart + idx * bottomInterval);
                      });
                      
                      const finalPins = distributePinsBySides(
                        c.pins || [],
                        sidesMap,
                        pitch,
                        newW,
                        newH,
                        nextOffsets
                      );
                      
                      return {
                        ...c,
                        width: newW,
                        height: newH,
                        pins: finalPins,
                        imageDeskew: cal.deskewAngle,
                        imageTaper: cal.taperFactor,
                        imageShear: cal.shearFactor,
                        imageSubCropX: cal.subCropX,
                        imageSubCropY: cal.subCropY,
                        imageSubCropW: cal.subCropW,
                        imageSubCropH: cal.subCropH,
                        imageTolerance: tolerance,
                        imageCrop: doCrop,
                        imageStartMargin: cal.startMargin,
                        imageEndMargin: cal.endMargin
                      };
                    }
                    return c;
                  }));
                }
              }
              setPan(p => ({ ...p }));
            };
            imageCache.current[cacheKey] = cachedImg;
          }
          if (cachedImg.complete && cachedImg.naturalWidth !== 0) {
            if (!comp.rawImage && (comp.imageDeskew === undefined || comp.imageTaper === undefined || comp.imageShear === undefined) && !cachedImg._calibrating) {
              cachedImg._calibrating = true;
              const imgToCal = cachedImg;
              setTimeout(() => {
                console.log(`[Cache Complete Calibration] Running autoCalibrateImageSkin for comp: ${comp.id}...`);
                const cal = autoCalibrateImageSkin(imgToCal, tolerance);
                console.log(`[Cache Complete Calibration] Result:`, cal);
                if (cal) {
                  setComponents(prev => prev.map(c => {
                    if (c.id === comp.id) {
                      const autoProcessed = processImageBackground(
                        imgToCal,
                        tolerance,
                        doCrop,
                        cal.deskewAngle,
                        { x: cal.subCropX, y: cal.subCropY, w: cal.subCropW, h: cal.subCropH },
                        cal.taperFactor || 0,
                        cal.shearFactor || 0
                      );
                      
                      const imgRatio = autoProcessed.width / autoProcessed.height;
                      const pitch = 15;
                      
                      const sidesMap = {};
                      (c.pins || []).forEach(p => {
                        if (p.dir === 'up') sidesMap[p.name] = 'top';
                        else if (p.dir === 'down') sidesMap[p.name] = 'bottom';
                        else if (p.dir === 'right') sidesMap[p.name] = 'right';
                        else sidesMap[p.name] = 'left';
                      });
                      
                      const leftCount = Object.values(sidesMap).filter(s => s === 'left').length;
                      const rightCount = Object.values(sidesMap).filter(s => s === 'right').length;
                      const topCount = Object.values(sidesMap).filter(s => s === 'top').length;
                      const bottomCount = Object.values(sidesMap).filter(s => s === 'bottom').length;
                      
                      let newH = c.height || 300;
                      let newW = c.width || 120;
                      if (imgRatio < 1) { // Vertical board
                        newH = Math.max(60, Math.max(leftCount, rightCount) * pitch + 30);
                        newW = Math.max(60, Math.round((newH * imgRatio) / 15) * 15);
                      } else { // Horizontal board
                        newW = Math.max(60, Math.max(topCount, bottomCount) * pitch + 30);
                        newH = Math.max(60, Math.round((newW / imgRatio) / 15) * 15);
                      }
                      
                      const leftPins = (c.pins || []).filter(p => sidesMap[p.name] === 'left');
                      const rightPins = (c.pins || []).filter(p => sidesMap[p.name] === 'right');
                      const topPins = (c.pins || []).filter(p => sidesMap[p.name] === 'top');
                      const bottomPins = (c.pins || []).filter(p => sidesMap[p.name] === 'bottom');
                      
                      const nextOffsets = {};
                      const startVal = newH * 0.04;
                      const endVal = newH * 0.96;
                      const span = endVal - startVal;
                      
                      const leftInterval = span / Math.max(1, leftPins.length - 1);
                      leftPins.forEach((p, idx) => {
                        nextOffsets[p.name] = Math.round(startVal + idx * leftInterval);
                      });
                      
                      const rightInterval = span / Math.max(1, rightPins.length - 1);
                      rightPins.forEach((p, idx) => {
                        nextOffsets[p.name] = Math.round(startVal + idx * rightInterval);
                      });
                      
                      const topStart = newW * (cal.startMargin / 100);
                      const topEnd = newW * (cal.endMargin / 100);
                      const topSpan = topEnd - topStart;
                      const topInterval = topSpan / Math.max(1, topPins.length - 1);
                      topPins.forEach((p, idx) => {
                        nextOffsets[p.name] = Math.round(topStart + idx * topInterval);
                      });
                      
                      const bottomStart = newW * (cal.startMargin / 100);
                      const bottomEnd = newW * (cal.endMargin / 100);
                      const bottomSpan = bottomEnd - bottomStart;
                      const bottomInterval = bottomSpan / Math.max(1, bottomPins.length - 1);
                      bottomPins.forEach((p, idx) => {
                        nextOffsets[p.name] = Math.round(bottomStart + idx * bottomInterval);
                      });
                      
                      const finalPins = distributePinsBySides(
                        c.pins || [],
                        sidesMap,
                        pitch,
                        newW,
                        newH,
                        nextOffsets
                      );
                      
                      return {
                        ...c,
                        width: newW,
                        height: newH,
                        pins: finalPins,
                        imageDeskew: cal.deskewAngle,
                        imageTaper: cal.taperFactor,
                        imageShear: cal.shearFactor,
                        imageSubCropX: cal.subCropX,
                        imageSubCropY: cal.subCropY,
                        imageSubCropW: cal.subCropW,
                        imageSubCropH: cal.subCropH,
                        imageTolerance: tolerance,
                        imageCrop: doCrop,
                        imageStartMargin: cal.startMargin,
                        imageEndMargin: cal.endMargin
                      };
                    }
                    return c;
                  }));
                }
                      }, 50);
            }
            
            let processedCanvas = imageCache.current[processedKey];
            if (!processedCanvas) {
              processedCanvas = processImageBackground(cachedImg, tolerance, doCrop, deskewAngle, {
                x: scX,
                y: scY,
                w: scW,
                h: scH
              }, comp.imageTaper || 0, comp.imageShear || 0);
              imageCache.current[processedKey] = processedCanvas;
            }
            if (processedCanvas) {
              ctx.save();
              // Apply custom opacity (default to 0.3)
              const op = comp.imageOpacity !== undefined ? comp.imageOpacity : 0.3;
              ctx.globalAlpha = op;
              
              // Center of component
              const cx = comp.x + comp.width / 2;
              const cy = comp.y + comp.height / 2;
              
              ctx.translate(cx, cy);
              
              const flipH = comp.imageFlipH || false;
              const flipV = comp.imageFlipV || false;
              const rot = comp.imageRotation || 0;
              const aspect = comp.imageAspect || 'stretch';
              
              if (flipH) ctx.scale(-1, 1);
              if (flipV) ctx.scale(1, -1);
              if (rot !== 0) ctx.rotate((rot * Math.PI) / 180);
              
              // Respect aspect modes: fit, fill, or stretch
              let drawW = comp.width;
              let drawH = comp.height;
              let dx = -comp.width / 2;
              let dy = -comp.height / 2;
              
              if (aspect === 'fit' || aspect === 'fill') {
                const imgRatio = processedCanvas.width / processedCanvas.height;
                const compRatio = comp.width / comp.height;
                
                if (aspect === 'fit') {
                  if (imgRatio > compRatio) {
                    drawW = comp.width;
                    drawH = comp.width / imgRatio;
                  } else {
                    drawH = comp.height;
                    drawW = comp.height * imgRatio;
                  }
                } else { // fill
                  if (imgRatio > compRatio) {
                    drawH = comp.height;
                    drawW = comp.height * imgRatio;
                  } else {
                    drawW = comp.width;
                    drawH = comp.width / imgRatio;
                  }
                }
                dx = -drawW / 2;
                dy = -drawH / 2;
              }
              
              ctx.drawImage(processedCanvas, dx, dy, drawW, drawH);
              ctx.restore();
            }
          }
        }
        if (!comp.image || isSelected) {
          ctx.strokeStyle = comp.groupId ? '#3b82f6' : '#1e293b'; 
          ctx.lineWidth = comp.groupId ? 2.5 : 2;
          ctx.strokeRect(comp.x, comp.y, comp.width, comp.height);
        }

        if (comp.groupId) {
          ctx.fillStyle = '#3b82f6';
          ctx.font = '7px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`[G: ${comp.groupId.toUpperCase()}]`, comp.x + comp.width - 5, comp.y + 12);
        }

        if (!comp.image) {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          drawComponentSymbol(ctx, comp);
        }

        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText(comp.name, comp.x + comp.width / 2, comp.y - 6);

        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(comp.value, comp.x + comp.width / 2, comp.y + comp.height + 12);

        comp.pins.forEach((pin) => {
          const px = comp.x + pin.x;
          const py = comp.y + pin.y;

          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          
          const gap = comp.image ? 3 : 0;
          let startX = px;
          let startY = py;
          if (comp.image) {
            if (pin.dir === 'left') startX -= gap;
            else if (pin.dir === 'right') startX += gap;
            else if (pin.dir === 'up') startY -= gap;
            else if (pin.dir === 'down') startY += gap;
          }
          
          ctx.moveTo(startX, startY);
          let tx = px;
          let ty = py;
          const pinLen = 8;
          if (pin.dir === 'left') tx -= pinLen;
          else if (pin.dir === 'right') tx += pinLen;
          else if (pin.dir === 'up') ty -= pinLen;
          else if (pin.dir === 'down') ty += pinLen;
          ctx.lineTo(tx, ty);
          ctx.stroke();

          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(tx, ty, 3, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();

          ctx.font = '9px JetBrains Mono, monospace';
          ctx.fillStyle = '#475569';
          ctx.textAlign = pin.dir === 'left' ? 'left' : (pin.dir === 'right' ? 'right' : 'center');
          
          let labelX = px;
          let labelY = py + 3;
          const textMargin = 5;
          if (pin.dir === 'left') labelX += textMargin;
          else if (pin.dir === 'right') labelX -= textMargin;
          else if (pin.dir === 'up') labelY += textMargin + 4;
          else if (pin.dir === 'down') labelY -= textMargin;

          ctx.fillText(pin.name, labelX, labelY);
        });
      });
    }

    // 6. Draw custom labels / texts
    if (layersVisibility.text) {
      ctx.fillStyle = '#334155';
      ctx.font = 'italic 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      customTexts.forEach(t => {
        ctx.fillText(t.text, t.x, t.y);
      });
    }

    // 7. Draw measurements ruler
    if (layersVisibility.measurements) {
      if (rulerStart) {
        const targetEnd = rulerEnd || mousePos;
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        
        ctx.beginPath();
        ctx.moveTo(rulerStart.x, rulerStart.y);
        ctx.lineTo(targetEnd.x, targetEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(rulerStart.x, rulerStart.y, 4, 0, 2 * Math.PI);
        ctx.arc(targetEnd.x, targetEnd.y, 4, 0, 2 * Math.PI);
        ctx.fill();

        const distancePx = Math.round(Math.hypot(targetEnd.x - rulerStart.x, targetEnd.y - rulerStart.y));
        const distanceMm = (distancePx * 0.25).toFixed(1); 
        
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillStyle = '#db2777';
        ctx.fillText(`📏 ${distancePx}px (${distanceMm}mm)`, (rulerStart.x + targetEnd.x) / 2 + 8, (rulerStart.y + targetEnd.y) / 2 - 8);
      }
    }

    ctx.restore();
  }, [components, traces, customTexts, customShapes, pan, zoom, selectedComponentId, selectedTraceId, drawingWireFrom, drawingShapeStart, rulerStart, rulerEnd, mousePos, dimensions, gridSize, layersVisibility, wireColor]);

  const drawComponentSymbol = (ctx, comp) => {
    const cx = comp.x + comp.width / 2;
    const cy = comp.y + comp.height / 2;

    switch (comp.type) {
      case 'resistor':
        ctx.beginPath();
        ctx.moveTo(comp.x + 10, cy);
        ctx.lineTo(comp.x + 18, cy);
        ctx.lineTo(comp.x + 22, cy - 8);
        ctx.lineTo(comp.x + 28, cy + 8);
        ctx.lineTo(comp.x + 34, cy - 8);
        ctx.lineTo(comp.x + 40, cy + 8);
        ctx.lineTo(comp.x + 44, cy);
        ctx.lineTo(comp.x + 50, cy);
        ctx.stroke();
        break;

      case 'capacitor':
        ctx.beginPath();
        ctx.moveTo(cx - 8, comp.y + 10);
        ctx.lineTo(cx - 8, comp.y + comp.height - 10);
        ctx.moveTo(cx + 8, comp.y + 10);
        ctx.lineTo(cx + 8, comp.y + comp.height - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(comp.x + 15, cy);
        ctx.lineTo(cx - 8, cy);
        ctx.moveTo(cx + 8, cy);
        ctx.lineTo(comp.x + comp.width - 15, cy);
        ctx.stroke();
        break;

      case 'led':
        ctx.save();
        ctx.translate(cx - 8, cy);
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(12, 0);
        ctx.lineTo(0, 10);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(12, -10);
        ctx.lineTo(12, 10);
        ctx.stroke();
        ctx.strokeStyle = '#e11d48'; 
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -12); ctx.lineTo(-6, -18);
        ctx.moveTo(-2, -18); ctx.lineTo(-6, -18); ctx.lineTo(-6, -14);
        ctx.moveTo(6, -12); ctx.lineTo(0, -18);
        ctx.moveTo(4, -18); ctx.lineTo(0, -18); ctx.lineTo(0, -14);
        ctx.stroke();
        ctx.restore();
        break;

      case 'regulator':
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText("V-REG", cx, cy + 4);
        break;

      case 'mcu':
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(cx - 20, cy - 20, 40, 40);
        ctx.strokeRect(cx - 20, cy - 20, 40, 40);
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.fillText("MCU", cx, cy - 2);
        ctx.font = '8px sans-serif';
        ctx.fillText("CORE", cx, cy + 8);
        break;

      default:
        break;
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const world = screenToWorld(e.clientX, e.clientY);
    let targetType = 'empty';
    let targetId = null;

    for (const comp of components) {
      if (world.x >= comp.x && world.x <= comp.x + comp.width && world.y >= comp.y && world.y <= comp.y + comp.height) {
        targetType = 'component';
        targetId = comp.id;
        break;
      }
    }

    if (targetType === 'empty') {
      for (const trace of traces) {
        if (!trace.path) continue;
        for (let i = 0; i < trace.path.length - 1; i++) {
          if (distToSegment(world, trace.path[i], trace.path[i+1]) <= 6) {
            targetType = 'trace';
            targetId = trace.id;
            break;
          }
        }
        if (targetId) break;
      }
    }

    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    setContextMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      type: targetType,
      targetId: targetId,
      rawCoord: world
    });
  };

  const handleMouseDown = (e) => {
    const world = screenToWorld(e.clientX, e.clientY);
    const gridX = snapToGrid(world.x);
    const gridY = snapToGrid(world.y);

    if (e.button === 2) {
      return; // Handled by handleContextMenu
    }

    if (e.button === 1 || activeTool === 'pan' || spacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
      return;
    }

    if (activeTool === 'text') {
      const textVal = prompt('Enter custom label text annotations:');
      if (textVal) {
        setCustomTexts(prev => [...prev, {
          id: `text_${Date.now()}`,
          x: gridX,
          y: gridY,
          text: textVal
        }]);
      }
      return;
    }

    if (activeTool === 'shape') {
      setDrawingShapeStart({ x: gridX, y: gridY });
      setMousePos(world);
      return;
    }

    if (activeTool === 'ruler') {
      setRulerStart({ x: world.x, y: world.y });
      setRulerEnd(null);
      setMousePos(world);
      return;
    }

    if (activeTool === 'select') {
      // 1. Drag wire path nodules if selected
      if (selectedTraceId) {
        const trace = traces.find(t => t.id === selectedTraceId);
        if (trace && trace.path) {
          for (let i = 0; i < trace.path.length; i++) {
            const pt = trace.path[i];
            const dist = Math.hypot(world.x - pt.x, world.y - pt.y);
            if (dist <= 8) {
              setDraggingNodule({ traceId: trace.id, index: i });
              return;
            }
          }
        }
      }

      for (const comp of components) {
        for (const pin of comp.pins) {
          const px = comp.x + pin.x;
          const py = comp.y + pin.y;
          let tx = px;
          let ty = py;
          const pinLen = 8;
          if (pin.dir === 'left') tx -= pinLen;
          else if (pin.dir === 'right') tx += pinLen;
          else if (pin.dir === 'up') ty -= pinLen;
          else if (pin.dir === 'down') ty += pinLen;

          const dist = Math.hypot(world.x - tx, world.y - ty);
          if (dist <= 8) {
            setDrawingWireFrom({
              compId: comp.id,
              pinName: pin.name,
              x: tx,
              y: ty
            });
            setMousePos(world);
            return;
          }
        }
      }

      for (const comp of components) {
        if (world.x >= comp.x && world.x <= comp.x + comp.width && world.y >= comp.y && world.y <= comp.y + comp.height) {
          setDraggingCompId(comp.id);
          setDragOffset({ x: world.x - comp.x, y: world.y - comp.y });
          setSelectedComponentId(comp.id);
          setSelectedTraceId(null);
          return;
        }
      }

      for (const trace of traces) {
        if (!trace.path) continue;
        for (let i = 0; i < trace.path.length - 1; i++) {
          if (distToSegment(world, trace.path[i], trace.path[i+1]) <= 6) {
            setSelectedTraceId(trace.id);
            setSelectedComponentId(null);
            return;
          }
        }
      }

      setSelectedComponentId(null);
      setSelectedTraceId(null);
    }

    else if (activeTool === 'wire') {
      for (const comp of components) {
        for (const pin of comp.pins) {
          const px = comp.x + pin.x;
          const py = comp.y + pin.y;
          let tx = px;
          let ty = py;
          const pinLen = 8;
          if (pin.dir === 'left') tx -= pinLen;
          else if (pin.dir === 'right') tx += pinLen;
          const dist = Math.hypot(world.x - tx, world.y - ty);
          if (dist <= 12) {
            setDrawingWireFrom({
              compId: comp.id,
              pinName: pin.name,
              x: tx,
              y: ty
            });
            setMousePos(world);
            return;
          }
        }
      }
    }

    else if (activeTool === 'eraser') {
      for (const comp of components) {
        if (world.x >= comp.x && world.x <= comp.x + comp.width && world.y >= comp.y && world.y <= comp.y + comp.height) {
          setComponents(prev => prev.filter(c => c.id !== comp.id));
          setTraces(prev => prev.filter(t => !t.from.startsWith(`${comp.id}.`) && !t.to.startsWith(`${comp.id}.`)));
          return;
        }
      }

      for (const trace of traces) {
        if (!trace.path) continue;
        for (let i = 0; i < trace.path.length - 1; i++) {
          if (distToSegment(world, trace.path[i], trace.path[i+1]) <= 6) {
            setTraces(prev => prev.filter(t => t.id !== trace.id));
            return;
          }
        }
      }

      setCustomTexts(prev => prev.filter(t => Math.hypot(world.x - t.x, world.y - t.y) > 40));

      setCustomShapes(prev => prev.filter(s => {
        const left = Math.min(s.x1, s.x2);
        const right = Math.max(s.x1, s.x2);
        const top = Math.min(s.y1, s.y2);
        const bottom = Math.max(s.y1, s.y2);
        return !(world.x >= left && world.x <= right && world.y >= top && world.y <= bottom);
      }));
    }
  };

  const handleMouseMove = (e) => {
    const world = screenToWorld(e.clientX, e.clientY);

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (draggingNodule && activeTool === 'select') {
      const snappedX = snapToGrid(world.x);
      const snappedY = snapToGrid(world.y);
      setTraces(prev => prev.map(t => {
        if (t.id === draggingNodule.traceId) {
          const nextPath = [...t.path];
          nextPath[draggingNodule.index] = { x: snappedX, y: snappedY };
          return { ...t, path: nextPath, isLocked: true };
        }
        return t;
      }));
      return;
    }

    if (draggingCompId && activeTool === 'select') {
      const targetComp = components.find(c => c.id === draggingCompId);
      if (targetComp) {
        const rawX = world.x - dragOffset.x;
        const rawY = world.y - dragOffset.y;
        const snappedX = snapToGrid(rawX);
        const snappedY = snapToGrid(rawY);

        const dx = snappedX - targetComp.x;
        const dy = snappedY - targetComp.y;

        if (dx !== 0 || dy !== 0) {
          setComponents(prev => prev.map(c => {
            if (c.id === draggingCompId) {
              return { ...c, x: snappedX, y: snappedY };
            }
            if (targetComp.groupId && c.groupId === targetComp.groupId) {
              return { ...c, x: c.x + dx, y: c.y + dy };
            }
            return c;
          }));
        }
      }
      return;
    }

    if (drawingWireFrom || drawingShapeStart || rulerStart) {
      setMousePos(world);
    }
  };

  const handleMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (draggingNodule) {
      const world = screenToWorld(e.clientX, e.clientY);
      let targetPin = null;

      for (const comp of components) {
        for (const pin of comp.pins) {
          const px = comp.x + pin.x;
          const py = comp.y + pin.y;
          let tx = px;
          let ty = py;
          const pinLen = 8;
          if (pin.dir === 'left') tx -= pinLen;
          else if (pin.dir === 'right') tx += pinLen;
          else if (pin.dir === 'up') ty -= pinLen;
          else if (pin.dir === 'down') ty += pinLen;

          const dist = Math.hypot(world.x - tx, world.y - ty);
          if (dist <= 12) {
            targetPin = `${comp.id}.${pin.name}`;
            break;
          }
        }
        if (targetPin) break;
      }

      if (targetPin) {
        setTraces(prev => prev.map(t => {
          if (t.id === draggingNodule.traceId) {
            const isStart = draggingNodule.index === 0;
            const isEnd = draggingNodule.index === t.path.length - 1;
            if (isStart) {
              return { ...t, from: targetPin, isLocked: true };
            } else if (isEnd) {
              return { ...t, to: targetPin, isLocked: true };
            }
          }
          return t;
        }));
      }
      setDraggingNodule(null);
      return;
    }

    if (draggingCompId) {
      setDraggingCompId(null);
      return;
    }

    if (drawingShapeStart) {
      const world = screenToWorld(e.clientX, e.clientY);
      const gx = snapToGrid(world.x);
      const gy = snapToGrid(world.y);
      if (gx !== drawingShapeStart.x || gy !== drawingShapeStart.y) {
        setCustomShapes(prev => [...prev, {
          id: `shape_${Date.now()}`,
          x1: drawingShapeStart.x,
          y1: drawingShapeStart.y,
          x2: gx,
          y2: gy,
          color: '#3b82f6'
        }]);
      }
      setDrawingShapeStart(null);
    }

    if (rulerStart) {
      const world = screenToWorld(e.clientX, e.clientY);
      setRulerEnd({ x: world.x, y: world.y });
    }

    if (drawingWireFrom) {
      const world = screenToWorld(e.clientX, e.clientY);
      let targetPinFound = false;

      for (const comp of components) {
        if (comp.id === drawingWireFrom.compId) continue;

        for (const pin of comp.pins) {
          const px = comp.x + pin.x;
          const py = comp.y + pin.y;
          let tx = px;
          let ty = py;
          const pinLen = 8;
          if (pin.dir === 'left') tx -= pinLen;
          else if (pin.dir === 'right') tx += pinLen;
          else if (pin.dir === 'up') ty -= pinLen;
          else if (pin.dir === 'down') ty += pinLen;

          const dist = Math.hypot(world.x - tx, world.y - ty);
          if (dist <= 12) {
            const fromStr = `${drawingWireFrom.compId}.${drawingWireFrom.pinName}`;
            const toStr = `${comp.id}.${pin.name}`;

            const exists = traces.some(t => 
              (t.from === fromStr && t.to === toStr) || 
              (t.from === toStr && t.to === fromStr)
            );

            if (!exists) {
              const newTrace = {
                id: `trace_${Date.now()}`,
                from: fromStr,
                to: toStr,
                isLocked: false,
                color: wireColor, // save color choice!
                path: []
              };
              setTraces(prev => [...prev, newTrace]);
            }
            targetPinFound = true;
            break;
          }
        }
        if (targetPinFound) break;
      }
      setDrawingWireFrom(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Escape') {
      setDrawingWireFrom(null);
      setDrawingShapeStart(null);
      setRulerStart(null);
      setRulerEnd(null);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const distToSegment = (p, v, w) => {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  const handleToggleGroup = (compId, groupId) => {
    setComponents(prev => prev.map(c => 
      c.id === compId ? { ...c, groupId: c.groupId === groupId ? null : groupId } : c
    ));
    setContextMenu(null);
  };

  const handleRotateComponent = (compId) => {
    const target = components.find(c => c.id === compId);
    if (!target) return;
    const newWidth = target.height;
    const newHeight = target.width;

    const rotatedPins = target.pins.map(pin => {
      const oldCx = target.width / 2;
      const oldCy = target.height / 2;
      const newCx = newWidth / 2;
      const newCy = newHeight / 2;

      const rx = pin.x - oldCx;
      const ry = pin.y - oldCy;

      const nx = -ry + newCx;
      const ny = rx + newCy;

      let ndir = pin.dir;
      if (pin.dir === 'left') ndir = 'up';
      else if (pin.dir === 'up') ndir = 'right';
      else if (pin.dir === 'right') ndir = 'down';
      else if (pin.dir === 'down') ndir = 'left';

      return { ...pin, x: Math.round(nx), y: Math.round(ny), dir: ndir };
    });

    setComponents(prev => prev.map(c => 
      c.id === compId ? { ...c, width: newWidth, height: newHeight, pins: rotatedPins } : c
    ));
    setContextMenu(null);
  };

  const handleDistributePins = (compId) => {
    setComponents(prev => prev.map(c => {
      if (c.id === compId) {
        if (!c.pins || c.pins.length === 0) return c;
        const pins = [...c.pins];
        const pinsPerSide = Math.ceil(pins.length / 2);
        const pinPitch = 15;
        const width = 120;
        const height = Math.max(90, pinsPerSide * pinPitch + 30);
        
        const distributed = pins.map((p, i) => {
          const isLeft = i < pinsPerSide;
          const sideIndex = isLeft ? i : (i - pinsPerSide);
          return {
            ...p,
            x: isLeft ? 0 : width,
            y: sideIndex * pinPitch + 15,
            dir: isLeft ? 'left' : 'right'
          };
        });
        
        return {
          ...c,
          width,
          height,
          pins: distributed
        };
      }
      return c;
    }));
    setContextMenu(null);
  };

  const updateSidesMap = (pinName, newSide) => {
    setSkinPicker(prev => {
      if (!prev) return prev;
      const nextSides = { ...prev.sidesMap, [pinName]: newSide };
      const nextLeft = Object.values(nextSides).filter(s => s === 'left').length;
      const nextRight = Object.values(nextSides).filter(s => s === 'right').length;
      const nextTop = Object.values(nextSides).filter(s => s === 'top').length;
      const nextBottom = Object.values(nextSides).filter(s => s === 'bottom').length;
      
      const nextMinW = Math.max(60, Math.max(nextTop, nextBottom) * prev.pitch + 30);
      const nextMinH = Math.max(60, Math.max(nextLeft, nextRight) * prev.pitch + 30);
      
      return {
        ...prev,
        sidesMap: nextSides,
        width: Math.max(prev.width, nextMinW),
        height: Math.max(prev.height, nextMinH)
      };
    });
  };

  const updatePitch = (newPitch) => {
    setSkinPicker(prev => {
      if (!prev) return prev;
      const leftC = Object.values(prev.sidesMap).filter(s => s === 'left').length;
      const rightC = Object.values(prev.sidesMap).filter(s => s === 'right').length;
      const topC = Object.values(prev.sidesMap).filter(s => s === 'top').length;
      const bottomC = Object.values(prev.sidesMap).filter(s => s === 'bottom').length;
      
      const nextMinW = Math.max(60, Math.max(topC, bottomC) * newPitch + 30);
      const nextMinH = Math.max(60, Math.max(leftC, rightC) * newPitch + 30);
      
      return {
        ...prev,
        pitch: newPitch,
        width: Math.max(prev.width, nextMinW),
        height: Math.max(prev.height, nextMinH)
      };
    });
  };

  const handleCvDetectPins = async () => {
    if (!skinPicker) return;
    const imgUrl = skinPicker.customUrl || skinPicker.selectedUrl;
    if (!imgUrl) return;
    
    setSkinPicker(prev => ({ ...prev, loading: true }));
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imgUrl.startsWith('data:') ? imgUrl : `/api/proxy-image?url=${encodeURIComponent(imgUrl)}`;
    
    img.onload = () => {
      // Process background removal & crop first so we scan the exact cropped chip bounds!
      const processedCanvas = processImageBackground(
        img,
        skinPicker.tolerance,
        skinPicker.doCrop,
        skinPicker.deskewAngle || 0,
        {
          x: skinPicker.subCropX !== undefined ? skinPicker.subCropX : 0,
          y: skinPicker.subCropY !== undefined ? skinPicker.subCropY : 0,
          w: skinPicker.subCropW !== undefined ? skinPicker.subCropW : 100,
          h: skinPicker.subCropH !== undefined ? skinPicker.subCropH : 100
        },
        skinPicker.taperFactor || 0,
        skinPicker.shearFactor || 0
      );
      const w = processedCanvas.width;
      const h = processedCanvas.height;
      
      const ctxOff = processedCanvas.getContext('2d', { willReadFrequently: true });
      const imgData = ctxOff.getImageData(0, 0, w, h);
      
      // Separate pins by sides
      const leftPins = skinPicker.rawPins.filter(p => skinPicker.sidesMap[p.name] === 'left');
      const rightPins = skinPicker.rawPins.filter(p => skinPicker.sidesMap[p.name] === 'right');
      const topPins = skinPicker.rawPins.filter(p => skinPicker.sidesMap[p.name] === 'top');
      const bottomPins = skinPicker.rawPins.filter(p => skinPicker.sidesMap[p.name] === 'bottom');
      
      const nextOffsets = { ...skinPicker.pinOffsets };
      
      const detectPeaks = (sidePins, side, limit) => {
        if (sidePins.length === 0) return;
        
        // Scan a strip near the side border
        let startX, endX, startY, endY;
        const intensities = [];
        
        if (side === 'left' || side === 'right') {
          if (side === 'left') {
            startX = Math.round(w * 0.04);
            endX = Math.round(w * 0.16);
          } else {
            startX = Math.round(w * 0.84);
            endX = Math.round(w * 0.96);
          }
          const stripW = Math.max(1, endX - startX);
          
          for (let y = 0; y < h; y++) {
            let sum = 0;
            for (let x = startX; x < endX; x++) {
              const idx = (y * w + x) * 4;
              const lum = 0.299 * imgData.data[idx] + 0.587 * imgData.data[idx + 1] + 0.114 * imgData.data[idx + 2];
              sum += lum;
            }
            intensities.push(sum / stripW);
          }
        } else {
          // top or bottom
          if (side === 'top') {
            startY = Math.round(h * 0.04);
            endY = Math.round(h * 0.16);
          } else {
            startY = Math.round(h * 0.84);
            endY = Math.round(h * 0.96);
          }
          const stripH = Math.max(1, endY - startY);
          
          for (let x = 0; x < w; x++) {
            let sum = 0;
            for (let y = startY; y < endY; y++) {
              const idx = (y * w + x) * 4;
              const lum = 0.299 * imgData.data[idx] + 0.587 * imgData.data[idx + 1] + 0.114 * imgData.data[idx + 2];
              sum += lum;
            }
            intensities.push(sum / stripH);
          }
        }
        
        // Local peak detection filter (finding high-contrast shifts)
        const signalLen = intensities.length;
        const peaks = [];
        
        for (let idx = 5; idx < signalLen - 5; idx++) {
          const val = intensities[idx];
          let isMax = true;
          let isMin = true;
          const windowSize = Math.max(3, Math.round(signalLen / (sidePins.length * 2.5)));
          
          for (let di = -windowSize; di <= windowSize; di++) {
            if (di === 0) continue;
            if (intensities[idx + di] >= val) isMax = false;
            if (intensities[idx + di] <= val) isMin = false;
          }
          if (isMax || isMin) {
            peaks.push(idx);
          }
        }
        
        // Bounding box of the peaks (first and last peaks correspond to the outer pins)
        let firstPeak = Math.round(signalLen * 0.12);
        let lastPeak = Math.round(signalLen * 0.88);
        
        if (peaks.length >= 2) {
          peaks.sort((a, b) => a - b);
          firstPeak = peaks[0];
          lastPeak = peaks[peaks.length - 1];
        }
        
        // Map back from image coordinate domain to component pixel size limit
        const scaleToLimit = limit / signalLen;
        const startVal = firstPeak * scaleToLimit;
        const endVal = lastPeak * scaleToLimit;
        
        const span = endVal - startVal;
        const interval = span / Math.max(1, sidePins.length - 1);
        
        sidePins.forEach((p, idx) => {
          nextOffsets[p.name] = Math.round(startVal + idx * interval);
        });
      };
      
      detectPeaks(leftPins, 'left', skinPicker.height);
      detectPeaks(rightPins, 'right', skinPicker.height);
      detectPeaks(topPins, 'top', skinPicker.width);
      detectPeaks(bottomPins, 'bottom', skinPicker.width);
      
      setSkinPicker(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          pinOffsets: nextOffsets,
          loading: false
        };
      });
    };
    
    img.onerror = () => {
      console.error('[CV Detect] failed to load image');
      setSkinPicker(prev => ({ ...prev, loading: false }));
    };
  };

  const handleEditComponentSkin = (compId) => {
    const comp = components.find(c => c.id === compId);
    if (!comp) return;
    
    setContextMenu(null);
    
    const sidesMap = {};
    const pitch = skinPicker?.pitch || 15;
    const pinOffsets = {};
    (comp.pins || []).forEach(p => {
      sidesMap[p.name] = p.dir === 'up' ? 'top' : (p.dir === 'down' ? 'bottom' : (p.dir === 'right' ? 'right' : 'left'));
      if (p.dir === 'up' || p.dir === 'down') {
        pinOffsets[p.name] = p.x;
      } else {
        pinOffsets[p.name] = p.y;
      }
    });
    
    setSkinPicker({
      compId,
      partNumber: comp.label || comp.partNumber || comp.name,
      searchQuery: comp.label && !comp.label.match(/^C\d+$/i) ? comp.label : (comp.partNumber || comp.name),
      images: comp.rawImage ? [comp.rawImage] : (comp.image ? [comp.image] : []),
      selectedUrl: comp.rawImage || comp.image || '',
      customUrl: '',
      tolerance: comp.rawTolerance !== undefined ? comp.rawTolerance : (comp.imageTolerance !== undefined ? comp.imageTolerance : 20),
      doCrop: comp.imageCrop !== undefined ? comp.imageCrop : true,
      width: comp.width || 120,
      height: comp.height || 300,
      pitch,
      sidesMap,
      rawPins: comp.pins || [],
      rotation: comp.imageRotation || 0,
      flipH: comp.imageFlipH || false,
      flipV: comp.imageFlipV || false,
      opacity: comp.imageOpacity !== undefined ? comp.imageOpacity : 0.3,
      aspect: comp.imageAspect || 'stretch',
      pinOffsets,
      loading: false,
      lastLoadedUrl: comp.rawImage || comp.image || '',
      deskewAngle: comp.rawDeskewAngle !== undefined ? comp.rawDeskewAngle : (comp.imageDeskew || 0),
      subCropX: comp.rawSubCropX !== undefined ? comp.rawSubCropX : (comp.imageSubCropX || 0),
      subCropY: comp.rawSubCropY !== undefined ? comp.rawSubCropY : (comp.imageSubCropY || 0),
      subCropW: comp.rawSubCropW !== undefined ? comp.rawSubCropW : (comp.imageSubCropW || 100),
      subCropH: comp.rawSubCropH !== undefined ? comp.rawSubCropH : (comp.imageSubCropH || 100)
    });
  };

  const handleSearchComponentSkin = async (compId, searchQueryOverride = null) => {
    const comp = components.find(c => c.id === compId);
    if (!comp) return;
    
    setContextMenu(null);
    
    const query = searchQueryOverride !== null 
      ? searchQueryOverride 
      : (comp.label && !comp.label.match(/^C\d+$/i) ? comp.label : (comp.partNumber || comp.name));
    
    setSkinPicker(prev => {
      if (!prev) {
        const sidesMap = {};
        const pitch = 15;
        const pinOffsets = {};
        (comp.pins || []).forEach(p => {
          if (p.dir === 'up') sidesMap[p.name] = 'top';
          else if (p.dir === 'down') sidesMap[p.name] = 'bottom';
          else if (p.dir === 'right') sidesMap[p.name] = 'right';
          else sidesMap[p.name] = 'left';
          
          if (p.dir === 'up' || p.dir === 'down') {
            pinOffsets[p.name] = p.x;
          } else {
            pinOffsets[p.name] = p.y;
          }
        });
        
        return {
          compId,
          partNumber: comp.label || comp.partNumber || comp.name,
          searchQuery: query,
          images: [],
          selectedUrl: comp.rawImage || comp.image || '',
          customUrl: '',
          tolerance: comp.rawTolerance !== undefined ? comp.rawTolerance : (comp.imageTolerance !== undefined ? comp.imageTolerance : 20),
          doCrop: comp.imageCrop !== undefined ? comp.imageCrop : true,
          width: comp.width || 120,
          height: comp.height || 300,
          pitch,
          sidesMap,
          rawPins: comp.pins || [],
          rotation: comp.imageRotation || 0,
          flipH: comp.imageFlipH || false,
          flipV: comp.imageFlipV || false,
          opacity: comp.imageOpacity !== undefined ? comp.imageOpacity : 0.3,
          aspect: comp.imageAspect || 'stretch',
          pinOffsets,
          deskewAngle: comp.rawDeskewAngle !== undefined ? comp.rawDeskewAngle : (comp.imageDeskew || 0),
          subCropX: comp.rawSubCropX !== undefined ? comp.rawSubCropX : (comp.imageSubCropX || 0),
          subCropY: comp.rawSubCropY !== undefined ? comp.rawSubCropY : (comp.imageSubCropY || 0),
          subCropW: comp.rawSubCropW !== undefined ? comp.rawSubCropW : (comp.imageSubCropW || 100),
          subCropH: comp.rawSubCropH !== undefined ? comp.rawSubCropH : (comp.imageSubCropH || 100),
          loading: true
        };
      }
      return {
        ...prev,
        searchQuery: query,
        loading: true
      };
    });
    
    try {
      const urls = [];
      const webUrls = await searchComponentImages(query, true);
      for (const u of webUrls) {
        if (!urls.includes(u)) urls.push(u);
      }
      
      setSkinPicker(prev => {
        if (!prev || prev.compId !== compId) return prev;
        return {
          ...prev,
          images: urls,
          loading: false,
          selectedUrl: prev.selectedUrl || urls[0] || ''
        };
      });
    } catch (e) {
      console.error("[Search Skin] error:", e);
      setSkinPicker(prev => {
        if (!prev || prev.compId !== compId) return prev;
        return {
          ...prev,
          loading: false
        };
      });
    }
  };

  const handleToggleTraceLockById = (traceId) => {
    setTraces(prev => prev.map(t => 
      t.id === traceId ? { ...t, isLocked: !t.isLocked } : t
    ));
    setContextMenu(null);
  };

  const handleAddQuickPassive = (type, coord) => {
    const gx = snapToGrid(coord.x);
    const gy = snapToGrid(coord.y);
    
    let num = 1;
    let newComp = {};
    if (type === 'resistor') {
      while (components.some(c => c.id === `R${num}`)) num++;
      newComp = {
        id: `R${num}`,
        name: `R${num}`,
        type: 'resistor',
        label: 'R_QUICK',
        value: '10kΩ',
        x: gx,
        y: gy,
        width: 60,
        height: 30,
        pins: [
          { name: '1', x: 0, y: 15, dir: 'left' },
          { name: '2', x: 60, y: 15, dir: 'right' }
        ],
        groupId: null
      };
    } else if (type === 'capacitor') {
      while (components.some(c => c.id === `C${num}`)) num++;
      newComp = {
        id: `C${num}`,
        name: `C${num}`,
        type: 'capacitor',
        label: 'C_QUICK',
        value: '100nF',
        x: gx,
        y: gy,
        width: 30,
        height: 45,
        pins: [
          { name: '1', x: 15, y: 0, dir: 'up' },
          { name: '2', x: 15, y: 45, dir: 'down' }
        ],
        groupId: null
      };
    } else if (type === 'led') {
      while (components.some(c => c.id === `D${num}`)) num++;
      newComp = {
        id: `D${num}`,
        name: `D${num}`,
        type: 'led',
        label: 'LED_QUICK',
        value: 'GaAs Red',
        x: gx,
        y: gy,
        width: 45,
        height: 60,
        pins: [
          { name: 'A', x: 0, y: 30, dir: 'left' },
          { name: 'K', x: 45, y: 30, dir: 'right' }
        ],
        groupId: null
      };
    }

    setComponents(prev => [...prev, newComp]);
    setContextMenu(null);
  };

  const dpr = window.devicePixelRatio || 1;

  const getCursorClass = () => {
    if (spacePressed || activeTool === 'pan') {
      return isPanning ? 'cursor-grabbing' : 'cursor-grab';
    }
    if (activeTool === 'eraser') return 'cursor-cell';
    if (activeTool === 'text') return 'cursor-text';
    if (activeTool === 'ruler') return 'cursor-help';
    return 'cursor-default';
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full flex overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* VIRTUAL DRAWING TOOLBAR WITH macOS SLIDE-OUT PANEL */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-15 flex items-stretch">
        
        {/* Core Vertical Tool Strip */}
        <div className="flex flex-col bg-white/95 backdrop-blur border border-slate-200/80 p-1.5 rounded-xl shadow-md space-y-1.5 z-20">
          <button
            onClick={() => { setActiveTool('select'); setDrawingWireFrom(null); setRulerStart(null); setDrawingShapeStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'select' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Pointer / Select Tool (V)"
          >
            <Navigation size={15} className="rotate-[270deg]" />
          </button>

          <button
            onClick={() => { setActiveTool('pan'); setDrawingWireFrom(null); setRulerStart(null); setDrawingShapeStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'pan' || spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Pan Canvas Tool (H / Spacebar Drag)"
          >
            <Move size={15} />
          </button>

          <button
            onClick={() => { setActiveTool('wire'); setRulerStart(null); setDrawingShapeStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'wire' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Route Wire Net Pencil (W)"
          >
            <Edit3 size={15} />
          </button>

          <button
            onClick={() => { setActiveTool('text'); setDrawingWireFrom(null); setRulerStart(null); setDrawingShapeStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'text' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Place Text Annotation Label (T)"
          >
            <Type size={15} />
          </button>

          <button
            onClick={() => { setActiveTool('shape'); setDrawingWireFrom(null); setRulerStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'shape' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Outline Boundary Shape Box (S)"
          >
            <Square size={15} />
          </button>

          <button
            onClick={() => { setActiveTool('ruler'); setDrawingWireFrom(null); setDrawingShapeStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'ruler' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Measure Distance Ruler Tool (M)"
          >
            <Ruler size={15} />
          </button>

          <button
            onClick={() => { setActiveTool('eraser'); setDrawingWireFrom(null); setRulerStart(null); setDrawingShapeStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'eraser' && !spacePressed ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Erase (E)"
          >
            <Trash2 size={15} />
          </button>

          <span className="h-px bg-slate-200 w-full font-sans"></span>

          <button
            onClick={() => { setPan({ x: 100, y: 80 }); setZoom(1); }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title="Recenter Camera Target"
          >
            <HelpCircle size={15} />
          </button>
        </div>

        {/* macOS Style Slide-out suboptions panel */}
        {activeTool && activeTool !== 'select' && activeTool !== 'pan' && (
          <div className="ml-2 bg-white/95 backdrop-blur border border-slate-200/80 rounded-xl shadow-md p-3 text-[11px] text-slate-700 flex flex-col justify-center transition-all duration-300 transform translate-x-0 w-44 z-10 select-none animate-in fade-in slide-in-from-left-4">
            {activeTool === 'wire' && (
              <div className="space-y-2 font-sans">
                <div className="font-bold border-b border-slate-100 pb-1 text-slate-800">Wire Settings</div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block mb-1">Trace Color:</span>
                  <div className="flex space-x-1.5">
                    <button onClick={() => setWireColor('#2563eb')} className={`w-4 h-4 rounded-full bg-blue-600 border ${wireColor === '#2563eb' ? 'border-slate-800 scale-110' : 'border-slate-300'}`} title="Signal Net (Blue)" />
                    <button onClick={() => setWireColor('#dc2626')} className={`w-4 h-4 rounded-full bg-red-600 border ${wireColor === '#dc2626' ? 'border-slate-800 scale-110' : 'border-slate-300'}`} title="5V VCC (Red)" />
                    <button onClick={() => setWireColor('#16a34a')} className={`w-4 h-4 rounded-full bg-green-600 border ${wireColor === '#16a34a' ? 'border-slate-800 scale-110' : 'border-slate-300'}`} title="GPIO (Green)" />
                    <button onClick={() => setWireColor('#d97706')} className={`w-4 h-4 rounded-full bg-amber-600 border ${wireColor === '#d97706' ? 'border-slate-800 scale-110' : 'border-slate-300'}`} title="Locked Solder (Gold)" />
                  </div>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block mb-1">A* Penalty:</span>
                  <select 
                    value={autoPenaltyMode} 
                    onChange={(e) => setAutoPenaltyMode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[9px] text-slate-600 outline-none"
                  >
                    <option value="high">High Cost Crossings</option>
                    <option value="low">Low Penalty Overlaps</option>
                  </select>
                </div>
              </div>
            )}
            
            {activeTool === 'text' && (
              <div className="space-y-1.5 font-sans">
                <div className="font-bold border-b border-slate-100 pb-1 text-slate-800">Label Tags</div>
                <p className="text-[10px] text-slate-400 leading-normal">Click directly on any parchment grid intersection to insert custom specs labels.</p>
              </div>
            )}

            {activeTool === 'shape' && (
              <div className="space-y-1.5 font-sans">
                <div className="font-bold border-b border-slate-100 pb-1 text-slate-800">Keepouts</div>
                <p className="text-[10px] text-slate-400 leading-normal">Drag boxes on the sheet to define physical groupings or boundaries.</p>
              </div>
            )}

            {activeTool === 'ruler' && (
              <div className="space-y-1.5 font-sans">
                <div className="font-bold border-b border-slate-100 pb-1 text-slate-800">Measure</div>
                <p className="text-[10px] text-slate-400 leading-normal">Drag a line between pads. Press <kbd className="bg-slate-100 px-1 py-0.2 rounded border">ESC</kbd> to clear current lines.</p>
              </div>
            )}

            {activeTool === 'eraser' && (
              <div className="space-y-1.5 font-sans text-rose-700">
                <div className="font-bold border-b border-rose-100 pb-1">Eraser Tool</div>
                <p className="text-[10px] text-slate-400 leading-normal">Click components, nets, shapes, or texts on sheet to delete.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div 
          style={{ top: contextMenu.y, left: contextMenu.x }} 
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-xs text-slate-700 min-w-[150px] font-sans"
        >
          {contextMenu.type === 'component' && (
            <>
              <div className="px-3 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">Groupings</div>
              <button 
                onClick={() => handleToggleGroup(contextMenu.targetId, 'group_a')}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition"
              >
                Toggle Group A
              </button>
              <button 
                onClick={() => handleToggleGroup(contextMenu.targetId, 'group_b')}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition"
              >
                Toggle Group B
              </button>
              <span className="block h-px bg-slate-100 my-0.5"></span>
              <button 
                onClick={() => handleRotateComponent(contextMenu.targetId)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition font-medium"
              >
                <RotateCw size={12} className="mr-1.5 text-slate-400" /> Rotate 90°
              </button>
              <button 
                onClick={() => handleDistributePins(contextMenu.targetId)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition font-medium text-indigo-600"
              >
                <Layers size={12} className="mr-1.5 text-indigo-400" /> Split Pins (Left/Right)
              </button>
              {(() => {
                const comp = components.find(c => c.id === contextMenu.targetId);
                const hasImage = !!comp?.image;
                return hasImage ? (
                  <>
                    <button 
                      onClick={() => handleEditComponentSkin(contextMenu.targetId)}
                      className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition font-medium text-emerald-600 border-b border-slate-100"
                    >
                      <Settings size={12} className="mr-1.5 text-emerald-400" /> Edit Skin Parameters
                    </button>
                    <button 
                      onClick={() => handleSearchComponentSkin(contextMenu.targetId)}
                      className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition font-medium text-blue-600"
                    >
                      <Search size={12} className="mr-1.5 text-blue-400" /> Replace Photo Skin
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => handleSearchComponentSkin(contextMenu.targetId)}
                    className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition font-medium text-emerald-600"
                  >
                    <Search size={12} className="mr-1.5 text-emerald-400" /> Apply Photo Skin
                  </button>
                );
              })()}
              <button 
                onClick={() => {
                  setComponents(prev => prev.filter(c => c.id !== contextMenu.targetId));
                  setTraces(prev => prev.filter(t => !t.from.startsWith(`${contextMenu.targetId}.`) && !t.to.startsWith(`${contextMenu.targetId}.`)));
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 hover:bg-rose-50 hover:text-rose-600 flex items-center transition font-medium"
              >
                <Trash2 size={12} className="mr-1.5 text-rose-400" /> Delete Part
              </button>
            </>
          )}

          {contextMenu.type === 'trace' && (
            <>
              <button 
                onClick={() => handleToggleTraceLockById(contextMenu.targetId)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition font-medium"
              >
                {traces.find(t => t.id === contextMenu.targetId)?.isLocked ? (
                  <>
                    <Unlock size={12} className="mr-1.5 text-amber-500" /> Free Route
                  </>
                ) : (
                  <>
                    <Lock size={12} className="mr-1.5 text-amber-500" /> Lock Trace
                  </>
                )}
              </button>
              <button 
                onClick={() => {
                  setTraces(prev => prev.filter(t => t.id !== contextMenu.targetId));
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 hover:bg-rose-50 hover:text-rose-600 flex items-center transition font-medium"
              >
                <Trash2 size={12} className="mr-1.5 text-rose-400" /> Delete Net
              </button>
            </>
          )}

          {contextMenu.type === 'empty' && (
            <>
              <div className="px-3 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">Quick Add</div>
              <button 
                onClick={() => handleAddQuickPassive('resistor', contextMenu.rawCoord)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition"
              >
                + Resistor
              </button>
              <button 
                onClick={() => handleAddQuickPassive('capacitor', contextMenu.rawCoord)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition"
              >
                + Capacitor
              </button>
              <button 
                onClick={() => handleAddQuickPassive('led', contextMenu.rawCoord)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition"
              >
                + LED
              </button>
              <span className="block h-px bg-slate-100 my-0.5"></span>
              <button 
                onClick={() => { setPan({ x: 100, y: 80 }); setZoom(1); setContextMenu(null); }}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition text-slate-400"
              >
                Reset Camera
              </button>
            </>
          )}
        </div>
      )}
      {/* Photo Skin Picker Modal Overlay */}
      {skinPicker && (() => {
        const leftCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'left').length;
        const rightCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'right').length;
        const topCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'top').length;
        const bottomCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'bottom').length;
        
        const minW = Math.max(60, Math.max(topCount, bottomCount) * skinPicker.pitch + 30);
        const minH = Math.max(60, Math.max(leftCount, rightCount) * skinPicker.pitch + 30);

        const nudgePinOffset = (pinName, amount) => {
          setSkinPicker(prev => {
            if (!prev) return prev;
            let val = prev.pinOffsets[pinName];
            if (val === undefined || val === null) {
              const pinIndex = prev.rawPins.findIndex(p => p.name === pinName);
              val = pinIndex * prev.pitch + 15;
            }
            return {
              ...prev,
              pinOffsets: {
                ...prev.pinOffsets,
                [pinName]: Math.max(0, val + amount)
              }
            };
          });
        };
        
        return (
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center font-sans p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95%] animate-in fade-in zoom-in duration-200">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Select Component Photo Skin</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Part: {skinPicker.partNumber}</p>
                </div>
                <button 
                  onClick={() => setSkinPicker(null)}
                  className="text-slate-400 hover:text-slate-600 transition text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>

              {/* Live Search Query Inputs */}
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center space-x-2">
                <input
                  type="text"
                  value={skinPicker.searchQuery || ''}
                  onChange={(e) => setSkinPicker(prev => ({ ...prev, searchQuery: e.target.value }))}
                  placeholder="Edit search query (e.g. ESP32-DevKitC-32E)..."
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-indigo-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchComponentSkin(skinPicker.compId, skinPicker.searchQuery);
                  }}
                />
                <button
                  onClick={() => handleSearchComponentSkin(skinPicker.compId, skinPicker.searchQuery)}
                  disabled={skinPicker.loading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs font-semibold transition"
                >
                  Search
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
                {/* Left Column: Search & Results */}
                <div className="md:col-span-5 p-5 border-r border-slate-100 flex flex-col space-y-4 overflow-y-auto min-h-0">
                  {skinPicker.loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs text-slate-500 font-medium">Searching distributor images...</span>
                    </div>
                  ) : (
                    <>
                      {/* 📋 Visual Candidate Selection Guide */}
                      <div className="space-y-1.5 border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">📋 PCB PHOTO SELECTION GUIDE</span>
                        <svg viewBox="0 0 420 120" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-1.5">
                          {/* Good Candidate Card */}
                          <g transform="translate(5, 5)">
                            <rect width="195" height="110" rx="8" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1" />
                            <text x="10" y="18" fill="#15803d" fontSize="9" fontWeight="bold" fontFamily="sans-serif">✓ GOOD MATCH (Flat Crop)</text>
                            
                            {/* Flat Orthogonal Board */}
                            <rect x="15" y="28" width="55" height="35" rx="3" fill="#166534" />
                            <rect x="25" y="38" width="35" height="15" rx="1" fill="#15803d" />
                            <line x1="15" y1="38" x2="15" y2="52" stroke="#eab308" strokeWidth="2" strokeDasharray="2,2" />
                            <line x1="70" y1="38" x2="70" y2="52" stroke="#eab308" strokeWidth="2" strokeDasharray="2,2" />
                            
                            <text x="80" y="38" fill="#14532d" fontSize="8" fontWeight="bold" fontFamily="sans-serif">Flat Orthogonal</text>
                            <text x="80" y="50" fill="#166534" fontSize="8" fontFamily="sans-serif">• Solid color backdrops</text>
                            <text x="80" y="62" fill="#166534" fontSize="8" fontFamily="sans-serif">• Clear header grids</text>
                            <text x="80" y="74" fill="#166534" fontSize="8" fontFamily="sans-serif">• High edge contrast</text>
                          </g>

                          {/* Bad Candidate Card */}
                          <g transform="translate(210, 5)">
                            <rect width="200" height="110" rx="8" fill="#fef2f2" stroke="#fecaca" strokeWidth="1" />
                            <text x="10" y="18" fill="#b91c1c" fontSize="9" fontWeight="bold" fontFamily="sans-serif">✗ BAD MATCH (Skew/Noise)</text>
                            
                            {/* Perspective / Shadow Board */}
                            <g transform="translate(15, 30) skewX(-15) scale(1, 0.7)">
                              <rect x="0" y="0" width="50" height="30" rx="2" fill="#7f1d1d" />
                            </g>
                            {/* Curved wire/hand line */}
                            <path d="M 12,68 C 22,60 32,75 52,58" fill="none" stroke="#dc2626" strokeWidth="1.5" />
                            
                            <text x="80" y="38" fill="#7f1d1d" fontSize="8" fontWeight="bold" fontFamily="sans-serif">Perspective Skew</text>
                            <text x="80" y="50" fill="#991b1b" fontSize="8" fontFamily="sans-serif">• Wires, tables, shadows</text>
                            <text x="80" y="62" fill="#991b1b" fontSize="8" fontFamily="sans-serif">• Render axes/ledges</text>
                            <text x="80" y="74" fill="#991b1b" fontSize="8" fontFamily="sans-serif">• Hand/fingers in frame</text>
                          </g>
                        </svg>
                        <p className="text-[9px] text-slate-500 bg-slate-50 border border-slate-200/60 p-2 rounded-lg mt-2 leading-relaxed">
                          👉 <b>How to pick:</b> Select a photo that is flat, straight, and has a solid clean background. Avoid images with shadows, angles, wires, or programmers.
                        </p>
                      </div>

                      {skinPicker.images.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          No search results found for this query.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Search Results (Click to Pick & Calibrate):</span>
                          <div className="grid grid-cols-4 gap-2">
                            {skinPicker.images.slice(0, visibleCount).map((url, idx) => {
                              const isSelected = skinPicker.selectedUrl === url;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => setSkinPicker(prev => ({ ...prev, selectedUrl: url, customUrl: '' }))}
                                  className={`relative aspect-square bg-slate-50 rounded-xl border-2 overflow-hidden hover:scale-[1.03] active:scale-[0.98] transition-all flex flex-col items-center justify-center p-1 ${
                                    isSelected ? 'border-indigo-600 shadow-md ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <img 
                                    src={url.startsWith('data:') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`} 
                                    alt={`Result ${idx}`} 
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                    onLoad={(e) => {
                                      e.target.style.display = 'block';
                                    }}
                                  />
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold">
                                      ✓
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          
                          {skinPicker.images.length > visibleCount && (
                            <button
                              onClick={() => setVisibleCount(prev => prev + 12)}
                              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold tracking-wide transition-all mt-2 active:scale-[0.98]"
                            >
                              + Load More Options ({skinPicker.images.length - visibleCount} remaining)
                            </button>
                          )}
                        </div>
                      )}

                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custom Image URL:</label>
                        <input 
                          type="text"
                          placeholder="Paste direct URL to a JPEG/PNG photo..."
                          value={skinPicker.customUrl}
                          onChange={(e) => setSkinPicker(prev => ({ ...prev, customUrl: e.target.value, selectedUrl: e.target.value ? '' : prev.selectedUrl }))}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:bg-white transition"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Right Column: Preview & Detailed Controls */}
                <div className="md:col-span-7 p-5 overflow-y-auto min-h-0 space-y-4">
                  {(skinPicker.selectedUrl || skinPicker.customUrl) ? (
                    <div className="space-y-4">
                      {/* Live Canvas Preview */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Live Alignment Preview:</span>
                          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-sm">
                            <button
                              onClick={() => setPrevZoom(z => Math.max(1, z - 0.25))}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-700 px-1"
                              title="Zoom Out"
                            >
                              ➖
                            </button>
                            <span className="font-mono text-[9px] text-slate-600 font-semibold w-8 text-center">{prevZoom.toFixed(2)}x</span>
                            <button
                              onClick={() => setPrevZoom(z => Math.min(4, z + 0.25))}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-700 px-1"
                              title="Zoom In"
                            >
                              ➕
                            </button>
                            <button
                              onClick={() => { setPrevZoom(1); setPrevPan({ x: 0, y: 0 }); }}
                              className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 border-l border-slate-200 pl-1.5"
                              title="Reset Zoom"
                            >
                              ↩️ Reset
                            </button>
                          </div>
                        </div>
                        <div 
                          className="w-full h-52 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center relative bg-white cursor-move select-none"
                          style={{
                            backgroundImage: 'conic-gradient(#f1f5f9 0.25turn, #e2e8f0 0.25turn 0.5turn, #f1f5f9 0.5turn 0.75turn, #e2e8f0 0.75turn)',
                            backgroundSize: '16px 16px'
                          }}
                        >
                          <canvas
                            ref={previewCanvasRef}
                            className="w-full h-full"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setIsPrevPanning(true);
                              setPrevPanStart({ x: e.clientX - prevPan.x, y: e.clientY - prevPan.y });
                            }}
                            onMouseMove={(e) => {
                              if (!isPrevPanning) return;
                              setPrevPan({ x: e.clientX - prevPanStart.x, y: e.clientY - prevPanStart.y });
                            }}
                            onMouseUp={() => setIsPrevPanning(false)}
                            onMouseLeave={() => setIsPrevPanning(false)}
                          />
                        </div>
                      </div>

                      {/* 🤖 AI Pin Recalibrator Section */}
                      <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">🤖 AI Pin Recalibrator</span>
                          <button
                            onClick={handleCvDetectPins}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold transition flex items-center shadow-sm"
                          >
                            Recalibrate Pins
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          Runs a pixel-scanning Computer Vision peak-detection filter on the photo to auto-detect metal header pin locations. Adjust bezel bounds if headers have empty offset margins.
                        </p>
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold text-slate-500">
                              <span>START MARGIN:</span>
                              <span className="text-indigo-600">{skinPicker.startMargin !== undefined ? skinPicker.startMargin : 12}%</span>
                            </div>
                            <input 
                              type="range"
                              min="0"
                              max="40"
                              value={skinPicker.startMargin !== undefined ? skinPicker.startMargin : 12}
                              onChange={(e) => setSkinPicker(prev => ({ ...prev, startMargin: Number(e.target.value) }))}
                              className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold text-slate-500">
                              <span>END MARGIN:</span>
                              <span className="text-indigo-600">{skinPicker.endMargin !== undefined ? skinPicker.endMargin : 88}%</span>
                            </div>
                            <input 
                              type="range"
                              min="60"
                              max="100"
                              value={skinPicker.endMargin !== undefined ? skinPicker.endMargin : 88}
                              onChange={(e) => setSkinPicker(prev => ({ ...prev, endMargin: Number(e.target.value) }))}
                              className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Tolerance & Crop Controls */}
                      <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-2">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-400">
                            <span>BG REMOVAL TOLERANCE:</span>
                            <span className="text-indigo-600">{skinPicker.tolerance}</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max="120"
                            value={skinPicker.tolerance}
                            onChange={(e) => setSkinPicker(prev => ({ ...prev, tolerance: Number(e.target.value) }))}
                            className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                          />
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                          <input 
                            type="checkbox"
                            id="doCropCheckbox"
                            checked={skinPicker.doCrop}
                            onChange={(e) => setSkinPicker(prev => ({ ...prev, doCrop: e.target.checked }))}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <label htmlFor="doCropCheckbox" className="text-xs font-semibold text-slate-600 select-none cursor-pointer">
                            Auto-Crop Image Bounds
                          </label>
                        </div>
                      </div>

                      {/* Image Aspect Mode & Opacity Controls */}
                      <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-2">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-400">
                            <span>OPACITY:</span>
                            <span className="text-indigo-600">{Math.round(skinPicker.opacity * 100)}%</span>
                          </div>
                          <input 
                            type="range"
                            min="5"
                            max="100"
                            value={Math.round(skinPicker.opacity * 100)}
                            onChange={(e) => setSkinPicker(prev => ({ ...prev, opacity: Number(e.target.value) / 100 }))}
                            className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">IMAGE ASPECT:</span>
                          <select
                            value={skinPicker.aspect}
                            onChange={(e) => setSkinPicker(prev => ({ ...prev, aspect: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 outline-none"
                          >
                            <option value="fit">Aspect Fit (No Distortion)</option>
                            <option value="fill">Aspect Fill (Cover Area)</option>
                            <option value="stretch">Stretch (Fit Boundary)</option>
                          </select>
                        </div>
                      </div>

                      {/* Photo Deskew Controls */}
                      <div className="space-y-1 border-b border-slate-100 pb-2">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400">
                          <span>📐 PHOTO DESKEW (FINE ROTATION):</span>
                          <span className="text-indigo-600">{(skinPicker.deskewAngle || 0)}°</span>
                        </div>
                        <input 
                          type="range"
                          min="-45"
                          max="45"
                          step="0.5"
                          value={skinPicker.deskewAngle || 0}
                          onChange={(e) => setSkinPicker(prev => ({ ...prev, deskewAngle: Number(e.target.value) }))}
                          className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                        />
                      </div>

                      {/* 📋 Visual Candidate Selection Guide */}
                      <div className="space-y-1.5 border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">📋 PCB PHOTO SELECTION GUIDE</span>
                        <svg viewBox="0 0 420 120" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-1.5">
                          {/* Good Candidate Card */}
                          <g transform="translate(5, 5)">
                            <rect width="195" height="110" rx="8" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1" />
                            <text x="10" y="18" fill="#15803d" fontSize="9" fontWeight="bold" fontFamily="sans-serif">✓ GOOD MATCH (Fast Crop)</text>
                            
                            {/* Flat Orthogonal Board */}
                            <rect x="15" y="28" width="55" height="35" rx="3" fill="#166534" />
                            <rect x="25" y="38" width="35" height="15" rx="1" fill="#15803d" />
                            <line x1="15" y1="38" x2="15" y2="52" stroke="#eab308" strokeWidth="2" strokeDasharray="2,2" />
                            <line x1="70" y1="38" x2="70" y2="52" stroke="#eab308" strokeWidth="2" strokeDasharray="2,2" />
                            
                            <text x="80" y="38" fill="#14532d" fontSize="8" fontWeight="bold" fontFamily="sans-serif">Flat Orthogonal</text>
                            <text x="80" y="50" fill="#166534" fontSize="8" fontFamily="sans-serif">• Solid color backdrops</text>
                            <text x="80" y="62" fill="#166534" fontSize="8" fontFamily="sans-serif">• Clear header grids</text>
                            <text x="80" y="74" fill="#166534" fontSize="8" fontFamily="sans-serif">• High edge contrast</text>
                          </g>

                          {/* Bad Candidate Card */}
                          <g transform="translate(210, 5)">
                            <rect width="200" height="110" rx="8" fill="#fef2f2" stroke="#fecaca" strokeWidth="1" />
                            <text x="10" y="18" fill="#b91c1c" fontSize="9" fontWeight="bold" fontFamily="sans-serif">✗ BAD MATCH (Skew/Noise)</text>
                            
                            {/* Perspective / Shadow Board */}
                            <g transform="translate(15, 30) skewX(-15) scale(1, 0.7)">
                              <rect x="0" y="0" width="50" height="30" rx="2" fill="#7f1d1d" />
                            </g>
                            {/* Curved wire/hand line */}
                            <path d="M 12,68 C 22,60 32,75 52,58" fill="none" stroke="#dc2626" strokeWidth="1.5" />
                            
                            <text x="80" y="38" fill="#7f1d1d" fontSize="8" fontWeight="bold" fontFamily="sans-serif">Perspective Skew</text>
                            <text x="80" y="50" fill="#991b1b" fontSize="8" fontFamily="sans-serif">• Wires, tables, shadows</text>
                            <text x="80" y="62" fill="#991b1b" fontSize="8" fontFamily="sans-serif">• Render axes/ledges</text>
                            <text x="80" y="74" fill="#991b1b" fontSize="8" fontFamily="sans-serif">• Hand/fingers in frame</text>
                          </g>
                        </svg>
                      </div>

                      {/* Image Orientation Controls */}
                      <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
                        <button
                          onClick={() => setSkinPicker(prev => ({ ...prev, rotation: ((prev.rotation || 0) + 90) % 360 }))}
                          className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded text-[10px] font-bold text-slate-600 flex items-center justify-center transition"
                        >
                          🔄 Rotate 90°
                        </button>
                        <button
                          onClick={() => setSkinPicker(prev => ({ ...prev, flipH: !prev.flipH }))}
                          className={`px-2 py-1 border rounded text-[10px] font-bold flex items-center justify-center transition ${
                            skinPicker.flipH ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          ↔️ Flip H
                        </button>
                        <button
                          onClick={() => setSkinPicker(prev => ({ ...prev, flipV: !prev.flipV }))}
                          className={`px-2 py-1 border rounded text-[10px] font-bold flex items-center justify-center transition ${
                            skinPicker.flipV ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          ↕️ Flip V
                        </button>
                      </div>

                      {/* Component Sizing & Geometry Sliders */}
                      <div className="space-y-2 border-b border-slate-100 pb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Component Body Geometry:</span>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold text-slate-500">
                              <span>WIDTH:</span>
                              <span className="text-indigo-600">{skinPicker.width}px</span>
                            </div>
                            <input 
                              type="range"
                              min={minW}
                              max="300"
                              step="15"
                              value={skinPicker.width}
                              onChange={(e) => setSkinPicker(prev => ({ ...prev, width: Math.max(minW, Number(e.target.value)) }))}
                              className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold text-slate-500">
                              <span>HEIGHT:</span>
                              <span className="text-indigo-600">{skinPicker.height}px</span>
                            </div>
                            <input 
                              type="range"
                              min={minH}
                              max="800"
                              step="15"
                              value={skinPicker.height}
                              onChange={(e) => setSkinPicker(prev => ({ ...prev, height: Math.max(minH, Number(e.target.value)) }))}
                              className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold text-slate-500">
                              <span>PIN SPACING:</span>
                              <span className="text-indigo-600">{skinPicker.pitch}px</span>
                            </div>
                            <select
                              value={skinPicker.pitch}
                              onChange={(e) => updatePitch(Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 outline-none"
                            >
                              <option value="15">15px (Compact)</option>
                              <option value="30">30px (Double)</option>
                              <option value="45">45px (Wide)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Pin Sides Manager */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Align Pin Positions & Manual Offsets:</span>
                        <div className="max-h-[220px] overflow-y-auto border border-slate-200/80 rounded-lg p-2 space-y-2 bg-white">
                          {skinPicker.rawPins.map((pin, idx) => {
                            const currentSide = skinPicker.sidesMap[pin.name] || 'left';
                            const maxOffset = (currentSide === 'left' || currentSide === 'right') ? skinPicker.height : skinPicker.width;
                            
                            let currentVal = skinPicker.pinOffsets[pin.name];
                            if (currentVal === undefined || currentVal === null) {
                              const pinIndex = skinPicker.rawPins.findIndex(p => p.name === pin.name);
                              currentVal = pinIndex * skinPicker.pitch + 15;
                            }
                            
                            return (
                              <div key={`${pin.name}_${idx}`} className="p-1.5 bg-slate-50/50 rounded border border-slate-100 flex flex-col space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-mono font-bold text-slate-700">{pin.name}</span>
                                  <div className="flex space-x-1">
                                    {['left', 'right', 'top', 'bottom'].map(side => (
                                      <button
                                        key={side}
                                        onClick={() => updateSidesMap(pin.name, side)}
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition ${
                                          currentSide === side 
                                            ? 'bg-indigo-600 text-white shadow-sm' 
                                            : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-200'
                                        }`}
                                      >
                                        {side[0]}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                
                                {/* Pin Offset Slider */}
                                <div className="flex items-center space-x-2">
                                  <input 
                                    type="range"
                                    min="0"
                                    max={maxOffset}
                                    value={currentVal}
                                    onChange={(e) => {
                                      const newVal = Number(e.target.value);
                                      setSkinPicker(prev => ({
                                        ...prev,
                                        pinOffsets: { ...prev.pinOffsets, [pin.name]: newVal }
                                      }));
                                    }}
                                    className="flex-1 accent-slate-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                  />
                                  <div className="flex items-center space-x-1 shrink-0">
                                    <button 
                                      onClick={() => nudgePinOffset(pin.name, -1)}
                                      className="w-4 h-4 bg-white border border-slate-200 rounded flex items-center justify-center text-[10px] font-bold text-slate-600 active:bg-slate-100"
                                    >
                                      -
                                    </button>
                                    <span className="font-mono text-[9px] text-slate-500 w-8 text-center">{currentVal}px</span>
                                    <button 
                                      onClick={() => nudgePinOffset(pin.name, 1)}
                                      className="w-4 h-4 bg-white border border-slate-200 rounded flex items-center justify-center text-[10px] font-bold text-slate-600 active:bg-slate-100"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs">
                      Pick a search result or type a custom URL on the left to activate settings.
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button
                  onClick={() => {
                    setComponents(prev => prev.map(c => 
                      c.id === skinPicker.compId ? { ...c, image: null } : c
                    ));
                    setSkinPicker(null);
                  }}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-100 hover:text-rose-700 transition"
                >
                  Clear Skin
                </button>

                <div className="flex space-x-2">
                  <button
                    onClick={() => setSkinPicker(null)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const finalUrl = skinPicker.customUrl || skinPicker.selectedUrl;
                      setSkinPicker(prev => ({ ...prev, loading: true }));
                      
                      try {
                        // 1. Load the raw image
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.src = finalUrl.startsWith('data:') ? finalUrl : `/api/proxy-image?url=${encodeURIComponent(finalUrl)}`;
                        await new Promise((resolve, reject) => {
                          img.onload = resolve;
                          img.onerror = reject;
                        });
                        
                        // 2. Generate the final processed canvas at high quality
                        const processedCanvas = processImageBackground(
                          img,
                          skinPicker.tolerance,
                          skinPicker.doCrop,
                          skinPicker.deskewAngle || 0,
                          {
                            x: skinPicker.subCropX !== undefined ? skinPicker.subCropX : 0,
                            y: skinPicker.subCropY !== undefined ? skinPicker.subCropY : 0,
                            w: skinPicker.subCropW !== undefined ? skinPicker.subCropW : 100,
                            h: skinPicker.subCropH !== undefined ? skinPicker.subCropH : 100
                          },
                          skinPicker.taperFactor || 0,
                          skinPicker.shearFactor || 0
                        );
                        
                        // 3. Downscale transparent PNG to max 500px to maintain crisp resolution with zero background noise
                        let processedDataUrl = null;
                        if (processedCanvas) {
                          const maxDim = 500;
                          const scale = Math.min(1, maxDim / Math.max(processedCanvas.width, processedCanvas.height));
                          if (scale < 1) {
                            const scaleCanvas = document.createElement('canvas');
                            scaleCanvas.width = Math.round(processedCanvas.width * scale);
                            scaleCanvas.height = Math.round(processedCanvas.height * scale);
                            const scaleCtx = scaleCanvas.getContext('2d');
                            scaleCtx.drawImage(processedCanvas, 0, 0, scaleCanvas.width, scaleCanvas.height);
                            processedDataUrl = scaleCanvas.toDataURL('image/png');
                          } else {
                            processedDataUrl = processedCanvas.toDataURL('image/png');
                          }
                        }
                        
                        const finalPins = distributePinsBySides(
                          skinPicker.rawPins,
                          skinPicker.sidesMap,
                          skinPicker.pitch,
                          skinPicker.width,
                          skinPicker.height,
                          skinPicker.pinOffsets
                        );
                        
                        setComponents(prev => prev.map(c => 
                          c.id === skinPicker.compId ? { 
                            ...c, 
                            width: skinPicker.width,
                            height: skinPicker.height,
                            pins: finalPins,
                            
                            // Save processed transparent PNG as active image
                            image: processedDataUrl || finalUrl,
                            
                            // Store original raw settings for editing
                            rawImage: finalUrl,
                            rawTolerance: skinPicker.tolerance,
                            rawStartMargin: skinPicker.startMargin,
                            rawEndMargin: skinPicker.endMargin,
                            rawDeskewAngle: skinPicker.deskewAngle,
                            rawSubCropX: skinPicker.subCropX,
                            rawSubCropY: skinPicker.subCropY,
                            rawSubCropW: skinPicker.subCropW,
                            rawSubCropH: skinPicker.subCropH,
                            
                            // Reset dynamic drawing transformations so they are not double-applied on schematic
                            imageTolerance: 0,
                            imageCrop: false,
                            imageRotation: skinPicker.rotation || 0,
                            imageFlipH: skinPicker.flipH || false,
                            imageFlipV: skinPicker.flipV || false,
                            imageOpacity: skinPicker.opacity,
                            imageAspect: skinPicker.aspect,
                            imageDeskew: 0,
                            imageSubCropX: 0,
                            imageSubCropY: 0,
                            imageSubCropW: 100,
                            imageSubCropH: 100
                          } : c
                        ));
                      } catch (err) {
                        console.error('[Skin Apply] compression/alignment failed:', err);
                      }
                      
                      setSkinPicker(null);
                    }}
                    disabled={skinPicker.loading}
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:bg-indigo-400 transition"
                  >
                    Apply Skin
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <canvas
        ref={canvasRef}
        width={dimensions.width * dpr}
        height={dimensions.height * dpr}
        style={{ width: dimensions.width, height: dimensions.height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        className={`${getCursorClass()} w-full h-full bg-[#fbf9f5]`}
      />
    </div>
  );
}
