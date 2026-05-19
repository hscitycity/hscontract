const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT       = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'hwaseong-secret-change-in-prod';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'hwaseong2024!';
const isProd     = process.env.NODE_ENV === 'production';

// ─── CORS ─────────────────────────────────────────────────────────────────────
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // file:// 또는 curl
    const allowed = isProd
      ? (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean)
      : DEV_ORIGINS;
    allowed.includes(origin) ? cb(null, true) : cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));

// ─── JWT 미들웨어 ─────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '토큰이 유효하지 않습니다.' });
  }
}

// ─── 오류 래퍼 ────────────────────────────────────────────────────────────────
const wrap = fn => async (req, res, next) => {
  try { await fn(req, res, next); }
  catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
};

// ─── /health ──────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'hwaseong-contract-guide-api', env: process.env.NODE_ENV || 'development' });
});

// ─── /api/auth ────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// ─── /api/content ─────────────────────────────────────────────────────────────
app.get('/api/content', wrap(async (req, res) => {
  res.json(await db.getAllContent());
}));

app.put('/api/content', wrap(async (req, res) => {
  const data = req.body.data ?? req.body;
  await db.replaceAllContent(data);
  res.json({ ok: true });
}));

app.put('/api/content/:ekey', auth, wrap(async (req, res) => {
  await db.setContentKey(req.params.ekey, req.body.value ?? '');
  res.json({ ok: true });
}));

app.delete('/api/content', wrap(async (req, res) => {
  await db.clearContent();
  res.status(204).send();
}));

// ─── /api/docs ────────────────────────────────────────────────────────────────
app.get('/api/docs', wrap(async (req, res) => {
  res.json(await db.getDocs());
}));

app.post('/api/docs/custom', wrap(async (req, res) => {
  if (typeof req.body !== 'object') return res.status(400).json({ error: 'invalid body' });
  await db.replaceCustomDocs(req.body);
  res.json({ ok: true });
}));

app.delete('/api/docs/custom', wrap(async (req, res) => {
  await db.clearCustomDocs();
  res.status(204).send();
}));

app.post('/api/docs/removed', wrap(async (req, res) => {
  if (typeof req.body !== 'object') return res.status(400).json({ error: 'invalid body' });
  await db.replaceRemovedDocs(req.body);
  res.json({ ok: true });
}));

app.delete('/api/docs/removed', wrap(async (req, res) => {
  await db.clearRemovedDocs();
  res.status(204).send();
}));

app.post('/api/docs/item', auth, wrap(async (req, res) => {
  const { stage, name, desc } = req.body || {};
  if (!stage || !name) return res.status(400).json({ error: 'stage, name 필수' });
  const item = await db.addCustomDoc(stage, name, desc);
  res.json({ ok: true, item });
}));

app.delete('/api/docs/item/:stage/:id', auth, wrap(async (req, res) => {
  await db.deleteCustomDoc(req.params.stage, req.params.id);
  res.status(204).send();
}));

// ─── /api/alerts ──────────────────────────────────────────────────────────────
app.get('/api/alerts', wrap(async (req, res) => {
  res.json(await db.getAlerts());
}));

app.post('/api/alerts', wrap(async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'array 필요' });
  await db.replaceAlerts(req.body);
  res.json({ ok: true });
}));

app.delete('/api/alerts', wrap(async (req, res) => {
  await db.clearAlerts();
  res.status(204).send();
}));

app.post('/api/alerts/item', auth, wrap(async (req, res) => {
  const { type, icon, text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text 필수' });
  const item = await db.addAlert(type, icon, text);
  res.json({ ok: true, item });
}));

app.delete('/api/alerts/item/:id', auth, wrap(async (req, res) => {
  await db.deleteAlert(req.params.id);
  res.status(204).send();
}));

// ─── /api/logs ────────────────────────────────────────────────────────────────
app.post('/api/logs', wrap(async (req, res) => {
  await db.addLog(req.ip, req.body.page, req.body.userAgent);
  res.json({ ok: true });
}));

// ─── /api/stats ───────────────────────────────────────────────────────────────
app.get('/api/stats', auth, wrap(async (req, res) => {
  res.json(await db.getStats());
}));

// ─── 서버 시작 ────────────────────────────────────────────────────────────────
db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[backend] 서버 실행 중: http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  })
  .catch(err => {
    console.error('[backend] DB 초기화 실패:', err);
    process.exit(1);
  });
