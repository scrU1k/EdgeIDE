import QRCode from 'qrcode';
import jsQR from 'jsqr';

export class QRService {
  /**
   * Generates a data URL for a QR Code image completely offline.
   */
  public static async generateQRDataUrl(data: string, darkColor: string = '#000000', lightColor: string = '#ffffff'): Promise<string> {
    try {
      return await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
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
   * Starts a camera stream on the provided video element and scans for QR codes continuously.
   * Returns a cleanup function that stops the camera tracks and scanning loop.
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

    const ctx = canvasElement.getContext('2d', { willReadFrequently: true });

    async function initCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        videoElement.srcObject = stream;
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('webkit-playsinline', 'true');
        videoElement.setAttribute('autoplay', 'true');
        videoElement.muted = true;
        videoElement.setAttribute('muted', 'true');
        
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

    function tick() {
      if (!isScanning) return;

      if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA && ctx) {
        canvasElement.height = videoElement.videoHeight;
        canvasElement.width = videoElement.videoWidth;
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          isScanning = false;
          onSuccess(code.data);
          cleanup();
          return;
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
