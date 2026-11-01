import type { Spot, Visits } from '../types';
import { parseSpot, parseVisits } from './validation';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
  /** 再送しても成功しない（入力不正・権限なし等）エラーか */
  get permanent(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 408 && this.status !== 429;
  }
}

/** ネットワーク到達不能（オフライン・サーバー停止） */
export class NetworkError extends Error {}

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new NetworkError(err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network error');
  } finally {
    clearTimeout(timer);
  }
  let data: unknown = null;
  const text = await res.text().catch(() => '');
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // 静的ホスティング等で API が存在しない場合は HTML が返る
    if (res.ok || res.status === 404) throw new NetworkError('API not available');
  }
  if (!res.ok) {
    if (res.status >= 500 || (res.status === 404 && !data)) throw new NetworkError(`server error ${res.status}`);
    const msg = (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

const room = (r: string) => `/api/rooms/${encodeURIComponent(r)}`;

export interface RemoteState {
  spots: Spot[];
  visits: Visits;
  deleted: Record<string, number>;
}

export const api = {
  async getState(roomId: string): Promise<RemoteState> {
    const raw = await request<{ spots?: unknown; visits?: unknown; deleted?: unknown }>('GET', `${room(roomId)}/state`);
    const spots = Array.isArray(raw?.spots) ? raw.spots.map(parseSpot).filter((s): s is Spot => s !== null) : [];
    const deleted: Record<string, number> = {};
    if (raw?.deleted && typeof raw.deleted === 'object') {
      for (const [k, v] of Object.entries(raw.deleted)) if (typeof v === 'number') deleted[k] = v;
    }
    return { spots, visits: parseVisits(raw?.visits), deleted };
  },
  async putSpot(roomId: string, spot: Spot, photoData: string | null, removePhoto: boolean): Promise<Spot> {
    const { photoUrl: _p, localPhoto: _l, ...payload } = spot;
    const res = await request<{ spot: unknown }>('PUT', `${room(roomId)}/spots/${encodeURIComponent(spot.id)}`, {
      spot: payload,
      photoData,
      removePhoto,
    }, 60000);
    const saved = parseSpot(res?.spot);
    if (!saved) throw new ApiError('invalid response', 500);
    return saved;
  },
  deleteSpot: (roomId: string, spotId: string, userId: string) =>
    request('DELETE', `${room(roomId)}/spots/${encodeURIComponent(spotId)}?userId=${encodeURIComponent(userId)}`),
  putVisit: (roomId: string, spotId: string, userId: string, nickname: string, at: number) =>
    request('PUT', `${room(roomId)}/visits/${encodeURIComponent(spotId)}`, { userId, nickname, at }),
  deleteVisit: (roomId: string, spotId: string, userId: string) =>
    request('DELETE', `${room(roomId)}/visits/${encodeURIComponent(spotId)}?userId=${encodeURIComponent(userId)}`),
};
