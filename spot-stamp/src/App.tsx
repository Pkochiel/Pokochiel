import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Spot, Stamp } from './types';
import { store, useAppState } from './state/store';
import { CATEGORIES } from './lib/categories';
import { computeBadges } from './lib/achievements';
import { geoPermissionGranted, getCurrentPosition, type LatLng } from './lib/geo';
import { storageAvailable } from './lib/storage';
import { Opening } from './components/Opening';
import { MapView, type MapHandle } from './components/MapView';
import { SpotCard } from './components/SpotCard';
import { SpotForm } from './components/SpotForm';
import { StampCeremony } from './components/StampCeremony';
import { StampBook } from './components/StampBook';
import { GroupPanel } from './components/GroupPanel';
import { SyncBadge, Toasts, Welcome } from './components/Misc';

type Tab = 'map' | 'book' | 'group';

const SYNC_INTERVAL_MS = 30_000;

export default function App() {
  const [opening, setOpening] = useState(true);
  const [tab, setTab] = useState<Tab>('map');
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(location.search).get('spot'));
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [form, setForm] = useState<{ editing: Spot | null; center: { lat: number; lng: number; zoom: number } } | null>(null);
  const [ceremony, setCeremony] = useState<{ stamp: Stamp; unlocked: string[] } | null>(null);
  const [stamping, setStamping] = useState(false);
  const [myPos, setMyPos] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<MapHandle>(null);
  const fittedRoom = useRef<string | null>(null);

  const profile = useAppState((s) => s.profile);
  const roomId = useAppState((s) => s.roomId);
  const spotsObj = useAppState((s) => s.room.spots);
  const stamps = useAppState((s) => s.room.stamps);
  const muted = useAppState((s) => s.settings.muted);

  const spots = useMemo(() => Object.values(spotsObj).sort((a, b) => a.createdAt - b.createdAt), [spotsObj]);
  const visibleSpots = useMemo(() => (filter === 'all' ? spots : spots.filter((s) => s.category === filter)), [spots, filter]);
  const stampedIds = useMemo(() => new Set(Object.keys(stamps)), [stamps]);
  const selected = selectedId ? spotsObj[selectedId] : undefined;

  // ---- 同期のライフサイクル ----
  useEffect(() => {
    if (!storageAvailable()) store.toast('error', 'この端末では保存領域が使えません。プライベートモードを解除してください', 8000);
    void store.sync();
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') void store.sync();
    }, SYNC_INTERVAL_MS);
    const onOnline = () => store.retryNow();
    const onVisible = () => document.visibilityState === 'visible' && void store.sync();
    const onStorage = (e: StorageEvent) => store.reloadFromStorage(e.key);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(tick);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // 位置情報が許可済みなら現在地を追従（距離表示・現地認定のため）
  useEffect(() => {
    let watchId: number | null = null;
    void geoPermissionGranted().then((ok) => {
      if (!ok || !('geolocation' in navigator)) return;
      watchId = navigator.geolocation.watchPosition(
        (p) => setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, maximumAge: 60_000 },
      );
    });
    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    if (myPos) mapRef.current?.showMe(myPos.lat, myPos.lng);
  }, [myPos, tab]);

  // グループを開いた最初の1回だけ、全スポットが見えるように地図を合わせる
  useEffect(() => {
    if (opening || tab !== 'map' || spots.length === 0 || fittedRoom.current === roomId) return;
    fittedRoom.current = roomId;
    const target = selectedId ? spotsObj[selectedId] : undefined;
    if (target) mapRef.current?.flyTo(target.lat, target.lng, 15);
    else mapRef.current?.fitSpots();
  }, [opening, tab, spots.length, roomId, selectedId, spotsObj]);

  // 選択中のスポットが消えたら（他の人が削除など）カードを閉じる
  useEffect(() => {
    if (selectedId && !spotsObj[selectedId] && store.getState().room.lastSyncedAt) setSelectedId(null);
  }, [selectedId, spotsObj]);

  // URL に選択状態を反映（共有・リロード用）
  useEffect(() => {
    try {
      const url = new URL(location.href);
      if (selectedId) url.searchParams.set('spot', selectedId);
      else url.searchParams.delete('spot');
      url.searchParams.set('room', roomId);
      history.replaceState(null, '', url);
    } catch {
      /* ignore */
    }
  }, [selectedId, roomId]);

  const showOnMap = useCallback(
    (id: string) => {
      const s = store.getState().room.spots[id];
      if (!s) return;
      setTab('map');
      setSelectedId(id);
      // タブ切り替えで地図が表示されてから移動
      requestAnimationFrame(() => {
        mapRef.current?.invalidate();
        mapRef.current?.flyTo(s.lat, s.lng, 15);
      });
    },
    [],
  );

  const locate = async () => {
    setLocating(true);
    try {
      const p = await getCurrentPosition();
      setMyPos(p);
      mapRef.current?.flyTo(p.lat, p.lng, 14);
    } catch (err) {
      store.toast('error', err instanceof Error ? err.message : '現在地を取得できませんでした');
    } finally {
      setLocating(false);
    }
  };

  const handleStamp = async (spot: Spot) => {
    if (stamping) return;
    setStamping(true);
    try {
      const before = store.getState().room.stamps;
      const allSpots = Object.values(store.getState().room.spots);
      const earnedBefore = new Set(computeBadges(Object.values(before), allSpots).filter((b) => b.earned).map((b) => b.id));
      const { stamp, isNew } = await store.stamp(spot.id);
      if (!isNew) {
        store.toast('info', 'このスポットのスタンプはもう持っています');
        return;
      }
      const after = Object.values(store.getState().room.stamps);
      const unlocked = computeBadges(after, allSpots)
        .filter((b) => b.earned && !earnedBefore.has(b.id))
        .map((b) => b.title);
      setCeremony({ stamp, unlocked });
    } catch (err) {
      store.toast('error', err instanceof Error ? err.message : 'スタンプを押せませんでした');
    } finally {
      setStamping(false);
    }
  };

  const openForm = (editing: Spot | null) => {
    const c = mapRef.current?.getCenter();
    setForm({ editing, center: { lat: c?.lat ?? 35.681, lng: c?.lng ?? 139.767, zoom: 15 } });
  };

  return (
    <div className="app">
      {opening && <Opening onDone={() => setOpening(false)} />}
      {!opening && !profile && <Welcome />}

      <main className={`screens tab-${tab}`}>
        {/* 地図はタブを切り替えても破棄しない（状態とタイルを保持） */}
        <section className="screen screen--map" hidden={tab !== 'map'} aria-label="マップ">
          <MapView
            ref={mapRef}
            spots={visibleSpots}
            stampedIds={stampedIds}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMapClick={() => setSelectedId(null)}
          />
          <header className="topbar">
            <div className="topbar__row">
              <h1 className="logo">
                <span className="logo__seal">旅</span>スポスタ
              </h1>
              <SyncBadge />
            </div>
            <div className="chips" role="tablist" aria-label="カテゴリで絞り込み">
              <button className={`chip ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
                すべて
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={`chip ${filter === c.id ? 'is-active' : ''}`}
                  style={{ '--cat': c.color } as React.CSSProperties}
                  onClick={() => setFilter(filter === c.id ? 'all' : c.id)}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </header>

          {spots.length === 0 && !selected && (
            <div className="map-empty">
              <p>📍 まだスポットがありません</p>
              <p>右下の「＋」からお気に入りを登録しよう！</p>
            </div>
          )}

          <div className={`map-fabs ${selected ? 'is-hidden' : ''}`}>
            <button className="fab fab--small" onClick={locate} disabled={locating} aria-label="現在地">
              {locating ? '…' : '◎'}
            </button>
            {spots.length > 0 && (
              <button className="fab fab--small" onClick={() => mapRef.current?.fitSpots()} aria-label="全スポットを表示">
                ⤢
              </button>
            )}
            <button className="fab fab--add" onClick={() => openForm(null)} aria-label="スポットを追加">
              ＋
            </button>
          </div>

          {selected && (
            <SpotCard
              key={selected.id}
              spot={selected}
              stamp={stamps[selected.id]}
              myPos={myPos}
              onClose={() => setSelectedId(null)}
              onStamp={handleStamp}
              onEdit={(s) => openForm(s)}
              stamping={stamping}
            />
          )}
        </section>

        {tab === 'book' && (
          <section className="screen screen--scroll" aria-label="マイ・スタンプ帳">
            <StampBook spots={spots} stamps={stamps} myPos={myPos} onShowOnMap={showOnMap} />
          </section>
        )}
        {tab === 'group' && (
          <section className="screen screen--scroll" aria-label="グループ">
            <GroupPanel />
          </section>
        )}
      </main>

      <nav className="tabbar" aria-label="メインメニュー">
        <button className={tab === 'map' ? 'is-active' : ''} onClick={() => setTab('map')} aria-current={tab === 'map'}>
          <span aria-hidden>🗺️</span>マップ
        </button>
        <button className={tab === 'book' ? 'is-active' : ''} onClick={() => setTab('book')} aria-current={tab === 'book'}>
          <span aria-hidden>📖</span>スタンプ帳
          {stampedIds.size > 0 && <i className="tabbar__count">{stampedIds.size}</i>}
        </button>
        <button className={tab === 'group' ? 'is-active' : ''} onClick={() => setTab('group')} aria-current={tab === 'group'}>
          <span aria-hidden>👥</span>グループ
        </button>
      </nav>

      {form && (
        <SpotForm
          editing={form.editing}
          initialCenter={form.center}
          onClose={() => setForm(null)}
          onSaved={(s) => {
            setForm(null);
            setFilter('all');
            showOnMap(s.id);
          }}
        />
      )}

      {ceremony && (
        <StampCeremony
          stamp={ceremony.stamp}
          unlocked={ceremony.unlocked}
          totalStamps={stampedIds.size}
          totalSpots={spots.length}
          muted={muted}
          onClose={() => setCeremony(null)}
          onOpenBook={() => {
            setCeremony(null);
            setSelectedId(null);
            setTab('book');
          }}
        />
      )}

      <Toasts />
    </div>
  );
}
