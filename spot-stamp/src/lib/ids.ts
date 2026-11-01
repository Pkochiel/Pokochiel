const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

/** URL安全なランダムID */
export function newId(len = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(randomBytes(len), (b) => chars[b % chars.length]).join('');
}

/** グループ（ルーム）の招待コード: 読み間違えにくい文字のみ */
export function newRoomCode(): string {
  const b = randomBytes(8);
  const s = Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}
