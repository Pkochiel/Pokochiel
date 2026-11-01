// スポスタ API サーバー（依存ゼロの Node.js http サーバー）
//   GET    /api/health
//   GET    /api/rooms/:room/state
//   PUT    /api/rooms/:room/spots/:id          { spot, photoData?, removePhoto? }
//   DELETE /api/rooms/:room/spots/:id?userId=
//   PUT    /api/rooms/:room/visits/:spotId     { userId, nickname, at }
//   DELETE /api/rooms/:room/visits/:spotId?userId=
//   GET    /uploads/:file   （写真）
//   それ以外 → dist/ の静的ファイル（SPA）
import http from 'node:http';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore } from './store.mjs';
import { ROOM_RE, ID_RE, LIMITS, validateSpotInput, decodeImageDataUrl } from './validate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 3 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** @param {http.ServerResponse} res @param {number} status @param {unknown} body */
function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

/** @param {http.IncomingMessage} req */
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    /** @type {Buffer[]} */
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new HttpError(400, 'invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/** @param {http.ServerResponse} res @param {string} file @param {string} cache */
async function sendFile(res, file, cache) {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat || !stat.isFile()) return false;
  res.writeHead(200, {
    'Content-Type': MIME[/** @type {keyof MIME} */ (path.extname(file).toLowerCase())] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(file).pipe(res);
  return true;
}

/**
 * @param {{ dataDir?: string, staticDir?: string }} [opts]
 */
export async function createApp(opts = {}) {
  const dataDir = opts.dataDir ?? process.env.DATA_DIR ?? path.join(__dirname, '..', 'data');
  const staticDir = opts.staticDir ?? path.join(__dirname, '..', 'dist');
  const store = new RoomStore(dataDir);
  await store.init();

  /** @param {http.IncomingMessage} req @param {http.ServerResponse} res */
  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const method = req.method ?? 'GET';

    if (parts[0] === 'api') {
      if (parts[1] === 'health') return sendJson(res, 200, { ok: true });
      if (parts[1] !== 'rooms') throw new HttpError(404, 'not found');
      const room = parts[2] ?? '';
      if (!ROOM_RE.test(room)) throw new HttpError(400, 'invalid room id');
      const kind = parts[3];
      const id = parts[4] ?? '';

      if (kind === 'state' && method === 'GET' && parts.length === 4) {
        return sendJson(res, 200, await store.getState(room));
      }
      if (!ID_RE.test(id) || parts.length !== 5) throw new HttpError(404, 'not found');

      if (kind === 'spots' && method === 'PUT') {
        const body = /** @type {any} */ (await readJson(req));
        const v = validateSpotInput(body.spot);
        if (!v.ok) throw new HttpError(400, v.error);
        let photo = null;
        if (body.photoData != null) {
          const p = decodeImageDataUrl(body.photoData);
          if (!p.ok) throw new HttpError(400, p.error);
          photo = p;
        }
        const saved = await store.upsertSpot(room, id, v.value, photo, body.removePhoto === true);
        return sendJson(res, 200, { spot: saved });
      }
      if (kind === 'spots' && method === 'DELETE') {
        const userId = url.searchParams.get('userId') ?? '';
        if (!ID_RE.test(userId)) throw new HttpError(400, 'invalid userId');
        return sendJson(res, 200, await store.deleteSpot(room, id, userId));
      }
      if (kind === 'visits' && method === 'PUT') {
        const body = /** @type {any} */ (await readJson(req));
        if (!ID_RE.test(body.userId ?? '')) throw new HttpError(400, 'invalid userId');
        const nickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, LIMITS.nickname) : '';
        const at = Number.isFinite(body.at) ? body.at : Date.now();
        return sendJson(res, 200, await store.addVisit(room, id, body.userId, nickname || '名無し', at));
      }
      if (kind === 'visits' && method === 'DELETE') {
        const userId = url.searchParams.get('userId') ?? '';
        if (!ID_RE.test(userId)) throw new HttpError(400, 'invalid userId');
        return sendJson(res, 200, await store.removeVisit(room, id, userId));
      }
      throw new HttpError(405, 'method not allowed');
    }

    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'method not allowed');

    if (parts[0] === 'uploads' && parts.length === 2) {
      const name = parts[1] ?? '';
      if (!/^[a-z0-9-]+-[A-Za-z0-9_-]+-[a-f0-9]{8}\.(jpg|png|webp)$/.test(name)) throw new HttpError(404, 'not found');
      if (await sendFile(res, path.join(store.uploadsDir, name), 'public, max-age=31536000, immutable')) return;
      throw new HttpError(404, 'not found');
    }

    // 静的ファイル（パストラバーサル防止）
    const rel = path.normalize(url.pathname).replace(/^([/\\])+/, '');
    const target = path.join(staticDir, rel);
    if (target.startsWith(staticDir) && rel && (await sendFile(res, target, rel.startsWith('assets') ? 'public, max-age=31536000, immutable' : 'no-cache'))) return;
    if (await sendFile(res, path.join(staticDir, 'index.html'), 'no-cache')) return;
    throw new HttpError(404, 'not found (run `npm run build` first)');
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = typeof err?.status === 'number' ? err.status : 500;
      if (status >= 500) console.error('[api] error', req.method, req.url, err);
      if (!res.headersSent) sendJson(res, status, { error: status >= 500 ? 'internal error' : err.message });
      else res.end();
    });
  });
  return { server, store };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
  const { server } = await createApp();
  server.listen(port, () => console.log(`[spot-stamp] http://localhost:${port}`));
}
