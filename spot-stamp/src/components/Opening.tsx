import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/feedback';

interface Props {
  onDone: () => void;
}

const PINS = [
  { x: 18, y: 30, e: '♨️', d: 0.15 },
  { x: 72, y: 22, e: '🍜', d: 0.3 },
  { x: 58, y: 62, e: '⛩️', d: 0.45 },
  { x: 26, y: 70, e: '☕', d: 0.6 },
  { x: 84, y: 52, e: '🌲', d: 0.75 },
];

/** 起動時のオープニング演出（タップでスキップ可） */
export function Opening({ onDone }: Props) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);
  const reduced = prefersReducedMotion();

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    setTimeout(onDone, reduced ? 0 : 450);
  };

  useEffect(() => {
    const t = setTimeout(finish, reduced ? 600 : 3300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`opening ${leaving ? 'opening--leave' : ''}`}
      onClick={finish}
      role="button"
      tabIndex={0}
      aria-label="オープニングをスキップ"
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && finish()}
    >
      <div className="opening__grid" aria-hidden />
      <svg className="opening__route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <path d="M18 30 C 40 10, 60 10, 72 22 S 64 52, 58 62 S 30 80, 26 70 S 70 40, 84 52" />
      </svg>
      {PINS.map((p) => (
        <span key={p.e} className="opening__pin" style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d}s` }} aria-hidden>
          <span className="opening__pin-head">{p.e}</span>
        </span>
      ))}
      <div className="opening__center">
        <div className="opening__seal" aria-hidden>
          <span>旅</span>
        </div>
        <h1 className="opening__title">
          <span>スポ</span>
          <span>スタ</span>
        </h1>
        <p className="opening__tagline">好きな場所を、みんなで集めよう。</p>
      </div>
      <p className="opening__skip">タップでスキップ</p>
    </div>
  );
}
