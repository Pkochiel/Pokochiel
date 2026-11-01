export interface LatLng {
  lat: number;
  lng: number;
}

/** 2点間の距離(m) — Haversine */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  if (m < 100_000) return `${(m / 1000).toFixed(1)}km`;
  return `${Math.round(m / 1000).toLocaleString()}km`;
}

export class GeoError extends Error {}

export function getCurrentPosition(opts: { timeout?: number; highAccuracy?: boolean } = {}): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeoError('この端末では位置情報が使えません'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? '位置情報の利用が許可されていません。ブラウザの設定を確認してください'
            : err.code === err.TIMEOUT
              ? '現在地の取得がタイムアウトしました'
              : '現在地を取得できませんでした';
        reject(new GeoError(msg));
      },
      { enableHighAccuracy: opts.highAccuracy ?? true, timeout: opts.timeout ?? 10000, maximumAge: 30000 },
    );
  });
}

/** 位置情報の許可が既に下りているか（許可ダイアログを勝手に出さないため） */
export async function geoPermissionGranted(): Promise<boolean> {
  try {
    const st = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return st?.state === 'granted';
  } catch {
    return false;
  }
}

export interface PlaceResult {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
}

/** OpenStreetMap Nominatim による地名検索（国内・海外対応） */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  url.searchParams.set('accept-language', 'ja,en');
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`検索に失敗しました (${res.status})`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((d: Record<string, unknown>) => ({
      name: typeof d.name === 'string' && d.name ? d.name : String(d.display_name ?? '').split(',')[0] ?? '',
      displayName: String(d.display_name ?? ''),
      lat: Number(d.lat),
      lng: Number(d.lon),
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

/** 逆ジオコーディング（住所の自動入力用。失敗しても致命的ではない） */
export async function reverseGeocode(p: LatLng, signal?: AbortSignal): Promise<string> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(p.lat));
  url.searchParams.set('lon', String(p.lng));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '16');
  url.searchParams.set('accept-language', 'ja,en');
  const res = await fetch(url, { signal });
  if (!res.ok) return '';
  const data = (await res.json()) as { display_name?: string };
  return typeof data.display_name === 'string' ? data.display_name : '';
}
