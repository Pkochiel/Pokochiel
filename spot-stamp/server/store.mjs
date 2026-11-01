// ルーム単位の JSON ファイルストア。
// - 書き込みはルームごとに直列化（同時リクエストでのレースを防止）
// - tmp ファイル → rename のアトミック書き込みで破損を防止
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LIMITS } from './validate.mjs';

export class RoomStore {
  /** @param {string} dataDir */
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.roomsDir = path.join(dataDir, 'rooms');
    this.uploadsDir = path.join(dataDir, 'uploads');
    /** @type {Map<string, any>} */
    this.cache = new Map();
    /** @type {Map<string, Promise<unknown>>} */
    this.locks = new Map();
  }

  async init() {
    await fs.mkdir(this.roomsDir, { recursive: true });
    await fs.mkdir(this.uploadsDir, { recursive: true });
  }

  /** @param {string} room */
  async load(room) {
    const cached = this.cache.get(room);
    if (cached) return cached;
    const file = path.join(this.roomsDir, `${room}.json`);
    let data;
    try {
      data = JSON.parse(await fs.readFile(file, 'utf8'));
      if (!data || typeof data !== 'object') throw new Error('corrupt');
    } catch (err) {
      if (/** @type {any} */ (err).code !== 'ENOENT') {
        // 壊れたファイルは退避してから空で再開（データを黙って捨てない）
        console.error(`[store] room ${room} is corrupt, backing up:`, err);
        await fs.rename(file, `${file}.corrupt-${Date.now()}`).catch(() => {});
      }
      data = {};
    }
    data.spots ??= {};
    data.visits ??= {};
    data.deleted ??= {};
    this.cache.set(room, data);
    return data;
  }

  /** @param {string} room @param {any} data */
  async persist(room, data) {
    const file = path.join(this.roomsDir, `${room}.json`);
    const tmp = `${file}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data));
    await fs.rename(tmp, file);
  }

  /**
   * ルーム単位で排他的に変更処理を実行する
   * @template T
   * @param {string} room
   * @param {(data: any) => Promise<T> | T} fn
   * @returns {Promise<T>}
   */
  mutate(room, fn) {
    const prev = this.locks.get(room) ?? Promise.resolve();
    const next = prev.then(async () => {
      const data = await this.load(room);
      // 失敗時にメモリ上の状態だけ変わらないよう、コピーに対して変更してから確定
      const draft = structuredClone(data);
      const result = await fn(draft);
      await this.persist(room, draft);
      this.cache.set(room, draft);
      return result;
    });
    this.locks.set(room, next.catch(() => {}));
    return next;
  }

  /** @param {string} room */
  async getState(room) {
    const data = await this.load(room);
    return {
      spots: Object.values(data.spots),
      visits: data.visits,
      deleted: data.deleted,
      serverTime: Date.now(),
    };
  }

  /**
   * @param {string} room @param {string} id @param {any} spot
   * @param {{ext: string, buf: Buffer} | null} photo
   * @param {boolean} removePhoto
   */
  async upsertSpot(room, id, spot, photo, removePhoto) {
    return this.mutate(room, async (data) => {
      const existing = data.spots[id];
      if (!existing && Object.keys(data.spots).length >= LIMITS.spotsPerRoom) {
        throw Object.assign(new Error('room is full'), { status: 409 });
      }
      if (data.deleted[id]) throw Object.assign(new Error('spot was deleted'), { status: 410 });
      if (existing && existing.createdById !== spot.createdById) {
        throw Object.assign(new Error('only the creator can edit this spot'), { status: 403 });
      }
      // 古い更新が後から届いた場合は無視（Last-Write-Wins）
      if (existing && existing.updatedAt > spot.updatedAt) return existing;

      let photoUrl = removePhoto ? undefined : existing?.photoUrl;
      if (photo) {
        const fileName = `${room}-${id}-${crypto.randomBytes(4).toString('hex')}.${photo.ext}`;
        await fs.writeFile(path.join(this.uploadsDir, fileName), photo.buf);
        photoUrl = `/uploads/${fileName}`;
      }
      const saved = {
        ...spot,
        id,
        createdAt: existing?.createdAt ?? spot.createdAt,
        photoUrl,
      };
      if (!saved.photoUrl) delete saved.photoUrl;
      data.spots[id] = saved;
      return saved;
    });
  }

  /** @param {string} room @param {string} id @param {string} userId */
  async deleteSpot(room, id, userId) {
    return this.mutate(room, (data) => {
      const existing = data.spots[id];
      if (!existing) {
        data.deleted[id] ??= Date.now();
        return { ok: true };
      }
      if (existing.createdById !== userId) {
        throw Object.assign(new Error('only the creator can delete this spot'), { status: 403 });
      }
      delete data.spots[id];
      data.deleted[id] = Date.now();
      return { ok: true };
    });
  }

  /** @param {string} room @param {string} spotId @param {string} userId @param {string} nickname @param {number} at */
  async addVisit(room, spotId, userId, nickname, at) {
    return this.mutate(room, (data) => {
      if (!data.spots[spotId]) throw Object.assign(new Error('spot not found'), { status: 404 });
      data.visits[spotId] ??= {};
      const prev = data.visits[spotId][userId];
      data.visits[spotId][userId] = { nickname, at: prev ? Math.min(prev.at, at) : at };
      return { ok: true };
    });
  }

  /** @param {string} room @param {string} spotId @param {string} userId */
  async removeVisit(room, spotId, userId) {
    return this.mutate(room, (data) => {
      if (data.visits[spotId]) {
        delete data.visits[spotId][userId];
        if (Object.keys(data.visits[spotId]).length === 0) delete data.visits[spotId];
      }
      return { ok: true };
    });
  }
}
