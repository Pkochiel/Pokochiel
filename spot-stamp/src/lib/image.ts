// 写真をリサイズ・圧縮して Blob(JPEG) にする。スマホの巨大写真でも保存/送信できるサイズへ。

export const MAX_INPUT_BYTES = 30 * 1024 * 1024;

export class ImageError extends Error {}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // EXIF の回転情報を反映
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* フォールバック */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressImage(file: File, maxSide = 1280, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new ImageError('画像ファイルを選んでください');
  if (file.size > MAX_INPUT_BYTES) throw new ImageError('画像が大きすぎます（30MBまで）');
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await loadBitmap(file);
  } catch {
    throw new ImageError('この画像は読み込めませんでした（HEIC等の場合はJPEGに変換してください）');
  }
  const w0 = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const h0 = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('画像の処理に失敗しました');
  ctx.drawImage(src, 0, 0, w, h);
  if ('close' in src) src.close();
  let q = quality;
  for (let i = 0; i < 4; i++) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (!blob) throw new ImageError('画像の変換に失敗しました');
    if (blob.size <= 1_200_000 || i === 3) return blob;
    q -= 0.15;
  }
  throw new ImageError('画像の変換に失敗しました');
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('read failed'));
    r.readAsDataURL(blob);
  });
}
