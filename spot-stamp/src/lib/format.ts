export function formatDate(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function relativeTime(t: number, now = Date.now()): string {
  const s = Math.round((now - t) / 1000);
  if (s < 60) return 'たった今';
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}日前`;
  return formatDate(t);
}

/** 外部の地図アプリでルート案内を開くURL */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
