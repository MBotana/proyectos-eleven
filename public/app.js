// Proyectos Eleven — app de escritorio (PWA instalable desde Chrome o Edge). Un solo usuario; todo se guarda en el servidor.
import { ESTADOS_LB, ESTADOS_NEG, ESTADOS_RED, PRIORIDADES, MONEDAS, PUBLICADOS, TAREAS, TIPOS_SERVICIO, YO as YO_DEF, esCerradoLB, esCerradoRED, PASOS_LB, PASOS_RED, puedeRedactarLB, avisosLB, hoyEn, addDays, normDomain, compiladoAMedios, aptoMedio, planificar, alertas, QUIEN, DOC_EDITABLE_LB, semaforo, resumenProyecto } from './shared.js';

/** Tu nombre en AppSheet (cada usuario ve sus tareas); se toma de la sesión al cargar. */
let YO = YO_DEF;
const S = {
  token: localStorage.getItem('pe_token') || '', setup: false, data: null, view: localStorage.getItem('pe_view') || 'inicio', calurl: '',
  f: { lbProj: '', lbEstado: 'activas', lbQ: '', lbUser: YO, lbMail: '', lbNeg: '', lbMes: '', lbGroup: '1', redProj: '', redEstado: 'activas', redQ: '', redUser: YO, redGroup: '1', medGroup: 'mail_eleven', medQ: '', mes: hoyEn().slice(0, 7), medTab: 'compilado', mProj: '', mPais: '', mPrecio: '', mDr: '', mMail: '', mQ: '', planMes: addDays(hoyEn().slice(0, 7) + '-28', 7).slice(0, 7), iaProj: '' },
  sel: { lb: new Set(), red: new Set() }, medios: null, plan: null, pings: 0,
  sort: { lb: ['deadline', 1], red: ['fecha_entrega', 1], med: ['precio_usd', 1] },
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
  pruebas: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 15h10"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  plan: '<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 14h3M8 18h6"/>',
  alertas: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  ia: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>', doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  play: '<path d="M7 4v16l13-8z"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
};
Object.assign(IC, { tablero: IC.inicio, lproyectos: IC.proyectos, lalertas: IC.alertas, lajustes: IC.ajustes });
const ic = (k) => `<svg class="i" viewBox="0 0 24 24">${IC[k]}</svg>`;

async function api(path, method = 'GET', body) {
  const r = await fetch(path, { method, headers: { 'content-type': 'application/json', ...(S.token ? { authorization: 'Bearer ' + S.token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token && path !== '/api/login') { S.token = ''; localStorage.removeItem('pe_token'); render(); }
  if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
  return j;
}
/** Las tareas de prueba viven aparte (S.data.lbP / redP): nunca se mezclan con las reales ni van a AppSheet. */
function separarPruebas(d) { if (!d || d.lbP) return d; d.lbP = d.lb.filter((t) => t.prueba); d.lb = d.lb.filter((t) => !t.prueba); d.redP = d.red.filter((t) => t.prueba); d.red = d.red.filter((t) => !t.prueba); return d; }
const tarea = (k, id) => S.data[k].find((o) => o.id === id) || S.data[k + 'P']?.find((o) => o.id === id);
function tomarUsuario() {
  if (!S.data?.me) return; const antes = YO; YO = S.data.me.nombre || YO_DEF;
  if (!S.yoListo || antes !== YO) { S.f.lbUser = YO; S.f.redUser = YO; S.yoListo = true; }
}
async function load() {
  try { S.data = separarPruebas(await api('/api/data')); tomarUsuario(); localStorage.setItem('pe_cache', JSON.stringify({ ...S.data, lb: [...S.data.lb, ...S.data.lbP], red: [...S.data.red, ...S.data.redP], lbP: undefined, redP: undefined })); }
  catch { if (!S.data) { try { S.data = separarPruebas(JSON.parse(localStorage.getItem('pe_cache') || 'null')); } catch { /* nada */ } } if (S.token) toast('Sin conexión: se muestran los últimos datos'); }
  render();
}
const proj = (code) => S.data.projects.find((p) => p.code === code);
const projs = (tipo) => S.data.projects.filter((p) => p.active && (!tipo || p.tipo === tipo));
const texto = (kind, id) => S.data.textos?.find((t) => t.kind === kind && t.ref === id);
const textoTag = (kind, id) => { const t = texto(kind, id); return t && t.palabras ? ` <span class="tag ${t.lista ? 'ok' : ''}" title="Redacción cargada en la app">${t.lista ? 'Redacción lista' : 'Borrador'} · ${t.palabras} pal.</span>` : ''; };
const pasoTitle = (pasos, e) => { const p = pasos[e]; return p ? `Para avanzar a ${p.sigue}: ${p.falta.join(' · ')}` : ''; };
function pasoBox(pasos, e) {
  const p = pasos[e]; if (!p) return '';
  return `<div class="alert" style="background:var(--acc-bg);border-color:#c7d7fe;margin:0 0 16px"><div style="font-weight:600;font-size:12.5px;color:var(--acc)">Próximo paso: ${h(e)} → ${h(p.sigue)}${p.confirmado ? '' : ' <span class="mute" style="font-weight:400">(a confirmar con las pruebas)</span>'}</div>
    <ul class="warnlist" style="margin-top:4px">${p.falta.map((f) => `<li style="color:var(--ink2)">• ${h(f)}</li>`).join('')}</ul>${p.botones.length ? `<div class="small mute" style="margin-top:4px">En AppSheet: ${p.botones.map(h).join(' · ')}</div>` : ''}</div>`;
}
const estadoOpts = (list, cur) => opts(list.includes(cur) || !cur ? list : [...list, cur], cur);
const estadoBadge = (e) => { const i = ESTADOS_LB.indexOf(e); const b = /^Backlink Publicado/.test(e) ? 5 : e === 'Cerrado' || e === 'Anulado' ? 7 : i <= 0 ? 1 : i <= 1 ? 2 : i <= 4 ? 3 : 4; return `<span class="badge b${b}">${h(e)}</span>`; };
const redBadge = (e) => `<span class="badge b${e === 'Cerrado' ? 7 : /^Para CMS/.test(e) ? 5 : /^Entrega/.test(e) ? 3 : e === 'Revisión General' ? 4 : 1}">${h(e)}</span>`;
function dlTag(d, done) { if (!d) return '<span class="mute">—</span>'; const t = hoy(); if (done) return `<span class="mute">${fmtD(d)}</span>`; return d < t ? `<span class="tag bad">${fmtD(d)}</span>` : d === t ? `<span class="tag warn">Hoy</span>` : d <= addDays(t, 2) ? `<span class="tag warn">${fmtD(d)}</span>` : fmtD(d); }

// ---------- marco ----------
const VIEWS = [['inicio', 'Inicio'], ['alertas', 'Notas y alertas'], ['lb', 'Links'], ['red', 'Redacciones'], ['medios', 'Medios'], ['plan', 'Planificación'], ['horas', 'Horas'], ['sep'], ['proyectos', 'Proyectos'], ['ia', 'IA y prompts'], ['pruebas', 'Pruebas'], ['appsheet', 'Para AppSheet'], ['ajustes', 'Ajustes']];
function render() {
  if (!S.token) return renderLogin();
  if (!S.data) { $('#app').innerHTML = '<div class="login"><div class="mute">Cargando…</div></div>'; return; }
  if (necesitaBienvenida()) return renderBienvenida();
  if (!$('#shell')) $('#app').innerHTML = `<div id="shell"><aside id="side"><div class="brand"><img src="/icon.svg" alt=""><div><b>Proyectos Eleven</b><small>Link building · Contenido</small></div></div><nav id="nav"></nav><div id="sidetimer"></div></aside><section id="main"><header id="head"></header><div id="view"></div></section></div>`;
  const al = misAlertas(), counts = { lb: S.data.lb.filter((t) => t.usuario === YO && !esCerradoLB(t.estado)).length, red: S.data.red.filter((r) => r.usuario === YO && !esCerradoRED(r.estado)).length, appsheet: S.data.as_pend.length, alertas: al.lider.length + al.impagas.length + al.indexacion.length };
  const modo = modoActual(), vistas = modo === 'lider' ? VIEWS_LIDER : VIEWS;
  if (!vistas.some(([k]) => k === S.view)) S.view = vistas[0][0];
  $('#nav').innerHTML = vistas.map(([k, t]) => (k === 'sep' ? '<div class="navsep"></div>' : `<button data-act="view" data-v="${k}" class="${S.view === k ? 'on' : ''}">${ic(k)}<span>${t}</span>${counts[k] ? `<span class="count${k === 'alertas' ? ' hotc' : ''}">${counts[k]}</span>` : ''}</button>`)).join('');
  S.enPruebas = S.view === 'pruebas';
  const v = VIEWS_FN[S.view] || VIEWS_FN.inicio, out = v();
  $('#head').innerHTML = `<div><h1>${out.title}</h1>${out.sub ? `<div class="sub">${out.sub}</div>` : ''}</div><div class="actions">${out.actions || ''}<button class="btn sec" data-act="actualizar" title="Vuelve a cargar lo que ya está en la app (no lee AppSheet)">Recargar</button>${botonSync()}</div>`;
  const keep = $('#view').scrollTop; $('#view').innerHTML = bannerSync() + out.body; $('#view').scrollTop = keep;
  renderSyncSide();
}
// ---------- sincronización a pedido (botón Sincronizar) ----------
const fmtHora = (ms) => new Date(ms).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
function syncInfo() {
  const st = S.data?.settings || {}, at = Number(st.as_sync_at) || 0; let info = {};
  try { info = JSON.parse(st.as_sync_info || '{}') || {}; } catch { /* sin info */ }
  return { at, hoy: !!at && hoyEn(undefined, at) === hoy(), info };
}
const botonSync = () => `<button class="btn" data-act="sync" ${S.syncEsperando ? 'disabled' : ''} title="Claude lee AppSheet y el reporte de seguimiento (dos veces cada tabla), valida todo y recién ahí actualiza la app">${ic('refresh')}${S.syncEsperando ? 'Sincronizando…' : 'Sincronizar'}</button>`;
function bannerSync() {
  const s = syncInfo(), box = (cls, html) => `<div class="alert ${cls}" style="margin:0 0 16px">${html}</div>`;
  if (S.syncEsperando) return box('info', `<b>Sincronizando con AppSheet…</b> Claude está leyendo AppSheet y el reporte (dos veces cada tabla). Esta ventana se actualiza sola cuando termine. <button class="lnk small" data-act="synccancel">Dejar de esperar</button>`);
  if (!s.at) return box('info', '<b>Todavía no hay datos de AppSheet.</b> Tocá <b>Sincronizar</b> para traerlos.');
  if (s.info.verificado === false) return box('bad', `<b>La última sincronización (${fmtHora(s.at)}) no pasó la verificación.</b> No tomes decisiones con estos datos: volvé a sincronizar.`);
  if (!s.hoy) return box('warn', `<b>Estos datos son del ${fmtHora(s.at)}.</b> Tocá <b>Sincronizar</b> para traer lo que hay hoy en AppSheet.`);
  return '';
}
function renderSyncSide() {
  const el = $('#sidetimer'); if (!el) return; const s = syncInfo();
  el.innerHTML = `<div class="lbl">Datos de AppSheet</div><div class="small" style="margin:2px 0 8px">${s.at ? `<b class="t-${s.hoy && s.info.verificado !== false ? 'ok' : 'warn'}">${s.hoy ? 'Hoy ' + new Date(s.at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : fmtHora(s.at)}</b>${s.info.links !== undefined ? `<div class="mute">${s.info.links} links · ${s.info.redacciones} redacciones</div>` : ''}${s.info.objetivos ? `<div class="mute">Objetivos del ${fmtD(s.info.objetivos)}</div>` : ''}` : '<span class="mute">Sin sincronizar</span>'}</div>${botonSync().replace('class="btn"', 'class="btn full sm"')}`;
}
/** Abre Claude con el pedido y espera (consultando la app cada 10 s) a que lleguen los datos nuevos. */
function sincronizar() {
  sincronizarConClaude('sincronizar');
  S.syncEsperando = { desde: Date.now(), antes: syncInfo().at }; sessionStorage.setItem('pe_sync', JSON.stringify(S.syncEsperando));
  esperarSync(); render();
}
function esperarSync() {
  clearInterval(S.syncPoll); if (!S.syncEsperando) return;
  S.syncPoll = setInterval(async () => {
    if (!S.syncEsperando || Date.now() - S.syncEsperando.desde > 30 * 60000) return terminarEspera();
    await load();
    const s = syncInfo();
    if (s.at > S.syncEsperando.antes) { terminarEspera(); toast(s.info.verificado === false ? 'Llegaron datos, pero no pasaron la verificación' : `Datos de AppSheet actualizados: ${s.info.links} links y ${s.info.redacciones} redacciones`); }
  }, 10000);
}
function terminarEspera() { clearInterval(S.syncPoll); S.syncEsperando = null; sessionStorage.removeItem('pe_sync'); render(); }
function renderLogin() {
  const alta = S.setup || S.invitacion;
  const intro = S.invitacion === false ? 'Esta invitación ya se usó o no existe. Pedile un link nuevo a quien te invitó.' : S.invitacion ? 'Te invitaron a Proyectos Eleven. Creá tu cuenta con tu mail de Eleven.' : S.setup ? 'Primera vez: creá tu cuenta con tu mail de Eleven.' : 'Ingresá con tu mail (o tu nombre) y tu contraseña.';
  $('#app').innerHTML = `<div class="login">${S.invitacion ? pasosBienvenida(enApp() || localStorage.getItem('pe_instalada') ? 1 : 0) : ''}${S.invitacion && !enApp() ? cajaInstalar() : ''}<form class="box" id="loginf"><img src="/icon.svg" alt=""><h1>Proyectos Eleven</h1><p>${intro}</p>
    ${S.invitacion === false ? '' : alta ? `<label>Mail de Eleven<input name="email" type="email" required autocomplete="email" autofocus></label>`
      : `<label>Mail o nombre<input name="usuario" autocomplete="username" autofocus></label>`}
    ${S.invitacion === false ? '' : `<label>Contraseña<input type="password" name="pw" autocomplete="${alta ? 'new-password' : 'current-password'}" required minlength="8"></label>
    <button class="btn full" style="margin-top:14px">${alta ? 'Crear cuenta y entrar' : 'Entrar'}</button>`}<div class="err" id="lerr"></div></form></div>`;
}
const searchBox = (f, ph) => `<div class="search">${ic('search')}<input type="search" data-f="${f}" placeholder="${ph}" value="${h(S.f[f])}"></div>`;
function th(view, key, label, cls = '') { const [k, d] = S.sort[view]; return `<th data-sort="${key}" data-sv="${view}" class="${cls}">${label}${k === key ? `<span class="arr">${d > 0 ? '▲' : '▼'}</span>` : ''}</th>`; }
function sortBy(arr, view, getters) { const [k, d] = S.sort[view], g = getters[k] || ((x) => x[k] ?? ''); return arr.sort((a, b) => { const x = g(a), y = g(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es', { numeric: true })) * d; }); }

// ---------- Inicio ----------
function pendientes() {
  const out = [];
  for (const t of S.data.lb) if (t.usuario === YO && t.deadline && !PUBLICADOS.has(t.estado) && !esCerradoLB(t.estado)) out.push({ kind: 'lb', id: t.id, d: t.deadline, tipo: 'Link', title: t.anchor || '(sin anchor)', code: t.as_code, project: t.project, estado: estadoBadge(t.estado) });
  for (const r of S.data.red) if (r.usuario === YO && r.fecha_entrega && !esCerradoRED(r.estado)) out.push({ kind: 'red', id: r.id, d: r.fecha_entrega, tipo: 'Redacción', title: r.tema, code: '', project: r.project, estado: redBadge(r.estado) });
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
  const rebotes = S.data.lb.filter((x) => x.usuario === YO && !PUBLICADOS.has(x.estado) && !esCerradoLB(x.estado)).map((x) => ({ x, a: avisosLB(x, proj(x.project), S.data.lb) })).filter((o) => o.a.length);
  const fecha = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return {
    title: 'Inicio', sub: fecha.charAt(0).toUpperCase() + fecha.slice(1),
    actions: `<button class="btn sec" data-act="newhours">${ic('horas')}Cargar horas</button><button class="btn sec" data-act="newred">${ic('plus')}Redacción</button><button class="btn" data-act="newlb">${ic('plus')}Tarea de LB</button>`,
    body: `${!S.data.projects.length ? `<div class="alert" style="margin:0 0 16px;background:var(--acc-bg);border-color:#c7d7fe"><b>Primer paso: traé tus tareas de AppSheet.</b> Andá a <a href="#" data-act="view" data-v="ajustes">Ajustes → Traer tus tareas de AppSheet</a>, arrastrá el botón a la barra de favoritos y tocalo con AppSheet abierto. Se cargan tus proyectos y tus tareas.</div>` : ''}<div class="kpis">
      <div class="kpi"><div class="k">Horas hoy</div><div class="v">${fmtN(totHoy)}</div><div class="d">Semana: ${fmtN(totSem)} h</div></div>
      <div class="kpi"><div class="k">Horas del mes</div><div class="v">${fmtN(rm)} <span class="mute" style="font-size:14px;font-weight:500">/ ${fmtN(pm)}</span></div><div class="d">${pm ? Math.round((rm / pm) * 100) : 0}% del plan de ${MESES[Number(mes.slice(5)) - 1]}</div></div>
      <div class="kpi ${venc.length ? 'hot' : ''}"><div class="k">Vencidas</div><div class="v">${venc.length}</div><div class="d">${prox.length - venc.length} en los próximos 7 días</div></div>
      <div class="kpi ${rebotes.length ? 'hot' : ''}"><div class="k">Tareas que rebotarían</div><div class="v">${rebotes.length}</div><div class="d">Según parámetros del proyecto</div></div>
      <div class="kpi"><div class="k">Pendientes AppSheet</div><div class="v">${S.data.as_pend.length}</div><div class="d">Cambios sin reflejar</div></div>
      <div class="kpi ${misAlertas().lider.length ? 'hot' : ''}" data-act="view" data-v="alertas" style="cursor:pointer"><div class="k">Hablar con el líder</div><div class="v">${misAlertas().lider.length}</div><div class="d">${misAlertas().impagas.length} sin pagar · ${misAlertas().indexacion.length} indexación</div></div></div>
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
const hechas = (p, mes) => (p.tipo === 'LIN' ? S.data.lb.filter((t) => t.usuario === YO && t.project === p.code && t.publicado && t.publicado.startsWith(mes)).length : S.data.red.filter((r) => r.usuario === YO && r.project === p.code && r.entregada && r.entregada.startsWith(mes)).length);

// ---------- Link building ----------
const usuarios = (arr) => [...new Set(arr.map((x) => x.usuario).filter(Boolean))].sort((a, b) => (a === YO ? -1 : b === YO ? 1 : a.localeCompare(b)));
const fmtMes = (d) => (d ? `${MESES[Number(d.slice(5, 7)) - 1].slice(0, 3)} ${d.slice(2, 4)}` : '');
/** Filas agrupadas por proyecto (encabezado con cliente y cantidad), como en AppSheet. */
function agrupar(arr, cols, rowFn, group) {
  if (group !== '1') return arr.map(rowFn).join('');
  let out = '', cur = null;
  const byP = arr.reduce((m, x) => ((m[x.project] = (m[x.project] || 0) + 1), m), {});
  for (const x of [...arr].sort((a, b) => S.data.projects.findIndex((p) => p.code === a.project) - S.data.projects.findIndex((p) => p.code === b.project))) {
    if (x.project !== cur) { cur = x.project; out += `<tr class="grp"><td colspan="${cols}"><span class="mono">${h(cur)}</span> <span class="mute" style="font-weight:400">· ${h(proj(cur)?.cliente || '')} · ${byP[cur]} tarea${byP[cur] > 1 ? 's' : ''}</span></td></tr>`; }
    out += rowFn(x);
  }
  return out;
}
// ---------- selección y cambio de estado en lote ----------
const selTd = (k, id) => `<td class="ck"><input type="checkbox" class="selck" data-k="${k}" data-id="${h(id)}" ${S.sel[k].has(id) ? 'checked' : ''}></td>`;
const selAllTh = (k, arr) => { const all = arr.length && arr.every((x) => S.sel[k].has(x.id)); S.visibles = { ...(S.visibles || {}), [k]: arr.map((x) => x.id) }; return `<th class="ck"><input type="checkbox" class="selall" data-k="${k}" title="Seleccionar las ${arr.length} visibles" ${all ? 'checked' : ''}></th>`; };
function bulkBar(k, arr) {
  const n = S.sel[k].size; if (!n) return '';
  const lista = k === 'lb' ? ESTADOS_LB : ESTADOS_RED, selec = [...S.data[k], ...S.data[k + 'P']].filter((x) => S.sel[k].has(x.id)), est = [...new Set(selec.map((x) => x.estado))];
  return `<div class="bulk"><b>${n} seleccionada${n > 1 ? 's' : ''}</b><span class="mute small">${h(est.slice(0, 3).join(' · '))}${est.length > 3 ? '…' : ''} · ${h([...new Set(selec.map((x) => x.project))].join(', '))}</span>
    <span style="margin-left:auto" class="small">Pasar a</span><select id="bulkest">${opts(lista, k === 'lb' ? PASOS_LB[est[0]]?.sigue || '' : PASOS_RED[est[0]]?.sigue || '')}</select>
    <button class="btn sm" data-act="bulkgo" data-k="${k}">Aplicar</button><button class="btn sm sec" data-act="bulkclear" data-k="${k}">Limpiar</button></div>`;
}

VIEWS_FN.lb = () => {
  const src = S.enPruebas ? S.data.lbP : S.data.lb;
  const f = S.f, q = f.lbQ.trim().toLowerCase();
  let arr = src.filter((t) => (!f.lbProj || t.project === f.lbProj) && (!f.lbUser || t.usuario === f.lbUser) && (!f.lbMail || t.mail_eleven === f.lbMail) && (!f.lbNeg || t.estado_neg === f.lbNeg) && (!f.lbMes || (t.deadline || '').startsWith(f.lbMes))
    && (f.lbEstado === 'todas' || (f.lbEstado === 'activas' ? !esCerradoLB(t.estado) : f.lbEstado === 'pendientes' ? !esCerradoLB(t.estado) && !PUBLICADOS.has(t.estado) : t.estado === f.lbEstado)));
  if (q) arr = arr.filter((t) => [t.as_code, t.anchor, t.medio, t.mail_eleven, t.contacto_medio, t.url_cliente, t.notas].join(' ').toLowerCase().includes(q));
  sortBy(arr, 'lb', { deadline: (t) => t.deadline || '9999', estado: (t) => ESTADOS_LB.indexOf(t.estado), precio: (t) => Number(t.precio ?? -1), medio: (t) => normDomain(t.medio), as_code: (t) => t.as_code.replace(/\d+$/, (n) => n.padStart(4, '0')) });
  const base = src.filter((t) => !f.lbUser || t.usuario === f.lbUser);
  const mails = [...new Set(base.map((t) => t.mail_eleven).filter(Boolean))].sort(), meses = [...new Set(base.map((t) => (t.deadline || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  const estados = [...new Set([...ESTADOS_LB, ...base.map((t) => t.estado)])];
  const sync = S.data.settings.as_sync_at ? `Copiado de AppSheet el ${new Date(Number(S.data.settings.as_sync_at)).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}` : '';
  return {
    title: 'Links', sub: `Tareas de link building · ${arr.length} resultado${arr.length === 1 ? '' : 's'}${sync ? ' · ' + sync : ''}`,
    actions: `<button class="btn" data-act="newlb">${ic('plus')}Nueva tarea</button>`,
    body: `<div class="toolbar wrap">
      <select data-f="lbProj"><option value="">Todos los proyectos</option>${opts(projs('LIN').map((p) => p.code), f.lbProj, projs('LIN').map((p) => `${p.code} · ${p.cliente}`))}</select>
      <select data-f="lbEstado">${opts(['activas', 'pendientes', 'todas', ...estados], f.lbEstado, ['Activas (sin cerradas ni anuladas)', 'Sin publicar', 'Todas', ...estados])}</select>
      <select data-f="lbUser"><option value="">Todos los asignados</option>${opts(usuarios(src), f.lbUser, usuarios(src).map((u) => (u === YO ? `${u} (yo)` : u)))}</select>
      <select data-f="lbMail"><option value="">Todos los mails de contacto</option>${opts(mails, f.lbMail)}</select>
      <select data-f="lbNeg"><option value="">Toda negociación</option>${opts(ESTADOS_NEG.filter(Boolean), f.lbNeg)}</select>
      <select data-f="lbMes"><option value="">Todos los meses</option>${opts(meses, f.lbMes, meses.map((m) => mesLargo(m)))}</select>
      ${searchBox('lbQ', 'Buscar anchor, medio, mail, código…')}
      <label class="check" style="margin-left:auto"><input type="checkbox" data-f="lbGroup" ${f.lbGroup === '1' ? 'checked' : ''}> Agrupar por proyecto</label></div>
    ${bulkBar('lb', arr)}<div class="card tblwrap"><table class="tbl"><thead><tr>${selAllTh('lb', arr)}${th('lb', 'as_code', 'Código')}${th('lb', 'anchor', 'Anchor')}${th('lb', 'medio', 'Medio')}${th('lb', 'mail_eleven', 'Mail de contacto')}${th('lb', 'estado_neg', 'Negociación')}${th('lb', 'precio', 'Precio', 'num')}${th('lb', 'deadline', 'Mes plan.')}${f.lbUser ? '' : th('lb', 'usuario', 'Asignado')}${th('lb', 'estado', 'Estado')}</tr></thead><tbody>
      ${agrupar(arr, f.lbUser ? 9 : 10, (x) => { const av = PUBLICADOS.has(x.estado) || esCerradoLB(x.estado) ? [] : avisosLB(x, proj(x.project), src);
        return `<tr data-open="lb" data-id="${x.id}" class="${S.sel.lb.has(x.id) ? 'selrow' : ''}">${selTd('lb', x.id)}<td class="mono">${x.as_code ? h(x.as_code) : x.prueba ? '<span class="tag warn">Prueba</span>' : `<span class="tag acc">Nueva · ${h(x.project)}</span>`}</td><td title="${h(x.anchor)}">${h(x.anchor) || '<span class="mute">—</span>'}${textoTag('lb', x.id)}${av.length ? ` <span class="tag warn" title="${h(av.join('\n'))}">${av.length} aviso${av.length > 1 ? 's' : ''}</span>` : ''}</td>
          <td title="${h(x.medio)}">${h(normDomain(x.medio))}</td><td title="${h(x.mail_eleven)}">${h(x.mail_eleven)}</td><td>${h(x.estado_neg)}</td><td class="num nowrap">${x.precio !== null && x.precio !== undefined ? `${h(x.moneda)} ${fmtN(x.precio)}` : ''}</td>
          <td class="nowrap">${PUBLICADOS.has(x.estado) || esCerradoLB(x.estado) ? `<span class="mute">${fmtMes(x.deadline)}</span>` : x.deadline && x.deadline < hoy() ? `<span class="tag bad">${fmtMes(x.deadline)}</span>` : fmtMes(x.deadline)}</td>
          ${f.lbUser ? '' : `<td class="nowrap ${x.usuario === YO ? '' : 'mute'}">${h(x.usuario)}</td>`}
          <td><select data-act="lbestado" data-id="${x.id}" title="${h(pasoTitle(PASOS_LB, x.estado))}">${estadoOpts(ESTADOS_LB, x.estado)}</select></td></tr>`; }, f.lbGroup) || '<tr><td colspan="10" class="empty">No hay tareas con estos filtros.</td></tr>'}</tbody></table></div>`,
  };
};
function lbForm(x = {}) {
  const ps = projs('LIN'), p = x.project || S.f.lbProj || ps[0]?.code, pp = proj(p)?.params || {};
  const mails = [...new Set(S.data.lb.map((t) => t.mail_eleven).filter(Boolean))].sort();
  return `<form id="lbf" data-id="${h(x.id || '')}" data-prueba="${x.prueba ? 1 : ''}"><div class="dh"><h2>${x.prueba ? '<span class="tag warn">Prueba</span> ' : ''}${x.id ? h(x.as_code || 'Tarea de link building') : 'Nueva tarea de link building'}</h2><button type="button" class="x" data-act="close" title="Cerrar (Esc)">${ic('x')}</button></div>
    <div class="db">${x.id ? pasoBox(PASOS_LB, x.estado) : ''}<div class="fields">
      <div class="section">Tarea</div>
      <label>Proyecto<select name="project" data-act="lbproj">${opts(ps.map((q) => q.code), p, ps.map((q) => `${q.code} · ${q.cliente}`))}</select></label>
      <label>Código en AppSheet<input name="as_code" class="mono" placeholder="${h(p)}-00" value="${h(x.as_code)}"></label>
      <label>Estado<select name="estado">${estadoOpts(ESTADOS_LB, x.estado || 'No Iniciado')}</select></label>
      <label>Mes planificado (deadline)<input type="date" name="deadline" value="${h(x.deadline)}"></label>
      <label>Asignado a<input name="usuario" list="users" value="${h(x.usuario || YO)}"></label>
      <label>Fecha de publicación<input type="date" value="${h(x.publicado)}" disabled></label>
      <label>Tipo de servicio<select name="tipo_servicio">${opts(TIPOS_SERVICIO, x.tipo_servicio || pp.servicio)}</select></label>
      <label>Negociación<select name="estado_neg">${estadoOpts(ESTADOS_NEG, x.estado_neg)}</select></label>
      <label class="full">Anchor text<input name="anchor" value="${h(x.anchor)}"></label>
      <label class="full">URL del cliente<input name="url_cliente" type="url" placeholder="https://${h(pp.dominio || '')}" value="${h(x.url_cliente)}"></label>
      <label class="full">URL de la publicación<input name="url_publicacion" type="url" placeholder="Se completa cuando el medio publica" value="${h(x.url_publicacion)}"></label>
      <div class="section">Medio</div>
      <label>Dominio<input name="medio" placeholder="diario.com.ar" value="${h(x.medio)}"></label>
      <div class="fields" style="gap:10px"><label>DR<input name="dr" type="number" step="any" value="${h(x.dr)}"></label><label>Tráfico<input name="trafico" type="number" step="1" value="${h(x.trafico)}"></label></div>
      <label>Precio<input name="precio" type="number" step="any" value="${h(x.precio)}"></label>
      <label>Moneda<select name="moneda">${opts(MONEDAS, x.moneda || 'USD')}</select></label>
      <div class="section">Contacto</div>
      <label>Mail de contacto (Mail Eleven)<input name="mail_eleven" list="mails" placeholder="nombre@eleven-agencia.net" value="${h(x.mail_eleven)}"></label>
      <label>Contacto del medio<input name="contacto_medio" placeholder="Mail, nombre o proveedor" value="${h(x.contacto_medio)}"></label>
      <label class="full">Notas<textarea name="notas">${h(x.notas)}</textarea></label>
    </div><datalist id="mails">${mails.map((m) => `<option value="${h(m)}">`).join('')}</datalist><datalist id="users">${usuarios([...S.data.lb, ...S.data.red]).map((u) => `<option value="${h(u)}">`).join('')}</datalist>
    <div id="lbav"></div><div class="err" id="ferr"></div></div>
    <div class="df">${x.id ? `<button type="button" class="btn danger" data-act="del" data-kind="lb">Borrar</button><button type="button" class="btn sec left" data-act="redactar" data-kind="lb" data-id="${x.id}" ${puedeRedactarLB(x.estado) ? '' : 'disabled title="Se habilita desde Gestión de Backlink"'}>${ic('red')}Redacción</button>` : '<span class="left"></span>'}<button type="button" class="btn sec" data-act="close">Cancelar</button><button class="btn">Guardar</button></div></form>`;
}
function lbAvisosVivos() {
  const f = $('#lbf'); if (!f) return;
  const x = Object.fromEntries(new FormData(f)); x.id = f.dataset.id;
  const a = PUBLICADOS.has(x.estado) || esCerradoLB(x.estado) ? [] : avisosLB(x, proj(x.project), S.data.lb), pp = proj(x.project)?.params || {};
  const lim = [pp.drMin != null && `DR ≥ ${pp.drMin}`, pp.trafMin != null && `tráfico ≥ ${fmtN(pp.trafMin)}`, pp.precioMaxUSD != null && `USD ≤ ${pp.precioMaxUSD}`, pp.repDias && `repetir medio cada ${pp.repDias} días`, pp.palabrasMin && `${pp.palabrasMin} palabras mín.`].filter(Boolean).join(' · ');
  $('#lbav').innerHTML = (lim ? `<p class="small mute" style="margin:14px 0 0">Parámetros de ${h(x.project)}: ${lim}</p>` : '') + (a.length ? `<div class="alert"><b style="color:var(--warn);font-size:12.5px">AppSheet va a rechazar o frenar esta tarea</b><ul class="warnlist">${a.map((s) => `<li>${h(s)}</li>`).join('')}</ul></div>` : '');
}

// ---------- Redacciones ----------
VIEWS_FN.red = () => {
  const src = S.enPruebas ? S.data.redP : S.data.red;
  const f = S.f, q = f.redQ.trim().toLowerCase();
  let arr = src.filter((r) => (!f.redProj || r.project === f.redProj) && (!f.redUser || r.usuario === f.redUser) && (f.redEstado === 'todas' || (f.redEstado === 'activas' ? !esCerradoRED(r.estado) : r.estado === f.redEstado)));
  if (q) arr = arr.filter((r) => [r.as_code, r.tema, r.subproyecto, r.variante, r.notas].join(' ').toLowerCase().includes(q));
  sortBy(arr, 'red', { fecha_entrega: (r) => r.fecha_entrega || '9999', prioridad: (r) => -PRIORIDADES.indexOf(r.prioridad), estado: (r) => ESTADOS_RED.indexOf(r.estado), as_code: (r) => (r.as_code || '~').replace(/\d+$/, (n) => n.padStart(4, '0')) });
  const pendAS = new Set(S.data.as_pend.filter((a) => a.entity === 'red').map((a) => a.ref));
  const base = src.filter((r) => !f.redUser || r.usuario === f.redUser), estados = [...new Set([...ESTADOS_RED, ...base.map((r) => r.estado)])];
  return {
    title: 'Redacciones', sub: `${arr.length} redacci${arr.length === 1 ? 'ón' : 'ones'}`, actions: `<button class="btn" data-act="newred">${ic('plus')}Nueva redacción</button>`,
    body: `<div class="toolbar"><select data-f="redProj"><option value="">Todos los proyectos</option>${opts(projs('RED').map((p) => p.code), f.redProj, projs('RED').map((p) => `${p.code} · ${p.cliente}`))}</select>
      <select data-f="redEstado">${opts(['activas', 'todas', ...estados], f.redEstado, ['Activas (sin cerradas)', 'Todas', ...estados])}</select>
      <select data-f="redUser"><option value="">Todos los asignados</option>${opts(usuarios(src), f.redUser, usuarios(src).map((u) => (u === YO ? `${u} (yo)` : u)))}</select>
      ${searchBox('redQ', 'Buscar tema o código…')}<label class="check" style="margin-left:auto"><input type="checkbox" data-f="redGroup" ${f.redGroup === '1' ? 'checked' : ''}> Agrupar por proyecto</label></div>
    ${bulkBar('red', arr)}<div class="card tblwrap"><table class="tbl"><thead><tr>${selAllTh('red', arr)}${th('red', 'as_code', 'Código')}${th('red', 'tema', 'Tema')}${th('red', 'subproyecto', 'Subproyecto')}${th('red', 'prioridad', 'Prioridad')}${th('red', 'fecha_entrega', 'Deadline')}${th('red', 'entregada', 'Entregada')}${f.redUser ? '' : th('red', 'usuario', 'Asignado')}${th('red', 'estado', 'Estado')}</tr></thead><tbody>
      ${agrupar(arr, f.redUser ? 8 : 9, (r) => `<tr data-open="red" data-id="${r.id}" class="${S.sel.red.has(r.id) ? 'selrow' : ''}">${selTd('red', r.id)}<td class="mono">${r.as_code ? h(r.as_code) : `<span class="tag ${r.prueba ? 'warn' : 'acc'}">${r.prueba ? 'Prueba' : pendAS.has(r.id) ? 'Por cargar' : 'Nueva'}</span>`}</td><td title="${h(r.tema)}" style="max-width:340px">${h(r.tema)}${textoTag('red', r.id)}</td><td>${h([r.subproyecto, r.variante].filter(Boolean).join(' · '))}</td>
        <td>${r.prioridad === 'Alta' || r.prioridad === 'Urgente' ? `<span class="tag bad">${h(r.prioridad)}</span>` : r.prioridad === 'Baja' ? '<span class="tag">Baja</span>' : h(r.prioridad)}</td>
        <td>${dlTag(r.fecha_entrega, esCerradoRED(r.estado) || !!r.entregada)}</td><td class="mute">${fmtD(r.entregada)}</td>${f.redUser ? '' : `<td class="nowrap ${r.usuario === YO ? '' : 'mute'}">${h(r.usuario)}</td>`}
        <td><select data-act="redestado" data-id="${r.id}" title="${h(pasoTitle(PASOS_RED, r.estado))}">${estadoOpts(ESTADOS_RED, r.estado)}</select></td></tr>`, f.redGroup) || '<tr><td colspan="9" class="empty">No hay redacciones con estos filtros.</td></tr>'}</tbody></table></div>`,
  };
};
function redForm(r = {}) {
  const ps = projs('RED');
  return `<form id="redf" data-id="${h(r.id || '')}" data-prueba="${r.prueba ? 1 : ''}"><div class="dh"><h2>${r.prueba ? '<span class="tag warn">Prueba</span> ' : ''}${r.id ? 'Redacción' : 'Nueva redacción'}</h2><button type="button" class="x" data-act="close">${ic('x')}</button></div>
    <div class="db">${r.id ? pasoBox(PASOS_RED, r.estado) : ''}<p class="small mute" style="margin:0 0 14px">Mismos campos que pide AppSheet en Carga de Redacciones.</p><div class="fields">
      <label class="full">Tema *<input name="tema" required value="${h(r.tema)}"></label>
      <label>Código en AppSheet<input name="as_code" class="mono" placeholder="Se completa al cargarla" value="${h(r.as_code)}"></label>
      <label>Asignado a<input name="usuario" value="${h(r.usuario || YO)}"></label>
      <label>Proyecto<select name="project">${opts(ps.map((q) => q.code), r.project || S.f.redProj || ps[0]?.code, ps.map((q) => `${q.code} · ${q.cliente}`))}</select></label>
      <label>Subproyecto (opcional)<input name="subproyecto" value="${h(r.subproyecto)}"></label>
      <label>Variante de subproyecto (opcional)<input name="variante" value="${h(r.variante)}"></label>
      <label>Deadline estado<input type="date" name="deadline_estado" value="${h(r.deadline_estado)}"></label>
      <label>Idioma<input name="idioma" value="${h(r.idioma || 'Español')}"></label>
      <label>País<input name="pais" value="${h(r.pais || 'Argentina')}"></label>
      <label>Deadline tarea<input type="date" name="fecha_entrega" value="${h(r.fecha_entrega || hoy())}"></label>
      <label>Prioridad<select name="prioridad">${estadoOpts(PRIORIDADES, r.prioridad || 'Normal')}</select></label>
      <label>Redacción IA<select name="ia">${opts(['1', '0'], r.ia === 0 && r.id ? '0' : '1', ['Sí', 'No'])}</select></label>
      <label>Estado<select name="estado">${estadoOpts(ESTADOS_RED, r.estado || 'Pendiente')}</select></label>
      <label class="full">Notas<textarea name="notas">${h(r.notas)}</textarea></label>
    </div><div class="err" id="ferr"></div></div>
    <div class="df">${r.id ? `<button type="button" class="btn danger" data-act="del" data-kind="red">Borrar</button><button type="button" class="btn sec left" data-act="redactar" data-kind="red" data-id="${r.id}">${ic('red')}Redacción</button>` : '<span class="left"></span>'}<button type="button" class="btn sec" data-act="close">Cancelar</button><button class="btn">Guardar</button></div></form>`;
}

// ---------- Medios y contactos ----------
function misContactos() {
  const f = S.f, q = f.medQ.trim().toLowerCase(), key = { mail_eleven: (t) => t.mail_eleven, contacto_medio: (t) => t.contacto_medio, medio: (t) => normDomain(t.medio) }[f.medGroup];
  const groups = new Map();
  for (const t of S.data.lb) {
    if (q && ![t.mail_eleven, t.contacto_medio, t.medio, t.anchor, t.as_code].join(' ').toLowerCase().includes(q)) continue;
    const k = key(t) || '(sin dato)'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === '(sin dato)') - (b === '(sin dato)') || a.localeCompare(b));
  const nMedios = new Set(S.data.lb.map((t) => normDomain(t.medio)).filter(Boolean)).size;
  return {
    sub: `${nMedios} medios en tus tareas · ${keys.length} grupos`,
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
      ${hrs.map((x) => `<tr ${x.auto ? '' : `data-open="hours" data-id="${x.id}"`}><td>${fmtD(x.date)}</td><td class="mono">${h(x.project)}</td><td>${h(x.task_type)}</td><td class="mute">${x.auto ? '<span class="tag acc">auto</span> ' : ''}${h(x.note)}</td><td class="num">${fmtN(x.hours)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin horas cargadas.</td></tr>'}</tbody></table></div>`,
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
  body: `<form id="projf"><div class="card"><table class="tbl"><thead><tr><th>Activo</th><th>Proyecto</th><th>Cliente</th><th>Dominio</th><th>Países</th><th class="num">DR mín.</th><th class="num">Tráfico mín.</th><th class="num">USD máx.</th><th class="num">Repetir (días)</th><th class="num">Palabras</th><th class="num" title="Q. piezas mensual planificadas (Reporte de Seguimiento)">Piezas/mes</th></tr></thead><tbody>
    ${S.data.projects.map((p) => `<tr data-code="${h(p.code)}"><td><input type="checkbox" name="active" ${p.active ? 'checked' : ''}></td><td class="mono">${h(p.code)}</td><td><input name="cliente" value="${h(p.cliente)}" style="width:120px;height:30px"></td>
      ${p.tipo === 'LIN' ? `<td><input name="dominio" value="${h(p.params.dominio)}" style="width:150px;height:30px"></td><td><input name="paises" value="${h(p.params.paises)}" style="width:130px;height:30px"></td>${['drMin', 'trafMin', 'precioMaxUSD', 'repDias', 'palabrasMin', 'linksMes'].map((k) => `<td class="num"><input type="number" step="any" name="${k}" value="${h(p.params[k] ?? '')}" style="width:66px;height:30px;text-align:right"></td>`).join('')}<input type="hidden" name="servicio" value="${h(p.params.servicio)}">` : `<td colspan="7" class="mute">Proyecto de redacción</td><td class="num"><input type="number" step="any" name="piezasMes" value="${h(p.params.piezasMes ?? '')}" style="width:66px;height:30px;text-align:right"></td>`}</tr>`).join('')}
    </tbody></table></div></form><p class="small mute">Topes tomados de "Parámetros del Proyecto" en AppSheet. Piezas por mes: "Q. piezas Mensual Plan." del Reporte de Seguimiento${S.data.projects.find((p) => p.params.objetivosAt) ? ` (leído el ${fmtD(S.data.projects.find((p) => p.params.objetivosAt).params.objetivosAt)})` : ''}. Un campo vacío no se controla.</p>`,
});

// ---------- Pendientes AppSheet ----------
VIEWS_FN.appsheet = () => {
  const pend = S.data.as_pend;
  return {
    title: 'Pendientes AppSheet', sub: 'Cambios hechos acá que todavía hay que reflejar en Eleven - Operaciones',
    actions: pend.length ? `<button class="btn sec" data-act="claudesync" data-q="pasar">${ic('ia')}Pasar con Claude</button><button class="btn sec" data-act="asall">Seleccionar todos</button><button class="btn" data-act="asdone">Marcar como reflejados</button>` : '',
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
    ${tarjetaClaude()}
    ${S.data.me?.admin ? `<div class="card"><div class="ch"><h2>Usuarios</h2><span class="sub">${S.data.usuarios.length}</span></div><div class="cb">
      <table class="tbl" style="margin-bottom:12px"><tbody><tr><th>Nombre</th><th>Mail</th><th>Modo predeterminado</th><th>Desde</th></tr>${S.data.usuarios.map((u) => `<tr><td>${h(u.nombre)}${u.admin ? ' <span class="tag">admin</span>' : ''}</td><td class="mute">${h(u.email)}</td><td><select class="umodo" data-id="${h(u.id)}" style="width:auto;height:28px">${opts(['tecnico', 'lider'], u.modo || 'tecnico', ['Técnico', 'Líder'])}</select></td><td class="mute small">${new Date(u.created_at).toLocaleDateString('es-AR')}</td></tr>`).join('')}</tbody></table>
      <label class="small" style="display:block;margin-bottom:10px">Link de AppSheet (Eleven - Operaciones): Claude lo abre solo en la bienvenida. Se completa solo la próxima vez que alguien trae tareas.<span style="display:flex;gap:6px;margin-top:4px"><input id="asurl" value="${h(st.as_url || '')}" placeholder="https://www.appsheet.com/start/…"><button class="btn sm sec" data-act="guardarasurl" type="button">Guardar</button></span></label>
      <button class="btn sm" data-act="invitar">Invitar a alguien</button><code class="url" id="invlink" style="margin-top:10px;display:none"></code>
      <p class="small mute">El link sirve para una sola cuenta. Cada persona ve solo sus tareas, horas, prompts y claves. El modo predeterminado es con el que abre la app; cada uno puede alternar entre Técnico y Líder desde la barra lateral.</p></div></div>` : ''}
    <div class="card"><div class="ch"><h2>Cuenta y datos</h2><span class="sub">${h(S.data.me?.nombre || '')} · ${h(S.data.me?.email || '')}</span></div><div class="cb" style="display:flex;gap:8px"><button class="btn sm sec" data-act="export">Descargar mis datos (JSON)</button><button class="btn sm sec" data-act="logout">Cerrar sesión</button></div></div></div>`,
  };
};

// ---------- Ajustes (versión líder) ----------
VIEWS_FN.lajustes = () => {
  const s = syncInfo();
  return {
    title: 'Ajustes',
    body: `<div class="cols c11" style="margin-top:0">${tarjetaClaude()}
    <div class="card"><div class="ch"><h2>Última sincronización</h2>${s.at ? (s.info.verificado === false ? '<span class="tag bad">Sin verificar</span>' : '<span class="tag ok">Verificada</span>') : '<span class="tag warn">Pendiente</span>'}</div><div class="cb">
      ${s.at ? `<p style="margin-top:0"><b>${fmtHora(s.at)}</b> · ${s.info.links ?? '—'} links · ${s.info.redacciones ?? '—'} redacciones · ${s.info.proyectos ?? '—'} proyectos</p><p class="small mute">Objetivos del mes: ${s.info.objetivos ? 'leídos del reporte el ' + fmtD(s.info.objetivos) : 'no se leyeron en la última sincronización (se muestran los anteriores, con su fecha)'}.</p>` : '<p class="mute" style="margin-top:0">Todavía no se trajo nada de AppSheet.</p>'}
      <p class="small mute">Cada sincronización lee dos veces cada tabla de AppSheet y del reporte, valida columnas y filas, compara las dos lecturas y recién ahí reemplaza los datos de la app por una foto completa (incluye lo que se borró en AppSheet). Si algo no coincide, no cambia nada. Después compara lo guardado con lo leído.</p></div></div>
    ${S.data.me?.admin ? `<div class="card"><div class="ch"><h2>Usuarios</h2><span class="sub">${S.data.usuarios.length}</span></div><div class="cb">
      <table class="tbl" style="margin-bottom:12px"><tbody><tr><th>Nombre</th><th>Mail</th><th>Desde</th></tr>${S.data.usuarios.map((u) => `<tr><td>${h(u.nombre)}${u.admin ? ' <span class="tag">admin</span>' : ''}</td><td class="mute">${h(u.email)}</td><td class="mute small">${new Date(u.created_at).toLocaleDateString('es-AR')}</td></tr>`).join('')}</tbody></table>
      <label class="small" style="display:block;margin-bottom:10px">Link de AppSheet (Eleven - Operaciones): Claude lo abre al sincronizar.<span style="display:flex;gap:6px;margin-top:4px"><input id="asurl" value="${h(S.data.settings.as_url || '')}" placeholder="https://www.appsheet.com/start/…"><button class="btn sm sec" data-act="guardarasurl" type="button">Guardar</button></span></label>
      <button class="btn sm" data-act="invitar">Invitar a alguien</button><code class="url" id="invlink" style="margin-top:10px;display:none"></code>
      <p class="small mute">El link sirve para una sola cuenta. Cada persona ve solo sus proyectos.</p></div></div>` : ''}
    <div class="card"><div class="ch"><h2>Cuenta y datos</h2><span class="sub">${h(S.data.me?.nombre || '')} · ${h(S.data.me?.email || '')}</span></div><div class="cb" style="display:flex;gap:8px"><button class="btn sm sec" data-act="export">Descargar mis datos (JSON)</button><button class="btn sm sec" data-act="logout">Cerrar sesión</button></div></div></div>`,
  };
};

// ---------- Pruebas: tareas que nunca van a AppSheet ----------
VIEWS_FN.pruebas = () => {
  const tab = S.f.pruebaTab || 'lb', base = (tab === 'lb' ? VIEWS_FN.lb : VIEWS_FN.red)();
  return {
    title: 'Pruebas', sub: `${S.data.lbP.length} links y ${S.data.redP.length} redacciones de prueba · no se mandan a AppSheet ni suman horas`,
    actions: `<button class="btn" data-act="${tab === 'lb' ? 'newlbP' : 'newredP'}">${ic('plus')}${tab === 'lb' ? 'Link de prueba' : 'Redacción de prueba'}</button>`,
    body: `<div class="alert" style="margin:0 0 14px;background:var(--warn-bg);border-color:#fedf89"><b>Modo prueba.</b> Podés crear tareas, cambiar estados (también en lote), redactar con IA y generar imágenes: nada de esto se anota en Para AppSheet ni se cuenta en Horas.
      Para probar el pegado en un documento, creá un Google Doc tuyo y pegá su link en el campo "Documento de la tarea" del editor.</div>
      ${tabs('pruebaTab', [['lb', `Links (${S.data.lbP.length})`], ['red', `Redacciones (${S.data.redP.length})`]])}${base.body}`,
  };
};
/** Huella de la versión de la app (cambia con cada despliegue). */
async function versionApp() { try { const t = await Promise.all(['/app.js', '/shared.js', '/style.css'].map((u) => fetch(u, { cache: 'no-store' }).then((r) => r.text()))); let x = 0; for (const c of t.join('')) x = (x * 31 + c.charCodeAt(0)) | 0; return x; } catch { return null; } }
async function actualizarTodo() {
  toast('Actualizando…'); S.medios = null; S.plan = null; S.iaEstado = null;
  try { await (await navigator.serviceWorker?.getRegistration())?.update(); } catch { /* sin service worker */ }
  await load();
  const v = await versionApp();
  if (v && S.version && v !== S.version) { toast('Hay una versión nueva de la app: recargando…'); setTimeout(() => location.reload(), 800); return; }
  toast('Actualizado');
}

// ======================= Modo líder (solo lectura, por proyecto) =======================
const VIEWS_LIDER = [['tablero', 'Tablero'], ['lproyectos', 'Proyectos'], ['lalertas', 'Para revisar'], ['sep'], ['lajustes', 'Ajustes']];
/** Esta versión es solo para líderes: el modo técnico está deshabilitado. */
const modoActual = () => 'lider';
const SEM_TXT = { ok: 'Terminada', warn: 'Por vencer', bad: 'Vencida o con problema', '': 'En curso', off: 'Anulada' };
const semDot = (c, t) => `<span class="sem sem-${c || 'run'}" title="${h(t || SEM_TXT[c])}"></span>`;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
function barraSemaforo(r) {
  const tot = r.terminadas + r.porVencer + r.vencidas + r.enCurso;
  if (!tot) return '<div class="small mute">Sin tareas planificadas este mes</div>';
  const seg = (n, c, t) => (n ? `<i class="seg sem-${c}" style="flex:${n}" title="${t}: ${n}"></i>` : '');
  return `<div class="stack">${seg(r.terminadas, 'ok', 'Terminadas')}${seg(r.enCurso, 'run', 'En curso')}${seg(r.porVencer, 'warn', 'Por vencer')}${seg(r.vencidas, 'bad', 'Vencidas o con problema')}</div>`;
}
function medidorPresupuesto(r) {
  if (r.pctPresupuesto === null) return '';
  const c = r.pctPresupuesto > 100 ? 'bad' : r.pctPresupuesto >= 90 ? 'warn' : 'ok';
  return `<div class="small" style="display:flex;justify-content:space-between;margin-top:10px"><span class="mute">Presupuesto del mes</span><b class="t-${c}">${r.pctPresupuesto}%</b></div>
    <div class="meter"><i class="sem-${c}" style="width:${Math.min(100, r.pctPresupuesto)}%"></i></div><div class="small mute">$ ${fmtN(r.gastado, 0)} de $ ${fmtN(r.tope, 0)}</div>`;
}
VIEWS_FN.tablero = () => {
  const mes = S.f.mes, t = hoy(), ps = S.data.projects.filter((p) => p.active);
  const rs = ps.map((p) => resumenProyecto(p, S.data, mes, t)), lin = rs.filter((r) => r.tipo === 'LIN'), red = rs.filter((r) => r.tipo === 'RED');
  const sum = (arr, k) => arr.reduce((a, r) => a + (r[k] || 0), 0);
  // el objetivo sale solo del reporte de seguimiento; si un proyecto no tiene, se muestra «sin objetivo» (no se inventa con las tareas del mes)
  const conObj = (arr) => arr.filter((r) => r.objetivo !== null), sinObj = rs.filter((r) => r.objetivo === null).map((r) => r.code);
  const pubs = sum(conObj(lin), 'terminadas'), obj = sum(conObj(lin), 'objetivo'), ent = sum(conObj(red), 'terminadas'), totRed = sum(conObj(red), 'objetivo');
  const venc = sum(rs, 'vencidas') + sum(rs, 'atrasadasDeOtrosMeses'), porV = sum(rs, 'porVencer');
  const conTope = lin.filter((r) => r.tope), tope = sum(conTope, 'tope'), gast = sum(conTope, 'gastado');
  const a = misAlertas(), qh = quehaceres(a);
  const card = (r) => `<div class="card pcard" data-act="lproy" data-p="${h(r.code)}"><div class="ch"><h2 class="mono">${h(r.code)}</h2><span class="sub">${h(r.cliente)}</span>
      ${r.vencidas + r.atrasadasDeOtrosMeses ? `<span class="tag bad" style="margin-left:auto">${r.vencidas + r.atrasadasDeOtrosMeses} para atender</span>` : r.porVencer ? `<span class="tag warn" style="margin-left:auto">${r.porVencer} por vencer</span>` : `<span class="tag ok" style="margin-left:auto">Al día</span>`}</div>
    <div class="cb"><div style="display:flex;align-items:baseline;gap:8px"><span class="big">${r.terminadas}</span><span class="mute">${r.objetivo === null ? `${r.tipo === 'LIN' ? 'publicados' : 'entregadas'} · <span class="tag warn">sin objetivo</span>` : `de ${r.objetivo} ${r.tipo === 'LIN' ? 'links publicados' : 'redacciones entregadas'} (objetivo)`}</span></div>
      ${barraSemaforo(r)}<div class="small mute" style="margin-top:6px">${r.terminadas} terminadas · ${r.enCurso} en curso · ${r.porVencer} por vencer · ${r.vencidas} vencidas o con problema${r.atrasadasDeOtrosMeses ? ` · ${r.atrasadasDeOtrosMeses} atrasadas de meses anteriores` : ''}</div>${medidorPresupuesto(r)}</div></div>`;
  return {
    title: 'Tablero', sub: `${mesLargo(mes)} · vista de líder, solo lectura`,
    actions: `<input type="month" data-f="mes" value="${h(mes)}" style="width:auto">`,
    body: `<div class="kpis">
      <div class="kpi"><div class="k">Links publicados</div><div class="v">${pubs} <span class="mute" style="font-size:14px;font-weight:500">/ ${obj}</span></div><div class="meter"><i class="sem-ok" style="width:${Math.min(100, pct(pubs, obj))}%"></i></div><div class="d">${pct(pubs, obj)}% del objetivo del mes</div></div>
      <div class="kpi"><div class="k">Redacciones entregadas</div><div class="v">${ent} <span class="mute" style="font-size:14px;font-weight:500">/ ${totRed}</span></div><div class="meter"><i class="sem-ok" style="width:${pct(ent, totRed)}%"></i></div><div class="d">${pct(ent, totRed)}% del objetivo del mes</div></div>
      <div class="kpi ${venc ? 'hot' : ''}"><div class="k">Vencidas o con problemas</div><div class="v t-${venc ? 'bad' : 'ok'}">${venc}</div><div class="d">${porV} por vencer en 7 días</div></div>
      <div class="kpi"><div class="k">Presupuesto de links usado</div><div class="v">${tope ? pct(gast, tope) + '%' : '—'}</div><div class="meter"><i class="sem-${pct(gast, tope) > 100 ? 'bad' : pct(gast, tope) >= 90 ? 'warn' : 'ok'}" style="width:${Math.min(100, pct(gast, tope))}%"></i></div><div class="d">${tope ? `$ ${fmtN(gast, 0)} de $ ${fmtN(tope, 0)}` : 'Sin topes cargados'}</div></div></div>
    ${sinObj.length ? `<p class="small mute" style="margin:8px 0 0">Sin objetivo en el reporte de seguimiento (no se cuentan en los totales): ${sinObj.map(h).join(', ')}</p>` : ''}
    <div class="card" style="margin-top:20px"><div class="ch"><h2>Quehaceres</h2><span class="sub">Lo que necesita una decisión o un seguimiento</span></div>${qh.length ? `<table class="tbl"><tbody>${qh.map((q) => `<tr data-act="lproy" data-p="${h(q.p)}" style="cursor:pointer"><td style="width:24px">${semDot(q.c)}</td><td><b>${h(q.txt)}</b>${q.det ? `<div class="small mute">${h(q.det)}</div>` : ''}</td><td class="mono nowrap mute">${h(q.p)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nada pendiente.</div>'}</div>
    <h3 class="seccion">Link building</h3><div class="pgrid">${lin.map(card).join('') || '<div class="empty">Sin proyectos de links.</div>'}</div>
    ${red.length ? `<h3 class="seccion">Redacciones</h3><div class="pgrid">${red.map(card).join('')}</div>` : ''}
    <p class="small mute">${semDot('ok')} terminada ${semDot('')} en curso ${semDot('warn')} vence en 7 días o menos ${semDot('bad')} vencida o con problema de indexación</p>`,
  };
};
/** Pendientes del líder, agrupados por proyecto. */
function quehaceres(a) {
  const out = [], porP = (arr) => arr.reduce((m, x) => ((m[x.project] ||= []).push(x), m), {});
  for (const x of a.lider.filter((x) => x.kind === 'proyecto')) out.push({ c: 'bad', p: x.project, txt: `${x.project} requiere esquema de precios`, det: x.motivo.replace(/^El proyecto requiere esquema de precios · /, '') });
  for (const [p, arr] of Object.entries(porP(a.impagas))) out.push({ c: 'warn', p, txt: `${arr.length} link${arr.length > 1 ? 's' : ''} publicado${arr.length > 1 ? 's' : ''} sin pagar`, det: arr.map((x) => x.code).join(', ') });
  for (const [p, arr] of Object.entries(porP(a.indexacion))) out.push({ c: 'bad', p, txt: `${arr.length} con problemas de indexación`, det: arr.map((x) => x.code).join(', ') });
  for (const [p, arr] of Object.entries(porP(a.lider.filter((x) => x.kind !== 'proyecto')))) out.push({ c: 'warn', p, txt: `${arr.length} necesita${arr.length > 1 ? 'n' : ''} validación del líder`, det: arr.map((x) => `${x.code}: ${x.motivo}`).join(' · ').slice(0, 220) });
  const t = hoy(); const venc = {};
  for (const x of [...S.data.lb.map((o) => ['lb', o]), ...S.data.red.map((o) => ['red', o])]) if (semaforo(x[0], x[1], t).txt === 'Vencida') (venc[x[1].project] ||= []).push(x[1]);
  for (const [p, arr] of Object.entries(venc)) out.push({ c: 'bad', p, txt: `${arr.length} tarea${arr.length > 1 ? 's' : ''} vencida${arr.length > 1 ? 's' : ''}`, det: [...new Set(arr.map((x) => x.usuario).filter(Boolean))].join(', ') });
  return out.sort((x, y) => (x.c === 'bad' ? 0 : 1) - (y.c === 'bad' ? 0 : 1) || x.p.localeCompare(y.p));
}
VIEWS_FN.lproyectos = () => {
  const ps = S.data.projects.filter((p) => p.active), cur = S.f.lProj && ps.some((p) => p.code === S.f.lProj) ? S.f.lProj : ps[0]?.code, p = proj(cur), t = hoy();
  if (!p) return { title: 'Proyectos', body: '<div class="card"><div class="empty">Todavía no hay proyectos: traé tus tareas de AppSheet desde Ajustes.</div></div>' };
  const lin = p.tipo === 'LIN', kind = lin ? 'lb' : 'red', f = S.f;
  let arr = S.data[kind].filter((x) => x.project === cur).map((x) => ({ x, s: semaforo(kind, x, t), d: lin ? x.deadline : x.fecha_entrega }));
  if (f.lMes) arr = arr.filter((o) => (o.d || '').startsWith(f.lMes));
  if (f.lSem) arr = arr.filter((o) => (f.lSem === 'run' ? o.s.c === '' : o.s.c === f.lSem));
  else arr = arr.filter((o) => o.s.c !== 'off');
  const orden = { bad: 0, warn: 1, '': 2, ok: 3, off: 4 };
  arr.sort((a, b) => orden[a.s.c] - orden[b.s.c] || String(a.d || '9').localeCompare(String(b.d || '9')));
  const r = resumenProyecto(p, S.data, f.mes, t), meses = [...new Set(S.data[kind].filter((x) => x.project === cur).map((x) => ((lin ? x.deadline : x.fecha_entrega) || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  return {
    title: 'Proyectos', sub: `${p.code} · ${p.cliente} · solo lectura`,
    body: `<div class="chips">${ps.map((q) => `<button class="${q.code === cur ? 'on' : ''}" data-act="lproy" data-p="${h(q.code)}">${h(q.code)}</button>`).join('')}</div>
    <div class="cols c21" style="margin-top:0"><div class="card"><div class="ch"><h2>${h(p.cliente)} · ${mesLargo(f.mes)}</h2></div><div class="cb">${barraSemaforo(r)}<div class="small mute" style="margin-top:6px">${r.terminadas} terminadas ${r.objetivo === null ? '(sin objetivo en el reporte)' : `de ${r.objetivo} (objetivo)`} · ${r.enCurso} en curso · ${r.porVencer} por vencer · ${r.vencidas} vencidas</div></div></div>
      <div class="card"><div class="cb">${medidorPresupuesto(r) || '<div class="small mute">Sin presupuesto cargado para este proyecto.</div>'}</div></div></div>
    <div class="toolbar" style="margin-top:16px"><select data-f="lMes"><option value="">Todos los meses</option>${opts(meses, f.lMes, meses.map(mesLargo))}</select>
      <select data-f="lSem">${opts(['', 'bad', 'warn', 'run', 'ok', 'off'], f.lSem, ['Todas (sin anuladas)', 'Vencidas o con problema', 'Por vencer', 'En curso', 'Terminadas', 'Anuladas'])}</select><span class="mute small" style="margin-left:auto">${arr.length} tarea${arr.length === 1 ? '' : 's'}</span></div>
    <div class="card tblwrap"><table class="tbl lider"><thead><tr><th></th><th>Código</th><th>${lin ? 'Anchor' : 'Tema'}</th>${lin ? '<th>Medio</th>' : ''}<th>Asignado</th><th>Estado</th><th>${lin ? 'Mes plan.' : 'Entrega'}</th><th>Situación</th></tr></thead><tbody>
      ${arr.map(({ x, s, d }) => `<tr class="row-${s.c || 'run'}"><td>${semDot(s.c, s.txt)}</td><td class="mono nowrap">${h(x.as_code)}</td><td class="wrap" style="max-width:340px">${h(lin ? x.anchor : x.tema) || '<span class="mute">—</span>'}</td>${lin ? `<td>${h(normDomain(x.medio))}</td>` : ''}<td class="nowrap">${h(x.usuario)}</td><td class="small">${h(x.estado)}</td><td class="nowrap">${lin ? fmtMes(d) : fmtD(d)}</td><td class="nowrap t-${s.c || 'run'}"><b>${h(s.txt)}</b></td></tr>`).join('') || '<tr><td colspan="8" class="empty">No hay tareas con estos filtros.</td></tr>'}</tbody></table></div>`,
  };
};
VIEWS_FN.lalertas = () => {
  const a = misAlertas(), qh = quehaceres(a), porP = {};
  for (const q of qh) (porP[q.p] ||= []).push(q);
  const quietas = a.quietas.reduce((m, x) => ((m[x.project] ||= []).push(x), m), {});
  const ps = [...new Set([...Object.keys(porP), ...Object.keys(quietas)])].sort();
  return {
    title: 'Para revisar', sub: 'Lo importante de cada proyecto, sin el detalle operativo',
    body: ps.length ? `<div class="pgrid">${ps.map((p) => `<div class="card"><div class="ch"><h2 class="mono">${h(p)}</h2><span class="sub">${h(proj(p)?.cliente || '')}</span><button class="lnk small" data-act="lproy" data-p="${h(p)}" style="margin-left:auto">Ver tareas →</button></div>
      <ul class="hl">${(porP[p] || []).map((q) => `<li>${semDot(q.c)}<div><b>${h(q.txt)}</b>${q.det ? `<div class="small mute">${h(q.det)}</div>` : ''}</div></li>`).join('')}
      ${quietas[p] ? `<li>${semDot('warn')}<div><b>${quietas[p].length} tarea${quietas[p].length > 1 ? 's' : ''} sin moverse hace más de ${S.data.settings.dias_quieta || 14} días</b><div class="small mute">${h(quietas[p].slice(0, 6).map((x) => `${x.code} (${x.dias} días en ${x.estado})`).join(' · '))}</div></div></li>` : ''}</ul></div>`).join('')}</div>`
      : '<div class="card"><div class="empty">Todo en orden: nada para revisar.</div></div>',
  };
};

// ---------- Medios: compilado + mis contactos ----------
async function cargarMedios(force) { if (S.medios && !force) return S.medios; S.medios = await api('/api/medios'); return S.medios; }
const tabs = (f, items) => `<div class="tabs">${items.map(([k, t]) => `<button class="${S.f[f] === k ? 'on' : ''}" data-act="tab" data-f="${f}" data-v="${k}">${t}</button>`).join('')}</div>`;
VIEWS_FN.medios = () => {
  const head = tabs('medTab', [['compilado', `Compilado de Eleven${S.data.medios_n ? ` (${fmtN(S.data.medios_n, 0)})` : ''}`], ['contactos', 'Mis medios y contactos']]);
  if (S.f.medTab === 'contactos') { const c = misContactos(); return { title: 'Medios', sub: c.sub, body: head + c.body }; }
  const at = S.data.settings.medios_at ? `Actualizado el ${new Date(Number(S.data.settings.medios_at)).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Todavía sin importar';
  const actions = `<label class="btn sec" style="cursor:pointer">${ic('plus')}Importar compilado (CSV)<input type="file" accept=".csv,text/csv" id="medcsv" hidden></label>`;
  if (!S.medios) { if (S.data.medios_n) cargarMedios().then(render).catch((e) => toast(e.message)); return { title: 'Medios', sub: at, actions, body: head + `<div class="card"><div class="empty">${S.data.medios_n ? 'Cargando medios…' : 'Importá el compilado: en la planilla <b>finance_01_report_Production</b>, Archivo → Descargar → CSV, y subilo con el botón de arriba.'}</div></div>` }; }
  const f = S.f, q = f.mQ.trim().toLowerCase(), lin = projs('LIN'), hoyS = hoy();
  const apt = new Map(S.medios.map((m) => [m.dominio, lin.filter((p) => aptoMedio(m, p, S.data.lb, hoyS).ok).map((p) => p.code)]));
  let arr = S.medios.filter((m) => (!f.mProj || apt.get(m.dominio).includes(f.mProj)) && (!f.mPais || m.pais === f.mPais) && (!f.mPrecio || (f.mPrecio === 'con' ? m.precio_usd !== null : m.precio_usd === null)) && (!f.mDr || (m.dr || 0) >= Number(f.mDr)) && (!f.mMail || m.mail === f.mMail) && (!q || (m.dominio + ' ' + m.mail + ' ' + m.proveedor).toLowerCase().includes(q)));
  sortBy(arr, 'med', { dr: (m) => m.dr ?? -1, trafico: (m) => m.trafico ?? -1, precio_usd: (m) => m.precio_usd ?? 1e9, aptos: (m) => apt.get(m.dominio).length });
  const paises = [...new Set(S.medios.map((m) => m.pais).filter(Boolean))].sort(), mails = [...new Set(S.medios.map((m) => m.mail).filter(Boolean))].sort();
  const MAX = 400, vis = arr.slice(0, MAX);
  return {
    title: 'Medios', sub: `${fmtN(arr.length, 0)} de ${fmtN(S.medios.length, 0)} medios en español · ${at}`, actions,
    body: head + `<div class="toolbar wrap"><select data-f="mProj"><option value="">Apto para cualquier proyecto o ninguno</option>${opts(lin.map((p) => p.code), f.mProj, lin.map((p) => `Apto para ${p.code} · ${p.cliente}`))}</select>
      <select data-f="mPais"><option value="">Todos los países</option>${opts(paises, f.mPais)}</select>
      <select data-f="mPrecio">${opts(['', 'con', 'sin'], f.mPrecio, ['Con y sin precio', 'Con precio (deal vigente)', 'Sin precio (a negociar)'])}</select>
      <input type="number" data-f="mDr" placeholder="DR mín." value="${h(f.mDr)}" style="width:90px">
      <select data-f="mMail"><option value="">Todos los mails de contacto</option>${opts(mails, f.mMail)}</select>${searchBox('mQ', 'Buscar dominio, mail o proveedor…')}</div>
    <div class="card tblwrap"><table class="tbl"><thead><tr>${th('med', 'dominio', 'Dominio')}${th('med', 'mail', 'Mail de contacto')}${th('med', 'dr', 'DR', 'num')}${th('med', 'trafico', 'Tráfico', 'num')}${th('med', 'precio_usd', 'Precio', 'num')}${th('med', 'pais', 'País')}${th('med', 'estado', 'Estado')}${th('med', 'aptos', 'Apto para')}</tr></thead><tbody>
      ${vis.map((m) => { const a = apt.get(m.dominio); return `<tr><td><a href="https://${h(m.dominio)}" target="_blank" rel="noopener">${h(m.dominio)}</a>${m.sensible ? ' <span class="tag" title="Admite temática sensible">sensible</span>' : ''}</td><td>${m.mail ? `${h(m.mail)} <button class="lnk small" data-act="copy" data-v="${h(m.mail)}">copiar</button>` : '<span class="mute">—</span>'}</td>
        <td class="num">${fmtN(m.dr, 0)}</td><td class="num">${fmtN(m.trafico, 0)}</td><td class="num nowrap" title="${h(m.proveedor)}${m.vence ? ' · vence ' + fmtD(m.vence) : ''}">${m.precio_usd !== null ? `USD ${fmtN(m.precio_usd)}${m.moneda && m.moneda !== 'USD' ? ` <span class="mute small">(${h(m.moneda)} ${fmtN(m.precio, 0)})</span>` : ''}` : '<span class="mute">—</span>'}</td>
        <td>${h(m.pais)}</td><td class="mute">${h(m.estado)}</td><td class="wrap" style="min-width:170px">${a.length ? a.map((c) => `<span class="tag ok mono">${h(c.replace(/-LIN-/, '·'))}</span>`).join(' ') : `<span class="mute small" title="${h(lin.map((p) => `${p.code}: ${aptoMedio(m, p, S.data.lb, hoyS).motivos.join(', ')}`).join('\n'))}">ninguno</span>`}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Ningún medio con estos filtros.</td></tr>'}
    </tbody></table></div>${arr.length > MAX ? `<p class="small mute">Se muestran los primeros ${MAX}. Usá los filtros para acotar.</p>` : ''}
    <p class="small mute">Apto = cumple DR, tráfico, país y precio máximo del proyecto y no está usado en otra tarea del proyecto dentro de los días de espera. Pasá el mouse por "ninguno" para ver por qué.</p>`,
  };
};
async function importarCompilado(file) {
  const txt = await file.text(); let ms;
  try { ms = compiladoAMedios(txt); } catch (e) { return toast(e.message); }
  toast(`Importando ${ms.length} medios…`);
  for (let i = 0; i < ms.length; i += 800) await api('/api/medios/import', 'POST', { rows: ms.slice(i, i + 800), reset: i === 0, last: i + 800 >= ms.length });
  S.medios = null; await load(); toast(`${fmtN(ms.length, 0)} medios importados`);
}

// ---------- Planificación del mes ----------
VIEWS_FN.plan = () => {
  const mes = S.f.planMes, pl = S.plan && S.plan.month === mes ? S.plan : null, lin = projs('LIN');
  if (S.plan === null || (S.plan && S.plan.month !== mes)) { S.plan = { month: mes, cargando: true }; api('/api/planes?month=' + mes).then((r) => { S.plan = r || { month: mes, vacio: true }; render(); }).catch(() => {}); }
  const unidades = (c) => S.data.plan.filter((r) => r.month === mes && r.project === c && /^A /.test(r.task_type)).reduce((a, r) => a + r.units, 0);
  const d = pl && pl.data, estado = pl?.estado;
  const badge = { borrador: '<span class="tag">Borrador</span>', pedida: '<span class="tag warn">Esperando validación de Claude</span>', validada: '<span class="tag ok">Validada por Claude</span>' }[estado] || '';
  let res = '';
  if (d && d.proyectos) {
    const porMail = {};
    for (const p of d.proyectos) for (const it of p.items) (porMail[it.mail || '(sin mail)'] ||= []).push({ ...it, code: p.code });
    const sinFalta = d.proyectos.filter((p) => !p.falta && !p.items.length);
    res = `${sinFalta.length ? `<p class="small mute" style="margin-top:0">Sin links pendientes en ${mesLargo(mes)}: ${sinFalta.map((p) => p.code).join(', ')}</p>` : ''}<div class="cols c11" style="margin-top:0">${d.proyectos.filter((p) => p.falta || p.items.length).map((p) => `<div class="card"><div class="ch"><h2 class="mono">${h(p.code)}</h2><span class="sub">${h(p.cliente)} · ${p.items.length} de ${p.falta} links · ${p.disponible !== null ? `$ ${fmtN(p.total, 0)} de $ ${fmtN(p.disponible, 0)} disponibles` : `$ ${fmtN(p.total, 0)} (sin tope cargado)`}</span></div>
      ${p.items.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Medio</th><th>Mail de contacto</th><th class="num">DR</th><th class="num">Tráfico</th><th class="num">Costo</th><th>También en</th></tr></thead><tbody>${p.items.map((it) => `<tr><td>${h(it.dominio)}</td><td class="small">${h(it.mail)}</td><td class="num">${fmtN(it.dr, 0)}</td><td class="num">${fmtN(it.trafico, 0)}</td><td class="num nowrap" title="USD ${fmtN(it.precio_usd)}">$ ${fmtN(it.ars, 0)}</td><td class="nowrap">${it.tambien.map((c) => `<span class="tag acc mono">${h(c.replace('-LIN-', '·'))}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${p.falta ? 'No hay medios con precio que entren en el presupuesto.' : 'Sin links pendientes este mes.'}</div>`}
      ${p.alternativas.length && p.items.length < p.falta ? `<div class="cb small"><b>Para negociar (sin precio):</b> ${p.alternativas.slice(0, 8).map((m) => `${h(m.dominio)} <span class="mute">(DR ${fmtN(m.dr, 0)} · ${h(m.mail || 'sin mail')})</span>`).join(' · ')}</div>` : ''}</div>`).join('')}</div>
      <div class="card" style="margin-top:20px"><div class="ch"><h2>Por mail de contacto</h2><span class="sub">Para escribir una vez a cada medio aunque sea para varios proyectos</span></div><table class="tbl"><tbody>
      ${Object.entries(porMail).sort((a, b) => b[1].length - a[1].length).map(([mail, arr]) => `<tr class="grp"><td colspan="4">${h(mail)} <span class="mute" style="font-weight:400">· ${arr.length} link${arr.length > 1 ? 's' : ''}</span></td></tr>${arr.map((it) => `<tr><td>${h(it.dominio)}</td><td class="mono">${h(it.code)}</td><td class="num">$ ${fmtN(it.ars, 0)}</td><td class="mute small">DR ${fmtN(it.dr, 0)} · ${fmtN(it.trafico, 0)} visitas</td></tr>`).join('')}`).join('')}</tbody></table></div>`;
  }
  return {
    title: 'Planificación', sub: `Links de ${mesLargo(mes)} según presupuesto y compilado de medios ${badge}`,
    actions: `<input type="month" data-f="planMes" value="${h(mes)}" style="width:auto"><button class="btn sec" data-act="planarmar">${ic('plan')}${d ? 'Volver a armar' : 'Armar planificación'}</button>${d ? `<button class="btn" data-act="planvalidar" ${estado === 'pedida' ? 'disabled' : ''}>Validar con Claude</button>` : ''}`,
    body: `<div class="card"><div class="ch"><h2>Presupuesto de ${mesLargo(mes)}</h2></div><table class="tbl"><thead><tr><th>Proyecto</th><th>Cliente</th><th class="num">Links del mes</th><th class="num">Ya planificados</th><th class="num">Tope del mes (ARS)</th><th class="num">Gastado</th><th class="num">Disponible</th><th class="num">USD máx. por link</th></tr></thead><tbody>
      ${lin.map((p) => { const c = (p.params.costos || {})[mes], tope = c ? c.tope : p.params.presupuestoMensualARS ? Math.round(p.params.presupuestoMensualARS * (p.params.costoObjetivo ?? 30) / 100) : null, gast = c ? c.gastado : null;
        return `<tr><td class="mono">${h(p.code)}</td><td>${h(p.cliente)}</td><td class="num">${unidades(p.code) || p.params.linksMes || 0}${unidades(p.code) ? '' : ' <span class="mute small">(AS)</span>'}</td><td class="num">${S.data.lb.filter((t) => t.project === p.code && t.estado !== 'Anulado' && (t.deadline || '').startsWith(mes)).length}</td>
          <td class="num">${tope !== null ? '$ ' + fmtN(tope, 0) : '<span class="mute">—</span>'}</td><td class="num">${gast !== null ? '$ ' + fmtN(gast, 0) : '<span class="mute">—</span>'}</td><td class="num"><b>${tope !== null ? '$ ' + fmtN(Math.max(0, tope - (gast || 0)), 0) : '—'}</b></td><td class="num mute">${p.params.precioMaxUSD ?? '—'}</td></tr>`; }).join('')}</tbody></table>
      <div class="cb small mute">Tope = presupuesto mensual × % costo objetivo, y gastado = lo que muestra AppSheet en "Costos Mensuales" (Gestión Link Building)${lin[0]?.params.costosAt ? `, copiado el ${fmtD(lin[0].params.costosAt)}` : ''}. Links: plan del mes en Horas o, si no hay, la cantidad mensual de AppSheet.</div></div>
    ${estado === 'pedida' ? `<div class="alert" style="margin:16px 0"><b>Pedido de validación guardado.</b> Abrí Claude con <b>Opus · esfuerzo alto</b> y escribí: <code>Validá la planificación de ${h(mes)} de Proyectos Eleven</code>. Claude la revisa contra AppSheet y el compilado y deja acá sus notas.</div>` : ''}
    ${pl?.validacion ? `<div class="card" style="margin:16px 0"><div class="ch"><h2>Notas de Claude</h2></div><div class="cb" style="white-space:pre-wrap">${h(pl.validacion)}</div></div>` : ''}
    <div style="margin-top:20px">${res || (pl?.cargando ? '<div class="empty">Cargando…</div>' : '<div class="card"><div class="empty">Cargá los presupuestos y tocá <b>Armar planificación</b>. No se arma sola.</div></div>')}</div>`,
  };
};
async function armarPlan() {
  const mes = S.f.planMes;
  if (!S.data.medios_n) return toast('Primero importá el compilado de medios');
  await cargarMedios();
  const data = planificar({ projects: S.data.projects, medios: S.medios, lb: S.data.lb, plan: S.data.plan, month: mes });
  await api('/api/planes', 'POST', { month: mes, estado: 'borrador', data });
  S.plan = null; render(); toast('Planificación armada (borrador)');
}

// ---------- Notas y alertas ----------
function misAlertas() { if (S._al && S._al.d === S.data) return S._al.v; const v = alertas(S.data, { hoy: hoy(), diasQuieta: Number(S.data.settings.dias_quieta || 14), yo: YO }); S._al = { d: S.data, v }; return v; }
const alertTbl = (arr, vacio) => arr.length ? `<table class="tbl"><tbody>${arr.map((a) => `<tr ${a.kind === 'proyecto' ? `data-act="verproy" data-p="${h(a.project)}" style="cursor:pointer"` : `data-open="${a.kind}" data-id="${h(a.id)}"`}><td class="mono nowrap">${h(a.code)}</td><td style="max-width:260px" title="${h(a.titulo)}">${h(a.titulo)}</td><td class="wrap small">${h(a.motivo)}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${vacio}</div>`;
VIEWS_FN.alertas = () => {
  const a = misAlertas(), notas = S.data.notas || [], lider = notas.filter((n) => n.lider && !n.hecha), mias = notas.filter((n) => !n.lider || n.hecha);
  const nota = (n) => `<tr><td class="ck"><input type="checkbox" class="notack" data-id="${h(n.id)}" ${n.hecha ? 'checked' : ''} title="Hecha"></td><td class="wrap ${n.hecha ? 'mute' : ''}" style="${n.hecha ? 'text-decoration:line-through' : ''}">${h(n.texto)}</td><td class="nowrap mute small">${new Date(n.created_at).toLocaleDateString('es-AR')}</td><td><button class="lnk small" data-act="notadel" data-id="${h(n.id)}">Borrar</button></td></tr>`;
  return {
    title: 'Notas y alertas', sub: 'Lo que tenés que revisar o hablar, armado a partir de tus tareas',
    body: `<div class="cols c11" style="margin-top:0">
      <div class="card"><div class="ch"><h2>Hablar con mi líder</h2><span class="sub">${a.lider.length + lider.length}</span></div>${alertTbl(a.lider, 'Nada pendiente con el líder.')}
        ${lider.length ? `<table class="tbl"><tbody>${lider.map(nota).join('')}</tbody></table>` : ''}</div>
      <div class="card"><div class="ch"><h2>Sugerencias</h2><span class="sub">Por acción, no por proyecto</span></div>${a.sugerencias.length ? `<table class="tbl"><tbody>${a.sugerencias.map((x, i) => `<tr data-act="sug" data-i="${i}" style="cursor:pointer"><td><b>${h(x.texto)}</b><div class="small mute">${h(x.detalle)}</div></td><td class="num"><span class="lnk small">Ver →</span></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sin sugerencias por ahora.</div>'}</div>
      <div class="card"><div class="ch"><h2>Publicados sin pagar</h2><span class="sub">Tienen información de pago pendiente: validar</span></div>${alertTbl(a.impagas, 'Todos los publicados figuran pagos (o falta traer el estado de pago desde AppSheet).')}</div>
      <div class="card"><div class="ch"><h2>Problemas de indexación</h2><span class="sub">MANUAL_INDEX o auditoría con problemas</span></div>${alertTbl(a.indexacion, 'Sin problemas de indexación.')}</div>
      <div class="card"><div class="ch"><h2>Quietas hace mucho</h2><span class="sub">Más de <select id="diasq" style="width:auto;height:26px;font-size:12px">${opts(['7', '14', '21', '30'], S.data.settings.dias_quieta || '14')}</select> días en el mismo estado</span></div>${alertTbl(a.quietas, 'Ninguna tarea quieta.')}</div>
      <div class="card"><div class="ch"><h2>Avisos de AppSheet</h2><span class="sub">Texto que muestra AppSheet arriba de la tarea</span></div>${alertTbl(a.appsheet, 'Sin avisos.')}</div>
    </div>
    <div class="card" style="margin-top:20px"><div class="ch"><h2>Mis notas</h2></div><form id="notaf" class="cb" style="display:flex;gap:8px;align-items:center"><input name="texto" placeholder="Escribí una nota…" required><label class="check nowrap"><input type="checkbox" name="lider"> Para hablar con el líder</label><button class="btn sm">Agregar</button></form>
      ${mias.length ? `<table class="tbl"><tbody>${mias.map(nota).join('')}</tbody></table>` : ''}</div>`,
  };
};

// ---------- IA y prompts ----------
const VARS = '{anchor} {url_cliente} {medio} {dr} {palabras_min} {pais} {idioma} {cliente} {dominio_cliente} {codigo} · redacciones: {tema} {tipo_pieza} {subproyecto} {variante} {material} {url_actual} {pagina_actual} · imagen: {titulo} {texto}';
function clavesPrompt(p) {
  if (p.tipo === 'LIN') return [['lb', 'Texto del artículo (link building)'], ['imagen', 'Imagen destacada']];
  const subs = [...new Set([...S.data.red.filter((r) => r.project === p.code && r.subproyecto).map((r) => r.subproyecto), ...(S.data.prompts || []).filter((x) => x.project === p.code && /^red:/.test(x.clave)).map((x) => x.clave.slice(4))])].sort();
  return [['red', 'Texto (general)'], ...subs.map((x) => [`red:${x}`, `Texto · ${x}`]), ['imagen', 'Imagen (general)'], ...subs.map((x) => [`imagen:${x}`, `Imagen · ${x}`])];
}
VIEWS_FN.ia = () => {
  const st = S.data.settings, ps = projs(), cur = S.f.iaProj || ps[0]?.code, p = proj(cur), pr = (c) => (S.data.prompts || []).find((x) => x.project === cur && x.clave === c)?.texto || '';
  if (!S.iaEstado && st.gemini) { S.iaEstado = { cargando: true }; api('/api/ia/estado').then((r) => { S.iaEstado = r; render(); }).catch(() => {}); }
  const e = S.iaEstado || {};
  return {
    title: 'IA y prompts', sub: 'Gemini para redactar y generar imágenes con tus prompts por proyecto',
    body: `<div class="cols c11" style="margin-top:0"><div class="card"><div class="ch"><h2>Gemini</h2>${st.gemini ? (e.conectado ? '<span class="tag ok">Conectado</span>' : e.cargando ? '<span class="tag">Verificando…</span>' : `<span class="tag bad">Error</span>`) : '<span class="tag warn">Sin conectar</span>'}</div><div class="cb">
      ${e.error ? `<div class="alert" style="margin-top:0">${h(e.error)}</div>` : ''}
      <ol class="steps" style="margin-top:0"><li>Entrá a <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> con tu cuenta y tocá <b>Crear clave de API</b>.</li><li>Activá la facturación en ese proyecto (así Google no usa los textos de clientes para entrenar).</li><li>Pegá la clave acá. Queda guardada solo en tu servidor; no se muestra de nuevo.</li></ol>
      <form id="gemf" style="display:flex;gap:8px"><input name="key" type="password" autocomplete="off" placeholder="${st.gemini ? 'Clave guardada · pegá otra para cambiarla' : 'AIza…'}"><button class="btn sm">${st.gemini ? 'Cambiar' : 'Conectar'}</button></form>
      ${e.conectado ? `<div class="fields" style="margin-top:14px"><label>Modelo para textos<select id="mtexto">${opts(e.modelos.filter((m) => !/image/.test(m)), e.texto)}</select></label><label>Modelo para imágenes<select id="mimagen">${opts(['', ...e.modelos.filter((m) => /image/.test(m))], e.imagen, ['(ninguno)', ...e.modelos.filter((m) => /image/.test(m))])}</select></label></div>
        <div style="display:flex;gap:8px;margin-top:12px"><button class="btn sm sec" data-act="iamodelos">Guardar modelos</button><button class="btn sm sec" data-act="iaprueba">Probar conexión</button><span id="iamsg" class="small mute" style="align-self:center"></span></div>` : ''}</div></div>
    <div class="card"><div class="ch"><h2>Google Docs de las tareas</h2>${st.gas ? '<span class="tag ok">Conectado</span>' : '<span class="tag warn">Sin conectar</span>'}</div><div class="cb">
      <p class="mute" style="margin-top:0">Para pegar el texto (y la imagen) en el documento de cada tarea se usa un script de Google que corre con tu cuenta de Eleven. Se instala una sola vez.</p>
      <ol class="steps"><li>Abrí <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a> con tu cuenta de Eleven y pegá el código (botón de abajo).</li><li><b>Implementar → Nueva implementación → Aplicación web</b>, ejecutar como <b>yo</b>, acceso <b>cualquier usuario</b>. Autorizá.</li><li>Pegá acá la URL que termina en <code>/exec</code>.</li></ol>
      <form id="gasf" style="display:flex;gap:8px"><input name="url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${h(st.gas_url)}"><button class="btn sm">Guardar</button></form>
      <div style="margin-top:10px"><button class="btn sm sec" data-act="gascode">${ic('copy')}Copiar código del script</button></div></div></div></div>
    <div class="card" style="margin-top:20px"><div class="ch"><h2>Prompts por proyecto</h2><select data-f="iaProj" style="width:auto;margin-left:auto">${opts(ps.map((x) => x.code), cur, ps.map((x) => `${x.code} · ${x.cliente}`))}</select></div><div class="cb">
      <p class="small mute" style="margin-top:0">Variables disponibles: ${h(VARS)}. Si un tipo queda vacío se usa el general; si el general está vacío, uno básico.</p>
      <form id="promptf" data-project="${h(cur)}">${clavesPrompt(p).map(([c, t]) => `<label class="full" style="margin-bottom:14px">${h(t)}<textarea name="${h(c)}" style="min-height:${/^imagen/.test(c) ? 90 : 180}px;font-size:13px">${h(pr(c))}</textarea></label>`).join('')}
      <button class="btn sm">Guardar prompts de ${h(cur)}</button></form></div></div>`,
  };
};
const GAS_CODE = `// Proyectos Eleven → pega la redacción (y la imagen) en el documento de una tarea de AppSheet. Corre con tu cuenta de Eleven.
const SECRET = '__SECRET__';
const ANCHO_IMAGEN = 567; // igual que las redacciones publicadas (3:2)
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.secret !== SECRET) return out({ error: 'No autorizado' });
    const ids = candidatos(b.doc, b.codigo, b.tipo);
    if (!ids.length) return out({ error: 'No encontré el documento de la tarea ' + (b.codigo || '') });
    for (const id of ids) {
      const doc = DocumentApp.openById(id), body = doc.getBody();
      try { body.appendParagraph(''); } catch (err) { continue; } // sin permiso de edición: probar el siguiente
      body.clear(); // la plantilla de AppSheet pide borrar su contenido al ingresar la redacción
      let primero = true, tieneImagen = false;
      if (b.titulo) titulo(body.appendParagraph(b.titulo).setHeading(DocumentApp.ParagraphHeading.HEADING1));
      String(b.cuerpo || '').split(/\\n{2,}/).forEach(function (bloque) {
        const t = bloque.trim(); if (!t) return;
        const m = t.match(/^(#{1,3})\\s+(.*)$/);
        if (m) { titulo(body.appendParagraph(m[2].replace(/\\*\\*/g, '')).setHeading(m[1].length <= 2 ? DocumentApp.ParagraphHeading.HEADING2 : DocumentApp.ParagraphHeading.HEADING3)); return; }
        t.split(/\\n/).forEach(function (linea) {
          const li = linea.match(/^\\s*[-*]\\s+(.*)$/), p = li ? body.appendListItem(li[1]) : body.appendParagraph(linea);
          formato(p);
        });
        if (primero && b.imagen && !tieneImagen) { // la imagen va después del primer párrafo, como en las notas publicadas
          const img = body.appendParagraph('').appendInlineImage(Utilities.newBlob(Utilities.base64Decode(b.imagen.data), b.imagen.mime, 'imagen'));
          const r = img.getHeight() / img.getWidth(); img.setWidth(ANCHO_IMAGEN).setHeight(Math.round(ANCHO_IMAGEN * r));
          tieneImagen = true;
        }
        primero = false;
      });
      const p0 = body.getParagraphs()[0]; if (p0 && !p0.getText() && body.getNumChildren() > 1) p0.removeFromParent();
      doc.saveAndClose();
      return out({ ok: true, doc: 'https://docs.google.com/document/d/' + id + '/edit' });
    }
    return out({ error: 'Tu usuario no puede editar el documento ahora (AppSheet lo habilita solo en algunos estados)' });
  } catch (err) { return out({ error: String(err) }); }
}
function titulo(p) { p.editAsText().setBold(true); }
function formato(p) {
  const t = p.editAsText(); let s = t.getText(), m;
  while ((m = /\\[([^\\]]+)\\]\\((https?:[^)]+)\\)/.exec(s))) { // [texto](url) → enlace en negrita, como el anchor de las notas
    t.deleteText(m.index, m.index + m[0].length - 1); t.insertText(m.index, m[1].replace(/\\*\\*/g, ''));
    t.setLinkUrl(m.index, m.index + m[1].replace(/\\*\\*/g, '').length - 1, m[2]); t.setBold(m.index, m.index + m[1].replace(/\\*\\*/g, '').length - 1, true); s = t.getText();
  }
  while ((m = /\\*\\*([^*]+)\\*\\*/.exec(s))) { t.deleteText(m.index, m.index + m[0].length - 1); t.insertText(m.index, m[1]); t.setBold(m.index, m.index + m[1].length - 1, true); s = t.getText(); }
}
function candidatos(url, codigo, tipo) {
  const m = String(url || '').match(/\\/d\\/([\\w-]{20,})/); if (m) return [m[1]];
  if (!codigo) return [];
  const out = [], it = DriveApp.searchFiles("title contains '" + codigo.replace(/'/g, '') + "_' and mimeType = 'application/vnd.google-apps.document' and trashed = false");
  while (it.hasNext()) { const f = it.next(), n = f.getName().replace(/\\s/g, '').toUpperCase(); if (n.indexOf(codigo.toUpperCase() + '_') === 0 && n.indexOf(String(tipo || '').replace(/\\s/g, '').toUpperCase()) >= 0) out.push(f.getId()); }
  return out.sort();
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }`;

// ---------- registro automático de tiempo ----------
// Mientras trabajás en una tarea (panel abierto o tareas seleccionadas) y la app está al frente, cada 30 s se suma tiempo a esa tarea.
// Si dejás de tocar el teclado o el mouse 5 minutos, se pausa. Cada acción (cambiar estado, guardar) se lleva además el tiempo
// desde la acción anterior (hasta 15 min), que cubre lo que hacés fuera de la app (escribir el mail, el doc). La IA, Claude y la
// sincronización con AppSheet suman su propio tiempo. Todo va a Horas solo, repartido por proyecto y tipo de tarea.
let ultimoInput = Date.now();
['mousemove', 'keydown', 'click', 'scroll', 'wheel'].forEach((e) => document.addEventListener(e, () => { ultimoInput = Date.now(); }, { passive: true, capture: true }));
function focoActual() {
  const f = document.querySelector('#drawer.open form[data-id]'), id = f?.dataset.id;
  if (id && (f.id === 'lbf' || f.id === 'redf' || f.id === 'txf')) return [{ kind: f.id === 'lbf' ? 'lb' : f.id === 'redf' ? 'red' : f.dataset.kind, ref: id }];
  const k = S.view === 'lb' || S.view === 'red' ? S.view : null;
  return k && S.sel[k].size ? [...S.sel[k]].slice(0, 50).map((ref) => ({ kind: k, ref })) : [];
}
setInterval(() => {
  if (!S.token || document.visibilityState !== 'visible' || Date.now() - ultimoInput > 5 * 60_000) return;
  const refs = focoActual(); if (!refs.length) return;
  api('/api/act/ping', 'POST', { refs }).catch(() => {});
  S.focoTxt = refs.length === 1 ? (tarea(refs[0].kind, refs[0].ref)?.as_code || tarea(refs[0].kind, refs[0].ref)?.project || '') : `${refs.length} tareas`;
  S.focoAt = Date.now(); renderTimer();
  if (++S.pings % 6 === 0 && !$('#drawer').classList.contains('open')) load();
}, 30_000);
function renderTimer() {
  const el = $('#sidetimer'); if (!el) return;
  if (modoActual() === 'lider') return renderSyncSide();
  const t = hoy(), auto = S.data.hours.filter((x) => x.auto && x.date === t), tot = auto.reduce((a, x) => a + x.hours, 0);
  const por = {}; for (const a of S.data.actividad || []) por[a.quien] = (por[a.quien] || 0) + (a.fin - a.inicio) / 60000;
  const activo = S.focoAt && Date.now() - S.focoAt < 70_000;
  el.innerHTML = `<div class="lbl">${activo ? '<span class="run"></span>' : ''}Tiempo de hoy · automático</div><div class="clock">${Math.floor(tot)}:${String(Math.round((tot % 1) * 60)).padStart(2, '0')} h</div>
    <div class="small mute">${Object.entries(por).map(([q, m]) => `${h(QUIEN[q] || q)} ${Math.round(m)} min`).join(' · ') || 'Abrí una tarea y empieza a contar'}</div>
    ${activo ? `<div class="small" style="margin-top:4px">Contando: <b class="mono">${h(S.focoTxt)}</b></div>` : ''}<button class="lnk small" data-act="view" data-v="horas" style="margin-top:6px">Ver horas →</button>
    <div class="seg2" style="margin-top:10px"><button class="on" data-act="modo" data-v="tecnico">Técnico</button><button data-act="modo" data-v="lider">Líder</button></div>`;
}

// ---------- editor de redacción ----------
const contar = (t) => (t.match(/[\p{L}\p{N}]+/gu) || []).length;
async function abrirRedaccion(kind, id) {
  const x = tarea(kind, id), t = await api(`/api/texto?kind=${kind}&ref=${encodeURIComponent(id)}`), min = kind === 'lb' ? proj(x.project)?.params?.palabrasMin : null;
  const titulo = kind === 'lb' ? `${x.as_code || x.project} · ${x.anchor || 'sin anchor'}` : `${x.as_code || x.project} · ${x.tema}`, st = S.data.settings;
  const tienePrompt = (S.data.prompts || []).some((p) => p.project === x.project && p.texto.trim());
  openDrawer(`<form id="txf" data-kind="${kind}" data-id="${h(id)}" data-min="${h(min ?? '')}"><div class="dh"><h2>Redacción — ${h(titulo)}</h2><button type="button" class="x" data-act="close">${ic('x')}</button></div>
    <div class="db"><div class="fields">
      ${kind === 'lb' ? `<div class="full small mute">Anchor: <b>${h(x.anchor)}</b> → ${h(x.url_cliente || 'sin URL del cliente')} · Medio: ${h(normDomain(x.medio))}</div>` : `<div class="full small mute">${h([x.subproyecto, x.variante].filter(Boolean).join(' · ') || 'Sin subproyecto')}</div>`}
      <div class="full iabar">${st.gemini ? (kind === 'lb' ? `<button type="button" class="btn sm" data-act="iatodo">${ic('ia')}Redactar e ilustrar${st.gas && DOC_EDITABLE_LB.includes(x.estado) ? ' y pegar en el doc' : ''}</button>` : `<button type="button" class="btn sm" data-act="iaredactar">${ic('ia')}Redactar con IA</button><button type="button" class="btn sm sec" data-act="iaimagen">${ic('img')}Generar imagen</button>`) : `<span class="small mute">Conectá Gemini en <a href="#" data-act="view" data-v="ia">IA y prompts</a> para redactar con un clic.</span>`}
        ${st.gemini && !tienePrompt ? '<span class="small mute">Sin prompt propio para este proyecto: se usa uno básico.</span>' : ''}<span id="iastat" class="small mute"></span></div>
      <details class="full" ${kind === 'red' && !x.subproyecto && !/^https?:|^\//.test(x.tema) && /^LAV-RED/.test(x.project) ? 'open' : ''}><summary class="small">Material de base para la IA (receta copiada, transcripción de un video, notas…)</summary><textarea id="material" style="min-height:120px;margin-top:6px" placeholder="Pegá acá la receta o el texto fuente. La IA arma el contenido completo a partir de esto."></textarea></details>
      <label class="full">Título<input name="titulo" value="${h(t.titulo)}"></label>
      <label class="full">Texto<textarea name="cuerpo" style="min-height:46vh;font-size:14px;line-height:1.6">${h(t.cuerpo)}</textarea></label>
      <div class="full" id="imgbox"></div>
      <div class="full" style="display:flex;gap:12px;align-items:center"><span id="txcount" class="small"></span><label class="check" style="margin-left:auto"><input type="checkbox" name="lista" ${t.lista ? 'checked' : ''}> Lista para pasar a AppSheet</label></div>
      <label class="full">Documento de la tarea (Google Doc)<input name="url" type="url" value="${h(t.url || x.doc_url || '')}" placeholder="https://docs.google.com/document/d/…"></label>
    </div><div class="err" id="ferr"></div></div>
    <div class="df"><button type="button" class="btn sec left" data-act="copytxt">${ic('copy')}Copiar texto</button>${st.gas ? `<button type="button" class="btn sec" data-act="docenviar" ${kind === 'lb' && !DOC_EDITABLE_LB.includes(x.estado) ? `disabled title="AppSheet deja editar el documento solo en ${DOC_EDITABLE_LB.join(' o ')}"` : ''}>${ic('doc')}Enviar al doc</button>` : ''}<button type="button" class="btn sec" data-act="close">Cerrar</button><button class="btn">Guardar</button></div></form>`, true);
  contarVivo(); mostrarImagen(kind, id);
}
async function mostrarImagen(kind, id) {
  const box = $('#imgbox'); if (!box) return;
  try {
    const r = await fetch(`/api/imagen?kind=${kind}&ref=${encodeURIComponent(id)}`, { headers: { authorization: 'Bearer ' + S.token } });
    if (r.status !== 200) { box.innerHTML = ''; return; }
    const u = URL.createObjectURL(await r.blob());
    box.innerHTML = `<div class="small mute" style="margin-bottom:4px">Imagen</div><img src="${u}" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid var(--line)"> <a class="lnk small" href="${u}" download="${h(id)}.png">Descargar</a>`;
  } catch { box.innerHTML = ''; }
}
async function iaRedactarUI(el) {
  const f = $('#txf'); if (f.cuerpo.value.trim() && !confirm('Ya hay texto. ¿Reemplazarlo por uno nuevo de la IA?')) return;
  el.disabled = true; $('#iastat').textContent = 'Redactando… (puede tardar un minuto)';
  try {
    const r = await api('/api/ia/redactar', 'POST', { kind: f.dataset.kind, ref: f.dataset.id, material: $('#material')?.value || '' });
    f.titulo.value = r.titulo; f.cuerpo.value = r.cuerpo; contarVivo(); $('#iastat').textContent = `Listo en ${r.segundos} s con ${r.modelo}. Revisalo antes de marcarlo como listo.`;
  } catch (e) { $('#iastat').textContent = e.message; }
  el.disabled = false;
}
/** Links: texto + imagen con un clic y, si la tarea está en un estado editable, se pega directo en el documento de AppSheet. */
async function iaTodoUI(el) {
  const f = $('#txf'), x = tarea('lb', f.dataset.id); if (f.cuerpo.value.trim() && !confirm('Ya hay texto. ¿Reemplazarlo por uno nuevo de la IA?')) return;
  const st = (t) => { $('#iastat').textContent = t; }; el.disabled = true;
  try {
    st('1/3 Redactando…'); const r = await api('/api/ia/redactar', 'POST', { kind: 'lb', ref: f.dataset.id }); f.titulo.value = r.titulo; f.cuerpo.value = r.cuerpo; contarVivo();
    st('2/3 Generando la imagen…'); let img = true; try { await api('/api/ia/imagen', 'POST', { kind: 'lb', ref: f.dataset.id, titulo: r.titulo }); await mostrarImagen('lb', f.dataset.id); } catch (e) { img = false; toast('Imagen: ' + e.message); }
    if (S.data.settings.gas && DOC_EDITABLE_LB.includes(x.estado)) {
      st('3/3 Pegando en el documento de AppSheet…');
      await api('/api/texto', 'POST', { kind: 'lb', ref: f.dataset.id, titulo: f.titulo.value, cuerpo: f.cuerpo.value, url: f.url.value, lista: f.lista.checked });
      const d = await api('/api/doc/enviar', 'POST', { kind: 'lb', ref: f.dataset.id, doc_url: f.url.value, conImagen: img }); if (d.doc) f.url.value = d.doc;
      st(`Listo: ${r.palabras} palabras${img ? ' + imagen' : ''}, pegado en el documento.`);
    } else st(`Listo: ${r.palabras} palabras${img ? ' + imagen' : ''}. ${S.data.settings.gas ? `No se pegó: el documento solo se edita en ${DOC_EDITABLE_LB.join(' o ')}.` : 'Conectá el script de Google para pegarlo solo.'}`);
  } catch (e) { st(e.message); }
  el.disabled = false;
}
async function iaImagenUI(el) {
  const f = $('#txf'); el.disabled = true; $('#iastat').textContent = 'Generando imagen…';
  try { await api('/api/ia/imagen', 'POST', { kind: f.dataset.kind, ref: f.dataset.id, titulo: f.titulo.value }); $('#iastat').textContent = 'Imagen lista.'; await mostrarImagen(f.dataset.kind, f.dataset.id); }
  catch (e) { $('#iastat').textContent = e.message; }
  el.disabled = false;
}
async function docEnviarUI(el) {
  const f = $('#txf'); el.disabled = true;
  try {
    await api('/api/texto', 'POST', { kind: f.dataset.kind, ref: f.dataset.id, titulo: f.titulo.value, cuerpo: f.cuerpo.value, url: f.url.value, lista: f.lista.checked });
    const r = await api('/api/doc/enviar', 'POST', { kind: f.dataset.kind, ref: f.dataset.id, doc_url: f.url.value, conImagen: !!$('#imgbox img') });
    if (r.doc) f.url.value = r.doc; toast('Texto pegado en el documento de la tarea');
  } catch (e) { toast(e.message); }
  el.disabled = false;
}
function contarVivo() { const f = $('#txf'); if (!f) return; const n = contar(f.cuerpo.value), min = Number(f.dataset.min || 0); $('#txcount').innerHTML = `${n} palabras${min ? ` · mínimo del proyecto: ${min} ${n >= min ? '<span class="tag ok">OK</span>' : `<span class="tag warn">faltan ${min - n}</span>`}` : ''}`; }

// ---------- panel lateral ----------
function openDrawer(html, wide) { const d = $('#drawer'); d.querySelector('.panel').innerHTML = html; d.querySelector('.panel').classList.toggle('wide', !!wide); d.classList.add('open'); lbAvisosVivos(); setTimeout(() => d.querySelector('.db input:not([type=hidden]), .db select')?.focus(), 60); }
function closeDrawer() { $('#drawer').classList.remove('open'); }
const formData = (f) => Object.fromEntries(new FormData(f));
async function guardar(fn, msg) { const e = $('#ferr'); try { if (e) e.textContent = ''; await fn(); closeDrawer(); if (msg) toast(msg); await load(); } catch (err) { if (e) e.textContent = err.message; else toast(err.message); } }

// ---------- eventos ----------
document.addEventListener('click', async (ev) => {
  if (ev.target.classList.contains('scrim')) return closeDrawer();
  const sortTh = ev.target.closest('th[data-sort]');
  if (sortTh) { const v = sortTh.dataset.sv, k = sortTh.dataset.sort, cur = S.sort[v]; S.sort[v] = [k, cur[0] === k ? -cur[1] : 1]; return render(); }
  const row = ev.target.closest('tr[data-open]');
  if (row && !ev.target.closest('select,button,input,td.ck,a')) { const k = row.dataset.open, x = k === 'hours' ? S.data.hours.find((o) => o.id === row.dataset.id) : tarea(k, row.dataset.id); return openDrawer({ lb: lbForm, red: redForm, hours: hoursForm }[k](x)); }
  const el = ev.target.closest('[data-act]'); if (!el || el.tagName === 'SELECT') return;
  switch (el.dataset.act) {
    case 'invitar': { const r = await api('/api/invites', 'POST'); const el2 = $('#invlink'); el2.style.display = 'block'; el2.textContent = r.link; navigator.clipboard?.writeText(r.link).then(() => toast('Link de invitación copiado')); break; }
    case 'view': ev.preventDefault(); closeDrawer(); if (el.dataset.v === 'ia') S.iaEstado = null; S.view = el.dataset.v; localStorage.setItem('pe_view', S.view); $('#view') && ($('#view').scrollTop = 0); render(); break;
    case 'newlb': openDrawer(lbForm()); break;
    case 'newlbP': openDrawer(lbForm({ prueba: 1, usuario: YO, estado: 'Gestión de Backlink' })); break;
    case 'newredP': openDrawer(redForm({ prueba: 1, usuario: YO })); break;
    case 'actualizar': await actualizarTodo(); break;
    case 'newred': openDrawer(redForm()); break;
    case 'newhours': openDrawer(hoursForm()); break;
    case 'editplan': openDrawer(planForm()); break;
    case 'close': closeDrawer(); break;
    case 'redactar': try { await abrirRedaccion(el.dataset.kind, el.dataset.id); } catch (e) { toast(e.message); } break;
    case 'copytxt': { const f = $('#txf'); navigator.clipboard?.writeText((f.titulo.value ? f.titulo.value + '\n\n' : '') + f.cuerpo.value).then(() => toast('Texto copiado')); break; }
    case 'del': { const f = el.closest('form'), k = el.dataset.kind; if (confirm('¿Borrar? No se puede deshacer.')) guardar(() => api(`/api/${k}/${f.dataset.id}`, 'DELETE'), 'Borrado'); break; }
    case 'bulkclear': S.sel[el.dataset.k].clear(); render(); break;
    case 'bulkgo': {
      const k = el.dataset.k, estado = $('#bulkest').value, ids = [...S.sel[k]];
      if (!confirm(`¿Pasar ${ids.length} tarea${ids.length > 1 ? 's' : ''} a "${estado}"? Queda anotado en Para AppSheet.`)) break;
      try { const r = await api('/api/bulk', 'POST', { kind: k, ids, estado }); S.sel[k].clear(); toast(`${r.n} tarea${r.n === 1 ? '' : 's'} en "${estado}"`); await load(); } catch (e) { toast(e.message); }
      break;
    }
    case 'tab': S.f[el.dataset.f] = el.dataset.v; render(); break;
    case 'sync': sincronizar(); break;
    case 'synccancel': terminarEspera(); break;
    case 'lproy': S.f.lProj = el.dataset.p; S.view = 'lproyectos'; render(); $('#view').scrollTop = 0; break;
    case 'verproy': { const p = proj(el.dataset.p); if (p?.tipo === 'RED') { S.view = 'red'; Object.assign(S.f, { redProj: p.code, redEstado: 'activas', redUser: '' }); } else { S.view = 'lb'; Object.assign(S.f, { lbProj: el.dataset.p, lbEstado: 'activas', lbUser: '' }); } render(); break; }
    case 'sug': { const x = misAlertas().sugerencias[Number(el.dataset.i)]; if (x.filtro.view) { S.view = x.filtro.view; } else { S.view = 'lb'; Object.assign(S.f, { lbProj: '', lbMail: '', lbNeg: '', lbMes: '', lbQ: '', lbUser: YO }, x.filtro); } render(); break; }
    case 'notadel': if (confirm('¿Borrar la nota?')) { await api('/api/notas/' + el.dataset.id, 'DELETE'); await load(); } break;
    case 'planarmar': try { await armarPlan(); } catch (e) { toast(e.message); } break;
    case 'planvalidar': { const r = await api('/api/planes?month=' + S.f.planMes); await api('/api/planes', 'POST', { month: S.f.planMes, estado: 'pedida', data: r.data }); S.plan = null; render(); break; }
    case 'iamodelos': await api('/api/settings', 'POST', { gemini_model_texto: $('#mtexto').value, gemini_model_imagen: $('#mimagen').value }); S.iaEstado = null; toast('Modelos guardados'); await load(); break;
    case 'iaprueba': { $('#iamsg').textContent = 'Probando…'; try { const r = await api('/api/ia/prueba', 'POST'); $('#iamsg').textContent = `${r.modelo}: "${r.respuesta}" (${(r.ms / 1000).toFixed(1)} s)`; } catch (e) { $('#iamsg').textContent = e.message; } break; }
    case 'gascode': { const { secret } = await api('/api/gas/secret'); navigator.clipboard?.writeText(GAS_CODE.replace('__SECRET__', secret)).then(() => toast('Código copiado: pegalo en script.google.com')); break; }
    case 'iaredactar': await iaRedactarUI(el); break;
    case 'iaimagen': await iaImagenUI(el); break;
    case 'iatodo': await iaTodoUI(el); break;
    case 'docenviar': await docEnviarUI(el); break;
    case 'copy': navigator.clipboard?.writeText(el.dataset.v).then(() => toast('Mail copiado')); break;
    case 'copycal': navigator.clipboard?.writeText(S.calurl || '').then(() => toast('Link copiado')); break;
    case 'resetcal': if (confirm('El link anterior deja de funcionar y vas a tener que volver a agregarlo en Google Calendar. ¿Seguir?')) { S.calurl = (await api('/api/calendar/reset', 'POST')).url; render(); } break;
    case 'claudeinst': instalarSkill(); break;
    case 'instalarapp': if (instalarEvt) { instalarEvt.prompt(); const r = await instalarEvt.userChoice; if (r.outcome === 'accepted') localStorage.setItem('pe_instalada', '1'); } break;
    case 'bvclaude': localStorage.setItem('pe_claude_via', el.dataset.via); S.bv = { paso: 'espera', via: el.dataset.via, desde: Date.now() - 5000 }; await abrirClaude('bienvenida', el.dataset.via); render(); break;
    case 'bvsaltar': case 'bvfin': clearInterval(S.bvPoll); localStorage.setItem(claveBienv(), '1'); S.bv = null; if (el.dataset.act === 'bvsaltar') S.view = 'lajustes'; $('#app').innerHTML = ''; render(); break;
    case 'guardarasurl': { const v = $('#asurl').value.trim(); await api('/api/settings', 'POST', { as_url: v }); await load(); toast(S.data.settings.as_url ? 'Link de AppSheet guardado' : 'El link tiene que empezar con https://www.appsheet.com/start/'); break; }
    case 'claudezip': descargarSkill(); break;
    case 'claudeok': localStorage.setItem('pe_skill', '1'); toast('Listo: la skill queda marcada como instalada'); render(); break;
    case 'claudesync': sincronizar(); break;
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
  if (el.classList.contains('selck')) { const k = el.dataset.k; el.checked ? S.sel[k].add(el.dataset.id) : S.sel[k].delete(el.dataset.id); render(); api('/api/act/ping', 'POST', { refs: [...S.sel[k]].map((ref) => ({ kind: k, ref })) }).catch(() => {}); return; }
  if (el.classList.contains('selall')) { const k = el.dataset.k; for (const id of S.visibles?.[k] || []) el.checked ? S.sel[k].add(id) : S.sel[k].delete(id); render(); return; }
  if (el.classList.contains('notack')) { const n = S.data.notas.find((x) => x.id === el.dataset.id); await api('/api/notas', 'POST', { ...n, hecha: el.checked }); await load(); return; }
  if (el.classList.contains('umodo')) { await api('/api/usuarios/modo', 'POST', { id: el.dataset.id, modo: el.value }); if (el.dataset.id === S.data.me.id) localStorage.removeItem('pe_modo_' + S.data.me.id); toast('Modo predeterminado guardado'); await load(); return; }
  if (el.id === 'diasq') { await api('/api/settings', 'POST', { dias_quieta: el.value }); await load(); return; }
  if (el.id === 'medcsv' && el.files[0]) { importarCompilado(el.files[0]).catch((e) => toast(e.message)); return; }
  if (el.dataset.f && el.type !== 'search') { S.f[el.dataset.f] = el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value; render(); return; }
  if (el.dataset.act === 'lbestado' || el.dataset.act === 'redestado') {
    const kind = el.dataset.act === 'lbestado' ? 'lb' : 'red', x = tarea(kind, el.dataset.id);
    try { await api('/api/' + kind, 'POST', { ...x, estado: el.value }); toast(x.prueba ? 'Estado actualizado (prueba: no va a AppSheet)' : 'Estado actualizado · anotado en Pendientes AppSheet'); await load(); } catch (e) { toast(e.message); el.value = x.estado; }
    return;
  }
  if (el.dataset.act === 'hrproj') { el.form.task_type.innerHTML = opts(TAREAS[proj(el.value).tipo]); return; }
  if (el.dataset.act === 'lbproj') { const pp = proj(el.value)?.params || {}; if (pp.servicio) el.form.tipo_servicio.value = pp.servicio; }
  if (el.closest('#lbf')) lbAvisosVivos();
});
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.f && el.type === 'search') { S.f[el.dataset.f] = el.value; clearTimeout(S.qt); S.qt = setTimeout(() => { const pos = el.selectionStart; render(); const n = document.querySelector(`[data-f="${el.dataset.f}"]`); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 200); return; }
  if (el.closest('#lbf')) lbAvisosVivos();
  if (el.closest('#txf')) contarVivo();
});
document.addEventListener('submit', async (ev) => {
  ev.preventDefault(); const f = ev.target;
  if (f.id === 'loginf') {
    try {
      const r = S.invitacion ? await api('/api/signup', 'POST', { invitacion: S.invitacionToken, email: f.email.value, password: f.pw.value })
        : S.setup ? await api('/api/setup', 'POST', { email: f.email.value, password: f.pw.value })
        : await api('/api/login', 'POST', { usuario: f.usuario.value, password: f.pw.value });
      S.token = r.token; localStorage.setItem('pe_token', r.token); localStorage.removeItem('pe_inv'); S.setup = false; S.invitacion = undefined; history.replaceState(null, '', '/'); $('#app').innerHTML = ''; await load();
    }
    catch (e) { $('#lerr').textContent = e.message; }
    return;
  }
  if (f.id === 'lbf') return guardar(() => api('/api/lb', 'POST', { ...formData(f), id: f.dataset.id || undefined, prueba: !!f.dataset.prueba }), f.dataset.prueba ? 'Tarea de prueba guardada (no va a AppSheet)' : 'Tarea guardada');
  if (f.id === 'redf') return guardar(() => { const d = formData(f); return api('/api/red', 'POST', { ...d, ia: d.ia === '1', id: f.dataset.id || undefined, prueba: !!f.dataset.prueba }); }, f.dataset.prueba ? 'Redacción de prueba guardada (no va a AppSheet)' : 'Redacción guardada');
  if (f.id === 'txf') return guardar(() => api('/api/texto', 'POST', { kind: f.dataset.kind, ref: f.dataset.id, titulo: f.titulo.value, cuerpo: f.cuerpo.value, url: f.url.value, lista: f.lista.checked }), 'Redacción guardada');
  if (f.id === 'notaf') { try { await api('/api/notas', 'POST', { texto: f.texto.value, lider: f.lider.checked }); await load(); } catch (e) { toast(e.message); } return; }
  if (f.id === 'gemf') { try { const r = await api('/api/ia/key', 'POST', { key: f.key.value.trim() }); S.iaEstado = null; toast(`Gemini conectado · textos: ${r.texto || '—'} · imágenes: ${r.imagen || '—'}`); await load(); } catch (e) { toast(e.message); } return; }
  if (f.id === 'gasf') { try { await api('/api/gas', 'POST', { url: f.url.value.trim() }); toast('Script guardado'); await load(); } catch (e) { toast(e.message); } return; }
  if (f.id === 'promptf') { try { for (const [clave, texto] of Object.entries(formData(f))) await api('/api/prompts', 'POST', { project: f.dataset.project, clave, texto }); toast('Prompts guardados'); await load(); } catch (e) { toast(e.message); } return; }
  if (f.id === 'hrf') return guardar(() => api('/api/hours', 'POST', { ...formData(f), id: f.dataset.id || undefined }), 'Horas guardadas');
  if (f.id === 'planf') {
    const d = formData(f), rows = Object.keys(d).filter((k) => /^p\d+$/.test(k)).map((k) => { const i = k.slice(1), [project, task_type] = d[k].split('|'); return { project, task_type, hours: d['h' + i], units: d['u' + i] }; });
    return guardar(() => api('/api/plan', 'POST', { month: S.f.mes, rows }), 'Plan guardado');
  }
  if (f.id === 'projf') {
    const projects = [...f.querySelectorAll('tr[data-code]')].map((tr) => { const g = (n) => tr.querySelector(`[name=${n}]`)?.value ?? ''; return { code: tr.dataset.code, cliente: g('cliente'), active: tr.querySelector('[name=active]').checked, params: { drMin: g('drMin'), trafMin: g('trafMin'), precioMaxUSD: g('precioMaxUSD'), repDias: g('repDias'), palabrasMin: g('palabrasMin'), linksMes: g('linksMes'), piezasMes: g('piezasMes') || g('linksMes'), dominio: g('dominio'), paises: g('paises'), servicio: g('servicio') } }; });
    try { await api('/api/projects', 'POST', { projects }); toast('Proyectos guardados'); await load(); } catch (e) { toast(e.message); }
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && $('#drawer').classList.contains('open')) return closeDrawer();
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter' && $('#drawer').classList.contains('open')) $('#drawer form')?.requestSubmit();
});

// ---------- Claude (sincronizar con AppSheet desde el Claude de cada uno) ----------
const datosConexion = (c) => (c.link ? `\n- Enlace para abrir mi app con mi sesión (un solo uso, vence en 1 hora): ${c.link}` : '') + `\n- AppSheet: ${c.as_url || 'la app «Eleven - Operaciones» (buscala en appsheet.com si no la tenés abierta)'}`;
const PROMPTS_CLAUDE = {
  bienvenida: (o, c) => `Hola Claude. Quiero dejar conectada mi app Proyectos Eleven con mi AppSheet. Leé ${o}/claude/SKILL.md (si todavía no tengo la skill «proyectos-eleven», proponémela para guardar) y seguí la sección «Primera vez» con estos datos:${datosConexion(c)}`,
  instalar: (o) => `Instalá la skill "proyectos-eleven" para poder sincronizar mi app Proyectos Eleven con AppSheet. Leé el archivo ${o}/claude/SKILL.md y proponémelo como skill para guardar, con ese mismo nombre y contenido. Si desde este chat no se pueden guardar skills, decime cómo subirlo.`,
  sincronizar: (o, c) => `Usá la skill proyectos-eleven para sincronizar mi app Proyectos Eleven con AppSheet y el reporte de seguimiento (solo lectura: no cambies nada en AppSheet ni en el reporte). Si no tenés la skill, seguí las instrucciones de ${o}/claude/SKILL.md.${datosConexion(c)}`,
};
const skillInstalada = () => localStorage.getItem('pe_skill') === '1';
const viaClaude = () => localStorage.getItem('pe_claude_via') || 'escritorio';
/** Abre Claude (escritorio o claude.ai con Claude in Chrome) con el pedido escrito. Suma un enlace de un solo uso para que la app quede abierta con tu sesión en el navegador de Claude. */
async function abrirClaude(clave, via = viaClaude()) {
  let c = { link: '', as_url: S.data?.settings?.as_url || '' };
  try { c = await api('/api/conectar', 'POST'); } catch { /* sin enlace: Claude le pide entrar */ }
  const texto = PROMPTS_CLAUDE[clave](location.origin, c), q = encodeURIComponent(texto);
  const web = 'https://claude.ai/new?q=' + q;
  if (via === 'chrome') window.open(web, '_blank', 'noopener'); else location.href = 'claude://claude.ai/new?q=' + q;
  const fb = $('#claudefb'); if (fb) { fb.style.display = ''; fb.querySelector('a').href = web; }
  toast('Se abrió Claude con el mensaje escrito: tocá Enviar');
}
function instalarSkill() {
  if (!confirm('Para sincronizar, tu Claude necesita la skill «proyectos-eleven»: las instrucciones para leer y actualizar AppSheet con tu sesión.\n\nSe va a abrir Claude con el pedido de instalación. Enviá el mensaje y tocá Guardar en la tarjeta que aparece.\n\n¿Instalarla ahora?')) return;
  abrirClaude('instalar');
}
function sincronizarConClaude(clave = 'sincronizar') {
  if (!skillInstalada() && confirm('Todavía no marcaste la skill «proyectos-eleven» como instalada en tu Claude. Sin ella, Claude igual puede leer las instrucciones de la app, pero tarda más.\n\n¿Instalarla primero?')) return instalarSkill();
  abrirClaude(clave);
}
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; }
/** ZIP sin compresión (alcanza para una skill de un archivo). */
function zipSimple(files) {
  const te = new TextEncoder(), partes = [], central = []; let off = 0;
  for (const f of files) {
    const n = te.encode(f.name), d = f.data, crc = crc32(d);
    const lh = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [12, 0x21, 2], [14, crc, 4], [18, d.length, 4], [22, d.length, 4], [26, n.length, 2]].forEach(([o, v, z]) => (z === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true)));
    const ch = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [14, 0x21, 2], [16, crc, 4], [20, d.length, 4], [24, d.length, 4], [28, n.length, 2], [42, off, 4]].forEach(([o, v, z]) => (z === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true)));
    partes.push(new Uint8Array(lh.buffer), n, d); central.push(new Uint8Array(ch.buffer), n); off += 30 + n.length + d.length;
  }
  const tam = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, tam, true); e.setUint32(16, off, true);
  return new Blob([...partes, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
async function descargarSkill() {
  try {
    const txt = await fetch('/claude/SKILL.md', { cache: 'no-store' }).then((r) => r.text());
    const a = document.createElement('a'); a.href = URL.createObjectURL(zipSimple([{ name: 'proyectos-eleven/SKILL.md', data: new TextEncoder().encode(txt) }]));
    a.download = 'proyectos-eleven.zip'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) { toast(e.message); }
}
// ---------- bienvenida guiada (instalar → cuenta → Claude → tareas) ----------
let instalarEvt = null;
const enApp = () => matchMedia('(display-mode: standalone)').matches;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); instalarEvt = e; const b = $('#instbtn'); if (b) b.disabled = false; });
window.addEventListener('appinstalled', () => { instalarEvt = null; localStorage.setItem('pe_instalada', '1'); const c = $('#instbox'); if (c) c.innerHTML = '<b>App instalada.</b> Se abrió en su propia ventana (también la tenés en el escritorio y en el menú Inicio): seguí ahí.'; });
function cajaInstalar() {
  return `<div class="box onb-inst" id="instbox"><b>1. Instalá la app en tu escritorio</b><p class="small mute" style="margin:4px 0 10px">Queda con su propia ventana y su ícono, como cualquier programa.</p>
    <button class="btn full" id="instbtn" data-act="instalarapp" ${instalarEvt ? '' : 'disabled'}>Instalar Proyectos Eleven</button><p class="small mute" style="margin:8px 0 0">Si el botón no se activa, abrí este link en Chrome o Edge. Si ya la instalaste, seguí con el paso 2.</p></div>`;
}
function pasosBienvenida(hechos) {
  const n = ['Instalá la app', 'Creá tu cuenta', 'Conectá Claude', 'Tus tareas'];
  return `<ol class="onb-pasos">${n.map((t, i) => `<li class="${i < hechos ? 'ok' : i === hechos ? 'on' : ''}"><span>${i < hechos ? '✓' : i + 1}</span>${t}</li>`).join('')}</ol>`;
}
const claveBienv = () => 'pe_bienv_' + (S.data?.me?.id || '');
function necesitaBienvenida() {
  if (!S.data?.me || sessionStorage.getItem('pe_claude') || localStorage.getItem(claveBienv())) return false;
  return !S.data.settings.as_sync_at || !!S.bv;
}
function renderBienvenida() {
  const st = S.data.settings, me = S.data.me; S.bv = S.bv || { paso: 'claude' };
  if (S.bv.paso === 'espera' && st.as_sync_at && Number(st.as_sync_at) > S.bv.desde) S.bv.paso = 'listo';
  const nombre = h((me.nombre || '').split(' ')[0]);
  let cuerpo;
  if (S.bv.paso === 'claude') cuerpo = `<h1>Hola, ${nombre}</h1><p>Ahora conectamos tu Claude. Él abre AppSheet con tu sesión y trae tus proyectos y tareas (solo lee); vos solo iniciás sesión cuando te lo pida.</p>
      <div class="onb-ops"><button class="onb-op" data-act="bvclaude" data-via="escritorio"><i class="tag acc">Recomendado</i><b>Claude de escritorio</b><span>La app de Claude en tu computadora</span></button>
      <button class="onb-op" data-act="bvclaude" data-via="chrome"><b>Claude in Chrome</b><span>La extensión de Claude en tu Chrome</span></button></div>
      <p class="small mute">¿No tenés Claude? <a href="https://claude.ai/download" target="_blank" rel="noopener">Descargá Claude de escritorio</a>, iniciá sesión y volvé a esta ventana.</p>`;
  else if (S.bv.paso === 'espera') {
    const con = Number(st.conectado_at) > S.bv.desde;
    const it = (ok, t, d) => `<li class="${ok ? 'ok' : ''}"><span>${ok ? '✓' : '·'}</span><div><b>${t}</b>${d ? `<div class="small mute">${d}</div>` : ''}</div></li>`;
    cuerpo = `<h1>Seguí en Claude</h1><p>Se abrió Claude con el mensaje escrito. Esta ventana se actualiza sola.</p>
      <ul class="onb-check">${it(con, 'Enviá el mensaje', 'Tocá Enviar en Claude. Si te muestra la skill «proyectos-eleven», tocá Guardar.')}
      ${it(con, 'Claude abre tu app', con ? 'Listo: ya la tiene abierta con tu sesión.' : 'Esperando…')}
      ${it(false, 'Iniciá sesión en AppSheet', 'Claude te abre AppSheet: entrá con tu cuenta de Eleven y avisale. Después lee AppSheet y el reporte dos veces, revisa todo y recién ahí carga tus datos.')}
      ${it(false, 'Tus tareas llegan acá', '<span class="spin"></span> Esperando a Claude…')}</ul>
      <p class="small mute">¿No se abrió Claude? <button class="lnk small" data-act="bvclaude" data-via="${S.bv.via}">Abrirlo de nuevo</button> · <button class="lnk small" data-act="bvclaude" data-via="${S.bv.via === 'chrome' ? 'escritorio' : 'chrome'}">Usar ${S.bv.via === 'chrome' ? 'Claude de escritorio' : 'Claude in Chrome'}</button> · <button class="lnk small" data-act="bvsaltar">Hacerlo sin Claude</button></p>`;
  } else {
    const nl = S.data.lb.length, nr = S.data.red.length;
    cuerpo = `<h1>¡Listo, ${nombre}!</h1><p>Trajimos <b>${nl} link${nl === 1 ? '' : 's'}</b> y <b>${nr} redaccion${nr === 1 ? '' : 'es'}</b> de AppSheet${S.data.projects.length ? ` de ${S.data.projects.length} proyecto${S.data.projects.length === 1 ? '' : 's'}` : ''}. </p>
      <p class="small mute">La app no se actualiza sola: cada vez que quieras ver lo último de AppSheet (por ejemplo, al empezar el día), tocá <b>Sincronizar</b>.</p>
      <button class="btn" data-act="bvfin">Entrar a la app</button>`;
  }
  $('#app').innerHTML = `<div class="login onb">${pasosBienvenida(S.bv.paso === 'listo' ? 4 : 2)}<div class="box">${cuerpo}</div></div>`;
  clearInterval(S.bvPoll); if (S.bv.paso === 'espera') S.bvPoll = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 5000);
}

function tarjetaClaude() {
  const ok = skillInstalada();
  return `<div class="card"><div class="ch"><h2>Sincronizar con AppSheet</h2>${ok ? '<span class="tag ok">Skill instalada</span>' : '<span class="tag warn">Falta la skill</span>'}</div><div class="cb">
    <p class="mute" style="margin-top:0">La app no se actualiza sola: trae lo que hay en AppSheet cuando tocás <b>Sincronizar</b>. Lo hace tu Claude con tu sesión (Claude de escritorio con el navegador integrado, o Claude in Chrome), solo leyendo.</p>
    <ol class="steps"><li><b>Una sola vez:</b> <button class="btn sm${ok ? ' sec' : ''}" data-act="claudeinst">${ic('ia')}Instalar la skill en Claude</button> ${ok ? '' : '<button class="lnk small" data-act="claudeok">Ya la guardé</button>'}<div class="small mute">Se abre Claude con el pedido escrito: lo enviás y tocás <b>Guardar</b>. A mano: <button class="lnk small" data-act="claudezip">descargá el .zip</button> y subilo en Claude → Personalizar → Skills.</div></li>
    <li><b>Al empezar el día y cada vez que quieras:</b> ${botonSync().replace('class="btn"', 'class="btn sm"')}<div class="small mute">Se abre Claude con el pedido escrito: tocá Enviar. Cuando termina, esta ventana se actualiza sola.</div></li></ol>
    <p class="small mute" id="claudefb" style="display:none">¿No se abrió Claude? <a href="#" target="_blank" rel="noopener">Abrirlo en el navegador</a> (ahí necesitás Claude in Chrome para que pueda usar AppSheet).</p></div></div>`;
}
/** API para el Claude del usuario (la skill proyectos-eleven la usa desde esta pestaña). Todo con la sesión de quien está logueado. */
window.PE = {
  version: 2,
  async yo() { if (!S.token) return null; if (!S.data) await load(); return S.data?.me ? { nombre: S.data.me.nombre, email: S.data.me.email, modo: 'lider' } : null; },
  async actualizar() { await load(); const s = syncInfo(); return { links: S.data.lb.length, redacciones: S.data.red.length, proyectos: S.data.projects.filter((p) => p.active).length, ultimaSync: s.at ? fmtHora(s.at) : null }; },
  /** Empieza una sincronización: devuelve { sid, clave, origen } para los códigos de lectura de la skill. */
  async syncIniciar() { return api('/api/sync/iniciar', 'POST', {}); },
  /** Revisa lo leído sin escribir nada: errores, advertencias, diferencias y si hace falta confirmación. */
  async syncRevisar(sid) { try { return await api('/api/sync/revisar', 'POST', { sid }); } catch (e) { return { ok: false, errores: [e.message] }; } },
  /** Aplica todo junto (o nada) y devuelve la verificación de lo guardado. */
  async syncAplicar(sid, confirmar = false) {
    const r = await fetch('/api/sync/aplicar', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + S.token }, body: JSON.stringify({ sid, confirmar: confirmar === true }) });
    const j = await r.json().catch(() => ({})); await load();
    return r.ok ? j : { ok: false, aplicado: false, error: j.error || 'Error ' + r.status, informe: j.informe };
  },
  async tiempo(accion, inicio, fin, refs = []) { const rs = refs.map((r) => ({ kind: r.tipo || r.kind, ref: r.tarea || r.ref })); if (!rs.length) return { ok: true, nota: 'sin tareas para asignar el tiempo' }; await api('/api/act/agente', 'POST', { quien: 'claude', refs: rs, accion, inicio, fin }); return { ok: true }; },
};

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
versionApp().then((v) => { S.version = v; });
const qs = new URLSearchParams(location.search);
(async () => {
  const con = qs.get('conectar');
  if (con) {
    history.replaceState(null, '', '/');
    try { const r = await api('/api/conectar/usar', 'POST', { token: con }); S.token = r.token; localStorage.setItem('pe_token', r.token); sessionStorage.setItem('pe_claude', '1'); toast(`Conectado como ${r.nombre}`); }
    catch (e) { if (!S.token) { $('#app').innerHTML = `<div class="login"><div class="box"><img src="/icon.svg" alt=""><h1>Proyectos Eleven</h1><p>${h(e.message)}</p></div></div>`; return; } toast(e.message); }
  }
  if (S.token) {
    try { S.data = separarPruebas(JSON.parse(localStorage.getItem('pe_cache') || 'null')); tomarUsuario(); } catch { /* nada */ }
    try { S.syncEsperando = JSON.parse(sessionStorage.getItem('pe_sync') || 'null'); } catch { /* nada */ } esperarSync();
    if (S.data) render(); await load();
    if (qs.get('invitacion')) { toast('Ya tenés una sesión abierta: para usar la invitación, cerrá sesión en Ajustes o abrí el link en otro navegador.'); }
    if (qs.get('nuevo')) history.replaceState(null, '', '/');
    return;
  }
  if (qs.get('invitacion')) localStorage.setItem('pe_inv', qs.get('invitacion'));
  const inv = qs.get('invitacion') || localStorage.getItem('pe_inv'); if (inv) S.invitacionToken = inv;
  try { const st = await api('/api/state' + (inv ? '?invitacion=' + encodeURIComponent(inv) : '')); S.setup = st.setup; S.invitacion = inv ? st.invitacion : undefined; if (inv && !st.invitacion && !qs.get('invitacion')) { localStorage.removeItem('pe_inv'); S.invitacion = undefined; } } catch { /* sin conexión */ }
  render();
})();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.token && !$('#drawer').classList.contains('open')) load(); });
