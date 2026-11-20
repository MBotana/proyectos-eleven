// Proyectos Eleven — app de escritorio (PWA instalable desde Chrome o Edge). Un solo usuario; todo se guarda en el servidor.
import { ESTADOS_LB, ESTADOS_NEG, ESTADOS_RED, PRIORIDADES, MONEDAS, PUBLICADOS, TAREAS, TIPOS_SERVICIO, avisosLB, hoyEn, addDays, normDomain } from './shared.js';

const S = {
  token: localStorage.getItem('pe_token') || '', setup: false, data: null, view: localStorage.getItem('pe_view') || 'inicio', calurl: '',
  f: { lbProj: '', lbEstado: 'activas', lbQ: '', redProj: '', redEstado: 'activas', redQ: '', medGroup: 'mail_eleven', medQ: '', mes: hoyEn().slice(0, 7) },
  sort: { lb: ['deadline', 1], red: ['fecha_entrega', 1] },
};
const $ = (s) => document.querySelector(s);
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opts = (list, sel, labels) => list.map((v, i) => `<option value="${h(v)}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${h(labels ? labels[i] : v || '—')}</option>`).join('');
const fmtD = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : '');
const fmtN = (n, dec = 2) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: dec }));
const hoy = () => hoyEn();
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesLargo = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2400); }

// íconos de línea (trazos simples)
const IC = {
  inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  lb: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  red: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  medios: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  horas: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  proyectos: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  appsheet: '<path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><path d="M18 2v4h-4M6 22v-4h4"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  play: '<path d="M7 4v16l13-8z"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
};
const ic = (k) => `<svg class="i" viewBox="0 0 24 24">${IC[k]}</svg>`;

async function api(path, method = 'GET', body) {
  const r = await fetch(path, { method, headers: { 'content-type': 'application/json', ...(S.token ? { authorization: 'Bearer ' + S.token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token && path !== '/api/login') { S.token = ''; localStorage.removeItem('pe_token'); render(); }
  if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
  return j;
}
async function load() {
  try { S.data = await api('/api/data'); localStorage.setItem('pe_cache', JSON.stringify(S.data)); }
  catch { if (!S.data) { try { S.data = JSON.parse(localStorage.getItem('pe_cache') || 'null'); } catch { /* nada */ } } if (S.token) toast('Sin conexión: se muestran los últimos datos'); }
  render();
}
const proj = (code) => S.data.projects.find((p) => p.code === code);
const projs = (tipo) => S.data.projects.filter((p) => p.active && (!tipo || p.tipo === tipo));
const estadoBadge = (e) => `<span class="badge b${ESTADOS_LB.indexOf(e) + 1}">${h(e)}</span>`;
const redBadge = (e) => `<span class="badge b${e === 'Entregada' ? 5 : e === 'En redacción' ? 2 : 1}">${h(e)}</span>`;
function dlTag(d, done) { if (!d) return '<span class="mute">—</span>'; const t = hoy(); if (done) return `<span class="mute">${fmtD(d)}</span>`; return d < t ? `<span class="tag bad">${fmtD(d)}</span>` : d === t ? `<span class="tag warn">Hoy</span>` : d <= addDays(t, 2) ? `<span class="tag warn">${fmtD(d)}</span>` : fmtD(d); }

// ---------- marco ----------
const VIEWS = [['inicio', 'Inicio'], ['lb', 'Link building'], ['red', 'Redacciones'], ['medios', 'Medios y contactos'], ['horas', 'Horas'], ['proyectos', 'Proyectos'], ['sep'], ['appsheet', 'Para AppSheet'], ['ajustes', 'Ajustes']];
function render() {
  if (!S.token) return renderLogin();
  if (!S.data) { $('#app').innerHTML = '<div class="login"><div class="mute">Cargando…</div></div>'; return; }
  if (!$('#shell')) $('#app').innerHTML = `<div id="shell"><aside id="side"><div class="brand"><img src="/icon.svg" alt=""><div><b>Proyectos Eleven</b><small>Link building · Contenido</small></div></div><nav id="nav"></nav><div id="sidetimer"></div></aside><section id="main"><header id="head"></header><div id="view"></div></section></div>`;
  const counts = { lb: S.data.lb.filter((t) => !PUBLICADOS.has(t.estado)).length, red: S.data.red.filter((r) => r.estado !== 'Entregada').length, appsheet: S.data.as_pend.length };
  $('#nav').innerHTML = VIEWS.map(([k, t]) => (k === 'sep' ? '<div class="navsep"></div>' : `<button data-act="view" data-v="${k}" class="${S.view === k ? 'on' : ''}">${ic(k)}<span>${t}</span>${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</button>`)).join('');
  const v = VIEWS_FN[S.view] || VIEWS_FN.inicio, out = v();
  $('#head').innerHTML = `<div><h1>${out.title}</h1>${out.sub ? `<div class="sub">${out.sub}</div>` : ''}</div><div class="actions">${out.actions || ''}</div>`;
  const keep = $('#view').scrollTop; $('#view').innerHTML = out.body; $('#view').scrollTop = keep;
  renderTimer();
}
function renderLogin() {
  $('#app').innerHTML = `<div class="login"><form class="box" id="loginf"><img src="/icon.svg" alt=""><h1>Proyectos Eleven</h1><p>${S.setup ? 'Primera vez: creá tu contraseña (mínimo 8 caracteres).' : 'Ingresá con tu contraseña.'}</p>
    <label>Contraseña<input type="password" name="pw" autocomplete="${S.setup ? 'new-password' : 'current-password'}" required minlength="8" autofocus></label>
    <button class="btn full" style="margin-top:14px">${S.setup ? 'Crear y entrar' : 'Entrar'}</button><div class="err" id="lerr"></div></form></div>`;
}
const searchBox = (f, ph) => `<div class="search">${ic('search')}<input type="search" data-f="${f}" placeholder="${ph}" value="${h(S.f[f])}"></div>`;
function th(view, key, label, cls = '') { const [k, d] = S.sort[view]; return `<th data-sort="${key}" data-sv="${view}" class="${cls}">${label}${k === key ? `<span class="arr">${d > 0 ? '▲' : '▼'}</span>` : ''}</th>`; }
function sortBy(arr, view, getters) { const [k, d] = S.sort[view], g = getters[k] || ((x) => x[k] ?? ''); return arr.sort((a, b) => { const x = g(a), y = g(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es', { numeric: true })) * d; }); }

// ---------- Inicio ----------
function pendientes() {
  const out = [];
  for (const t of S.data.lb) if (t.deadline && !PUBLICADOS.has(t.estado)) out.push({ kind: 'lb', id: t.id, d: t.deadline, tipo: 'Link', title: t.anchor || '(sin anchor)', code: t.as_code, project: t.project, estado: estadoBadge(t.estado) });
  for (const r of S.data.red) if (r.fecha_entrega && r.estado !== 'Entregada') out.push({ kind: 'red', id: r.id, d: r.fecha_entrega, tipo: 'Redacción', title: r.tema, code: '', project: r.project, estado: redBadge(r.estado) });
  return out.sort((a, b) => a.d.localeCompare(b.d));
}
function horasMes(mes) { return S.data.hours.filter((x) => x.date.startsWith(mes)).reduce((a, x) => a + x.hours, 0); }
function planMes(mes) { return S.data.plan.filter((p) => p.month === mes).reduce((a, p) => a + p.hours, 0); }
const VIEWS_FN = {};
VIEWS_FN.inicio = () => {
  const t = hoy(), mes = t.slice(0, 7), p = pendientes(), venc = p.filter((x) => x.d < t), prox = p.filter((x) => x.d <= addDays(t, 7));
  const totHoy = S.data.hours.filter((x) => x.date === t).reduce((a, x) => a + x.hours, 0);
  const lunes = addDays(t, -((new Date(t + 'T12:00:00Z').getUTCDay() + 6) % 7)), totSem = S.data.hours.filter((x) => x.date >= lunes && x.date <= t).reduce((a, x) => a + x.hours, 0);
  const pm = planMes(mes), rm = horasMes(mes);
  const rebotes = S.data.lb.filter((x) => !PUBLICADOS.has(x.estado)).map((x) => ({ x, a: avisosLB(x, proj(x.project), S.data.lb) })).filter((o) => o.a.length);
  const fecha = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return {
    title: 'Inicio', sub: fecha.charAt(0).toUpperCase() + fecha.slice(1),
    actions: `<button class="btn sec" data-act="newhours">${ic('horas')}Cargar horas</button><button class="btn sec" data-act="newred">${ic('plus')}Redacción</button><button class="btn" data-act="newlb">${ic('plus')}Tarea de LB</button>`,
    body: `<div class="kpis">
      <div class="kpi"><div class="k">Horas hoy</div><div class="v">${fmtN(totHoy)}</div><div class="d">Semana: ${fmtN(totSem)} h</div></div>
      <div class="kpi"><div class="k">Horas del mes</div><div class="v">${fmtN(rm)} <span class="mute" style="font-size:14px;font-weight:500">/ ${fmtN(pm)}</span></div><div class="d">${pm ? Math.round((rm / pm) * 100) : 0}% del plan de ${MESES[Number(mes.slice(5)) - 1]}</div></div>
      <div class="kpi ${venc.length ? 'hot' : ''}"><div class="k">Vencidas</div><div class="v">${venc.length}</div><div class="d">${prox.length - venc.length} en los próximos 7 días</div></div>
      <div class="kpi ${rebotes.length ? 'hot' : ''}"><div class="k">Tareas que rebotarían</div><div class="v">${rebotes.length}</div><div class="d">Según parámetros del proyecto</div></div>
      <div class="kpi"><div class="k">Pendientes AppSheet</div><div class="v">${S.data.as_pend.length}</div><div class="d">Cambios sin reflejar</div></div></div>
    <div class="cols c21"><div class="card"><div class="ch"><h2>Próximos vencimientos</h2><span class="sub">Vencidas y próximos 7 días</span></div>
      ${prox.length ? `<table class="tbl"><thead><tr><th>Vence</th><th>Tipo</th><th>Proyecto</th><th>Tarea</th><th>Estado</th></tr></thead><tbody>${prox.map((x) => `<tr data-open="${x.kind}" data-id="${x.id}"><td>${dlTag(x.d)}</td><td class="mute">${x.tipo}</td><td class="mono">${h(x.project)}</td><td>${h(x.title)}${x.code ? ` <span class="mute mono">${h(x.code)}</span>` : ''}</td><td>${x.estado}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sin vencimientos en los próximos 7 días.</div>'}</div>
      <div class="card"><div class="ch"><h2>Tareas que rebotarían en AppSheet</h2></div>
      ${rebotes.length ? `<table class="tbl"><tbody>${rebotes.map(({ x, a }) => `<tr data-open="lb" data-id="${x.id}"><td class="wrap"><div><b class="mono">${h(x.as_code || x.project)}</b> <span class="mute">· ${h(normDomain(x.medio))}</span></div><ul class="warnlist">${a.map((s) => `<li>${h(s)}</li>`).join('')}</ul></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Ninguna tarea activa incumple los parámetros.</div>'}</div></div>
    <div class="cols c11">${proyectosResumen(mes)}</div>`,
  };
};
function proyectosResumen(mes) {
  const rows = projs().map((p) => {
    const pl = S.data.plan.filter((x) => x.month === mes && x.project === p.code), ph = pl.reduce((a, x) => a + x.hours, 0), pu = pl.reduce((a, x) => a + x.units, 0);
    const rh = S.data.hours.filter((x) => x.date.startsWith(mes) && x.project === p.code).reduce((a, x) => a + x.hours, 0);
    return { p, ph, pu, rh, hu: hechas(p, mes) };
  });
  const tbl = (tipo, titulo) => `<div class="card"><div class="ch"><h2>${titulo}</h2><span class="sub">${mesLargo(mes)}</span></div><table class="tbl"><thead><tr><th>Proyecto</th><th>Cliente</th><th class="num">Horas</th><th></th><th class="num">Unidades</th></tr></thead><tbody>
    ${rows.filter((r) => r.p.tipo === tipo).map((r) => `<tr data-act="view" data-v="horas"><td class="mono">${h(r.p.code)}</td><td>${h(r.p.cliente)}</td><td class="num">${fmtN(r.rh)} / ${fmtN(r.ph)}</td><td>${bar(r.rh, r.ph)}</td><td class="num">${r.hu} / ${r.pu}</td></tr>`).join('')}</tbody></table></div>`;
  return tbl('LIN', 'Link building por proyecto') + tbl('RED', 'Redacción por proyecto');
}
const bar = (r, p) => `<span class="bar"><i class="${p > 0 && r > p ? 'over' : ''}" style="width:${p > 0 ? Math.min(100, (r / p) * 100) : r > 0 ? 100 : 0}%"></i></span>`;
const hechas = (p, mes) => (p.tipo === 'LIN' ? S.data.lb.filter((t) => t.project === p.code && t.publicado && t.publicado.startsWith(mes)).length : S.data.red.filter((r) => r.project === p.code && r.entregada && r.entregada.startsWith(mes)).length);

// ---------- Link building ----------
VIEWS_FN.lb = () => {
  const f = S.f, q = f.lbQ.trim().toLowerCase();
  let arr = S.data.lb.filter((t) => (!f.lbProj || t.project === f.lbProj) && (f.lbEstado === 'todas' || (f.lbEstado === 'activas' ? !PUBLICADOS.has(t.estado) : t.estado === f.lbEstado)));
  if (q) arr = arr.filter((t) => [t.as_code, t.anchor, t.medio, t.mail_eleven, t.contacto_medio, t.url_cliente, t.notas].join(' ').toLowerCase().includes(q));
  sortBy(arr, 'lb', { deadline: (t) => t.deadline || '9999', estado: (t) => ESTADOS_LB.indexOf(t.estado), dr: (t) => Number(t.dr ?? -1), precio: (t) => Number(t.precio ?? -1), medio: (t) => normDomain(t.medio) });
  return {
    title: 'Link building', sub: `${arr.length} tarea${arr.length === 1 ? '' : 's'}${f.lbEstado === 'activas' ? ' activas' : ''}`,
    actions: `<button class="btn" data-act="newlb">${ic('plus')}Nueva tarea</button>`,
    body: `<div class="toolbar"><select data-f="lbProj"><option value="">Todos los proyectos</option>${opts(projs('LIN').map((p) => p.code), f.lbProj, projs('LIN').map((p) => `${p.code} · ${p.cliente}`))}</select>
      <select data-f="lbEstado">${opts(['activas', 'todas', ...ESTADOS_LB], f.lbEstado, ['Activas', 'Todas', ...ESTADOS_LB])}</select>${searchBox('lbQ', 'Buscar anchor, medio, mail, código…')}</div>
    <div class="card tblwrap"><table class="tbl"><thead><tr>${th('lb', 'as_code', 'Código / proyecto')}${th('lb', 'anchor', 'Anchor')}${th('lb', 'medio', 'Medio')}${th('lb', 'dr', 'DR', 'num')}${th('lb', 'mail_eleven', 'Contacté desde')}${th('lb', 'precio', 'Precio', 'num')}${th('lb', 'deadline', 'Deadline')}${th('lb', 'estado', 'Estado')}</tr></thead><tbody>
      ${arr.map((x) => { const av = PUBLICADOS.has(x.estado) ? [] : avisosLB(x, proj(x.project), S.data.lb);
        return `<tr data-open="lb" data-id="${x.id}"><td class="mono">${x.as_code ? h(x.as_code) : `<span class="mute">${h(x.project)}</span>`}</td><td title="${h(x.anchor)}">${h(x.anchor) || '<span class="mute">—</span>'}${av.length ? ` <span class="tag warn" title="${h(av.join('\n'))}">${av.length} aviso${av.length > 1 ? 's' : ''}</span>` : ''}</td>
          <td>${h(normDomain(x.medio))}</td><td class="num">${fmtN(x.dr)}</td><td title="${h(x.estado_neg)}">${h(x.mail_eleven)}</td><td class="num nowrap">${x.precio !== null && x.precio !== undefined ? `${h(x.moneda)} ${fmtN(x.precio)}` : ''}</td><td>${dlTag(x.deadline, PUBLICADOS.has(x.estado))}</td>
          <td><select data-act="lbestado" data-id="${x.id}">${opts(ESTADOS_LB, x.estado)}</select></td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">No hay tareas con estos filtros.</td></tr>'}</tbody></table></div>`,
  };
};
function lbForm(x = {}) {
  const ps = projs('LIN'), p = x.project || S.f.lbProj || ps[0]?.code, pp = proj(p)?.params || {};
  const mails = [...new Set(S.data.lb.map((t) => t.mail_eleven).filter(Boolean))].sort();
  return `<form id="lbf" data-id="${h(x.id || '')}"><div class="dh"><h2>${x.id ? h(x.as_code || 'Tarea de link building') : 'Nueva tarea de link building'}</h2><button type="button" class="x" data-act="close" title="Cerrar (Esc)">${ic('x')}</button></div>
    <div class="db"><div class="fields">
      <div class="section">Tarea</div>
      <label>Proyecto<select name="project" data-act="lbproj">${opts(ps.map((q) => q.code), p, ps.map((q) => `${q.code} · ${q.cliente}`))}</select></label>
      <label>Código en AppSheet<input name="as_code" class="mono" placeholder="${h(p)}-00" value="${h(x.as_code)}"></label>
      <label>Estado<select name="estado">${opts(ESTADOS_LB, x.estado || 'No Iniciado')}</select></label>
      <label>Deadline<input type="date" name="deadline" value="${h(x.deadline)}"></label>
      <label>Tipo de servicio<select name="tipo_servicio">${opts(TIPOS_SERVICIO, x.tipo_servicio || pp.servicio)}</select></label>
      <label>Negociación<select name="estado_neg">${opts(ESTADOS_NEG, x.estado_neg)}</select></label>
      <label class="full">Anchor text<input name="anchor" value="${h(x.anchor)}"></label>
      <label class="full">URL del cliente<input name="url_cliente" type="url" placeholder="https://${h(pp.dominio || '')}" value="${h(x.url_cliente)}"></label>
      <div class="section">Medio</div>
      <label>Dominio<input name="medio" placeholder="diario.com.ar" value="${h(x.medio)}"></label>
      <div class="fields" style="gap:10px"><label>DR<input name="dr" type="number" step="any" value="${h(x.dr)}"></label><label>Tráfico<input name="trafico" type="number" step="1" value="${h(x.trafico)}"></label></div>
      <label>Precio<input name="precio" type="number" step="any" value="${h(x.precio)}"></label>
      <label>Moneda<select name="moneda">${opts(MONEDAS, x.moneda || 'USD')}</select></label>
      <div class="section">Contacto</div>
      <label>Mail desde el que contacté<input name="mail_eleven" type="email" list="mails" placeholder="nombre@eleven-agencia.net" value="${h(x.mail_eleven)}"></label>
      <label>Contacto del medio<input name="contacto_medio" placeholder="Mail, nombre o proveedor" value="${h(x.contacto_medio)}"></label>
      <label class="full">Notas<textarea name="notas">${h(x.notas)}</textarea></label>
    </div><datalist id="mails">${mails.map((m) => `<option value="${h(m)}">`).join('')}</datalist>
    <div id="lbav"></div><div class="err" id="ferr"></div></div>
    <div class="df">${x.id ? `<button type="button" class="btn danger left" data-act="del" data-kind="lb">Borrar</button>` : '<span class="left"></span>'}<button type="button" class="btn sec" data-act="close">Cancelar</button><button class="btn">Guardar</button></div></form>`;
}
function lbAvisosVivos() {
  const f = $('#lbf'); if (!f) return;
  const x = Object.fromEntries(new FormData(f)); x.id = f.dataset.id;
  const a = PUBLICADOS.has(x.estado) ? [] : avisosLB(x, proj(x.project), S.data.lb), pp = proj(x.project)?.params || {};
  const lim = [pp.drMin != null && `DR ≥ ${pp.drMin}`, pp.trafMin != null && `tráfico ≥ ${fmtN(pp.trafMin)}`, pp.precioMaxUSD != null && `USD ≤ ${pp.precioMaxUSD}`, pp.repDias && `repetir medio cada ${pp.repDias} días`, pp.palabrasMin && `${pp.palabrasMin} palabras mín.`].filter(Boolean).join(' · ');
  $('#lbav').innerHTML = (lim ? `<p class="small mute" style="margin:14px 0 0">Parámetros de ${h(x.project)}: ${lim}</p>` : '') + (a.length ? `<div class="alert"><b style="color:var(--warn);font-size:12.5px">AppSheet va a rechazar o frenar esta tarea</b><ul class="warnlist">${a.map((s) => `<li>${h(s)}</li>`).join('')}</ul></div>` : '');
}

// ---------- Redacciones ----------
VIEWS_FN.red = () => {
  const f = S.f, q = f.redQ.trim().toLowerCase();
  let arr = S.data.red.filter((r) => (!f.redProj || r.project === f.redProj) && (f.redEstado === 'todas' || (f.redEstado === 'activas' ? r.estado !== 'Entregada' : r.estado === f.redEstado)));
  if (q) arr = arr.filter((r) => [r.tema, r.subproyecto, r.notas].join(' ').toLowerCase().includes(q));
  sortBy(arr, 'red', { fecha_entrega: (r) => r.fecha_entrega || '9999', prioridad: (r) => -PRIORIDADES.indexOf(r.prioridad), estado: (r) => ESTADOS_RED.indexOf(r.estado) });
  const pendAS = new Set(S.data.as_pend.filter((a) => a.entity === 'red').map((a) => a.ref));
  return {
    title: 'Redacciones', sub: `${arr.length} redacci${arr.length === 1 ? 'ón' : 'ones'}`, actions: `<button class="btn" data-act="newred">${ic('plus')}Nueva redacción</button>`,
    body: `<div class="toolbar"><select data-f="redProj"><option value="">Todos los proyectos</option>${opts(projs('RED').map((p) => p.code), f.redProj, projs('RED').map((p) => `${p.code} · ${p.cliente}`))}</select>
      <select data-f="redEstado">${opts(['activas', 'todas', ...ESTADOS_RED], f.redEstado, ['Activas', 'Todas', ...ESTADOS_RED])}</select>${searchBox('redQ', 'Buscar tema…')}</div>
    <div class="card tblwrap"><table class="tbl"><thead><tr>${th('red', 'tema', 'Tema')}${th('red', 'project', 'Proyecto')}${th('red', 'subproyecto', 'Subproyecto')}${th('red', 'ia', 'Tipo')}${th('red', 'prioridad', 'Prioridad')}${th('red', 'fecha_entrega', 'Entrega')}<th>AppSheet</th>${th('red', 'estado', 'Estado')}</tr></thead><tbody>
      ${arr.map((r) => `<tr data-open="red" data-id="${r.id}"><td title="${h(r.tema)}">${h(r.tema)}</td><td class="mono">${h(r.project)}</td><td>${h(r.subproyecto)}</td><td>${r.ia ? 'IA' : 'Manual'}</td><td>${r.prioridad === 'Alta' ? '<span class="tag bad">Alta</span>' : r.prioridad === 'Baja' ? '<span class="tag">Baja</span>' : 'Normal'}</td>
        <td>${dlTag(r.fecha_entrega, r.estado === 'Entregada')}</td><td>${pendAS.has(r.id) ? '<span class="tag acc">Por cargar</span>' : '<span class="mute">Al día</span>'}</td><td><select data-act="redestado" data-id="${r.id}">${opts(ESTADOS_RED, r.estado)}</select></td></tr>`).join('') || '<tr><td colspan="8" class="empty">No hay redacciones con estos filtros.</td></tr>'}</tbody></table></div>`,
  };
};
function redForm(r = {}) {
  const ps = projs('RED');
  return `<form id="redf" data-id="${h(r.id || '')}"><div class="dh"><h2>${r.id ? 'Redacción' : 'Nueva redacción'}</h2><button type="button" class="x" data-act="close">${ic('x')}</button></div>
    <div class="db"><p class="small mute" style="margin:0 0 14px">Mismos campos que pide AppSheet en Carga de Redacciones.</p><div class="fields">
      <label class="full">Tema *<input name="tema" required value="${h(r.tema)}"></label>
      <label>Proyecto<select name="project">${opts(ps.map((q) => q.code), r.project || S.f.redProj || ps[0]?.code, ps.map((q) => `${q.code} · ${q.cliente}`))}</select></label>
      <label>Subproyecto (opcional)<input name="subproyecto" value="${h(r.subproyecto)}"></label>
      <label>Idioma<input name="idioma" value="${h(r.idioma || 'Español')}"></label>
      <label>País<input name="pais" value="${h(r.pais || 'Argentina')}"></label>
      <label>Fecha de entrega<input type="date" name="fecha_entrega" value="${h(r.fecha_entrega || hoy())}"></label>
      <label>Prioridad<select name="prioridad">${opts(PRIORIDADES, r.prioridad || 'Normal')}</select></label>
      <label>Redacción IA<select name="ia">${opts(['1', '0'], r.ia === 0 ? '0' : '1', ['Sí', 'No'])}</select></label>
      <label>Estado<select name="estado">${opts(ESTADOS_RED, r.estado || 'Pendiente')}</select></label>
      <label class="full">Notas<textarea name="notas">${h(r.notas)}</textarea></label>
    </div><div class="err" id="ferr"></div></div>
    <div class="df">${r.id ? `<button type="button" class="btn danger left" data-act="del" data-kind="red">Borrar</button>` : '<span class="left"></span>'}<button type="button" class="btn sec" data-act="close">Cancelar</button><button class="btn">Guardar</button></div></form>`;
}

// ---------- Medios y contactos ----------
VIEWS_FN.medios = () => {
  const f = S.f, q = f.medQ.trim().toLowerCase(), key = { mail_eleven: (t) => t.mail_eleven, contacto_medio: (t) => t.contacto_medio, medio: (t) => normDomain(t.medio) }[f.medGroup];
  const groups = new Map();
  for (const t of S.data.lb) {
    if (q && ![t.mail_eleven, t.contacto_medio, t.medio, t.anchor, t.as_code].join(' ').toLowerCase().includes(q)) continue;
    const k = key(t) || '(sin dato)'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === '(sin dato)') - (b === '(sin dato)') || a.localeCompare(b));
  const nMedios = new Set(S.data.lb.map((t) => normDomain(t.medio)).filter(Boolean)).size;
  return {
    title: 'Medios y contactos', sub: `${nMedios} medios · ${keys.length} grupos`,
    body: `<div class="toolbar"><select data-f="medGroup">${opts(['mail_eleven', 'contacto_medio', 'medio'], f.medGroup, ['Agrupar por mail desde el que contacté', 'Agrupar por contacto del medio', 'Agrupar por medio'])}</select>${searchBox('medQ', 'Buscar mail, medio, anchor…')}</div>
    <div class="card tblwrap"><table class="tbl"><thead><tr><th>Medio</th><th>Proyecto</th><th>Código</th><th>Anchor</th>${f.medGroup !== 'mail_eleven' ? '<th>Contacté desde</th>' : ''}${f.medGroup !== 'contacto_medio' ? '<th>Contacto del medio</th>' : ''}<th>Negociación</th><th class="num">Precio</th><th>Estado</th></tr></thead><tbody>
    ${keys.map((k) => { const arr = groups.get(k), ps = [...new Set(arr.map((t) => t.project))];
      return `<tr class="grp"><td colspan="9"><span>${h(k)}</span> <span class="mute" style="font-weight:400">· ${arr.length} tarea${arr.length > 1 ? 's' : ''} · ${h(ps.join(', '))}</span>${k.includes('@') ? ` <button class="lnk small" data-act="copy" data-v="${h(k)}" style="margin-left:8px">Copiar mail</button>` : ''}</td></tr>` +
        arr.map((t) => `<tr data-open="lb" data-id="${t.id}"><td>${h(normDomain(t.medio)) || '<span class="mute">—</span>'}</td><td class="mono">${h(t.project)}</td><td class="mono">${h(t.as_code)}</td><td>${h(t.anchor)}</td>${f.medGroup !== 'mail_eleven' ? `<td>${h(t.mail_eleven)}</td>` : ''}${f.medGroup !== 'contacto_medio' ? `<td>${h(t.contacto_medio)}</td>` : ''}<td>${h(t.estado_neg)}</td><td class="num nowrap">${t.precio != null ? `${h(t.moneda)} ${fmtN(t.precio)}` : ''}</td><td>${estadoBadge(t.estado)}</td></tr>`).join(''); }).join('') || '<tr><td colspan="9" class="empty">Todavía no hay medios cargados.</td></tr>'}</tbody></table></div>`,
  };
};

// ---------- Horas ----------
VIEWS_FN.horas = () => {
  const mes = S.f.mes, plan = S.data.plan.filter((p) => p.month === mes), hrs = S.data.hours.filter((x) => x.date.startsWith(mes));
  const filas = new Map();
  for (const p of plan) filas.set(p.project + '|' + p.task_type, { project: p.project, task_type: p.task_type, ph: p.hours, pu: p.units, rh: 0 });
  for (const x of hrs) { const k = x.project + '|' + x.task_type; if (!filas.has(k)) filas.set(k, { project: x.project, task_type: x.task_type, ph: 0, pu: 0, rh: 0 }); filas.get(k).rh += x.hours; }
  let totPh = 0, totRh = 0, body = '';
  for (const p of S.data.projects) {
    const rows = [...filas.values()].filter((r) => r.project === p.code && (r.ph > 0 || r.rh > 0 || r.pu > 0)); if (!rows.length) continue;
    const ph = rows.reduce((a, r) => a + r.ph, 0), rh = rows.reduce((a, r) => a + r.rh, 0), pu = rows.reduce((a, r) => a + r.pu, 0); totPh += ph; totRh += rh;
    body += `<tr class="grp"><td><span class="mono">${h(p.code)}</span> <span class="mute" style="font-weight:400">${h(p.cliente)}</span></td><td></td><td class="num">${fmtN(ph)}</td><td class="num">${fmtN(rh)}</td><td>${bar(rh, ph)}</td><td class="num">${ph ? Math.round((rh / ph) * 100) + '%' : ''}</td><td class="num">${hechas(p, mes)} / ${pu}</td></tr>`;
    body += rows.map((r) => `<tr><td></td><td>${h(r.task_type)}</td><td class="num">${fmtN(r.ph)}</td><td class="num">${fmtN(r.rh)}</td><td>${bar(r.rh, r.ph)}</td><td class="num mute">${r.ph ? Math.round((r.rh / r.ph) * 100) + '%' : ''}</td><td class="num mute">${r.pu || ''}</td></tr>`).join('');
  }
  return {
    title: 'Horas', sub: `${mesLargo(mes)} · ${fmtN(totRh)} de ${fmtN(totPh)} h planificadas (${totPh ? Math.round((totRh / totPh) * 100) : 0}%)`,
    actions: `<input type="month" data-f="mes" value="${h(mes)}" style="width:auto"><button class="btn sec" data-act="editplan">Editar plan del mes</button><button class="btn" data-act="newhours">${ic('plus')}Cargar horas</button>`,
    body: `<div class="card"><table class="tbl"><thead><tr><th>Proyecto</th><th>Tarea</th><th class="num">Plan (h)</th><th class="num">Real (h)</th><th></th><th class="num">Avance</th><th class="num">Unidades hechas / plan</th></tr></thead><tbody>${body || '<tr><td colspan="7" class="empty">Sin plan ni horas en este mes.</td></tr>'}</tbody></table></div>
    <p class="small mute">Unidades hechas: links que pasaron a Publicado o Cerrado y redacciones Entregadas dentro del mes.</p>
    <div class="card" style="margin-top:20px"><div class="ch"><h2>Registro</h2><span class="sub">${hrs.length} carga${hrs.length === 1 ? '' : 's'}</span></div><table class="tbl"><thead><tr><th>Fecha</th><th>Proyecto</th><th>Tarea</th><th>Nota</th><th class="num">Horas</th></tr></thead><tbody>
      ${hrs.map((x) => `<tr data-open="hours" data-id="${x.id}"><td>${fmtD(x.date)}</td><td class="mono">${h(x.project)}</td><td>${h(x.task_type)}</td><td class="mute">${h(x.note)}</td><td class="num">${fmtN(x.hours)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin horas cargadas.</td></tr>'}</tbody></table></div>`,
  };
};
function hoursForm(x = {}) {
  const ps = projs(), p = x.project || ps[0]?.code;
  return `<form id="hrf" data-id="${h(x.id || '')}"><div class="dh"><h2>${x.id ? 'Editar horas' : 'Cargar horas'}</h2><button type="button" class="x" data-act="close">${ic('x')}</button></div>
    <div class="db"><div class="fields"><label>Fecha<input type="date" name="date" value="${h(x.date || hoy())}"></label><label>Horas<input type="number" name="hours" step="0.25" min="0.25" max="24" required value="${h(x.hours)}" placeholder="1,5"></label>
    <label>Proyecto<select name="project" data-act="hrproj">${opts(ps.map((q) => q.code), p, ps.map((q) => `${q.code} · ${q.cliente}`))}</select></label><label>Tarea<select name="task_type">${opts(TAREAS[proj(p)?.tipo || 'LIN'], x.task_type)}</select></label>
    <label class="full">Nota<input name="note" value="${h(x.note)}"></label></div><div class="err" id="ferr"></div></div>
    <div class="df">${x.id ? `<button type="button" class="btn danger left" data-act="del" data-kind="hours">Borrar</button>` : '<span class="left"></span>'}<button type="button" class="btn sec" data-act="close">Cancelar</button><button class="btn">Guardar</button></div></form>`;
}
function planForm() {
  const mes = S.f.mes, plan = S.data.plan.filter((p) => p.month === mes), get = (c, t) => plan.find((p) => p.project === c && p.task_type === t) || {};
  const rows = projs().flatMap((p) => TAREAS[p.tipo].map((t) => ({ c: p.code, t, ...get(p.code, t) })));
  return `<form id="planf"><div class="dh"><h2>Plan de ${mesLargo(mes)}</h2><button type="button" class="x" data-act="close">${ic('x')}</button></div>
    <div class="db" style="padding:0"><table class="tbl"><thead><tr><th>Proyecto</th><th>Tarea</th><th class="num">Horas</th><th class="num">Unidades</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td class="mono">${h(r.c)}</td><td>${h(r.t)}<input type="hidden" name="p${i}" value="${h(r.c)}|${h(r.t)}"></td><td><input type="number" step="0.01" min="0" name="h${i}" value="${r.hours || ''}" style="width:90px;height:30px"></td><td><input type="number" step="1" min="0" name="u${i}" value="${r.units || ''}" style="width:80px;height:30px"></td></tr>`).join('')}
    </tbody></table><div class="err" id="ferr" style="padding:0 20px"></div></div><div class="df"><span class="left"></span><button type="button" class="btn sec" data-act="close">Cancelar</button><button class="btn">Guardar plan</button></div></form>`;
}

// ---------- Proyectos ----------
VIEWS_FN.proyectos = () => ({
  title: 'Proyectos', sub: 'Proyectos habilitados en AppSheet y los topes que valida cada uno',
  actions: `<button class="btn" data-act="saveproj">Guardar cambios</button>`,
  body: `<form id="projf"><div class="card"><table class="tbl"><thead><tr><th>Activo</th><th>Proyecto</th><th>Cliente</th><th>Dominio</th><th>Países</th><th class="num">DR mín.</th><th class="num">Tráfico mín.</th><th class="num">USD máx.</th><th class="num">Repetir (días)</th><th class="num">Palabras</th></tr></thead><tbody>
    ${S.data.projects.map((p) => `<tr data-code="${h(p.code)}"><td><input type="checkbox" name="active" ${p.active ? 'checked' : ''}></td><td class="mono">${h(p.code)}</td><td><input name="cliente" value="${h(p.cliente)}" style="width:120px;height:30px"></td>
      ${p.tipo === 'LIN' ? `<td><input name="dominio" value="${h(p.params.dominio)}" style="width:150px;height:30px"></td><td><input name="paises" value="${h(p.params.paises)}" style="width:130px;height:30px"></td>${['drMin', 'trafMin', 'precioMaxUSD', 'repDias', 'palabrasMin'].map((k) => `<td class="num"><input type="number" step="any" name="${k}" value="${h(p.params[k] ?? '')}" style="width:66px;height:30px;text-align:right"></td>`).join('')}<input type="hidden" name="servicio" value="${h(p.params.servicio)}">` : '<td colspan="7" class="mute">Proyecto de redacción</td>'}</tr>`).join('')}
    </tbody></table></div></form><p class="small mute">Valores tomados de "Parámetros del Proyecto" en AppSheet el 20/11/2026. Un campo vacío no se controla.</p>`,
});

// ---------- Pendientes AppSheet ----------
VIEWS_FN.appsheet = () => {
  const pend = S.data.as_pend;
  return {
    title: 'Pendientes AppSheet', sub: 'Cambios hechos acá que todavía hay que reflejar en Eleven - Operaciones',
    actions: pend.length ? `<button class="btn sec" data-act="asall">Seleccionar todos</button><button class="btn" data-act="asdone">Marcar como reflejados</button>` : '',
    body: `<div class="card">${pend.length ? `<table class="tbl"><thead><tr><th style="width:36px"></th><th>Fecha</th><th>Tipo</th><th>Tarea</th><th>Cambio</th></tr></thead><tbody>
      ${pend.map((a) => `<tr><td><input type="checkbox" class="asck" value="${a.id}"></td><td class="nowrap">${new Date(a.at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${a.entity === 'lb' ? 'Link' : 'Redacción'}</td><td class="mono">${h(a.label)}</td><td class="wrap">${h(a.change)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Todo al día: no hay cambios pendientes.</div>'}</div>`,
  };
};

// ---------- Ajustes ----------
VIEWS_FN.ajustes = () => {
  const st = S.data.settings;
  return {
    title: 'Ajustes',
    body: `<div class="cols c11" style="margin-top:0"><div class="card"><div class="ch"><h2>Google Calendar</h2></div><div class="cb">
      <p class="mute" style="margin-top:0">Tus deadlines (tareas de LB y redacciones sin terminar) como calendario de solo lectura. Google lo actualiza solo, aunque puede tardar varias horas.</p>
      <code class="url" id="calurl">${h(S.calurl || 'Cargando…')}</code>
      <ol class="steps"><li>Copiá el link.</li><li>En Google Calendar: <b>Otros calendarios → + → Desde URL</b>.</li><li>Pegalo y elegí <b>Agregar calendario</b>.</li></ol>
      <div style="display:flex;gap:8px"><button class="btn sm" data-act="copycal">${ic('copy')}Copiar link</button><button class="btn sm sec" data-act="resetcal">Generar link nuevo</button></div></div></div>
    <div class="card"><div class="ch"><h2>Avisos de escritorio</h2></div><div class="cb">
      <label class="check"><input type="checkbox" id="avisos" ${st.avisos === '1' ? 'checked' : ''}> Avisos activados</label>
      <div class="fields" style="margin-top:14px"><label>Resumen de deadlines a las<select id="aviso_hora">${opts([...Array(15)].map((_, i) => String(i + 7)), st.aviso_hora, [...Array(15)].map((_, i) => `${i + 7}:00`))}</select></label>
      <label>Si no cargaste horas (lun a vie), avisar a las<select id="horas_hora">${opts([...Array(8)].map((_, i) => String(i + 15)), st.horas_hora, [...Array(8)].map((_, i) => `${i + 15}:00`))}</select></label></div>
      <div style="display:flex;gap:8px;margin-top:14px"><button class="btn sm" data-act="saveavisos">Guardar</button><button class="btn sm sec" data-act="push">Activar en esta computadora</button><button class="btn sm sec" data-act="pushtest">Enviar prueba</button></div>
      <p class="small mute" id="pushmsg">Los avisos llegan como notificaciones de Windows aunque la app esté cerrada (Chrome o Edge tienen que estar abiertos en segundo plano).</p></div></div>
    <div class="card"><div class="ch"><h2>Instalar como app de escritorio</h2></div><div class="cb">
      <ol class="steps" style="margin-top:0"><li>Abrí esta página en <b>Chrome</b> o <b>Edge</b>.</li><li>En la barra de direcciones, tocá el ícono de <b>Instalar</b> (o menú ⋮ → <b>Transmitir, guardar y compartir → Instalar página como app</b>).</li><li>Queda con su propia ventana, ícono en la barra de tareas y en el menú Inicio. Clic derecho en el ícono: accesos directos a nueva tarea y cargar horas.</li></ol></div></div>
    <div class="card"><div class="ch"><h2>Cuenta y datos</h2></div><div class="cb" style="display:flex;gap:8px"><button class="btn sm sec" data-act="export">Descargar mis datos (JSON)</button><button class="btn sm sec" data-act="logout">Cerrar sesión</button></div></div></div>`,
  };
};

// ---------- cronómetro (guardado en el servidor) ----------
const timer = () => { try { return JSON.parse(S.data.settings.timer || 'null'); } catch { return null; } };
function renderTimer() {
  const el = $('#sidetimer'); if (!el) return; const tm = timer(), ps = projs();
  el.innerHTML = tm ? `<div class="lbl"><span class="run"></span>Cronómetro</div><div class="small"><b class="mono">${h(tm.project)}</b></div><div class="small mute">${h(tm.task_type)}</div><div class="clock" id="tclock">0:00:00</div>
      <div style="display:flex;gap:6px"><button class="btn sm" data-act="tstop" style="flex:1;justify-content:center">${ic('stop')}Guardar</button><button class="btn sm sec" data-act="tdiscard">Descartar</button></div>`
    : `<div class="lbl">Cronómetro</div><select id="tproj" data-act="tproj" style="height:30px;font-size:12.5px">${opts(ps.map((p) => p.code), S.tproj || ps[0]?.code)}</select>
      <select id="ttype" style="height:30px;font-size:12.5px">${opts(TAREAS[proj(S.tproj || ps[0]?.code)?.tipo || 'LIN'], S.ttype)}</select><button class="btn sm full" data-act="tstart">${ic('play')}Iniciar</button>`;
  clearInterval(renderTimer.i); if (!tm) return;
  const up = () => { const c = $('#tclock'); if (!c) return; const s = Math.max(0, Math.floor((Date.now() - tm.start) / 1000)); c.textContent = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; document.title = `${c.textContent} · ${tm.project}`; };
  up(); renderTimer.i = setInterval(up, 1000);
}
async function setTimer(v) { await api('/api/settings', 'POST', { timer: v ? JSON.stringify(v) : '' }); S.data.settings.timer = v ? JSON.stringify(v) : ''; if (!v) document.title = 'Proyectos Eleven'; }

// ---------- panel lateral ----------
function openDrawer(html) { const d = $('#drawer'); d.querySelector('.panel').innerHTML = html; d.classList.add('open'); lbAvisosVivos(); setTimeout(() => d.querySelector('.db input:not([type=hidden]), .db select')?.focus(), 60); }
function closeDrawer() { $('#drawer').classList.remove('open'); }
const formData = (f) => Object.fromEntries(new FormData(f));
async function guardar(fn, msg) { const e = $('#ferr'); try { if (e) e.textContent = ''; await fn(); closeDrawer(); if (msg) toast(msg); await load(); } catch (err) { if (e) e.textContent = err.message; else toast(err.message); } }

// ---------- eventos ----------
document.addEventListener('click', async (ev) => {
  if (ev.target.classList.contains('scrim')) return closeDrawer();
  const sortTh = ev.target.closest('th[data-sort]');
  if (sortTh) { const v = sortTh.dataset.sv, k = sortTh.dataset.sort, cur = S.sort[v]; S.sort[v] = [k, cur[0] === k ? -cur[1] : 1]; return render(); }
  const row = ev.target.closest('tr[data-open]');
  if (row && !ev.target.closest('select,button,input')) { const k = row.dataset.open, x = S.data[k].find((o) => o.id === row.dataset.id); return openDrawer({ lb: lbForm, red: redForm, hours: hoursForm }[k](x)); }
  const el = ev.target.closest('[data-act]'); if (!el || el.tagName === 'SELECT') return;
  switch (el.dataset.act) {
    case 'view': S.view = el.dataset.v; localStorage.setItem('pe_view', S.view); if (S.view === 'ajustes') loadCal(); $('#view') && ($('#view').scrollTop = 0); render(); break;
    case 'newlb': openDrawer(lbForm()); break;
    case 'newred': openDrawer(redForm()); break;
    case 'newhours': openDrawer(hoursForm()); break;
    case 'editplan': openDrawer(planForm()); break;
    case 'close': closeDrawer(); break;
    case 'del': { const f = el.closest('form'), k = el.dataset.kind; if (confirm('¿Borrar? No se puede deshacer.')) guardar(() => api(`/api/${k}/${f.dataset.id}`, 'DELETE'), 'Borrado'); break; }
    case 'tstart': try { S.ttype = $('#ttype').value; await setTimer({ project: $('#tproj').value, task_type: $('#ttype').value, start: Date.now() }); renderTimer(); } catch (e) { toast(e.message); } break;
    case 'tstop': {
      const tm = timer(), hrs = Math.round(((Date.now() - tm.start) / 3600000) * 100) / 100;
      if (hrs < 0.01) { await setTimer(null); renderTimer(); break; }
      try { await api('/api/hours', 'POST', { project: tm.project, task_type: tm.task_type, hours: Math.min(hrs, 24), date: hoy(), note: 'Cronómetro' }); await setTimer(null); toast(`Se guardaron ${fmtN(hrs)} h en ${tm.project}`); await load(); } catch (e) { toast(e.message); }
      break;
    }
    case 'tdiscard': if (confirm('¿Descartar el tiempo del cronómetro?')) { await setTimer(null); renderTimer(); } break;
    case 'copy': navigator.clipboard?.writeText(el.dataset.v).then(() => toast('Mail copiado')); break;
    case 'copycal': navigator.clipboard?.writeText(S.calurl || '').then(() => toast('Link copiado')); break;
    case 'resetcal': if (confirm('El link anterior deja de funcionar y vas a tener que volver a agregarlo en Google Calendar. ¿Seguir?')) { S.calurl = (await api('/api/calendar/reset', 'POST')).url; render(); } break;
    case 'asall': document.querySelectorAll('.asck').forEach((c) => { c.checked = true; }); break;
    case 'asdone': { const ids = [...document.querySelectorAll('.asck:checked')].map((c) => Number(c.value)); if (!ids.length) return toast('Seleccioná al menos un cambio'); await api('/api/as/done', 'POST', { ids }); toast('Marcados como reflejados'); await load(); break; }
    case 'saveproj': $('#projf')?.requestSubmit(); break;
    case 'saveavisos': await api('/api/settings', 'POST', { avisos: $('#avisos').checked ? '1' : '0', aviso_hora: $('#aviso_hora').value, horas_hora: $('#horas_hora').value }); toast('Avisos guardados'); await load(); break;
    case 'push': enablePush(); break;
    case 'pushtest': { const r = await api('/api/push/test', 'POST'); $('#pushmsg').textContent = r.delivered ? 'Aviso de prueba enviado.' : 'Todavía no activaste los avisos en ninguna computadora.'; break; }
    case 'export': { const d = await api('/api/export'), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = `proyectos-eleven-${hoy()}.json`; a.click(); break; }
    case 'logout': await api('/api/logout', 'POST').catch(() => {}); S.token = ''; localStorage.removeItem('pe_token'); render(); break;
  }
});
document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.f && el.type !== 'search') { S.f[el.dataset.f] = el.value; render(); return; }
  if (el.dataset.act === 'lbestado' || el.dataset.act === 'redestado') {
    const kind = el.dataset.act === 'lbestado' ? 'lb' : 'red', x = S.data[kind].find((o) => o.id === el.dataset.id);
    try { await api('/api/' + kind, 'POST', { ...x, estado: el.value }); toast('Estado actualizado · anotado en Pendientes AppSheet'); await load(); } catch (e) { toast(e.message); el.value = x.estado; }
    return;
  }
  if (el.dataset.act === 'tproj') { S.tproj = el.value; $('#ttype').innerHTML = opts(TAREAS[proj(el.value).tipo]); return; }
  if (el.dataset.act === 'hrproj') { el.form.task_type.innerHTML = opts(TAREAS[proj(el.value).tipo]); return; }
  if (el.dataset.act === 'lbproj') { const pp = proj(el.value)?.params || {}; if (pp.servicio) el.form.tipo_servicio.value = pp.servicio; }
  if (el.closest('#lbf')) lbAvisosVivos();
});
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.f && el.type === 'search') { S.f[el.dataset.f] = el.value; clearTimeout(S.qt); S.qt = setTimeout(() => { const pos = el.selectionStart; render(); const n = document.querySelector(`[data-f="${el.dataset.f}"]`); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 200); return; }
  if (el.closest('#lbf')) lbAvisosVivos();
});
document.addEventListener('submit', async (ev) => {
  ev.preventDefault(); const f = ev.target;
  if (f.id === 'loginf') {
    try { const r = await api(S.setup ? '/api/setup' : '/api/login', 'POST', { password: f.pw.value }); S.token = r.token; localStorage.setItem('pe_token', r.token); S.setup = false; $('#app').innerHTML = ''; await load(); }
    catch (e) { $('#lerr').textContent = e.message; }
    return;
  }
  if (f.id === 'lbf') return guardar(() => api('/api/lb', 'POST', { ...formData(f), id: f.dataset.id || undefined }), 'Tarea guardada');
  if (f.id === 'redf') return guardar(() => { const d = formData(f); return api('/api/red', 'POST', { ...d, ia: d.ia === '1', id: f.dataset.id || undefined }); }, 'Redacción guardada');
  if (f.id === 'hrf') return guardar(() => api('/api/hours', 'POST', { ...formData(f), id: f.dataset.id || undefined }), 'Horas guardadas');
  if (f.id === 'planf') {
    const d = formData(f), rows = Object.keys(d).filter((k) => /^p\d+$/.test(k)).map((k) => { const i = k.slice(1), [project, task_type] = d[k].split('|'); return { project, task_type, hours: d['h' + i], units: d['u' + i] }; });
    return guardar(() => api('/api/plan', 'POST', { month: S.f.mes, rows }), 'Plan guardado');
  }
  if (f.id === 'projf') {
    const projects = [...f.querySelectorAll('tr[data-code]')].map((tr) => { const g = (n) => tr.querySelector(`[name=${n}]`)?.value ?? ''; return { code: tr.dataset.code, cliente: g('cliente'), active: tr.querySelector('[name=active]').checked, params: { drMin: g('drMin'), trafMin: g('trafMin'), precioMaxUSD: g('precioMaxUSD'), repDias: g('repDias'), palabrasMin: g('palabrasMin'), dominio: g('dominio'), paises: g('paises'), servicio: g('servicio') } }; });
    try { await api('/api/projects', 'POST', { projects }); toast('Proyectos guardados'); await load(); } catch (e) { toast(e.message); }
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && $('#drawer').classList.contains('open')) return closeDrawer();
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter' && $('#drawer').classList.contains('open')) $('#drawer form')?.requestSubmit();
});

async function loadCal() { try { S.calurl = (await api('/api/calendar')).url; const el = $('#calurl'); if (el) el.textContent = S.calurl; } catch { /* sin conexión */ } }

// ---------- notificaciones ----------
function b64uToBytes(s) { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); }
async function enablePush() {
  const msg = (t) => { const el = $('#pushmsg'); if (el) el.textContent = t; };
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return msg('Este navegador no permite avisos. Usá Chrome o Edge.');
    if ((await Notification.requestPermission()) !== 'granted') return msg('Permiso denegado. Habilitalo en la configuración del sitio del navegador.');
    const reg = await navigator.serviceWorker.ready, { publicKey } = await api('/api/vapid');
    const s = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(publicKey) }));
    await api('/api/push/subscribe', 'POST', s.toJSON()); msg('Avisos activados en esta computadora.');
  } catch (e) { msg('No se pudo activar: ' + e.message); }
}

// ---------- arranque ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
const qs = new URLSearchParams(location.search);
(async () => {
  if (S.token) {
    try { S.data = JSON.parse(localStorage.getItem('pe_cache') || 'null'); } catch { /* nada */ }
    if (S.data) render(); if (S.view === 'ajustes') loadCal(); await load();
    const n = qs.get('nuevo'); if (n === 'lb') openDrawer(lbForm()); else if (n === 'red') openDrawer(redForm()); else if (n === 'horas') openDrawer(hoursForm());
    if (n) history.replaceState(null, '', '/');
    return;
  }
  try { S.setup = (await api('/api/state')).setup; } catch { /* sin conexión */ }
  render();
})();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.token && !$('#drawer').classList.contains('open')) load(); });
