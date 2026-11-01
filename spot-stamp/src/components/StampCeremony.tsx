import { useEffect, useRef, useState } from 'react';
import type { Stamp } from '../types';
import { categoryInfo } from '../lib/categories';
import { playStampSound, prefersReducedMotion, vibrate } from '../lib/feedback';
import { rankFor } from '../lib/achievements';
import { StampSeal } from './StampSeal';

interface Props {
  stamp: Stamp;
  totalStamps: number;
  totalSpots: number;
  muted: boolean;
  /** 今回の押印で新たに獲得した称号/バッジ */
  unlocked: string[];
  onClose: () => void;
  onOpenBook: () => void;
}

/**
 * 押印アニメーション：
 *  1. スタンプ台（ハンコ）が上から降りてくる
 *  2. ドンッ！と押される（画面シェイク・振動・効果音・インクの飛沫）
 *  3. ハンコが離れ、押されたスタンプと紙吹雪
 */
export function StampCeremony({ stamp, totalStamps, totalSpots, muted, unlocked, onClose, onOpenBook }: Props) {
  const info = categoryInfo(stamp.category);
  const reduced = prefersReducedMotion();
  const [phase, setPhase] = useState<'drop' | 'impact' | 'reveal'>(reduced ? 'reveal' : 'drop');
  const closeBtn = useRef<HTMLButtonElement>(null);
  const rank = rankFor(totalStamps);
  const rankUp = rank.current.min === totalStamps && totalStamps > 0;

  useEffect(() => {
    if (reduced) {
      playStampSound(muted);
      vibrate(40);
      return;
    }
    const t1 = setTimeout(() => {
      setPhase('impact');
      playStampSound(muted);
      vibrate([30, 40, 60]);
    }, 650);
    const t2 = setTimeout(() => setPhase('reveal'), 1150);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'reveal') closeBtn.current?.focus();
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={`ceremony ceremony--${phase}`} role="dialog" aria-modal="true" aria-label="スタンプ獲得">
      <div className="ceremony__paper">
        <div className="ceremony__stage">
          {phase !== 'reveal' && (
            <div className="ceremony__hanko" style={{ '--ink': info.ink } as React.CSSProperties} aria-hidden>
              <div className="ceremony__hanko-grip" />
              <div className="ceremony__hanko-face">{info.stampWord}</div>
            </div>
          )}
          <div className="ceremony__seal">
            <StampSeal name={stamp.name} category={stamp.category} date={stamp.at} onSite={stamp.onSite} tilt={stamp.tilt} size={220} />
          </div>
          {phase !== 'drop' && (
            <div className="ceremony__splash" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} style={{ '--a': `${i * 36}deg`, '--ink': info.ink } as React.CSSProperties} />
              ))}
            </div>
          )}
        </div>
        {phase === 'reveal' && (
          <>
            <div className="confetti" aria-hidden>
              {Array.from({ length: 28 }, (_, i) => (
                <i
                  key={i}
                  style={
                    {
                      '--x': `${(i * 37) % 100}%`,
                      '--d': `${(i % 7) * 0.08}s`,
                      '--c': ['#e85d5d', '#f6c343', '#4a7fd0', '#3fa463', '#f08a32'][i % 5],
                      '--r': `${(i * 53) % 360}deg`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
            <div className="ceremony__text">
              <p className="ceremony__get">スタンプゲット！</p>
              <h2>{stamp.name}</h2>
              {stamp.onSite && <p className="ceremony__onsite">🏅 現地認定スタンプ！</p>}
              {rankUp && (
                <p className="ceremony__rankup">
                  {rank.current.emoji} 称号「{rank.current.title}」になった！
                </p>
              )}
              {unlocked.map((u) => (
                <p key={u} className="ceremony__badge">
                  🎖 バッジ「{u}」獲得！
                </p>
              ))}
              <p className="ceremony__progress">
                コレクション {totalStamps} / {Math.max(totalSpots, totalStamps)}
                {rank.next && `　・　あと${rank.next.min - totalStamps}個で「${rank.next.title}」`}
              </p>
              <div className="ceremony__buttons">
                <button className="btn btn--ghost" onClick={onOpenBook}>
                  📖 スタンプ帳を見る
                </button>
                <button ref={closeBtn} className="btn btn--primary" onClick={onClose}>
                  つぎへ
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
