export type Category = 'onsen' | 'gourmet' | 'cafe' | 'sightseeing' | 'nature' | 'other';

export interface Spot {
  id: string;
  name: string;
  category: Category;
  lat: number;
  lng: number;
  address: string;
  comment: string;
  /** サーバーに保存された写真のURL */
  photoUrl?: string;
  /** 端末内(IndexedDB)に未送信の写真がある */
  localPhoto?: boolean;
  createdBy: string;
  createdById: string;
  createdAt: number;
  updatedAt: number;
}

/** 自分のスタンプ（スポットが削除されても残るようスナップショットを保持） */
export interface Stamp {
  spotId: string;
  at: number;
  name: string;
  category: Category;
  /** 現地(500m以内)で押した */
  onSite: boolean;
  /** スタンプの傾き（押印ごとに少しずつ違う味を出す） */
  tilt: number;
}

export type Visits = Record<string, Record<string, { nickname: string; at: number }>>;

export type SyncOp =
  | { kind: 'upsertSpot'; spotId: string; removePhoto?: boolean }
  | { kind: 'deleteSpot'; spotId: string }
  | { kind: 'stamp'; spotId: string; at: number }
  | { kind: 'unstamp'; spotId: string };

export interface Profile {
  userId: string;
  nickname: string;
}

export interface RoomState {
  spots: Record<string, Spot>;
  stamps: Record<string, Stamp>;
  visits: Visits;
  queue: SyncOp[];
  lastSyncedAt: number | null;
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';
