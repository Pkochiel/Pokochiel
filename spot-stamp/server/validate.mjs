// サーバー/クライアント共通の入力検証ロジック（サーバー側の最終防衛ライン）

export const CATEGORIES = ['onsen', 'gourmet', 'cafe', 'sightseeing', 'nature', 'other'];
export const ROOM_RE = /^[a-z0-9][a-z0-9-]{2,31}$/;
export const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
export const LIMITS = {
  name: 60,
  comment: 500,
  address: 200,
  nickname: 24,
  photoBytes: 1_500_000,
  spotsPerRoom: 1000,
};

/** @param {unknown} v */
const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** @param {unknown} v @param {number} max */
const cleanStr = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * スポット入力を検証し、正規化したオブジェクトを返す。
 * @param {any} input
 * @returns {{ ok: true, value: any } | { ok: false, error: string }}
 */
export function validateSpotInput(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'invalid body' };
  const name = cleanStr(input.name, LIMITS.name);
  if (!name) return { ok: false, error: 'name is required' };
  if (!CATEGORIES.includes(input.category)) return { ok: false, error: 'invalid category' };
  if (!isFiniteNum(input.lat) || input.lat < -90 || input.lat > 90) return { ok: false, error: 'invalid lat' };
  if (!isFiniteNum(input.lng) || input.lng < -180 || input.lng > 180) return { ok: false, error: 'invalid lng' };
  const createdBy = cleanStr(input.createdBy, LIMITS.nickname) || '名無し';
  const createdById = cleanStr(input.createdById, 64);
  if (!ID_RE.test(createdById)) return { ok: false, error: 'invalid createdById' };
  const createdAt = isFiniteNum(input.createdAt) ? input.createdAt : Date.now();
  const updatedAt = isFiniteNum(input.updatedAt) ? input.updatedAt : createdAt;
  return {
    ok: true,
    value: {
      name,
      category: input.category,
      lat: input.lat,
      lng: input.lng,
      address: cleanStr(input.address, LIMITS.address),
      comment: cleanStr(input.comment, LIMITS.comment),
      createdBy,
      createdById,
      createdAt,
      updatedAt,
    },
  };
}

/**
 * data URL の画像をデコード（JPEG/PNG/WebP のみ許可）
 * @param {unknown} dataUrl
 * @returns {{ ok: true, ext: string, buf: Buffer } | { ok: false, error: string }}
 */
export function decodeImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return { ok: false, error: 'photo must be a data URL' };
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { ok: false, error: 'unsupported photo format' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0) return { ok: false, error: 'empty photo' };
  if (buf.length > LIMITS.photoBytes) return { ok: false, error: 'photo too large' };
  // マジックバイトで中身を確認（拡張子偽装対策）
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isWebp = buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
  if ((ext === 'jpg' && !isJpg) || (ext === 'png' && !isPng) || (ext === 'webp' && !isWebp)) {
    return { ok: false, error: 'photo content mismatch' };
  }
  return { ok: true, ext, buf };
}
