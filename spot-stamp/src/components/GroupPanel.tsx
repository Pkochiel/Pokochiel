import { useMemo, useState } from 'react';
import { DEFAULT_ROOM, store, useAppState } from '../state/store';
import { newRoomCode } from '../lib/ids';
import { LIMITS, ROOM_RE } from '../lib/validation';

/** グループ（共有）・ランキング・設定 */
export function GroupPanel() {
  const roomId = useAppState((s) => s.roomId);
  const profile = useAppState((s) => s.profile);
  const spots = useAppState((s) => s.room.spots);
  const visits = useAppState((s) => s.room.visits);
  const muted = useAppState((s) => s.settings.muted);
  const server = useAppState((s) => s.serverAvailable);
  const [code, setCode] = useState('');
  const [nick, setNick] = useState(profile?.nickname ?? '');

  const inviteUrl = useMemo(() => {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('room', roomId);
    return u.toString();
  }, [roomId]);

  // メンバーごとのスタンプ数・登録数ランキング
  const ranking = useMemo(() => {
    const m = new Map<string, { name: string; stamps: number; posts: number }>();
    for (const [, users] of Object.entries(visits)) {
      for (const [uid, v] of Object.entries(users)) {
        const e = m.get(uid) ?? { name: v.nickname, stamps: 0, posts: 0 };
        e.stamps++;
        m.set(uid, e);
      }
    }
    for (const s of Object.values(spots)) {
      const e = m.get(s.createdById) ?? { name: s.createdBy, stamps: 0, posts: 0 };
      e.posts++;
      m.set(s.createdById, e);
    }
    return [...m.entries()].sort((a, b) => b[1].stamps - a[1].stamps || b[1].posts - a[1].posts).slice(0, 20);
  }, [spots, visits]);

  const share = async () => {
    const text = `スポスタのグループ「${roomId}」に参加して、一緒にスタンプを集めよう！`;
    try {
      if (navigator.share) await navigator.share({ title: 'スポスタに招待', text, url: inviteUrl });
      else {
        await navigator.clipboard.writeText(`${text}\n${inviteUrl}`);
        store.toast('success', '招待リンクをコピーしました');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      store.toast('error', 'コピーできませんでした。コードを直接伝えてください');
    }
  };

  const join = (id: string) => {
    try {
      store.switchRoom(id);
      setCode('');
      store.toast('success', `グループ「${id}」に切り替えました`);
    } catch (err) {
      store.toast('error', err instanceof Error ? err.message : '参加できませんでした');
    }
  };

  const saveNick = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      store.setProfile(nick);
      store.toast('success', 'ニックネームを変更しました');
    } catch (err) {
      store.toast('error', err instanceof Error ? err.message : '変更できませんでした');
    }
  };

  const codeValid = ROOM_RE.test(code.trim().toLowerCase());

  return (
    <div className="panel">
      <section className="card">
        <h3>👥 いまのグループ</h3>
        <p className="room-code">{roomId}</p>
        {roomId === DEFAULT_ROOM && <p className="muted">誰でも参加できる公開グループです。仲間うちで共有するなら新しいグループを作ろう。</p>}
        {server === false && <p className="muted">⚠️ 共有サーバーに接続できません。データは端末に保存され、接続できたら自動で送信されます。</p>}
        <div className="row">
          <button className="btn btn--primary" onClick={share}>
            📨 招待リンクを送る
          </button>
          <button className="btn btn--ghost" onClick={() => join(newRoomCode())}>
            ✨ 新しいグループを作る
          </button>
        </div>
      </section>

      <section className="card">
        <h3>🔑 グループに参加</h3>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (codeValid) join(code.trim().toLowerCase());
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="招待コード（例：ab12-cd34）"
            autoCapitalize="none"
            autoCorrect="off"
            aria-label="招待コード"
          />
          <button className="btn btn--ghost" type="submit" disabled={!codeValid}>
            参加
          </button>
        </form>
        {roomId !== DEFAULT_ROOM && (
          <button className="link-btn" onClick={() => join(DEFAULT_ROOM)}>
            公開グループに戻る
          </button>
        )}
      </section>

      <section className="card">
        <h3>🏆 グループランキング</h3>
        {ranking.length === 0 ? (
          <p className="muted">まだ記録がありません</p>
        ) : (
          <ol className="ranking">
            {ranking.map(([uid, r], i) => (
              <li key={uid} className={uid === profile?.userId ? 'is-me' : ''}>
                <span className="ranking__pos">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
                <span className="ranking__name">
                  {r.name}
                  {uid === profile?.userId && '（あなた）'}
                </span>
                <span className="ranking__val">🏮 {r.stamps}</span>
                <span className="ranking__val">📍 {r.posts}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card">
        <h3>⚙️ 設定</h3>
        <form className="row" onSubmit={saveNick}>
          <input value={nick} maxLength={LIMITS.nickname} onChange={(e) => setNick(e.target.value)} aria-label="ニックネーム" />
          <button className="btn btn--ghost" type="submit" disabled={!nick.trim() || nick.trim() === profile?.nickname}>
            変更
          </button>
        </form>
        <label className="toggle">
          <input type="checkbox" checked={!muted} onChange={(e) => store.setMuted(!e.target.checked)} />
          <span>押印の効果音</span>
        </label>
        <p className="muted small">地図データ © OpenStreetMap contributors</p>
      </section>
    </div>
  );
}
