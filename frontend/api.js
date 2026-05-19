// ─────────────────────────────────────────────────────────────────────────────
// API 클라이언트 — 화성시 계약 업무 길잡이
// API_BASE 는 index.html 상단 인라인 스크립트에서 환경에 따라 선언됨.
// ─────────────────────────────────────────────────────────────────────────────

const API = {
  // ── /api/content ──────────────────────────────────────────────────────────
  async getContent() {
    const res = await fetch(`${API_BASE}/api/content`);
    if (!res.ok) throw new Error(`content GET ${res.status}`);
    const body = await res.json();
    return body.data || null;
  },

  async putContent(data) {
    const res = await fetch(`${API_BASE}/api/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    if (!res.ok) throw new Error(`content PUT ${res.status}`);
    return res.json();
  },

  async deleteContent() {
    await fetch(`${API_BASE}/api/content`, { method: 'DELETE' });
  },

  // ── /api/docs ─────────────────────────────────────────────────────────────
  async getDocs() {
    const res = await fetch(`${API_BASE}/api/docs`);
    if (!res.ok) throw new Error(`docs GET ${res.status}`);
    return res.json(); // { custom: {...}, removed: {...} }
  },

  async saveCustomDocs(obj) {
    const res = await fetch(`${API_BASE}/api/docs/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj)
    });
    if (!res.ok) throw new Error(`docs/custom POST ${res.status}`);
  },

  async deleteCustomDocs() {
    await fetch(`${API_BASE}/api/docs/custom`, { method: 'DELETE' });
  },

  async saveRemovedDocs(obj) {
    const res = await fetch(`${API_BASE}/api/docs/removed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj)
    });
    if (!res.ok) throw new Error(`docs/removed POST ${res.status}`);
  },

  async deleteRemovedDocs() {
    await fetch(`${API_BASE}/api/docs/removed`, { method: 'DELETE' });
  },

  // ── /api/alerts ───────────────────────────────────────────────────────────
  async getAlerts() {
    const res = await fetch(`${API_BASE}/api/alerts`);
    if (!res.ok) throw new Error(`alerts GET ${res.status}`);
    const body = await res.json();
    return Array.isArray(body) ? body : (body.data || []);
  },

  async saveAlerts(alerts) {
    const res = await fetch(`${API_BASE}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alerts)
    });
    if (!res.ok) throw new Error(`alerts POST ${res.status}`);
  },

  async deleteAlerts() {
    await fetch(`${API_BASE}/api/alerts`, { method: 'DELETE' });
  },

  // ── /api/logs ─────────────────────────────────────────────────────────────
  async postLog() {
    await fetch(`${API_BASE}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: location.pathname, userAgent: navigator.userAgent })
    });
  }
};
