import { useId } from 'react';
import type { Category } from '../types';
import { categoryInfo } from '../lib/categories';

interface Props {
  name: string;
  category: Category;
  date?: number;
  onSite?: boolean;
  tilt?: number;
  size?: number;
  /** 未獲得（シルエット表示） */
  locked?: boolean;
  className?: string;
}

function fmtDate(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** 名前が長い場合は円周に収まるよう切り詰め */
function fitName(name: string) {
  const chars = Array.from(name);
  return chars.length > 10 ? `${chars.slice(0, 9).join('')}…` : name;
}

/** 特製スタンプ（SVG）。インクのかすれをフィルタで表現 */
export function StampSeal({ name, category, date, onSite, tilt = 0, size = 120, locked, className }: Props) {
  const uid = useId().replace(/:/g, '');
  const info = categoryInfo(category);
  const ink = locked ? '#b9b2a6' : info.ink;
  const top = `top-${uid}`;
  const bottom = `bot-${uid}`;
  const rough = `rough-${uid}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={locked ? `${name}（未獲得）` : `${name}のスタンプ`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <defs>
        <path id={top} d="M 44 100 A 56 56 0 0 1 156 100" />
        <path id={bottom} d="M 29 100 A 71 71 0 0 0 171 100" />
        <filter id={rough} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={uid.length} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" result="disp" />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75"
            result="holes"
          />
          <feComposite in="disp" in2="holes" operator="in" />
        </filter>
      </defs>
      <g filter={locked ? undefined : `url(#${rough})`} fill="none" stroke={ink} opacity={locked ? 0.7 : 0.92}>
        <circle cx="100" cy="100" r="92" strokeWidth="7" strokeDasharray={locked ? '10 8' : undefined} />
        <circle cx="100" cy="100" r="80" strokeWidth="2.5" />
        <circle cx="100" cy="100" r="44" strokeWidth="2.5" />
        {!locked && (
          <>
            <text fill={ink} stroke="none" fontSize="16" fontWeight="800" letterSpacing="1" textAnchor="middle">
              <textPath href={`#${top}`} startOffset="50%">
                {fitName(name)}
              </textPath>
            </text>
            <text fill={ink} stroke="none" fontSize="14" fontWeight="700" letterSpacing="2" textAnchor="middle">
              <textPath href={`#${bottom}`} startOffset="50%">
                {date ? fmtDate(date) : ''}
              </textPath>
            </text>
            <text
              x="100"
              y="118"
              fill={ink}
              stroke="none"
              fontSize="54"
              fontWeight="900"
              textAnchor="middle"
              fontFamily="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif"
            >
              {info.stampWord}
            </text>
            <circle cx="37" cy="100" r="3.5" fill={ink} stroke="none" />
            <circle cx="163" cy="100" r="3.5" fill={ink} stroke="none" />
          </>
        )}
        {locked && (
          <text x="100" y="118" fill={ink} stroke="none" fontSize="52" fontWeight="900" textAnchor="middle">
            ?
          </text>
        )}
      </g>
      {onSite && !locked && (
        <g transform="translate(150 150)">
          <circle r="24" fill="#f6c343" stroke="#b8860b" strokeWidth="3" />
          <text y="-3" fontSize="11" fontWeight="900" fill="#7a4f00" textAnchor="middle">
            現地
          </text>
          <text y="11" fontSize="11" fontWeight="900" fill="#7a4f00" textAnchor="middle">
            認定
          </text>
        </g>
      )}
    </svg>
  );
}
