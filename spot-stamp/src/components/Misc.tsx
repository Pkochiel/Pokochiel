import { Component, useState, type ReactNode } from 'react';
import { store, useAppState } from '../state/store';
import { LIMITS } from '../lib/validation';

export function Toasts() {
  const toasts = useAppState((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast toast--${t.kind}`} onClick={() => store.dismissToast(t.id)}>
          {t.kind === 'error' ? '⚠️ ' : t.kind === 'success' ? '✅ ' : 'ℹ️ '}
          {t.message}
        </button>
      ))}
    </div>
  );
}

export function SyncBadge() {
  const status = useAppState((s) => s.syncStatus);
  const pending = useAppState((s) => s.room.queue.length);
  const server = useAppState((s) => s.serverAvailable);
  let label: string;
  let cls: string;
  if (server === false && status !== 'syncing') {
    label = pending ? `端末に保存中（未送信${pending}件）` : '端末のみで保存中';
    cls = 'offline';
  } else if (status === 'syncing') {
    label = '同期中…';
    cls = 'syncing';
  } else if (status === 'offline' || pending > 0) {
    label = `オフライン（未送信${pending}件）`;
    cls = 'offline';
  } else if (status === 'error') {
    label = '同期エラー';
    cls = 'error';
  } else {
    label = '同期済み';
    cls = 'ok';
  }
  return (
    <button className={`sync sync--${cls}`} onClick={() => store.retryNow()} aria-label={`${label}（タップで再同期）`}>
      <span className="sync__dot" />
      {label}
    </button>
  );
}

/** 初回のみ：ニックネーム登録 */
export function Welcome() {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      store.setProfile(name);
      void store.sync();
    } catch (er) {
      setErr(er instanceof Error ? er.message : '登録できませんでした');
    }
  };
  return (
    <div className="welcome">
      <form className="welcome__card" onSubmit={submit}>
        <p className="welcome__emoji">🎒</p>
        <h2>ようこそ、スポスタへ！</h2>
        <p>お気に入りの場所を地図に集めて、みんなでスタンプラリー。まずはニックネームを決めよう。</p>
        <input
          autoFocus
          value={name}
          maxLength={LIMITS.nickname}
          onChange={(e) => {
            setName(e.target.value);
            setErr('');
          }}
          placeholder="ニックネーム（例：湯けむり太郎）"
          aria-label="ニックネーム"
        />
        {err && <p className="field__error">{err}</p>}
        <button className="btn btn--primary btn--block" type="submit" disabled={!name.trim()}>
          はじめる
        </button>
      </form>
    </div>
  );
}

interface EBState {
  error: Error | null;
}

/** 予期しない描画エラーで真っ白にならないように */
export class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }
  componentDidCatch(error: Error, info: unknown) {
    console.error('[ui] crashed', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="welcome">
        <div className="welcome__card">
          <p className="welcome__emoji">🙇</p>
          <h2>エラーが発生しました</h2>
          <p>スポットやスタンプのデータは端末に保存されています。再読み込みしてください。</p>
          <pre className="error-detail">{this.state.error.message}</pre>
          <button className="btn btn--primary btn--block" onClick={() => location.reload()}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }
}
