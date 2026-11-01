import { useEffect, useState } from 'react';
import type { Spot } from '../types';
import { photoStore } from '../lib/photoStore';

/** スポットの写真URL（サーバー or 端末内の未送信写真） */
export function usePhotoSrc(spot: Pick<Spot, 'id' | 'photoUrl' | 'localPhoto' | 'updatedAt'> | null | undefined): string | null {
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const id = spot?.id;
  const wantLocal = !!spot?.localPhoto;
  const version = spot?.updatedAt;

  useEffect(() => {
    if (!id || !wantLocal) {
      setLocalUrl(null);
      return;
    }
    let url: string | null = null;
    let cancelled = false;
    photoStore
      .get(id)
      .then((blob) => {
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        setLocalUrl(url);
      })
      .catch(() => setLocalUrl(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, wantLocal, version]);

  if (spot?.localPhoto && localUrl) return localUrl;
  return spot?.photoUrl ?? localUrl;
}
