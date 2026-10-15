// Ramal — alertas: avisos manuais (alerts.json) e tiroteios perto das estações (Fogo Cruzado).
//
// alerts.json (opcional), editável à mão:
//   [{ "id": "obra-1", "kind": "aviso"|"paralisacao"|"seguranca", "title": "...", "detail": "...",
//      "lines": ["japeri"], "stations": ["Deodoro"], "expires": "2026-10-20T23:00:00-03:00" }]
//
// Fogo Cruzado (opcional): defina FOGO_CRUZADO_EMAIL e FOGO_CRUZADO_PASSWORD (cadastro em
// https://api.fogocruzado.org.br/sign-up). FOGO_CRUZADO_STATE_ID evita a busca do id do estado.

const fs = require('fs');
const path = require('path');

const FC_URL = 'https://api-service.fogocruzado.org.br/api/v2';
const RADIUS_KM = 1;
const WINDOW_H = 3;

function km([a, b], [c, d]) {
  const R = 6371, rad = x => (x * Math.PI) / 180;
  const dLat = rad(c - a), dLon = rad(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

class Safety {
  constructor({ root, net, env }) {
    this.root = root;
    this.net = net;
    this.manualFile = path.join(root, 'alerts.json');
    this.manual = { mtime: 0, items: [] };
    try { this.geo = JSON.parse(fs.readFileSync(path.join(root, 'stations-geo.json'), 'utf8')); } catch { this.geo = {}; }
    this.fc = { email: env('FOGO_CRUZADO_EMAIL'), password: env('FOGO_CRUZADO_PASSWORD'), stateId: env('FOGO_CRUZADO_STATE_ID'), token: null, until: 0 };
    this.fcAlerts = [];
    this.fcStatus = this.fc.email ? 'iniciando' : 'desligado (sem credenciais)';
    if (this.fc.email && this.fc.password) {
      this.pollFC();
      setInterval(() => this.pollFC(), 5 * 60e3).unref();
    }
  }

  manualAlerts() {
    try {
      const st = fs.statSync(this.manualFile);
      if (st.mtimeMs !== this.manual.mtime) {
        this.manual = { mtime: st.mtimeMs, items: JSON.parse(fs.readFileSync(this.manualFile, 'utf8')) };
      }
    } catch { this.manual = { mtime: 0, items: [] }; }
    const now = Date.now();
    return this.manual.items
      .filter(a => !a.expires || Date.parse(a.expires) > now)
      .map(a => ({ kind: 'aviso', lines: [], stations: [], source: 'Equipe Ramal', ...a }));
  }

  // ---------- Fogo Cruzado ----------

  async fcFetch(pathname, opts = {}) {
    if (!this.fc.token || Date.now() > this.fc.until) {
      const res = await fetch(`${FC_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.fc.email, password: this.fc.password }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`login HTTP ${res.status}`);
      const j = await res.json();
      this.fc.token = j.data.accessToken;
      this.fc.until = Date.now() + (Number(j.data.expiresIn) || 3600) * 1000 - 60e3;
    }
    const res = await fetch(`${FC_URL}${pathname}`, { ...opts, headers: { Authorization: `Bearer ${this.fc.token}` }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`${pathname.split('?')[0]} HTTP ${res.status}`);
    return res.json();
  }

  async pollFC() {
    try {
      if (!this.fc.stateId) {
        const j = await this.fcFetch('/states');
        const rj = (j.data || []).find(s => /rio de janeiro/i.test(s.name || s.state || ''));
        if (!rj) throw new Error('estado RJ não encontrado em /states');
        this.fc.stateId = rj.id;
      }
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      const items = [];
      for (let page = 1; page <= 5; page++) {
        const j = await this.fcFetch(`/occurrences?idState=${this.fc.stateId}&typeOccurrence=all&initialdate=${today}&finaldate=${today}&page=${page}`);
        items.push(...(j.data || []));
        const pages = (j.pageMeta && j.pageMeta.pageCount) || 1;
        if (page >= pages) break;
      }
      const cut = Date.now() - WINDOW_H * 3600e3;
      const alerts = [];
      for (const o of items) {
        const at = Date.parse(o.date);
        const pos = [Number(o.latitude), Number(o.longitude)];
        if (!(at > cut) || !pos.every(Number.isFinite)) continue;
        const near = Object.entries(this.geo).filter(([, p]) => km(p, pos) <= RADIUS_KM).map(([n]) => n);
        if (!near.length) continue;
        const lines = [...this.net.lines.values()].filter(l => near.some(n => l.stations.has(n))).map(l => l.id);
        const hood = (o.neighborhood && o.neighborhood.name) || o.neighborhood || '';
        alerts.push({
          id: `fc-${o.id}`, kind: 'seguranca',
          title: `Tiroteio perto de ${near.join(', ')}`,
          detail: `Registrado às ${new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}${hood ? ` em ${hood}` : ''}. Se puder, evite a região e acompanhe as notícias.`,
          lines, stations: near, at: new Date(at).toISOString(), source: 'Fogo Cruzado',
        });
      }
      this.fcAlerts = alerts;
      this.fcStatus = `ok (${items.length} ocorrências hoje, ${alerts.length} perto de estações)`;
    } catch (e) {
      this.fcStatus = `falha: ${e.message}`;
      console.error(`[fogo cruzado] ${this.fcStatus}`);
    }
  }

  alerts() { return [...this.manualAlerts(), ...this.fcAlerts]; }
}

module.exports = { Safety };
