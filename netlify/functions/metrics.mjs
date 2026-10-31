// Contagem anônima de uso do app: instalações, pessoas ativas por dia e refeições registradas.
// Cada aparelho gera um código aleatório (sem nome, e-mail ou foto). Os registros ficam no Netlify Blobs.
// POST /api/metrics  -> registra um evento vindo do app
// GET  /numeros?key=  -> painel com os números (a chave fica na variável de ambiente METRICS_KEY)
import { getStore } from '@netlify/blobs';

const ALLOWED_ORIGINS = ['https://app.quantasproteinas.com.br', 'https://quantasproteinas.netlify.app'];
const isAllowedOrigin = (o) => !!o && (ALLOWED_ORIGINS.includes(o) || /^https:\/\/[a-z0-9-]+--quantasproteinas\.netlify\.app$/.test(o));
const ID_RE = /^[a-f0-9]{16,40}$/;
const EVENTS = new Set(['open', 'install', 'meal']);

// Dia no fuso de Brasília, no formato AAAA-MM-DD
const dayOf = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
const store = () => getStore({ name: 'metricas', consistency: 'strong' });
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function putOnce(s, key, value) {
  // Grava só se ainda não existe (primeira vez que o aparelho aparece, primeira instalação)
  const exists = await s.getMetadata(key);
  if (exists) return false;
  await s.setJSON(key, value);
  return true;
}

async function record(req) {
  if (!isAllowedOrigin(req.headers.get('origin'))) return json(403, { ok: false });
  let b;
  try { b = await req.json(); } catch { return json(400, { ok: false }); }
  const id = String(b.id || '');
  const e = String(b.e || '');
  if (!ID_RE.test(id) || !EVENTS.has(e)) return json(400, { ok: false });
  const os = ['ios', 'android', 'desktop'].includes(b.os) ? b.os : 'outro';
  const sa = b.sa === true;
  const day = dayOf();
  const at = new Date().toISOString();
  const s = store();

  if (await putOnce(s, `device/${id}`, { at, os })) await s.setJSON(`newdev/${day}/${id}`, { os });

  // Abrir pelo ícone conta como instalado (é como o iPhone aparece, já que ele não avisa a instalação)
  if (e === 'install' || (e === 'open' && sa)) {
    if (await putOnce(s, `install/${id}`, { at, os, via: e })) await s.setJSON(`installday/${day}/${id}`, { os });
  }
  if (e === 'open') await s.setJSON(`active/${day}/${id}`, { sa, os });
  if (e === 'meal') await s.setJSON(`meal/${day}/${id}-${Date.now()}`, {});
  return json(200, { ok: true });
}

async function keysWith(s, prefix) {
  const { blobs } = await s.list({ prefix });
  return blobs.map((b) => b.key);
}

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function dashboard(req) {
  const key = new URL(req.url).searchParams.get('key') || '';
  const secret = process.env.METRICS_KEY || '';
  if (!secret || key !== secret) return new Response('Não autorizado.', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const s = store();
  const [devices, installs, actives, meals, newdevs, installdays] = await Promise.all(
    ['device/', 'install/', 'active/', 'meal/', 'newdev/', 'installday/'].map((p) => keysWith(s, p))
  );
  const perDay = (keys) => keys.reduce((m, k) => { const d = k.split('/')[1]; m[d] = (m[d] || 0) + 1; return m; }, {});
  const A = perDay(actives), M = perDay(meals), N = perDay(newdevs), I = perDay(installdays);
  const days = [];
  for (let i = 0; i < 30; i++) days.push(dayOf(new Date(Date.now() - i * 86400000)));
  const today = days[0];
  const last7 = new Set(actives.filter((k) => days.slice(0, 7).includes(k.split('/')[1])).map((k) => k.split('/')[2]));
  const last30 = new Set(actives.filter((k) => days.includes(k.split('/')[1])).map((k) => k.split('/')[2]));
  // Sistema dos aparelhos instalados
  const installVals = await Promise.all(installs.slice(0, 2000).map((k) => s.get(k, { type: 'json' })));
  const byOs = installVals.reduce((m, v) => { const o = (v && v.os) || 'outro'; m[o] = (m[o] || 0) + 1; return m; }, {});
  const fmt = (d) => d.split('-').reverse().slice(0, 2).join('/');
  const maxA = Math.max(1, ...days.map((d) => A[d] || 0));
  const rows = days.map((d) => `<tr><td>${fmt(d)}</td><td><span class="bar" style="width:${Math.round(((A[d] || 0) / maxA) * 100)}%"></span>${A[d] || 0}</td><td>${I[d] || 0}</td><td>${N[d] || 0}</td><td>${M[d] || 0}</td></tr>`).join('');
  const card = (n, l) => `<div class="c"><b>${esc(n)}</b><span>${esc(l)}</span></div>`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Números do app</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#F1F7F4;color:#15302A;padding:24px 16px}main{max-width:820px;margin:0 auto}h1{font-size:24px;margin:0 0 4px}p{color:#4F6861;margin:0 0 20px;font-size:14px}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px}.c{background:#fff;border-radius:16px;padding:16px}.c b{display:block;font-size:30px;font-weight:800}.c span{font-size:13px;color:#4F6861}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden;font-size:14px}th,td{padding:9px 12px;text-align:left;border-bottom:1px solid #DCEBE4;font-variant-numeric:tabular-nums}th{font-size:12px;color:#4F6861}td:nth-child(2){min-width:140px}.bar{display:inline-block;height:8px;background:#14A37F;border-radius:4px;margin-right:8px;vertical-align:middle;min-width:2px}</style></head>
<body><main><h1>Números do app</h1><p>Contagem anônima por aparelho. Atualizado agora, ${esc(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}.</p>
<div class="g">${card(installs.length, 'instalações')}${card(devices.length, 'aparelhos que abriram o app')}${card(A[today] || 0, 'ativos hoje')}${card(last7.size, 'ativos nos últimos 7 dias')}${card(last30.size, 'ativos nos últimos 30 dias')}${card(meals.length, 'refeições registradas')}</div>
<p>Instalações por sistema: iPhone ${byOs.ios || 0} · Android ${byOs.android || 0} · Computador ${byOs.desktop || 0} · Outros ${byOs.outro || 0}</p>
<table><thead><tr><th>Dia</th><th>Ativos</th><th>Instalações</th><th>Aparelhos novos</th><th>Refeições</th></tr></thead><tbody>${rows}</tbody></table></main></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}

export default async (req) => {
  if (req.method === 'POST') return record(req);
  if (req.method === 'GET') return dashboard(req);
  return new Response('', { status: 405 });
};

export const config = { path: ['/api/metrics', '/numeros'] };
