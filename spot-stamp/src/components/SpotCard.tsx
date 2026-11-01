import { useMemo, useState } from 'react';
import type { Spot, Stamp } from '../types';
import { categoryInfo } from '../lib/categories';
import { usePhotoSrc } from '../hooks/usePhotoSrc';
import { useAppState, store } from '../state/store';
import { directionsUrl, formatDate, relativeTime } from '../lib/format';
import { distanceM, formatDistance, type LatLng } from '../lib/geo';
import { StampSeal } from './StampSeal';

interface Props {
  spot: Spot;
  stamp: Stamp | undefined;
  myPos: LatLng | null;
  onClose: () => void;
  onStamp: (spot: Spot) => void;
  onEdit: (spot: Spot) => void;
  stamping: boolean;
}

/** ピンをタップした時に下から出てくるスポット詳細カード */
export function SpotCard({ spot, stamp, myPos, onClose, onStamp, onEdit, stamping }: Props) {
  const info = categoryInfo(spot.category);
  const photo = usePhotoSrc(spot);
  const [photoBroken, setPhotoBroken] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const profile = useAppState((s) => s.profile);
  const visitsForSpot = useAppState((s) => s.room.visits[spot.id]);
  const visitors = useMemo(
    () => Object.entries(visitsForSpot ?? {}).sort((a, b) => a[1].at - b[1].at),
    [visitsForSpot],
  );
  const mine = profile?.userId === spot.createdById;
  const distance = myPos ? distanceM(myPos, spot) : null;
  const pending = useAppState((s) => s.room.queue.some((o) => o.spotId === spot.id && o.kind === 'upsertSpot'));

  const share = async () => {
    const url = new URL(location.href);
    url.searchParams.set('spot', spot.id);
    const text = `${info.emoji} ${spot.name}\n${spot.comment}`.trim();
    try {
      if (navigator.share) {
        await navigator.share({ title: spot.name, text, url: url.toString() });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      store.toast('success', 'リンクをコピーしました');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      store.toast('error', '共有できませんでした');
    }
  };

  const remove = () => {
    if (!confirm(`「${spot.name}」を削除しますか？\nグループの全員の地図から消えます。`)) return;
    try {
      store.deleteSpot(spot.id);
      store.toast('info', 'スポットを削除しました');
      onClose();
    } catch (err) {
      store.toast('error', err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  return (
    <section className={`sheet spot-card ${expanded ? 'sheet--expanded' : ''}`} aria-label={`${spot.name}の詳細`}>
      <button className="sheet__handle" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? '縮める' : '広げる'}>
        <span />
      </button>
      <button className="icon-btn spot-card__close" onClick={onClose} aria-label="閉じる">
        ✕
      </button>

      <div className="spot-card__scroll">
        <div className="spot-card__photo" style={{ '--cat': info.color } as React.CSSProperties}>
          {photo && !photoBroken ? (
            <img src={photo} alt={spot.name} onError={() => setPhotoBroken(true)} loading="lazy" />
          ) : (
            <div className="spot-card__noimg" aria-hidden>
              {info.emoji}
            </div>
          )}
          <span className="chip chip--cat" style={{ background: info.color }}>
            {info.emoji} {info.label}
          </span>
          {stamp && (
            <div className="spot-card__mini-seal" aria-hidden>
              <StampSeal name={stamp.name} category={stamp.category} date={stamp.at} onSite={stamp.onSite} tilt={stamp.tilt} size={88} />
            </div>
          )}
        </div>

        <div className="spot-card__body">
          <h2 className="spot-card__title">{spot.name}</h2>
          <p className="spot-card__meta">
            {distance != null && <span>📍 ここから {formatDistance(distance)}</span>}
            <span>
              by {spot.createdBy}
              {mine && '（あなた）'} ・ {relativeTime(spot.createdAt)}
            </span>
            {pending && <span className="chip chip--pending">未送信</span>}
          </p>
          {spot.comment && <p className="spot-card__comment">“{spot.comment}”</p>}
          {spot.address && <p className="spot-card__address">{spot.address}</p>}

          <div className="spot-card__visitors">
            {visitors.length === 0 ? (
              <span>まだ誰も行っていません。一番乗りのチャンス！</span>
            ) : (
              <span>
                👣 {visitors.length}人が行った：
                {visitors
                  .slice(0, 5)
                  .map(([uid, v]) => (uid === profile?.userId ? 'あなた' : v.nickname))
                  .join('、')}
                {visitors.length > 5 && ` ほか${visitors.length - 5}人`}
              </span>
            )}
          </div>

          <div className="spot-card__actions">
            <a className="btn btn--ghost" href={directionsUrl(spot.lat, spot.lng)} target="_blank" rel="noopener noreferrer">
              🧭 ルート
            </a>
            <button className="btn btn--ghost" onClick={share}>
              📤 共有
            </button>
            {mine && (
              <>
                <button className="btn btn--ghost" onClick={() => onEdit(spot)}>
                  ✏️ 編集
                </button>
                <button className="btn btn--ghost btn--danger" onClick={remove}>
                  🗑 削除
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 片手で押しやすいよう、主ボタンはカード最下部に固定 */}
      <div className="spot-card__cta">
        {stamp ? (
          <div className="stamped-note">
            <span className="stamped-note__icon">🏮</span>
            <span>
              {formatDate(stamp.at)} にスタンプ獲得{stamp.onSite && '（現地認定）'}
            </span>
          </div>
        ) : (
          <button className="btn btn--stamp" onClick={() => onStamp(spot)} disabled={stamping}>
            {stamping ? '押印中…' : (
              <>
                <span className="btn--stamp__icon" aria-hidden>
                  {info.stampWord}
                </span>
                行った！スタンプを押す
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
