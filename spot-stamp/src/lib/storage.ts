// localStorage の安全なラッパー。プライベートモードや容量超過でも例外で落ちない。

export class StorageError extends Error {
  constructor(message: string, readonly quota: boolean) {
    super(message);
  }
}

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // Safari のプライベートモード等でアクセス自体が例外になる
  }
}

export function readJson(key: string): unknown {
  const s = ls();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch (err) {
    console.warn(`[storage] failed to read ${key}`, err);
    // 壊れたデータは退避しておく（調査・復旧用）
    try {
      const raw = s.getItem(key);
      if (raw != null) s.setItem(`${key}:corrupt`, raw);
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** 書き込みに失敗したら StorageError を投げる（呼び出し側でユーザーに通知する） */
export function writeJson(key: string, value: unknown): void {
  const s = ls();
  if (!s) throw new StorageError('この端末では保存領域が使えません（プライベートモード等）', false);
  try {
    s.setItem(key, JSON.stringify(value));
  } catch (err) {
    const quota =
      err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    throw new StorageError(quota ? '端末の保存容量が不足しています' : '端末への保存に失敗しました', quota);
  }
}

export function storageAvailable(): boolean {
  const s = ls();
  if (!s) return false;
  try {
    s.setItem('__probe__', '1');
    s.removeItem('__probe__');
    return true;
  } catch {
    return false;
  }
}
