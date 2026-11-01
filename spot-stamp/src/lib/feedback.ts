// 押印時の効果音（WebAudioで合成：外部ファイル不要）と振動
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 「ポンッ」という押印音 */
export function playStampSound(muted: boolean) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  try {
    const t = ac.currentTime;
    // 低音のドン
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.3);
    // 紙に当たる「パッ」というノイズ
    const len = Math.floor(ac.sampleRate * 0.08);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const noise = ac.createBufferSource();
    const ng = ac.createGain();
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    ng.gain.value = 0.35;
    noise.buffer = buf;
    noise.connect(filter).connect(ng).connect(ac.destination);
    noise.start(t);
    // キラーン
    [880, 1320].forEach((f, i) => {
      const o = ac.createOscillator();
      const gg = ac.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const st = t + 0.28 + i * 0.09;
      gg.gain.setValueAtTime(0.0001, st);
      gg.gain.exponentialRampToValueAtTime(0.18, st + 0.02);
      gg.gain.exponentialRampToValueAtTime(0.0001, st + 0.35);
      o.connect(gg).connect(ac.destination);
      o.start(st);
      o.stop(st + 0.4);
    });
  } catch {
    /* 音が鳴らなくても機能には影響しない */
  }
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
