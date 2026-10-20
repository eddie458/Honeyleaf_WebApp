// DEVELOPMENT ONLY. A stand-in for the PHP API (docs/API.md) that lives in the
// Vite dev server, so the client can be built and demonstrated without PHP.
// It keeps its data in .tools/mock-db.json (git-ignored). It is never part
// of a build or an upload, and it is not secure: real work runs on server/.
//
// Demo sign-in (test values for this mock only): see DEMO below.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DB_FILE = join(root, '.tools', 'mock-db.json');
const DEMO = { username: 'demo', password: 'honeyleaf-demo-2026', displayName: 'Eddie' };
const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

function fresh() {
  return {
    seq: 2,
    users: [{ id: 1, username: DEMO.username, displayName: DEMO.displayName, password: DEMO.password, role: 'admin', active: true, mustChangePassword: false, lastLoginAt: null, createdAt: nowIso() }],
    sessions: {},
    journals: [],
    entries: {},
    settings: {},
    assets: {},
  };
}

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function ulid() {
  let t = Date.now();
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = B32[t % 32] + time;
    t = Math.floor(t / 32);
  }
  return time + [...randomBytes(16)].map((b) => B32[b % 32]).join('');
}

let db = null;
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    mkdirSync(dirname(DB_FILE), { recursive: true });
    writeFileSync(DB_FILE, JSON.stringify(db));
  }, 200);
}

class HttpError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const cookieOf = (req) => Object.fromEntries((req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).filter((p) => p.length === 2));

function sessionOf(req) {
  const token = cookieOf(req).hl_session;
  const s = token ? db.sessions[token] : null;
  return s ? { token, ...s, user: db.users.find((u) => u.id === s.userId) } : null;
}

function requireUser(req, { allowLocked = false } = {}) {
  const s = sessionOf(req);
  if (!s || !s.user || !s.user.active) throw new HttpError(401, 'unauthenticated');
  if (s.locked && !allowLocked) throw new HttpError(423, 'locked');
  return s;
}

const publicUser = (u) => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role, mustChangePassword: u.mustChangePassword, lockMinutes: db.settings[u.id]?.lockMinutes ?? 15 });

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function entryJson(e) {
  return {
    entry: { id: e.id, journalId: e.journalId, date: e.date, title: e.title, header: e.header, version: e.version, schema: 1, conflictOf: e.conflictOf ?? null, createdAt: e.createdAt, updatedAt: e.updatedAt },
    pages: e.pages.map((p, index) => ({ id: p.id, index, doc: p.doc, favorite: Boolean(p.doc?.favorite) })),
  };
}

function summary(e) {
  return { id: e.id, date: e.date, title: e.title, pageCount: e.pages.length, pageIds: e.pages.map((p) => p.id), version: e.version, hasPhotos: e.pages.some((p) => (p.doc?.decorations ?? []).some((d) => d.type === 'photo')), conflictOf: e.conflictOf ?? null, createdAt: e.createdAt, updatedAt: e.updatedAt };
}

async function route(req, res, path, url) {
  const m = req.method;
  const seg = path.split('/').filter(Boolean);

  if (m === 'GET' && path === 'health') return { ok: true, version: 'mock' };

  if (m === 'GET' && path === 'session') {
    const s = sessionOf(req);
    const csrf = s?.csrf ?? 'mock-anon';
    if (!s || !s.user) return { state: 'signed_out', csrf, server: { version: 'mock', maxUploadBytes: 15728640, trashDays: 30 } };
    return { state: s.locked ? 'locked' : 'signed_in', csrf, user: publicUser(s.user), server: { version: 'mock', maxUploadBytes: 15728640, trashDays: 30 } };
  }

  if (m === 'POST' && path === 'auth/login') {
    const b = await body(req);
    const u = db.users.find((x) => x.username.toLowerCase() === String(b.username ?? '').toLowerCase());
    if (!u || !u.active || u.password !== b.password) throw new HttpError(401, 'invalid_credentials');
    const token = randomBytes(24).toString('hex');
    db.sessions[token] = { userId: u.id, csrf: randomBytes(16).toString('hex'), locked: false, remember: Boolean(b.remember), createdAt: nowIso(), lastSeenAt: nowIso() };
    u.lastLoginAt = nowIso();
    persist();
    res.setHeader('Set-Cookie', `hl_session=${token}; HttpOnly; Path=/; SameSite=Lax${b.remember ? '; Max-Age=2592000' : ''}`);
    return { user: publicUser(u), csrf: db.sessions[token].csrf };
  }

  if (m === 'POST' && path === 'auth/logout') {
    const s = sessionOf(req);
    if (s) delete db.sessions[s.token];
    persist();
    res.setHeader('Set-Cookie', 'hl_session=; HttpOnly; Path=/; Max-Age=0');
    return {};
  }

  if (m === 'POST' && path === 'auth/lock') {
    const s = requireUser(req, { allowLocked: true });
    db.sessions[s.token].locked = true;
    persist();
    return {};
  }

  if (m === 'POST' && path === 'auth/unlock') {
    const s = requireUser(req, { allowLocked: true });
    const b = await body(req);
    if (b.password !== s.user.password) throw new HttpError(401, 'invalid_credentials');
    db.sessions[s.token].locked = false;
    persist();
    return { csrf: s.csrf };
  }

  if (m === 'POST' && path === 'auth/password') {
    const s = requireUser(req);
    const b = await body(req);
    if (b.current !== s.user.password) throw new HttpError(401, 'invalid_credentials');
    if (String(b.next ?? '').length < 10) throw new HttpError(400, 'validation', { fields: { next: 'weak' } });
    s.user.password = b.next;
    s.user.mustChangePassword = false;
    persist();
    return { user: publicUser(s.user) };
  }

  if (m === 'POST' && path === 'auth/recover') throw new HttpError(400, 'invalid_code');

  if (m === 'DELETE' && seg[0] === 'auth' && seg[1] === 'sessions' && seg[2]) {
    const s = requireUser(req);
    for (const [token, x] of Object.entries(db.sessions)) if (x.userId === s.user.id && token.startsWith(seg[2]) && token !== s.token) delete db.sessions[token];
    persist();
    return {};
  }

  if (m === 'GET' && path === 'auth/sessions') {
    const s = requireUser(req);
    return {
      sessions: Object.entries(db.sessions)
        .filter(([, x]) => x.userId === s.user.id)
        .map(([token, x]) => ({ id: token.slice(0, 16), createdAt: x.createdAt, lastSeenAt: x.lastSeenAt, remember: x.remember, current: token === s.token, device: 'This browser (mock)' })),
    };
  }

  const s = requireUser(req);
  const me = s.user.id;

  if (path === 'journals' && m === 'GET') return { journals: db.journals.filter((j) => j.userId === me) };
  if (seg[0] === 'journals' && seg.length === 2 && m === 'PUT') {
    const b = await body(req);
    let j = db.journals.find((x) => x.userId === me && x.id === seg[1]);
    if (!j) {
      j = { userId: me, id: seg[1], createdAt: nowIso() };
      db.journals.push(j);
    }
    Object.assign(j, { title: b.title, cover: b.cover, defaults: b.defaults, sortOrder: b.sortOrder ?? 0, updatedAt: nowIso() });
    persist();
    return { journal: j };
  }
  if (seg[0] === 'journals' && seg[2] === 'entries' && m === 'GET') {
    const list = Object.values(db.entries).filter((e) => e.userId === me && e.journalId === seg[1] && !e.deletedAt);
    list.sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
    return { entries: list.map(summary) };
  }

  if (seg[0] === 'entries' && seg.length === 2) {
    const key = `${me}:${seg[1]}`;
    const e = db.entries[key];
    if (m === 'GET') {
      if (!e || e.deletedAt) throw new HttpError(404, 'not_found');
      return entryJson(e);
    }
    if (m === 'DELETE') {
      if (!e) throw new HttpError(404, 'not_found');
      e.deletedAt = nowIso();
      persist();
      return {};
    }
    if (m === 'PUT') {
      const b = await body(req);
      const incoming = { title: b.entry.title ?? '', date: b.entry.date, header: b.entry.header, journalId: b.entry.journalId, pages: b.pages.map((p) => ({ id: p.id, doc: p.doc })) };
      if (e && !e.deletedAt && (b.baseVersion === null || b.baseVersion !== e.version)) {
        const copyId = ulid();
        const copy = { ...incoming, userId: me, id: copyId, title: `${incoming.title} (copy from another device)`.trim(), version: 1, conflictOf: e.id, createdAt: nowIso(), updatedAt: nowIso() };
        db.entries[`${me}:${copyId}`] = copy;
        persist();
        throw new HttpError(409, 'conflict', { conflictCopyId: copyId, current: entryJson(e) });
      }
      const next = { ...(e ?? { userId: me, id: seg[1], createdAt: nowIso(), version: 0 }), ...incoming, deletedAt: null, version: (e?.version ?? 0) + 1, updatedAt: nowIso() };
      db.entries[key] = next;
      persist();
      return { version: next.version, updatedAt: next.updatedAt };
    }
  }

  if (path === 'settings') {
    if (m === 'GET') return { settings: db.settings[me] ?? {} };
    if (m === 'PUT') {
      const b = await body(req);
      db.settings[me] = b.settings ?? {};
      persist();
      return {};
    }
  }

  if (path === 'assets' && m === 'POST') {
    const web = new Request(`http://mock${url.pathname}`, { method: 'POST', headers: { 'content-type': req.headers['content-type'] ?? '' }, body: Readable.toWeb(req), duplex: 'half' });
    const form = await web.formData();
    const id = String(form.get('id'));
    const file = form.get('file');
    const thumb = form.get('thumb');
    const key = `${me}:${id}`;
    if (!db.assets[key]) {
      const full = Buffer.from(await file.arrayBuffer());
      db.assets[key] = { userId: me, id, kind: String(form.get('kind') ?? 'photo'), mime: file.type || 'image/webp', bytes: full.length, data: full.toString('base64'), thumb: thumb ? Buffer.from(await thumb.arrayBuffer()).toString('base64') : null, createdAt: nowIso() };
      persist();
    }
    const a = db.assets[key];
    res.statusCode = 201;
    return { asset: { id, kind: a.kind, mime: a.mime, width: null, height: null, bytes: a.bytes, createdAt: a.createdAt } };
  }
  if (path === 'assets' && m === 'GET') {
    const list = Object.values(db.assets).filter((a) => a.userId === me && !a.deletedAt && a.kind === (url.searchParams.get('kind') ?? 'photo'));
    return { assets: list.reverse().map((a) => ({ id: a.id, kind: a.kind, mime: a.mime, width: null, height: null, bytes: a.bytes, createdAt: a.createdAt })) };
  }
  if (seg[0] === 'assets' && seg.length === 2) {
    const a = db.assets[`${me}:${seg[1]}`];
    if (!a) throw new HttpError(404, 'not_found');
    if (m === 'DELETE') {
      a.deletedAt = nowIso();
      persist();
      return {};
    }
    const thumb = url.searchParams.get('size') === 'thumb' && a.thumb;
    res.statusCode = 200;
    res.setHeader('Content-Type', a.mime);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.end(Buffer.from(thumb || a.data, 'base64'));
    return undefined;
  }

  if (path === 'trash' && m === 'GET') {
    const items = Object.values(db.entries)
      .filter((e) => e.userId === me && e.deletedAt)
      .map((e) => ({ type: 'entry', id: e.id, label: e.title || e.date, date: e.date, deletedAt: e.deletedAt, purgeAt: new Date(Date.parse(e.deletedAt) + 30 * 864e5).toISOString() }));
    return { items };
  }
  if (path === 'trash/restore' && m === 'POST') {
    const b = await body(req);
    const e = db.entries[`${me}:${b.id}`];
    if (e) e.deletedAt = null;
    persist();
    return {};
  }
  if (path === 'trash/purge' && m === 'POST') {
    const b = await body(req);
    delete db.entries[`${me}:${b.id}`];
    persist();
    return {};
  }

  if (seg[0] === 'admin') {
    if (s.user.role !== 'admin') throw new HttpError(403, 'forbidden');
    const view = (u) => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role, active: u.active, mustChangePassword: u.mustChangePassword, lastLoginAt: u.lastLoginAt, storageUsedBytes: Object.values(db.assets).filter((a) => a.userId === u.id).reduce((n, a) => n + a.bytes, 0), storageLimitBytes: u.storageLimitBytes ?? null, createdAt: u.createdAt });
    if (path === 'admin/users' && m === 'GET') return { users: db.users.map(view) };
    if (path === 'admin/users' && m === 'POST') {
      const b = await body(req);
      if (!/^[a-z0-9._-]{3,32}$/i.test(b.username ?? '')) throw new HttpError(400, 'validation', { fields: { username: 'invalid' } });
      if (db.users.some((u) => u.username.toLowerCase() === b.username.toLowerCase())) throw new HttpError(400, 'validation', { fields: { username: 'taken' } });
      const u = { id: db.seq++, username: b.username, displayName: b.displayName || b.username, password: b.password, role: 'member', active: true, mustChangePassword: true, lastLoginAt: null, createdAt: nowIso() };
      db.users.push(u);
      persist();
      res.statusCode = 201;
      return { user: view(u) };
    }
    const u = db.users.find((x) => x.id === Number(seg[2]));
    if (!u) throw new HttpError(404, 'not_found');
    if (m === 'PATCH') {
      const b = await body(req);
      for (const k of ['displayName', 'active', 'role', 'storageLimitBytes']) if (k in b) u[k] = b[k];
      persist();
      return { user: view(u) };
    }
    if (seg[3] === 'password') {
      const b = await body(req);
      u.password = b.password;
      u.mustChangePassword = true;
      persist();
      return { user: view(u) };
    }
    if (seg[3] === 'signout') {
      for (const [k, x] of Object.entries(db.sessions)) if (x.userId === u.id) delete db.sessions[k];
      persist();
      return {};
    }
    if (m === 'DELETE') {
      db.users = db.users.filter((x) => x.id !== u.id);
      persist();
      return {};
    }
  }

  if (path === 'export' && m === 'GET') {
    const entries = Object.values(db.entries).filter((e) => e.userId === me && !e.deletedAt);
    const assets = Object.values(db.assets).filter((a) => a.userId === me && !a.deletedAt);
    const files = {
      'honeyleaf-export.json': strToU8(
        JSON.stringify({
          format: 1,
          exportedAt: nowIso(),
          app: 'Honeyleaf (mock)',
          journals: db.journals.filter((j) => j.userId === me),
          entries: entries.map((e) => ({ id: e.id, journalId: e.journalId, date: e.date, title: e.title, header: e.header, pages: e.pages.map((p, index) => ({ id: p.id, index, doc: p.doc })) })),
          assets: assets.map((a) => ({ id: a.id, kind: a.kind, mime: a.mime, file: `assets/${a.id}.webp`, ...(a.thumb ? { thumb: `assets/${a.id}.thumb.webp` } : {}) })),
          settings: db.settings[me] ?? {},
        }),
      ),
    };
    for (const a of assets) {
      files[`assets/${a.id}.webp`] = new Uint8Array(Buffer.from(a.data, 'base64'));
      if (a.thumb) files[`assets/${a.id}.thumb.webp`] = new Uint8Array(Buffer.from(a.thumb, 'base64'));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="honeyleaf-backup.zip"');
    res.end(Buffer.from(zipSync(files, { level: 0 })));
    return undefined;
  }

  throw new HttpError(404, 'not_found');
}

/** Vite plugin: answers /api/* from memory (dev server only). */
export function mockApi() {
  return {
    name: 'honeyleaf-mock-api',
    apply: 'serve',
    configureServer(server) {
      db = existsSync(DB_FILE) ? JSON.parse(readFileSync(DB_FILE, 'utf8')) : fresh();
      server.config.logger.info('  Mock API on /api (dev only). Demo sign-in is in scripts/dev/mock-api.mjs.');
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const url = new URL(req.url, 'http://mock');
        const path = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
        res.setHeader('Cache-Control', 'no-store');
        try {
          const out = await route(req, res, path, url);
          if (out === undefined) return;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(out));
        } catch (e) {
          const err = e instanceof HttpError ? e : new HttpError(500, 'server_error');
          if (!(e instanceof HttpError)) console.error('[mock-api]', e);
          res.statusCode = err.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { code: err.code, message: err.code }, ...err.extra }));
        }
      });
    },
  };
}
