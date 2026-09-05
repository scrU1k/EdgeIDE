import QRCode from 'qrcode';
import jsQR from 'jsqr';

export interface QROptions {
  accentColor?: string;
  badgeType?: 'code' | 'device' | 'file';
  label?: string;
  fileName?: string;
  darkColor?: string;
  lightColor?: string;
  size?: number;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
    return;
  }
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export class QRService {
  /**
   * Generates a custom EdgeIDE-themed QR Code data URL completely offline.
   * Includes IDE HUD reticle brackets, accent-colored finder pupils, rounded data modules,
   * and a central code-terminal emblem with traffic light dots and </> or >_ glyphs.
   */
  public static async generateQRDataUrl(
    data: string,
    optionsOrDark?: string | QROptions,
    lightColorParam: string = '#ffffff'
  ): Promise<string> {
    let options: QROptions = {};
    if (typeof optionsOrDark === 'string') {
      options.darkColor = optionsOrDark;
      options.lightColor = lightColorParam;
    } else if (optionsOrDark) {
      options = optionsOrDark;
    }

    const accentColor = options.accentColor || '#6366f1';
    const badgeType = options.badgeType || 'code';
    const darkColor = options.darkColor || '#09090f';
    const lightColor = options.lightColor || '#ffffff';
    const canvasSize = options.size || 600;

    try {
      // 1. Generate QR matrix with high error correction (fallback smoothly if data payload is large)
      let qr: any;
      const errorLevels: ('H' | 'Q' | 'M')[] = ['H', 'Q', 'M'];
      for (const level of errorLevels) {
        try {
          qr = QRCode.create(data, { errorCorrectionLevel: level });
          break;
        } catch (err) {
          if (level === 'M') throw err;
        }
      }

      if (!qr || !qr.modules) {
        throw new Error('QR matrix generation failed');
      }

      const matrixSize = qr.modules.size;
      const quietZone = 4;
      const totalModules = matrixSize + quietZone * 2;
      const cellSize = canvasSize / totalModules;
      const startX = quietZone * cellSize;
      const startY = quietZone * cellSize;

      // 2. Offscreen Canvas
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback to default QRCode if canvas context is unavailable
        return await QRCode.toDataURL(data, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: canvasSize,
          color: { dark: darkColor, light: lightColor }
        });
      }

      // 3. Crisp Light Background with rounded corners
      ctx.fillStyle = lightColor;
      ctx.beginPath();
      drawRoundedRect(ctx, 0, 0, canvasSize, canvasSize, 24);
      ctx.fill();

      // 4. Viewfinder / HUD Reticle Corner Brackets in Accent Color
      ctx.save();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = Math.max(2.5, cellSize * 0.35);
      ctx.lineCap = 'round';
      const bracketMargin = cellSize * 1.0;
      const bracketLen = cellSize * 2.2;
      const bLeft = bracketMargin;
      const bTop = bracketMargin;
      const bRight = canvasSize - bracketMargin;
      const bBottom = canvasSize - bracketMargin;

      // Top-Left ┌
      ctx.beginPath();
      ctx.moveTo(bLeft, bTop + bracketLen);
      ctx.lineTo(bLeft, bTop);
      ctx.lineTo(bLeft + bracketLen, bTop);
      ctx.stroke();

      // Top-Right ┐
      ctx.beginPath();
      ctx.moveTo(bRight - bracketLen, bTop);
      ctx.lineTo(bRight, bTop);
      ctx.lineTo(bRight, bTop + bracketLen);
      ctx.stroke();

      // Bottom-Left └
      ctx.beginPath();
      ctx.moveTo(bLeft, bBottom - bracketLen);
      ctx.lineTo(bLeft, bBottom);
      ctx.lineTo(bLeft + bracketLen, bBottom);
      ctx.stroke();

      // Bottom-Right ┘
      ctx.beginPath();
      ctx.moveTo(bRight - bracketLen, bBottom);
      ctx.lineTo(bRight, bBottom);
      ctx.lineTo(bRight, bBottom - bracketLen);
      ctx.stroke();
      ctx.restore();

      // Helper to identify finder pattern areas
      const isFinderArea = (r: number, c: number): boolean => {
        if (r < 7 && c < 7) return true;
        if (r < 7 && c >= matrixSize - 7) return true;
        if (r >= matrixSize - 7 && c < 7) return true;
        return false;
      };

      // 5. Draw Rounded Data Modules (excluding finder pattern zones)
      ctx.fillStyle = darkColor;
      const moduleGap = Math.max(0.6, cellSize * 0.05);
      const moduleRadius = Math.max(1, (cellSize - moduleGap) * 0.28);

      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          if (isFinderArea(r, c)) continue;
          if (qr.modules.get(r, c)) {
            const x = startX + c * cellSize + moduleGap / 2;
            const y = startY + r * cellSize + moduleGap / 2;
            const w = cellSize - moduleGap;
            const h = cellSize - moduleGap;
            ctx.beginPath();
            drawRoundedRect(ctx, x, y, w, h, moduleRadius);
            ctx.fill();
          }
        }
      }

      // 6. Draw 3 Finder Patterns with Accent-Colored Center Pupils
      const finderPositions = [
        [0, 0],
        [0, matrixSize - 7],
        [matrixSize - 7, 0]
      ];

      for (const [fr, fc] of finderPositions) {
        const fx = startX + fc * cellSize;
        const fy = startY + fr * cellSize;
        const fSize = 7 * cellSize;

        // Outer 7x7 dark frame
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        drawRoundedRect(ctx, fx, fy, fSize, fSize, cellSize * 1.3);
        ctx.fill();

        // Inner 5x5 light cut-out
        ctx.fillStyle = lightColor;
        ctx.beginPath();
        drawRoundedRect(ctx, fx + cellSize, fy + cellSize, 5 * cellSize, 5 * cellSize, cellSize * 0.9);
        ctx.fill();

        // Center 3x3 pupil in Accent Color
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        drawRoundedRect(ctx, fx + 2 * cellSize, fy + 2 * cellSize, 3 * cellSize, 3 * cellSize, cellSize * 0.7);
        ctx.fill();
      }

      // 7. Center Code Emblem Badge
      const badgePixelSize = Math.round(matrixSize * cellSize * 0.20);
      const cx = canvasSize / 2;
      const cy = canvasSize / 2;
      const bx = cx - badgePixelSize / 2;
      const by = cy - badgePixelSize / 2;

      // Clean white protective halo around badge
      const safetyPadding = cellSize * 0.45;
      ctx.fillStyle = lightColor;
      ctx.beginPath();
      drawRoundedRect(
        ctx,
        bx - safetyPadding,
        by - safetyPadding,
        badgePixelSize + safetyPadding * 2,
        badgePixelSize + safetyPadding * 2,
        badgePixelSize * 0.32
      );
      ctx.fill();

      // Deep IDE Obsidian badge container
      ctx.fillStyle = '#0c0e17';
      ctx.beginPath();
      drawRoundedRect(ctx, bx, by, badgePixelSize, badgePixelSize, badgePixelSize * 0.24);
      ctx.fill();

      // Subtle accent border around badge
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = Math.max(2, badgePixelSize * 0.035);
      ctx.stroke();

      // Mini terminal traffic light dots at top of badge
      const dotY = by + badgePixelSize * 0.23;
      const dotSpacing = badgePixelSize * 0.15;
      const dotR = Math.max(1.8, badgePixelSize * 0.036);

      // Red dot
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx - dotSpacing, dotY, dotR, 0, Math.PI * 2);
      ctx.fill();

      // Yellow dot
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(cx, dotY, dotR, 0, Math.PI * 2);
      ctx.fill();

      // Green dot
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(cx + dotSpacing, dotY, dotR, 0, Math.PI * 2);
      ctx.fill();

      // Code Glyph in Center (< / > or >_)
      const glyphY = by + badgePixelSize * 0.67;
      const fontSize = Math.round(badgePixelSize * 0.36);
      ctx.font = `bold ${fontSize}px 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (badgeType === 'device') {
        // Terminal Prompt: >_
        ctx.fillStyle = accentColor;
        ctx.fillText('>', cx - fontSize * 0.25, glyphY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('_', cx + fontSize * 0.25, glyphY);
      } else {
        // Code Brackets: < / >
        ctx.fillStyle = accentColor;
        ctx.fillText('<', cx - fontSize * 0.45, glyphY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('/', cx, glyphY);
        ctx.fillStyle = accentColor;
        ctx.fillText('>', cx + fontSize * 0.45, glyphY);
      }

      // 8. Bottom Monospace Watermark Tag
      const defaultTag = badgeType === 'file' 
        ? (options.fileName ? `// ${options.fileName}` : '// FILE TRANSFER') 
        : '// DEVICE PAIR';
      const tagText = options.label || defaultTag;

      ctx.fillStyle = '#64748b'; // slate-500
      ctx.font = `600 ${Math.max(10, Math.round(cellSize * 0.72))}px 'JetBrains Mono', 'Fira Code', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText.toUpperCase(), cx, canvasSize - cellSize * 1.5);

      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Failed to generate custom QR code:', err);
      // Resilient fallback to basic black & white
      return await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: canvasSize,
        color: { dark: darkColor, light: lightColor }
      });
    }
  }

  /**
   * Starts a high-performance camera stream on the provided video element and scans for QR codes continuously.
   * Leverages hardware-accelerated BarcodeDetector where available with jsQR fallback.
   */
  public static startCameraScanner(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    onSuccess: (scannedText: string) => void,
    onError?: (err: Error) => void
  ): () => void {
    let isScanning = true;
    let stream: MediaStream | null = null;
    let animationFrameId: number | null = null;

    let barcodeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        barcodeDetector = null;
      }
    }

    const ctx = canvasElement.getContext('2d', { willReadFrequently: true });

    async function initCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        videoElement.srcObject = stream;
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('webkit-playsinline', 'true');
        videoElement.muted = true;

        // Wait for metadata before playing to avoid DOMException on mobile/localhost
        await new Promise<void>(resolve => {
          if (videoElement.readyState >= 1) {
            resolve();
          } else {
            videoElement.addEventListener('loadedmetadata', () => resolve(), { once: true });
          }
        });

        try {
          await videoElement.play();
        } catch (playErr) {
          console.warn('Direct video play error:', playErr);
        }
        
        requestAnimationFrame(tick);
      } catch (err: any) {
        if (onError) onError(err);
      }
    }

    async function tick() {
      if (!isScanning) return;

      const hasVideoFrame = videoElement.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0;

      if (hasVideoFrame) {
        // 1. Try hardware-accelerated BarcodeDetector (instant on Android Chrome / WebView)
        if (barcodeDetector) {
          try {
            const barcodes = await barcodeDetector.detect(videoElement);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              isScanning = false;
              navigator.vibrate?.(80);
              onSuccess(barcodes[0].rawValue);
              cleanup();
              return;
            }
          } catch (detErr) {
            // Fall through to jsQR
          }
        }

        // 2. jsQR engine with attemptBoth for maximum accuracy
        if (ctx) {
          canvasElement.height = videoElement.videoHeight;
          canvasElement.width = videoElement.videoWidth;
          ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

          const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });

          if (code && code.data) {
            isScanning = false;
            navigator.vibrate?.(80);
            onSuccess(code.data);
            cleanup();
            return;
          }
        }
      }

      animationFrameId = requestAnimationFrame(tick);
    }

    function cleanup() {
      isScanning = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      videoElement.srcObject = null;
    }

    initCamera();

    return cleanup;
  }
}
