import { useEffect, useRef, useState } from 'react';
import type { Spot } from '../types';
import { CATEGORIES } from '../lib/categories';
import { LIMITS, validateDraft, type DraftErrors, type SpotDraft } from '../lib/validation';
import { compressImage, ImageError } from '../lib/image';
import { getCurrentPosition, reverseGeocode, searchPlaces, type PlaceResult } from '../lib/geo';
import { usePhotoSrc } from '../hooks/usePhotoSrc';
import { store } from '../state/store';
import { MapView, type MapHandle } from './MapView';

interface Props {
  editing: Spot | null;
  initialCenter: { lat: number; lng: number; zoom: number };
  onClose: () => void;
  onSaved: (spot: Spot) => void;
}

/** スポット登録・編集フォーム（地図の中心で場所を決める＝片手でドラッグするだけ） */
export function SpotForm({ editing, initialCenter, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<SpotDraft>(() => ({
    name: editing?.name ?? '',
    category: editing?.category ?? '',
    lat: editing?.lat ?? initialCenter.lat,
    lng: editing?.lng ?? initialCenter.lng,
    address: editing?.address ?? '',
    comment: editing?.comment ?? '',
  }));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined); // undefined=変更なし
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const addressTouched = useRef(!!editing?.address);
  const mapRef = useRef<MapHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const existingPhoto = usePhotoSrc(editing);
  const geoAbort = useRef<AbortController | null>(null);
  const dirty = useRef(false);

  const update = (patch: Partial<SpotDraft>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof DraftErrors];
      if ('lat' in patch) delete next.location;
      return next;
    });
  };

  useEffect(() => {
    if (!(photo instanceof Blob)) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => () => geoAbort.current?.abort(), []);

  // 地図を動かしたら、中心の住所を自動入力（手入力されていれば上書きしない）
  const revTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMoveEnd = (c: { lat: number; lng: number }) => {
    update({ lat: c.lat, lng: c.lng });
    if (addressTouched.current) return;
    if (revTimer.current) clearTimeout(revTimer.current);
    revTimer.current = setTimeout(async () => {
      geoAbort.current?.abort();
      const ctrl = new AbortController();
      geoAbort.current = ctrl;
      try {
        const addr = await reverseGeocode(c, ctrl.signal);
        if (!ctrl.signal.aborted && !addressTouched.current && addr) setDraft((d) => ({ ...d, address: addr.slice(0, LIMITS.address) }));
      } catch {
        /* 住所の自動入力はベストエフォート */
      }
    }, 900);
  };
  useEffect(() => () => {
    if (revTimer.current) clearTimeout(revTimer.current);
  }, []);

  const doSearch = async (e?: { preventDefault(): void }) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const r = await searchPlaces(q);
      setResults(r);
      if (r.length === 0) store.toast('info', '見つかりませんでした。地図を動かして指定してください');
    } catch {
      store.toast('error', '検索できませんでした（通信状況を確認してください）');
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: PlaceResult) => {
    setResults(null);
    setQuery('');
    mapRef.current?.flyTo(r.lat, r.lng, 16);
    const patch: Partial<SpotDraft> = { lat: r.lat, lng: r.lng };
    if (!draft.name.trim()) patch.name = r.name.slice(0, LIMITS.name);
    if (!addressTouched.current) patch.address = r.displayName.slice(0, LIMITS.address);
    update(patch);
  };

  const locate = async () => {
    setLocating(true);
    try {
      const p = await getCurrentPosition();
      mapRef.current?.flyTo(p.lat, p.lng, 17);
      mapRef.current?.showMe(p.lat, p.lng);
    } catch (err) {
      store.toast('error', err instanceof Error ? err.message : '現在地を取得できませんでした');
    } finally {
      setLocating(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      setPhoto(await compressImage(file));
      dirty.current = true;
    } catch (err) {
      store.toast('error', err instanceof ImageError ? err.message : '写真を読み込めませんでした');
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const center = mapRef.current?.getCenter();
    const d = center ? { ...draft, lat: center.lat, lng: center.lng } : draft;
    const errs = validateDraft(d);
    setErrors(errs);
    if (Object.keys(errs).length) {
      store.toast('error', Object.values(errs)[0]!);
      return;
    }
    setSaving(true);
    try {
      const saved = await store.saveSpot(
        { name: d.name, category: d.category as Spot['category'], lat: d.lat!, lng: d.lng!, address: d.address, comment: d.comment, photo },
        editing?.id,
      );
      store.toast('success', editing ? 'スポットを更新しました' : 'スポットを登録しました！');
      onSaved(saved);
    } catch (err) {
      store.toast('error', err instanceof Error ? err.message : '保存に失敗しました');
      setSaving(false);
    }
  };

  const close = () => {
    if (dirty.current && !confirm('入力内容を破棄して閉じますか？')) return;
    onClose();
  };

  const shownPhoto = photo === null ? null : (photoPreview ?? existingPhoto);

  return (
    <div className="fullsheet" role="dialog" aria-modal="true" aria-label={editing ? 'スポットを編集' : 'スポットを追加'}>
      <header className="fullsheet__header">
        <button className="icon-btn" onClick={close} aria-label="閉じる">
          ✕
        </button>
        <h2>{editing ? 'スポットを編集' : 'おすすめスポットを追加'}</h2>
        <span style={{ width: 44 }} />
      </header>

      <form className="spot-form" onSubmit={submit} noValidate>
        <div className="spot-form__map">
          <MapView
            ref={mapRef}
            spots={[]}
            initialCenter={{ lat: draft.lat ?? initialCenter.lat, lng: draft.lng ?? initialCenter.lng, zoom: editing ? 16 : initialCenter.zoom }}
            onMoveEnd={onMoveEnd}
          />
          <div className="crosshair" aria-hidden>
            <span className="crosshair__pin">📍</span>
            <span className="crosshair__shadow" />
          </div>
          <p className="spot-form__hint">地図を動かして📍を場所に合わせてね</p>
          <button type="button" className="fab fab--small spot-form__locate" onClick={locate} disabled={locating} aria-label="現在地へ移動">
            {locating ? '…' : '◎'}
          </button>
        </div>
        {errors.location && <p className="field__error">{errors.location}</p>}

        <div className="spot-form__search">
          <input
            type="search"
            enterKeyHint="search"
            placeholder="地名・お店の名前で検索（海外もOK）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doSearch(e);
            }}
            aria-label="場所を検索"
          />
          <button type="button" className="btn btn--ghost" onClick={() => void doSearch()} disabled={searching}>
            {searching ? '…' : '検索'}
          </button>
        </div>
        {results && results.length > 0 && (
          <ul className="search-results">
            {results.map((r, i) => (
              <li key={`${r.lat},${r.lng},${i}`}>
                <button type="button" onClick={() => pickResult(r)}>
                  <strong>{r.name}</strong>
                  <small>{r.displayName}</small>
                </button>
              </li>
            ))}
          </ul>
        )}

        <label className="field">
          <span className="field__label">スポット名 *</span>
          <input
            value={draft.name}
            maxLength={LIMITS.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="例：〇〇温泉 / 〇〇ラーメン"
            aria-invalid={!!errors.name}
          />
          {errors.name && <span className="field__error">{errors.name}</span>}
        </label>

        <fieldset className="field">
          <legend className="field__label">カテゴリ *</legend>
          <div className="cat-picker">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`cat-picker__item ${draft.category === c.id ? 'is-active' : ''}`}
                style={{ '--cat': c.color } as React.CSSProperties}
                onClick={() => update({ category: c.id })}
                aria-pressed={draft.category === c.id}
              >
                <span>{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
          {errors.category && <span className="field__error">{errors.category}</span>}
        </fieldset>

        <div className="field">
          <span className="field__label">写真</span>
          <div className="photo-picker">
            {shownPhoto ? (
              <div className="photo-picker__preview">
                <img src={shownPhoto} alt="選択した写真" />
                <button type="button" className="icon-btn photo-picker__remove" onClick={() => { setPhoto(null); dirty.current = true; }} aria-label="写真を外す">
                  ✕
                </button>
              </div>
            ) : (
              <button type="button" className="photo-picker__add" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
                {photoBusy ? '読み込み中…' : '📷 写真を追加'}
              </button>
            )}
            {shownPhoto && (
              <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
                変更
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          </div>
        </div>

        <label className="field">
          <span className="field__label">おすすめコメント</span>
          <textarea
            rows={3}
            value={draft.comment}
            maxLength={LIMITS.comment}
            onChange={(e) => update({ comment: e.target.value })}
            placeholder="ここが最高！おすすめポイントを書こう"
          />
          <span className="field__count">
            {draft.comment.length}/{LIMITS.comment}
          </span>
          {errors.comment && <span className="field__error">{errors.comment}</span>}
        </label>

        <label className="field">
          <span className="field__label">住所・場所メモ</span>
          <input
            value={draft.address}
            maxLength={LIMITS.address}
            onChange={(e) => {
              addressTouched.current = true;
              update({ address: e.target.value });
            }}
            placeholder="自動で入ります（編集もできます）"
          />
        </label>

        <div className="spot-form__submit">
          <button className="btn btn--primary btn--block" type="submit" disabled={saving || photoBusy}>
            {saving ? '保存中…' : editing ? '更新する' : 'この場所を登録する'}
          </button>
        </div>
      </form>
    </div>
  );
}
