'use strict';

const usePg = !!process.env.DATABASE_URL;

// ─── PostgreSQL ────────────────────────────────────────────────────────────────
let _pool;
function pool() {
  if (!_pool) {
    const { Pool } = require('pg');
    const url = process.env.DATABASE_URL || '';
    _pool = new Pool({
      connectionString: url,
      ssl: (url && !url.includes('localhost') && !url.includes('127.0.0.1'))
        ? { rejectUnauthorized: false }
        : false
    });
  }
  return _pool;
}

// ? → $1,$2,... 변환 후 실행
async function pgq(sql, params = []) {
  let i = 0;
  const s = sql.replace(/\?/g, () => `$${++i}`);
  return (await pool().query(s, params)).rows;
}

async function pgTx(fn) {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    await fn(async (sql, params = []) => {
      let i = 0;
      const s = sql.replace(/\?/g, () => `$${++i}`);
      return (await client.query(s, params)).rows;
    });
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ─── SQLite ────────────────────────────────────────────────────────────────────
let _sqdb;
function sqdb() {
  if (!_sqdb) {
    const DB = require('better-sqlite3');
    const path = require('path');
    const fs = require('fs');
    const dir = path.join(__dirname, '../../data');
    fs.mkdirSync(dir, { recursive: true });
    _sqdb = new DB(path.join(dir, 'hwaseong.db'));
    _sqdb.pragma('journal_mode = WAL');
  }
  return _sqdb;
}

function sqq(sql, params = []) {
  const stmt = sqdb().prepare(sql);
  const upper = sql.trimStart().toUpperCase();
  if (upper.startsWith('SELECT') || upper.startsWith('WITH')) return stmt.all(...params);
  stmt.run(...params);
  return [];
}

function sqTx(fn) {
  sqdb().transaction(fn)();
}

// ─── 테이블 초기화 SQL ─────────────────────────────────────────────────────────
const PG_INIT = `
  CREATE TABLE IF NOT EXISTS content_entries (
    ekey       TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS custom_docs (
    id          TEXT PRIMARY KEY,
    stage       TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS removed_docs (
    stage TEXT NOT NULL,
    name  TEXT NOT NULL,
    PRIMARY KEY (stage, name)
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL DEFAULT 'warning',
    icon       TEXT DEFAULT '📌',
    text       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS access_logs (
    id         BIGSERIAL PRIMARY KEY,
    ip         TEXT,
    page       TEXT DEFAULT '/',
    user_agent TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

const SQ_INIT = `
  CREATE TABLE IF NOT EXISTS content_entries (
    ekey       TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS custom_docs (
    id          TEXT PRIMARY KEY,
    stage       TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS removed_docs (
    stage TEXT NOT NULL,
    name  TEXT NOT NULL,
    PRIMARY KEY (stage, name)
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL DEFAULT 'warning',
    icon       TEXT DEFAULT '📌',
    text       TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS access_logs (
    id         INTEGER PRIMARY KEY,
    ip         TEXT,
    page       TEXT DEFAULT '/',
    user_agent TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`;

async function init() {
  if (usePg) {
    for (const stmt of PG_INIT.split(';').map(s => s.trim()).filter(Boolean)) {
      await pgq(stmt);
    }
    console.log('[db] PostgreSQL 테이블 초기화 완료');
  } else {
    sqdb().exec(SQ_INIT);
    console.log('[db] SQLite 테이블 초기화 완료');
  }
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────────
function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildDocs(customRows, removedRows) {
  const custom = {}, removed = {};
  for (const r of customRows) {
    if (!custom[r.stage]) custom[r.stage] = [];
    custom[r.stage].push({ id: r.id, name: r.name, desc: r.description || '' });
  }
  for (const r of removedRows) {
    if (!removed[r.stage]) removed[r.stage] = [];
    removed[r.stage].push(r.name);
  }
  return { custom, removed };
}

// ─── content ───────────────────────────────────────────────────────────────────
async function getAllContent() {
  const rows = usePg
    ? await pgq('SELECT ekey, value, updated_at FROM content_entries')
    : sqq('SELECT ekey, value, updated_at FROM content_entries');
  const data = {}, meta = {};
  for (const r of rows) {
    data[r.ekey] = r.value;
    meta[r.ekey] = { updatedAt: r.updated_at };
  }
  return { data: Object.keys(data).length ? data : null, meta };
}

async function replaceAllContent(dataObj) {
  const entries = Object.entries(dataObj || {}).filter(([k]) => k !== '_savedAt');
  if (usePg) {
    await pgTx(async (qx) => {
      await qx('DELETE FROM content_entries');
      for (const [ekey, value] of entries) {
        await qx('INSERT INTO content_entries (ekey, value) VALUES (?, ?)', [ekey, value || '']);
      }
    });
  } else {
    sqTx(() => {
      sqq('DELETE FROM content_entries');
      for (const [ekey, value] of entries) {
        sqq('INSERT INTO content_entries (ekey, value) VALUES (?, ?)', [ekey, value || '']);
      }
    });
  }
}

async function setContentKey(ekey, value) {
  if (usePg) {
    await pgq(
      'INSERT INTO content_entries (ekey, value) VALUES (?, ?) ON CONFLICT (ekey) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()',
      [ekey, value ?? '']
    );
  } else {
    sqq(
      "INSERT INTO content_entries (ekey, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(ekey) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
      [ekey, value ?? '']
    );
  }
}

async function clearContent() {
  usePg ? await pgq('DELETE FROM content_entries') : sqq('DELETE FROM content_entries');
}

// ─── docs ──────────────────────────────────────────────────────────────────────
async function getDocs() {
  if (usePg) {
    const [c, r] = await Promise.all([
      pgq('SELECT id, stage, name, description FROM custom_docs ORDER BY created_at'),
      pgq('SELECT stage, name FROM removed_docs')
    ]);
    return buildDocs(c, r);
  }
  return buildDocs(
    sqq('SELECT id, stage, name, description FROM custom_docs ORDER BY created_at'),
    sqq('SELECT stage, name FROM removed_docs')
  );
}

async function replaceCustomDocs(obj) {
  const entries = Object.entries(obj || {});
  if (usePg) {
    await pgTx(async (qx) => {
      await qx('DELETE FROM custom_docs');
      for (const [stage, items] of entries) {
        for (const item of (items || [])) {
          await qx('INSERT INTO custom_docs (id, stage, name, description) VALUES (?, ?, ?, ?)',
            [item.id, stage, item.name, item.description || item.desc || '']);
        }
      }
    });
  } else {
    sqTx(() => {
      sqq('DELETE FROM custom_docs');
      for (const [stage, items] of entries) {
        for (const item of (items || [])) {
          sqq('INSERT INTO custom_docs (id, stage, name, description) VALUES (?, ?, ?, ?)',
            [item.id, stage, item.name, item.description || item.desc || '']);
        }
      }
    });
  }
}

async function replaceRemovedDocs(obj) {
  const entries = Object.entries(obj || {});
  if (usePg) {
    await pgTx(async (qx) => {
      await qx('DELETE FROM removed_docs');
      for (const [stage, names] of entries) {
        for (const name of (names || [])) {
          await qx('INSERT INTO removed_docs (stage, name) VALUES (?, ?)', [stage, name]);
        }
      }
    });
  } else {
    sqTx(() => {
      sqq('DELETE FROM removed_docs');
      for (const [stage, names] of entries) {
        for (const name of (names || [])) {
          sqq('INSERT INTO removed_docs (stage, name) VALUES (?, ?)', [stage, name]);
        }
      }
    });
  }
}

async function clearCustomDocs() {
  usePg ? await pgq('DELETE FROM custom_docs') : sqq('DELETE FROM custom_docs');
}

async function clearRemovedDocs() {
  usePg ? await pgq('DELETE FROM removed_docs') : sqq('DELETE FROM removed_docs');
}

async function addCustomDoc(stage, name, desc) {
  const id = uid('doc');
  usePg
    ? await pgq('INSERT INTO custom_docs (id, stage, name, description) VALUES (?, ?, ?, ?)', [id, stage, name, desc || ''])
    : sqq('INSERT INTO custom_docs (id, stage, name, description) VALUES (?, ?, ?, ?)', [id, stage, name, desc || '']);
  return { id, name, desc: desc || '' };
}

async function deleteCustomDoc(stage, id) {
  usePg
    ? await pgq('DELETE FROM custom_docs WHERE stage=? AND id=?', [stage, id])
    : sqq('DELETE FROM custom_docs WHERE stage=? AND id=?', [stage, id]);
}

// ─── alerts ────────────────────────────────────────────────────────────────────
async function getAlerts() {
  if (usePg) {
    return pgq('SELECT id, type, icon, text, created_at AS "createdAt" FROM alerts ORDER BY created_at');
  }
  return sqq('SELECT id, type, icon, text, created_at AS createdAt FROM alerts ORDER BY created_at');
}

async function replaceAlerts(alerts) {
  if (!Array.isArray(alerts)) return;
  if (usePg) {
    await pgTx(async (qx) => {
      await qx('DELETE FROM alerts');
      for (const a of alerts) {
        await qx('INSERT INTO alerts (id, type, icon, text) VALUES (?, ?, ?, ?)',
          [a.id, a.type || 'warning', a.icon || '📌', a.text]);
      }
    });
  } else {
    sqTx(() => {
      sqq('DELETE FROM alerts');
      for (const a of alerts) {
        sqq('INSERT INTO alerts (id, type, icon, text) VALUES (?, ?, ?, ?)',
          [a.id, a.type || 'warning', a.icon || '📌', a.text]);
      }
    });
  }
}

async function clearAlerts() {
  usePg ? await pgq('DELETE FROM alerts') : sqq('DELETE FROM alerts');
}

async function addAlert(type, icon, text) {
  const id = uid('alert');
  const createdAt = new Date().toISOString();
  usePg
    ? await pgq('INSERT INTO alerts (id, type, icon, text) VALUES (?, ?, ?, ?)', [id, type || 'warning', icon || '📌', text])
    : sqq('INSERT INTO alerts (id, type, icon, text) VALUES (?, ?, ?, ?)', [id, type || 'warning', icon || '📌', text]);
  return { id, type: type || 'warning', icon: icon || '📌', text, createdAt };
}

async function deleteAlert(id) {
  usePg ? await pgq('DELETE FROM alerts WHERE id=?', [id]) : sqq('DELETE FROM alerts WHERE id=?', [id]);
}

// ─── logs / stats ──────────────────────────────────────────────────────────────
async function addLog(ip, page, userAgent) {
  usePg
    ? await pgq('INSERT INTO access_logs (ip, page, user_agent) VALUES (?, ?, ?)', [ip, page || '/', userAgent || ''])
    : sqq('INSERT INTO access_logs (ip, page, user_agent) VALUES (?, ?, ?)', [ip, page || '/', userAgent || '']);
}

async function getStats() {
  if (usePg) {
    const [today, week, month, total, recent] = await Promise.all([
      pgq("SELECT COUNT(*) AS cnt FROM access_logs WHERE created_at >= NOW() - INTERVAL '1 day'"),
      pgq("SELECT COUNT(*) AS cnt FROM access_logs WHERE created_at >= NOW() - INTERVAL '7 days'"),
      pgq("SELECT COUNT(*) AS cnt FROM access_logs WHERE created_at >= NOW() - INTERVAL '30 days'"),
      pgq('SELECT COUNT(*) AS cnt FROM access_logs'),
      pgq('SELECT ip, page, user_agent AS "userAgent", created_at AS timestamp FROM access_logs ORDER BY created_at DESC LIMIT 20')
    ]);
    return {
      today: parseInt(today[0].cnt, 10),
      week:  parseInt(week[0].cnt, 10),
      month: parseInt(month[0].cnt, 10),
      total: parseInt(total[0].cnt, 10),
      recent
    };
  }
  const now = Date.now();
  const [r1, r2, r3, r4, recent] = [
    sqq('SELECT COUNT(*) AS cnt FROM access_logs WHERE created_at >= ?', [new Date(now - 86400000).toISOString()]),
    sqq('SELECT COUNT(*) AS cnt FROM access_logs WHERE created_at >= ?', [new Date(now - 7 * 86400000).toISOString()]),
    sqq('SELECT COUNT(*) AS cnt FROM access_logs WHERE created_at >= ?', [new Date(now - 30 * 86400000).toISOString()]),
    sqq('SELECT COUNT(*) AS cnt FROM access_logs'),
    sqq('SELECT ip, page, user_agent AS userAgent, created_at AS timestamp FROM access_logs ORDER BY created_at DESC LIMIT 20')
  ];
  return { today: r1[0].cnt, week: r2[0].cnt, month: r3[0].cnt, total: r4[0].cnt, recent };
}

module.exports = {
  init,
  getAllContent, replaceAllContent, setContentKey, clearContent,
  getDocs, replaceCustomDocs, replaceRemovedDocs, clearCustomDocs, clearRemovedDocs, addCustomDoc, deleteCustomDoc,
  getAlerts, replaceAlerts, clearAlerts, addAlert, deleteAlert,
  addLog, getStats
};
