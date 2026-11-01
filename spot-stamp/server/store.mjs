// ルーム単位のデータストア。保存先は2種類：
//   - FileBackend    : DATA_DIR 配下の JSON ファイル + 写真ファイル（ローカル開発・ディスク付きサーバー向け）
//   - PostgresBackend: DATABASE_URL の Postgres（Neon / Supabase などの無料DB。無料ホスティング向け）
// どちらも「ルームごとに直列化された読み込み→変更→保存」を保証する。
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LIMITS } from './validate.mjs';

const MIME_BY_EXT = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** @param {any} data */
function normalize(data) {
  const d = data && typeof data === 'object' ? data : {};
  d.spots ??= {};
  d.visits ??= {};
  d.deleted ??= {};
  return d;
}

/**
 * @typedef {{ savePhoto(name: string, ext: string, buf: Buffer): Promise<void> }} TxContext
 * @typedef {{
 *   init(): Promise<void>,
 *   read(room: string): Promise<any>,
 *   transact<T>(room: string, fn: (draft: any, ctx: TxContext) => Promise<T> | T): Promise<T>,
 *   getPhoto(name: string): Promise<{ buf: Buffer, mime: string } | null>,
 *   close?(): Promise<void>,
 * }} Backend
 */

/** ルームごとの直列化キュー（同一プロセス内） */
class RoomLocks {
  /** @type {Map<string, Promise<unknown>>} */
  locks = new Map();
  /** @template T @param {string} room @param {() => Promise<T>} fn @returns {Promise<T>} */
  run(room, fn) {
    const prev = this.locks.get(room) ?? Promise.resolve();
    const next = prev.then(fn);
    const tail = next.catch(() => {});
    this.locks.set(room, tail);
    // 使い終わったキューは消してメモリを溜めない
    void tail.then(() => {
      if (this.locks.get(room) === tail) this.locks.delete(room);
    });
    return next;
  }
}

/** @implements {Backend} */
export class FileBackend {
  /** @param {string} dataDir */
  constructor(dataDir) {
    this.roomsDir = path.join(dataDir, 'rooms');
    this.uploadsDir = path.join(dataDir, 'uploads');
    /** @type {Map<string, any>} */
    this.cache = new Map();
    this.locks = new RoomLocks();
  }

  async init() {
    await fs.mkdir(this.roomsDir, { recursive: true });
    await fs.mkdir(this.uploadsDir, { recursive: true });
  }

  /** @param {string} room */
  async read(room) {
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
    data = normalize(data);
    this.cache.set(room, data);
    return data;
  }

  /** @template T @param {string} room @param {(draft: any, ctx: TxContext) => Promise<T> | T} fn @returns {Promise<T>} */
  transact(room, fn) {
    return this.locks.run(room, async () => {
      // 失敗時にメモリ上の状態だけ変わらないよう、コピーに対して変更してから確定
      const draft = structuredClone(await this.read(room));
      const ctx = {
        savePhoto: (/** @type {string} */ name, /** @type {string} */ _ext, /** @type {Buffer} */ buf) =>
          fs.writeFile(path.join(this.uploadsDir, name), buf),
      };
      const result = await fn(draft, ctx);
      const file = path.join(this.roomsDir, `${room}.json`);
      const tmp = `${file}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(draft));
      await fs.rename(tmp, file);
      this.cache.set(room, draft);
      return result;
    });
  }

  /** @param {string} name */
  async getPhoto(name) {
    const ext = /** @type {keyof typeof MIME_BY_EXT} */ (name.split('.').pop() ?? '');
    try {
      return { buf: await fs.readFile(path.join(this.uploadsDir, name)), mime: MIME_BY_EXT[ext] ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }
}

/** @implements {Backend} */
export class PostgresBackend {
  /** @param {string} connectionString */
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.locks = new RoomLocks();
    /** @type {import('pg').Pool | null} */
    this.pool = null;
  }

  async init() {
    const { default: pg } = await import('pg');
    const url = new URL(this.connectionString);
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname) || url.searchParams.get('sslmode') === 'disable';
    this.pool = new pg.Pool({
      connectionString: this.connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      // Neon / Supabase などのクラウドDBは TLS 必須
      ...(local ? {} : { ssl: { rejectUnauthorized: true } }),
    });
    // DB 側の一時的な切断でプロセスを落とさない
    this.pool.on('error', (err) => console.error('[db] idle client error', err));
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS spostamp_rooms (
        id text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS spostamp_photos (
        name text PRIMARY KEY,
        mime text NOT NULL,
        data bytea NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  get db() {
    if (!this.pool) throw new Error('database is not initialized');
    return this.pool;
  }

  /** @param {string} room */
  async read(room) {
    const r = await this.db.query('SELECT data FROM spostamp_rooms WHERE id = $1', [room]);
    return normalize(r.rows[0]?.data);
  }

  /** @template T @param {string} room @param {(draft: any, ctx: TxContext) => Promise<T> | T} fn @returns {Promise<T>} */
  transact(room, fn) {
    // プロセス内で直列化した上で、DB でも行ロック（複数インスタンスでも安全）
    return this.locks.run(room, async () => {
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO spostamp_rooms (id, data) VALUES ($1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING`,
          [room],
        );
        const r = await client.query('SELECT data FROM spostamp_rooms WHERE id = $1 FOR UPDATE', [room]);
        const draft = normalize(r.rows[0]?.data);
        const ctx = {
          savePhoto: async (/** @type {string} */ name, /** @type {string} */ ext, /** @type {Buffer} */ buf) => {
            await client.query('INSERT INTO spostamp_photos (name, mime, data) VALUES ($1, $2, $3)', [
              name,
              MIME_BY_EXT[/** @type {keyof typeof MIME_BY_EXT} */ (ext)] ?? 'application/octet-stream',
              buf,
            ]);
          },
        };
        const result = await fn(draft, ctx);
        await client.query('UPDATE spostamp_rooms SET data = $2::jsonb, updated_at = now() WHERE id = $1', [
          room,
          JSON.stringify(draft),
        ]);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    });
  }

  /** @param {string} name */
  async getPhoto(name) {
    const r = await this.db.query('SELECT mime, data FROM spostamp_photos WHERE name = $1', [name]);
    const row = r.rows[0];
    return row ? { buf: row.data, mime: row.mime } : null;
  }

  async close() {
    await this.pool?.end();
  }
}

/** 業務ロジック（保存先に依存しない） */
export class RoomStore {
  /** @param {Backend} backend */
  constructor(backend) {
    this.backend = backend;
  }

  /** 環境に応じて保存先を選ぶ */
  static fromEnv(opts = {}) {
    const url = /** @type {any} */ (opts).databaseUrl ?? process.env.DATABASE_URL;
    if (url) return new RoomStore(new PostgresBackend(url));
    return new RoomStore(new FileBackend(/** @type {any} */ (opts).dataDir));
  }

  get kind() {
    return this.backend instanceof PostgresBackend ? 'postgres' : 'file';
  }

  init() {
    return this.backend.init();
  }

  close() {
    return this.backend.close?.() ?? Promise.resolve();
  }

  /** @param {string} name */
  getPhoto(name) {
    return this.backend.getPhoto(name);
  }

  /** @param {string} room */
  async getState(room) {
    const data = await this.backend.read(room);
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
  upsertSpot(room, id, spot, photo, removePhoto) {
    return this.backend.transact(room, async (data, ctx) => {
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
        await ctx.savePhoto(fileName, photo.ext, photo.buf);
        photoUrl = `/uploads/${fileName}`;
      }
      const saved = { ...spot, id, createdAt: existing?.createdAt ?? spot.createdAt, photoUrl };
      if (!saved.photoUrl) delete saved.photoUrl;
      data.spots[id] = saved;
      return saved;
    });
  }

  /** @param {string} room @param {string} id @param {string} userId */
  deleteSpot(room, id, userId) {
    return this.backend.transact(room, (data) => {
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
  addVisit(room, spotId, userId, nickname, at) {
    return this.backend.transact(room, (data) => {
      if (!data.spots[spotId]) throw Object.assign(new Error('spot not found'), { status: 404 });
      data.visits[spotId] ??= {};
      const prev = data.visits[spotId][userId];
      data.visits[spotId][userId] = { nickname, at: prev ? Math.min(prev.at, at) : at };
      return { ok: true };
    });
  }

  /** @param {string} room @param {string} spotId @param {string} userId */
  removeVisit(room, spotId, userId) {
    return this.backend.transact(room, (data) => {
      if (data.visits[spotId]) {
        delete data.visits[spotId][userId];
        if (Object.keys(data.visits[spotId]).length === 0) delete data.visits[spotId];
      }
      return { ok: true };
    });
  }
}
