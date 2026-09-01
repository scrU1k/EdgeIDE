import QRCode from 'qrcode';
import jsQR from 'jsqr';

export class QRService {
  /**
   * Generates a data URL for a QR Code image completely offline (high contrast black on white).
   */
  public static async generateQRDataUrl(data: string, darkColor: string = '#000000', lightColor: string = '#ffffff'): Promise<string> {
    try {
      return await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'L',
        margin: 2,
        width: 512,
        color: {
          dark: darkColor,
          light: lightColor
        }
      });
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      throw err;
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
