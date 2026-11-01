import { useMemo, useState } from 'react';
import type { Category, Spot, Stamp } from '../types';
import { CATEGORIES, categoryInfo } from '../lib/categories';
import { computeBadges, rankFor } from '../lib/achievements';
import { distanceM, formatDistance, type LatLng } from '../lib/geo';
import { formatDate } from '../lib/format';
import { store } from '../state/store';
import { StampSeal } from './StampSeal';

interface Props {
  spots: Spot[];
  stamps: Record<string, Stamp>;
  myPos: LatLng | null;
  onShowOnMap: (spotId: string) => void;
}

type Slot = { kind: 'stamp'; stamp: Stamp; spot: Spot | undefined } | { kind: 'empty'; spot: Spot };

/** マイ・スタンプ帳：集めたスタンプと、まだ空いている枠（＝行きたい気持ち）を並べる */
export function StampBook({ spots, stamps, myPos, onShowOnMap }: Props) {
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [detail, setDetail] = useState<Slot | null>(null);
  const stampList = useMemo(() => Object.values(stamps).sort((a, b) => a.at - b.at), [stamps]);
  const rank = rankFor(stampList.length);
  const badges = useMemo(() => computeBadges(stampList, spots), [stampList, spots]);
  const earnedBadges = badges.filter((b) => b.earned).length;

  const slots: Slot[] = useMemo(() => {
    const spotById = new Map(spots.map((s) => [s.id, s]));
    const stamped: Slot[] = stampList.map((st) => ({ kind: 'stamp', stamp: st, spot: spotById.get(st.spotId) }));
    let empty: Slot[] = spots.filter((s) => !stamps[s.id]).map((s) => ({ kind: 'empty', spot: s }));
    if (myPos) empty = empty.sort((a, b) => distanceM(myPos, a.spot!) - distanceM(myPos, b.spot!));
    return [...stamped, ...empty];
  }, [spots, stamps, stampList, myPos]);

  const filtered = filter === 'all' ? slots : slots.filter((s) => (s.kind === 'stamp' ? s.stamp.category : s.spot.category) === filter);
  const total = new Set([...spots.map((s) => s.id), ...stampList.map((s) => s.spotId)]).size;
  const pct = total ? Math.round((stampList.length / total) * 100) : 0;
  const nextTarget = slots.find((s): s is Extract<Slot, { kind: 'empty' }> => s.kind === 'empty');

  const catCounts = useMemo(() => {
    const m = new Map<Category, { got: number; all: number }>();
    for (const c of CATEGORIES) m.set(c.id, { got: 0, all: 0 });
    for (const s of slots) {
      const cat = s.kind === 'stamp' ? s.stamp.category : s.spot.category;
      const e = m.get(cat)!;
      e.all++;
      if (s.kind === 'stamp') e.got++;
    }
    return m;
  }, [slots]);

  const undo = (st: Stamp) => {
    if (!confirm(`「${st.name}」のスタンプを取り消しますか？`)) return;
    try {
      store.unstamp(st.spotId);
      setDetail(null);
      store.toast('info', 'スタンプを取り消しました');
    } catch (err) {
      store.toast('error', err instanceof Error ? err.message : '取り消しに失敗しました');
    }
  };

  return (
    <div className="book">
      <header className="book__cover">
        <div className="book__rank">
          <span className="book__rank-emoji" aria-hidden>
            {rank.current.emoji}
          </span>
          <div>
            <p className="book__rank-label">いまの称号</p>
            <p className="book__rank-title">{rank.current.title}</p>
          </div>
        </div>
        <div className="book__stats">
          <div>
            <strong>{stampList.length}</strong>
            <span>スタンプ</span>
          </div>
          <div>
            <strong>{pct}%</strong>
            <span>コンプ率</span>
          </div>
          <div>
            <strong>
              {earnedBadges}/{badges.length}
            </strong>
            <span>バッジ</span>
          </div>
        </div>
        {rank.next ? (
          <div className="progress" aria-label={`次の称号まで${rank.next.min - stampList.length}個`}>
            <div className="progress__bar" style={{ width: `${rank.progress * 100}%` }} />
            <span className="progress__label">
              あと<b>{rank.next.min - stampList.length}</b>個で「{rank.next.emoji} {rank.next.title}」
            </span>
          </div>
        ) : (
          <p className="progress__label">最高の称号に到達！あなたは伝説です 👑</p>
        )}
        {nextTarget && (
          <button className="book__next" onClick={() => onShowOnMap(nextTarget.spot.id)}>
            <span>🎯 次はここ！</span>
            <strong>
              {categoryInfo(nextTarget.spot.category).emoji} {nextTarget.spot.name}
            </strong>
            {myPos && <small>{formatDistance(distanceM(myPos, nextTarget.spot))}</small>}
          </button>
        )}
      </header>

      <nav className="book__tabs" aria-label="カテゴリで絞り込み">
        <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>
          すべて {stampList.length}/{total}
        </button>
        {CATEGORIES.filter((c) => (catCounts.get(c.id)?.all ?? 0) > 0).map((c) => {
          const cc = catCounts.get(c.id)!;
          return (
            <button key={c.id} className={filter === c.id ? 'is-active' : ''} onClick={() => setFilter(c.id)}>
              {c.emoji} {cc.got}/{cc.all}
              {cc.got === cc.all && ' 👑'}
            </button>
          );
        })}
      </nav>

      {filtered.length === 0 ? (
        <div className="empty">
          <p className="empty__emoji">🗺️</p>
          <p>まだスポットがありません。</p>
          <p>地図の「＋」からおすすめスポットを登録しよう！</p>
        </div>
      ) : (
        <div className="book__page">
          {filtered.map((s) =>
            s.kind === 'stamp' ? (
              <button key={s.stamp.spotId} className="slot slot--got" onClick={() => setDetail(s)}>
                <StampSeal name={s.stamp.name} category={s.stamp.category} date={s.stamp.at} onSite={s.stamp.onSite} tilt={s.stamp.tilt} size={104} />
                <span className="slot__name">{s.stamp.name}</span>
              </button>
            ) : (
              <button key={s.spot.id} className="slot slot--empty" onClick={() => setDetail(s)}>
                <StampSeal name={s.spot.name} category={s.spot.category} locked size={104} />
                <span className="slot__name">{s.spot.name}</span>
                {myPos && <span className="slot__dist">{formatDistance(distanceM(myPos, s.spot))}</span>}
              </button>
            ),
          )}
        </div>
      )}

      <section className="badges">
        <h3>バッジコレクション</h3>
        <div className="badges__grid">
          {badges.map((b) => (
            <div key={b.id} className={`badge ${b.earned ? 'badge--earned' : ''}`} title={b.description}>
              <span className="badge__emoji">{b.earned ? b.emoji : '🔒'}</span>
              <span className="badge__title">{b.title}</span>
              <span className="badge__desc">{b.description}</span>
              {!b.earned && (
                <span className="badge__progress">
                  <i style={{ width: `${b.progress * 100}%` }} />
                </span>
              )}
              <span className="badge__count">{b.progressLabel}</span>
            </div>
          ))}
        </div>
      </section>

      {detail && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setDetail(null)}>
          <div className="modal__body" onClick={(e) => e.stopPropagation()}>
            {detail.kind === 'stamp' ? (
              <>
                <StampSeal
                  name={detail.stamp.name}
                  category={detail.stamp.category}
                  date={detail.stamp.at}
                  onSite={detail.stamp.onSite}
                  tilt={detail.stamp.tilt}
                  size={200}
                />
                <h3>{detail.stamp.name}</h3>
                <p>
                  {formatDate(detail.stamp.at)} 獲得 {detail.stamp.onSite && '・🏅現地認定'}
                </p>
                {!detail.spot && <p className="muted">※このスポットは削除されましたが、思い出として残っています</p>}
                <div className="modal__actions">
                  {detail.spot && (
                    <button className="btn btn--primary" onClick={() => onShowOnMap(detail.stamp.spotId)}>
                      🗺 地図で見る
                    </button>
                  )}
                  <button className="btn btn--ghost btn--danger" onClick={() => undo(detail.stamp)}>
                    取り消す
                  </button>
                </div>
              </>
            ) : (
              <>
                <StampSeal name={detail.spot.name} category={detail.spot.category} locked size={160} />
                <h3>{detail.spot.name}</h3>
                <p>まだ行っていないスポット。行ってスタンプをゲットしよう！</p>
                {myPos && <p>ここから {formatDistance(distanceM(myPos, detail.spot))}</p>}
                <div className="modal__actions">
                  <button className="btn btn--primary" onClick={() => onShowOnMap(detail.spot.id)}>
                    🗺 地図で見る
                  </button>
                </div>
              </>
            )}
            <button className="icon-btn modal__close" onClick={() => setDetail(null)} aria-label="閉じる">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
