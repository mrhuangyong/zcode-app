import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import jsQR from 'jsqr';
import jpeg from 'jpeg-js';

// 相册图片二维码解码：统一转 JPEG 像素后交给 jsQR。
// 图片来自用户主动选择，只在本机内存中解码，不落地、不上传。

const MAX_DECODE_WIDTH = 1280;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export async function decodeQrFromImage(uri: string): Promise<string | null> {
  try {
    const context = ImageManipulator.manipulate(uri).resize({ width: MAX_DECODE_WIDTH });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      base64: true,
      compress: 1,
      format: SaveFormat.JPEG,
    });

    if (!saved.base64) {
      return null;
    }

    const jpegData = jpeg.decode(base64ToBytes(saved.base64), { useTArray: true });
    const pixels = new Uint8ClampedArray(jpegData.data);
    const result = jsQR(pixels, jpegData.width, jpegData.height);

    return result?.data ?? null;
  } catch {
    return null;
  }
}
