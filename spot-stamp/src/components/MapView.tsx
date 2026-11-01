import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Spot } from '../types';
import { categoryInfo } from '../lib/categories';

// 正確な地図: OpenStreetMap のタイル（環境変数で差し替え可能）
const TILE_URL = (import.meta.env.VITE_TILE_URL as string | undefined) ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR =
  (import.meta.env.VITE_TILE_ATTRIBUTION as string | undefined) ??
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

export const JAPAN_CENTER: L.LatLngTuple = [36.2, 138.25];

export interface MapHandle {
  flyTo(lat: number, lng: number, zoom?: number): void;
  getCenter(): { lat: number; lng: number };
  fitSpots(): void;
  showMe(lat: number, lng: number): void;
  invalidate(): void;
}

interface Props {
  spots: Spot[];
  stampedIds?: Set<string>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMapClick?: () => void;
  interactiveMarkers?: boolean;
  initialCenter?: { lat: number; lng: number; zoom: number };
  className?: string;
  onMoveEnd?: (c: { lat: number; lng: number }) => void;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function pinIcon(spot: Spot, stamped: boolean, selected: boolean) {
  const info = categoryInfo(spot.category);
  return L.divIcon({
    className: 'pin-wrap',
    html: `<div class="pin ${stamped ? 'pin--stamped' : ''} ${selected ? 'pin--selected' : ''}" style="--pin:${info.color}">
        <span class="pin__emoji">${info.emoji}</span>
        ${stamped ? '<span class="pin__badge" aria-label="スタンプ獲得済み">✓</span>' : ''}
      </div>
      <div class="pin__label">${escapeHtml(spot.name)}</div>`,
    iconSize: [44, 54],
    iconAnchor: [22, 52],
  });
}

export const MapView = forwardRef<MapHandle, Props>(function MapView(
  { spots, stampedIds, selectedId, onSelect, onMapClick, interactiveMarkers = true, initialCenter, className, onMoveEnd },
  ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, { marker: L.Marker; key: string }>());
  const meMarker = useRef<L.CircleMarker | null>(null);
  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  // 最新のコールバックを参照（地図の再生成を避ける）
  const cb = useRef({ onSelect, onMapClick, onMoveEnd });
  cb.current = { onSelect, onMapClick, onMoveEnd };

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, {
      zoomControl: false,
      worldCopyJump: true,
      minZoom: 2,
      maxBounds: [
        [-85, -360],
        [85, 360],
      ],
    });
    if (initialCenter) m.setView([initialCenter.lat, initialCenter.lng], initialCenter.zoom);
    else m.setView(JAPAN_CENTER, 5);
    const tiles = L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19, crossOrigin: true });
    let tileErrors = 0;
    tiles.on('tileerror', () => {
      tileErrors++;
      if (tileErrors === 8) el.current?.classList.add('map--tile-error');
    });
    tiles.on('tileload', () => {
      tileErrors = 0;
      el.current?.classList.remove('map--tile-error');
    });
    tiles.addTo(m);
    L.control.zoom({ position: 'topright' }).addTo(m);
    m.on('click', () => cb.current.onMapClick?.());
    m.on('moveend', () => {
      const c = m.getCenter();
      cb.current.onMoveEnd?.({ lat: c.lat, lng: L.Util.wrapNum(c.lng, [-180, 180], true) });
    });
    map.current = m;
    // 親要素のサイズ変化に追従
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      markers.current.clear();
      meMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // マーカーの差分更新
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const s of spots) {
      seen.add(s.id);
      const stamped = stampedIds?.has(s.id) ?? false;
      const selected = selectedId === s.id;
      const key = `${s.name}|${s.category}|${s.lat}|${s.lng}|${stamped}|${selected}`;
      const existing = markers.current.get(s.id);
      if (existing) {
        if (existing.key !== key) {
          existing.marker.setLatLng([s.lat, s.lng]);
          existing.marker.setIcon(pinIcon(s, stamped, selected));
          existing.marker.setZIndexOffset(selected ? 1000 : 0);
          existing.key = key;
        }
        continue;
      }
      const marker = L.marker([s.lat, s.lng], {
        icon: pinIcon(s, stamped, selected),
        keyboard: true,
        title: s.name,
        interactive: interactiveMarkers,
        zIndexOffset: selected ? 1000 : 0,
      });
      marker.on('click', () => cb.current.onSelect?.(s.id));
      marker.addTo(m);
      markers.current.set(s.id, { marker, key });
    }
    for (const [id, { marker }] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
  }, [spots, stampedIds, selectedId, interactiveMarkers]);

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng, zoom) {
      const m = map.current;
      if (!m) return;
      m.flyTo([lat, lng], zoom ?? Math.max(m.getZoom(), 14), { duration: 0.8 });
    },
    getCenter() {
      const c = map.current?.getCenter() ?? L.latLng(JAPAN_CENTER);
      return { lat: c.lat, lng: L.Util.wrapNum(c.lng, [-180, 180], true) };
    },
    fitSpots() {
      const m = map.current;
      const list = spotsRef.current;
      if (!m || list.length === 0) return;
      if (list.length === 1) m.setView([list[0]!.lat, list[0]!.lng], 13);
      else m.fitBounds(L.latLngBounds(list.map((s) => [s.lat, s.lng])), { padding: [60, 60], maxZoom: 14 });
    },
    showMe(lat, lng) {
      const m = map.current;
      if (!m) return;
      if (!meMarker.current) {
        meMarker.current = L.circleMarker([lat, lng], {
          radius: 9,
          color: '#fff',
          weight: 3,
          fillColor: '#2a7cff',
          fillOpacity: 1,
          interactive: false,
          className: 'me-marker',
        }).addTo(m);
      } else meMarker.current.setLatLng([lat, lng]);
    },
    invalidate() {
      map.current?.invalidateSize();
    },
  }));

  return <div ref={el} className={`map ${className ?? ''}`} />;
});
