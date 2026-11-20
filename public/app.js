// Proyectos Eleven — app (PWA). Un solo usuario. Todo se guarda en el servidor; el teléfono y la compu ven lo mismo.
import { ESTADOS_LB, ESTADOS_NEG, ESTADOS_RED, PRIORIDADES, MONEDAS, PUBLICADOS, TAREAS, TIPOS_SERVICIO, avisosLB, hoyEn, addDays, normDomain } from './shared.js';

const S = {
  token: localStorage.getItem('pe_token') || '', setup: false, data: null, tab: localStorage.getItem('pe_tab') || 'hoy',
  f: { lbProj: '', lbEstado: 'activas', lbQ: '', lbSort: 'deadline', redProj: '', redEstado: 'activas', redQ: '', medGroup: 'mail_eleven', medQ: '', mes: hoyEn().slice(0, 7) },
};
const $ = (s) => document.querySelector(s);
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opts = (list, sel, labels) => list.map((v, i) => `<option value="${h(v)}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${h(labels ? labels[i] : v || '—')}</option>`).join('');
const fmtD = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '');
const fmtH = (n) => (Math.round(Number(n || 0) * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const hoy = () => hoyEn();
function hint(t) { const el = $('#hint'); el.textContent = t; el.classList.add('show'); clearTimeout(hint.t); hint.t = setTimeout(() => el.classList.remove('show'), 2200); }

async function api(path, method = 'GET', body) {
  const r = await fetch(path, { method, headers: { 'content-type': 'application/json', ...(S.token ? { authorization: 'Bearer ' + S.token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token && path !== '/api/login') { S.token = ''; localStorage.removeItem('pe_token'); render(); }
  if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
  return j;
}
async function load() {
  try { S.data = await api('/api/data'); localStorage.setItem('pe_cache', JSON.stringify(S.data)); }
  catch (e) { if (!S.data) { try { S.data = JSON.parse(localStorage.getItem('pe_cache') || 'null'); } catch { /* nada */ } } if (S.token) hint('Sin conexión: ves los últimos datos'); }
  render();
}
const proj = (code) => S.data.projects.find((p) => p.code === code);
const projs = (tipo) => S.data.projects.filter((p) => p.active && (!tipo || p.tipo === tipo));

// ---------- marco ----------
const TABS = [['hoy', '🏠', 'Hoy'], ['lb', '🔗', 'Link building'], ['red', '✍️', 'Redacciones'], ['medios', '✉️', 'Medios'], ['horas', '⏱', 'Horas'], ['ajustes', '⚙️', 'Ajustes']];
function render() {
  if (!S.token) return renderLogin();
  if (!S.data) { $('#app').innerHTML = '<div class="empty">Cargando…</div>'; return; }
  const nav = TABS.map(([k, ic, t]) => `<button data-act="tab" data-v="${k}" class="${S.tab === k ? 'on' : ''}">${t}</button>`).join('');
  $('#top').innerHTML = `<img class="logo" src="/icon.svg" alt=""><div class="title">Proyectos Eleven</div><nav>${nav}</nav>`;
  $('#tabs').innerHTML = TABS.map(([k, ic, t]) => `<button data-act="tab" data-v="${k}" class="${S.tab === k ? 'on' : ''}"><span>${ic}</span>${t === 'Link building' ? 'LB' : t}</button>`).join('');
  $('#app').innerHTML = ({ hoy: vHoy, lb: vLB, red: vRED, medios: vMedios, horas: vHoras, ajustes: vAjustes }[S.tab] || vHoy)();
  tickTimer();
}
function renderLogin() {
  $('#top').innerHTML = ''; $('#tabs').innerHTML = '';
  $('#app').innerHTML = `<div class="login"><img src="/icon.svg" alt=""><h1 style="margin-top:10px">Proyectos Eleven</h1>
    <div class="card"><form id="loginf"><label>${S.setup ? 'Creá tu contraseña (mínimo 8 caracteres)' : 'Contraseña'}<input type="password" name="pw" autocomplete="${S.setup ? 'new-password' : 'current-password'}" required minlength="8"></label>
    <button class="btn" style="width:100%;margin-top:10px">${S.setup ? 'Crear y entrar' : 'Entrar'}</button><div class="err" id="lerr"></div></form></div></div>`;
}

// ---------- Hoy ----------
function pendientes() {
  const d = S.data, out = [];
  for (const t of d.lb) if (t.deadline && !PUBLICADOS.has(t.estado)) out.push({ kind: 'lb', id: t.id, d: t.deadline, title: t.anchor || t.as_code || 'Tarea de LB', sub: [t.project, t.as_code, t.estado, t.medio].filter(Boolean).join(' · ') });
  for (const r of d.red) if (r.fecha_entrega && r.estado !== 'Entregada') out.push({ kind: 'red', id: r.id, d: r.fecha_entrega, title: r.tema, sub: [r.project, r.estado, r.prioridad !== 'Normal' && 'Prioridad ' + r.prioridad].filter(Boolean).join(' · ') });
  return out.sort((a, b) => a.d.localeCompare(b.d));
}
function itemDL(x) {
  const t = hoy(), cls = x.d < t ? 'bad' : x.d === t ? 'warn' : '';
  return `<div class="item" data-act="open" data-kind="${x.kind}" data-id="${x.id}"><div><div class="main">${x.kind === 'lb' ? '🔗' : '✍️'} ${h(x.title)}</div><div class="meta">${h(x.sub)}</div></div>
    <div class="side"><span class="pill ${cls}">${x.d < t ? 'Vencida ' : ''}${fmtD(x.d)}</span></div></div>`;
}
function vHoy() {
  const t = hoy(), p = pendientes(), venc = p.filter((x) => x.d < t), hoyL = p.filter((x) => x.d === t), prox = p.filter((x) => x.d > t && x.d <= addDays(t, 7));
  const hrsHoy = S.data.hours.filter((x) => x.date === t), totHoy = hrsHoy.reduce((a, x) => a + x.hours, 0);
  const lunes = addDays(t, -((new Date(t + 'T12:00:00Z').getUTCDay() + 6) % 7)), totSem = S.data.hours.filter((x) => x.date >= lunes && x.date <= t).reduce((a, x) => a + x.hours, 0);
  const conAvisos = S.data.lb.filter((x) => !PUBLICADOS.has(x.estado)).map((x) => ({ x, a: avisosLB(x, proj(x.project), S.data.lb) })).filter((o) => o.a.length);
  const nAS = S.data.as_pend.length;
  const bloque = (titulo, arr) => (arr.length ? `<h3>${titulo} (${arr.length})</h3><div class="list">${arr.map(itemDL).join('')}</div>` : '');
  return `<div class="grid three"><div>
    <div class="card"><h2>📅 Deadlines</h2>${bloque('Vencidas', venc)}${bloque('Hoy', hoyL)}${bloque('Próximos 7 días', prox)}
      ${!venc.length && !hoyL.length && !prox.length ? '<div class="empty">Nada para los próximos 7 días.</div>' : ''}
      <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="newlb">+ Tarea LB</button><button class="btn sm ghost" data-act="newred">+ Redacción</button></div></div>
    ${conAvisos.length ? `<div class="card"><h2>⚠️ Tareas que van a rebotar en AppSheet</h2><div class="list">${conAvisos.map(({ x, a }) => `<div class="item" data-act="open" data-kind="lb" data-id="${x.id}"><div><div class="main">${h(x.as_code || x.anchor || 'Tarea')}</div><div class="meta">${h(x.project)} · ${h(x.medio)}</div><div class="warnbox">${a.map((s) => `<div>${h(s)}</div>`).join('')}</div></div><div></div></div>`).join('')}</div></div>` : ''}
  </div><div>
    <div class="card" id="timercard">${timerHTML()}</div>
    <div class="card"><h2>⏱ Horas</h2><div class="row between"><div class="stat"><span class="mute small">Hoy</span><span class="big">${fmtH(totHoy)} h</span></div><div class="stat" style="text-align:right"><span class="mute small">Esta semana</span><span class="big">${fmtH(totSem)} h</span></div></div>
      ${hrsHoy.length ? `<div class="list" style="margin-top:8px">${hrsHoy.map(hourItem).join('')}</div>` : ''}
      <button class="btn sm" style="margin-top:10px" data-act="newhours">+ Cargar horas</button></div>
    <div class="card"><h2>🔁 Para reflejar en AppSheet</h2><p class="mute" style="margin:0 0 8px">${nAS ? `${nAS} cambio${nAS > 1 ? 's' : ''} hecho${nAS > 1 ? 's' : ''} acá que todavía no están en AppSheet.` : 'Todo al día.'}</p>${nAS ? '<button class="btn sm ghost" data-act="tab" data-v="ajustes">Ver lista</button>' : ''}</div>
  </div></div>`;
}
function hourItem(x) {
  return `<div class="item" data-act="edithours" data-id="${x.id}"><div><div class="main">${h(x.project)} · ${h(x.task_type)}</div><div class="meta">${fmtD(x.date)}${x.note ? ' · ' + h(x.note) : ''}</div></div><div class="side"><b>${fmtH(x.hours)} h</b></div></div>`;
}

// ---------- cronómetro (guardado en el servidor: sigue corriendo entre compu y teléfono) ----------
const timer = () => { try { return JSON.parse(S.data.settings.timer || 'null'); } catch { return null; } };
function timerHTML() {
  const tm = timer();
  if (tm) return `<h2>⏱ Cronómetro</h2><div class="mute small">${h(tm.project)} · ${h(tm.task_type)}</div><div class="timer" id="tclock">0:00:00</div>
    <div class="row" style="margin-top:8px"><button class="btn" data-act="tstop">Detener y guardar</button><button class="btn ghost" data-act="tdiscard">Descartar</button></div>`;
  const ps = projs();
  return `<h2>⏱ Cronómetro</h2><div class="fields"><label>Proyecto<select id="tproj" data-act="tproj">${opts(ps.map((p) => p.code), S.tproj || ps[0]?.code)}</select></label>
    <label>Tarea<select id="ttype">${opts(TAREAS[proj(S.tproj || ps[0]?.code)?.tipo || 'LIN'])}</select></label></div><button class="btn" style="margin-top:10px" data-act="tstart">Iniciar</button>`;
}
function tickTimer() {
  clearInterval(tickTimer.i); const tm = timer(); if (!tm) return;
  const up = () => { const el = $('#tclock'); if (!el) return clearInterval(tickTimer.i); const s = Math.max(0, Math.floor((Date.now() - tm.start) / 1000)); el.textContent = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  up(); tickTimer.i = setInterval(up, 1000);
}
async function setTimer(v) { await api('/api/settings', 'POST', { timer: v ? JSON.stringify(v) : '' }); S.data.settings.timer = v ? JSON.stringify(v) : ''; }

// ---------- Link building ----------
function lbFiltradas() {
  const f = S.f, q = f.lbQ.trim().toLowerCase();
  let arr = S.data.lb.filter((t) => (!f.lbProj || t.project === f.lbProj) && (f.lbEstado === 'todas' || (f.lbEstado === 'activas' ? !PUBLICADOS.has(t.estado) : t.estado === f.lbEstado)));
  if (q) arr = arr.filter((t) => [t.as_code, t.anchor, t.medio, t.mail_eleven, t.contacto_medio, t.url_cliente, t.notas].join(' ').toLowerCase().includes(q));
  const key = { deadline: (t) => t.deadline || '9999', proyecto: (t) => t.project + (t.deadline || '9999'), estado: (t) => String(ESTADOS_LB.indexOf(t.estado)).padStart(2, '0') + (t.deadline || '9999'), mail: (t) => (t.mail_eleven || '~') + t.project, medio: (t) => normDomain(t.medio) || '~' }[f.lbSort];
  return arr.sort((a, b) => key(a).localeCompare(key(b)));
}
function vLB() {
  const f = S.f, arr = lbFiltradas(), t = hoy();
  return `<div class="card"><div class="toolbar">
      <select data-f="lbProj"><option value="">Todos los proyectos</option>${opts(projs('LIN').map((p) => p.code), f.lbProj)}</select>
      <select data-f="lbEstado">${opts(['activas', 'todas', ...ESTADOS_LB], f.lbEstado, ['Activas', 'Todas', ...ESTADOS_LB])}</select>
      <select data-f="lbSort">${opts(['deadline', 'proyecto', 'estado', 'mail', 'medio'], f.lbSort, ['Orden: deadline', 'Orden: proyecto', 'Orden: estado', 'Orden: mail Eleven', 'Orden: medio'])}</select>
      <input type="search" data-f="lbQ" placeholder="Buscar anchor, medio, mail, código…" value="${h(f.lbQ)}"><button class="btn" data-act="newlb">+ Nueva tarea</button></div>
    <div class="mute small" style="margin-bottom:6px">${arr.length} tarea${arr.length === 1 ? '' : 's'}</div>
    <div class="list">${arr.map((x) => {
      const av = PUBLICADOS.has(x.estado) ? [] : avisosLB(x, proj(x.project), S.data.lb);
      return `<div class="item" data-act="open" data-kind="lb" data-id="${x.id}"><div><div class="main">${h(x.anchor || '(sin anchor)')}${av.length ? ` <span class="pill warn" title="${h(av.join('\n'))}">⚠️ ${av.length}</span>` : ''}</div>
        <div class="meta"><span>${h(x.project)}</span>${x.as_code ? `<span>${h(x.as_code)}</span>` : ''}${x.medio ? `<span>🌐 ${h(normDomain(x.medio))}</span>` : ''}${x.mail_eleven ? `<span>✉️ ${h(x.mail_eleven)}</span>` : ''}${x.estado_neg ? `<span>${h(x.estado_neg)}</span>` : ''}${x.precio !== null && x.precio !== undefined ? `<span>${h(x.moneda)} ${fmtH(x.precio)}</span>` : ''}</div></div>
        <div class="side"><select data-act="lbestado" data-id="${x.id}">${opts(ESTADOS_LB, x.estado)}</select>${x.deadline ? `<span class="pill ${!PUBLICADOS.has(x.estado) && x.deadline < t ? 'bad' : x.deadline === t ? 'warn' : 'gray'}">${fmtD(x.deadline)}</span>` : ''}</div></div>`;
    }).join('') || '<div class="empty">No hay tareas con estos filtros.</div>'}</div></div>`;
}
function lbForm(x = {}) {
  const ps = projs('LIN'), p = x.project || S.f.lbProj || ps[0]?.code;
  return `<div class="sheet"><h2>${x.id ? 'Tarea de link building' : 'Nueva tarea de link building'}</h2><form id="lbf" data-id="${h(x.id || '')}">
    <div class="fields three">
      <label>Proyecto<select name="project">${opts(ps.map((q) => q.code), p)}</select></label>
      <label>Código en AppSheet<input name="as_code" placeholder="TEL-LIN-2-169" value="${h(x.as_code)}"></label>
      <label>Estado<select name="estado">${opts(ESTADOS_LB, x.estado || 'No Iniciado')}</select></label>
      <label>Deadline<input type="date" name="deadline" value="${h(x.deadline)}"></label>
      <label>Tipo de servicio<select name="tipo_servicio">${opts(TIPOS_SERVICIO, x.tipo_servicio)}</select></label>
      <label>Negociación<select name="estado_neg">${opts(ESTADOS_NEG, x.estado_neg)}</select></label>
      <label class="full">Anchor text<input name="anchor" value="${h(x.anchor)}"></label>
      <label class="full">URL del cliente<input name="url_cliente" type="url" value="${h(x.url_cliente)}"></label>
      <label>Medio (dominio)<input name="medio" placeholder="diario.com.ar" value="${h(x.medio)}"></label>
      <label>DR<input name="dr" type="number" step="any" value="${h(x.dr)}"></label>
      <label>Tráfico orgánico<input name="trafico" type="number" step="1" value="${h(x.trafico)}"></label>
      <label>Precio<input name="precio" type="number" step="any" value="${h(x.precio)}"></label>
      <label>Moneda<select name="moneda">${opts(MONEDAS, x.moneda || 'USD')}</select></label>
      <label>Mail desde el que contacté<input name="mail_eleven" type="email" list="mails" placeholder="vos@eleven-agencia.net" value="${h(x.mail_eleven)}"></label>
      <label class="full">Contacto del medio (mail, nombre o proveedor)<input name="contacto_medio" value="${h(x.contacto_medio)}"></label>
      <label class="full">Notas<textarea name="notas">${h(x.notas)}</textarea></label>
    </div><datalist id="mails">${[...new Set(S.data.lb.map((t) => t.mail_eleven).filter(Boolean))].map((m) => `<option value="${h(m)}">`).join('')}</datalist>
    <div id="lbav"></div><div class="err" id="ferr"></div>
    <div class="actions">${x.id ? '<button type="button" class="btn danger left" data-act="dellb">Borrar</button>' : ''}<button type="button" class="btn ghost" data-act="close">Cancelar</button><button class="btn">Guardar</button></div></form></div>`;
}
function lbAvisosVivos() {
  const f = $('#lbf'); if (!f) return;
  const x = Object.fromEntries(new FormData(f)); x.id = f.dataset.id;
  const a = avisosLB(x, proj(x.project), S.data.lb);
  $('#lbav').innerHTML = a.length && !PUBLICADOS.has(x.estado) ? `<div class="warnbox">${a.map((s) => `<div>⚠️ ${h(s)}</div>`).join('')}</div>` : '';
}

// ---------- Redacciones ----------
function vRED() {
  const f = S.f, q = f.redQ.trim().toLowerCase(), t = hoy();
  let arr = S.data.red.filter((r) => (!f.redProj || r.project === f.redProj) && (f.redEstado === 'todas' || (f.redEstado === 'activas' ? r.estado !== 'Entregada' : r.estado === f.redEstado)));
  if (q) arr = arr.filter((r) => [r.tema, r.subproyecto, r.notas].join(' ').toLowerCase().includes(q));
  const pendAS = new Set(S.data.as_pend.filter((a) => a.entity === 'red').map((a) => a.ref));
  return `<div class="card"><div class="toolbar">
      <select data-f="redProj"><option value="">Todos los proyectos</option>${opts(projs('RED').map((p) => p.code), f.redProj)}</select>
      <select data-f="redEstado">${opts(['activas', 'todas', ...ESTADOS_RED], f.redEstado, ['Activas', 'Todas', ...ESTADOS_RED])}</select>
      <input type="search" data-f="redQ" placeholder="Buscar tema…" value="${h(f.redQ)}"><button class="btn" data-act="newred">+ Nueva redacción</button></div>
    <div class="list">${arr.map((r) => `<div class="item" data-act="open" data-kind="red" data-id="${r.id}"><div><div class="main">${h(r.tema)}</div>
        <div class="meta"><span>${h(r.project)}</span>${r.subproyecto ? `<span>${h(r.subproyecto)}</span>` : ''}<span>${r.ia ? '🤖 IA' : '✋ Manual'}</span>${r.prioridad !== 'Normal' ? `<span>Prioridad ${h(r.prioridad)}</span>` : ''}${pendAS.has(r.id) ? '<span class="pill">Falta en AppSheet</span>' : ''}</div></div>
        <div class="side"><select data-act="redestado" data-id="${r.id}">${opts(ESTADOS_RED, r.estado)}</select>${r.fecha_entrega ? `<span class="pill ${r.estado !== 'Entregada' && r.fecha_entrega < t ? 'bad' : r.fecha_entrega === t ? 'warn' : 'gray'}">${fmtD(r.fecha_entrega)}</span>` : ''}</div></div>`).join('') || '<div class="empty">No hay redacciones con estos filtros.</div>'}</div></div>`;
}
function redForm(r = {}) {
  const ps = projs('RED');
  return `<div class="sheet"><h2>${r.id ? 'Redacción' : 'Nueva redacción'}</h2><p class="mute small" style="margin:0 0 10px">Mismos campos que pide AppSheet en Carga de Redacciones.</p><form id="redf" data-id="${h(r.id || '')}">
    <div class="fields">
      <label class="full">Tema *<input name="tema" required value="${h(r.tema)}"></label>
      <label>Proyecto<select name="project">${opts(ps.map((q) => q.code), r.project || S.f.redProj || ps[0]?.code)}</select></label>
      <label>Subproyecto (opcional)<input name="subproyecto" value="${h(r.subproyecto)}"></label>
      <label>Idioma<input name="idioma" value="${h(r.idioma || 'Español')}"></label>
      <label>País<input name="pais" value="${h(r.pais || 'Argentina')}"></label>
      <label>Fecha de entrega<input type="date" name="fecha_entrega" value="${h(r.fecha_entrega || hoy())}"></label>
      <label>Prioridad<select name="prioridad">${opts(PRIORIDADES, r.prioridad || 'Normal')}</select></label>
      <label>Redacción IA<select name="ia">${opts(['1', '0'], r.ia === 0 ? '0' : '1', ['Sí', 'No'])}</select></label>
      <label>Estado<select name="estado">${opts(ESTADOS_RED, r.estado || 'Pendiente')}</select></label>
      <label class="full">Notas<textarea name="notas">${h(r.notas)}</textarea></label>
    </div><div class="err" id="ferr"></div>
    <div class="actions">${r.id ? '<button type="button" class="btn danger left" data-act="delred">Borrar</button>' : ''}<button type="button" class="btn ghost" data-act="close">Cancelar</button><button class="btn">Guardar</button></div></form></div>`;
}

// ---------- Medios (ordenados por mail, sin importar el proyecto) ----------
function vMedios() {
  const f = S.f, q = f.medQ.trim().toLowerCase(), key = { mail_eleven: (t) => t.mail_eleven, contacto_medio: (t) => t.contacto_medio, medio: (t) => normDomain(t.medio) }[f.medGroup];
  const groups = new Map();
  for (const t of S.data.lb) {
    if (q && ![t.mail_eleven, t.contacto_medio, t.medio, t.anchor, t.as_code].join(' ').toLowerCase().includes(q)) continue;
    const k = key(t) || '(sin dato)'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === '(sin dato)') - (b === '(sin dato)') || a.localeCompare(b));
  return `<div class="card"><div class="toolbar"><select data-f="medGroup">${opts(['mail_eleven', 'contacto_medio', 'medio'], f.medGroup, ['Agrupar por mail desde el que contacté', 'Agrupar por contacto del medio', 'Agrupar por medio'])}</select>
    <input type="search" data-f="medQ" placeholder="Buscar mail, medio, anchor…" value="${h(f.medQ)}"></div>
    ${keys.map((k) => { const arr = groups.get(k), ps = [...new Set(arr.map((t) => t.project))];
      return `<div class="group"><div class="gh"><span class="grow">${h(k)}</span><span class="pill gray">${arr.length} · ${h(ps.join(', '))}</span>${k.includes('@') ? `<button class="btn sm ghost" data-act="copy" data-v="${h(k)}">Copiar</button>` : ''}</div>
        ${arr.map((t) => `<div class="item" data-act="open" data-kind="lb" data-id="${t.id}"><div><div class="main">${h(normDomain(t.medio) || '(sin medio)')} <span class="mute small">· ${h(t.project)}</span></div><div class="meta">${t.as_code ? `<span>${h(t.as_code)}</span>` : ''}<span>${h(t.anchor)}</span>${f.medGroup !== 'mail_eleven' && t.mail_eleven ? `<span>✉️ ${h(t.mail_eleven)}</span>` : ''}${f.medGroup !== 'contacto_medio' && t.contacto_medio ? `<span>👤 ${h(t.contacto_medio)}</span>` : ''}</div></div>
          <div class="side"><span class="pill ${PUBLICADOS.has(t.estado) ? 'ok' : ''}">${h(t.estado)}</span>${t.estado_neg ? `<span class="small mute">${h(t.estado_neg)}</span>` : ''}</div></div>`).join('')}</div>`; }).join('') || '<div class="empty">Todavía no hay medios cargados.</div>'}</div>`;
}

// ---------- Horas ----------
function vHoras() {
  const mes = S.f.mes, plan = S.data.plan.filter((p) => p.month === mes), hrs = S.data.hours.filter((x) => x.date.startsWith(mes));
  const filas = new Map();
  for (const p of plan) filas.set(p.project + '|' + p.task_type, { project: p.project, task_type: p.task_type, ph: p.hours, pu: p.units, rh: 0 });
  for (const x of hrs) { const k = x.project + '|' + x.task_type; if (!filas.has(k)) filas.set(k, { project: x.project, task_type: x.task_type, ph: 0, pu: 0, rh: 0 }); filas.get(k).rh += x.hours; }
  const porProj = new Map(); for (const r of filas.values()) { if (!porProj.has(r.project)) porProj.set(r.project, []); porProj.get(r.project).push(r); }
  const hechas = (code) => { const p = proj(code); if (!p) return 0; return p.tipo === 'LIN' ? S.data.lb.filter((t) => t.project === code && t.publicado && t.publicado.startsWith(mes)).length : S.data.red.filter((r) => r.project === code && r.entregada && r.entregada.startsWith(mes)).length; };
  const bar = (r, p) => `<div class="bar"><i class="${p > 0 && r > p ? 'over' : ''}" style="width:${p > 0 ? Math.min(100, (r / p) * 100) : r > 0 ? 100 : 0}%"></i></div>`;
  let totPh = 0, totRh = 0, body = '';
  for (const p of S.data.projects) {
    const rows = porProj.get(p.code); if (!rows) continue;
    const ph = rows.reduce((a, r) => a + r.ph, 0), rh = rows.reduce((a, r) => a + r.rh, 0), pu = rows.reduce((a, r) => a + r.pu, 0); totPh += ph; totRh += rh;
    body += `<tr class="sub"><td>${h(p.code)} <span class="mute small">${h(p.cliente)}</span></td><td></td><td class="num">${fmtH(ph)}</td><td class="num">${fmtH(rh)}</td><td>${bar(rh, ph)}</td><td class="num">${hechas(p.code)} / ${pu}</td></tr>`;
    body += rows.map((r) => `<tr><td></td><td>${h(r.task_type)}</td><td class="num">${fmtH(r.ph)}</td><td class="num">${fmtH(r.rh)}</td><td>${bar(r.rh, r.ph)}</td><td class="num mute">${r.pu || ''}</td></tr>`).join('');
  }
  return `<div class="card"><div class="toolbar"><input type="month" data-f="mes" value="${h(mes)}" style="width:auto"><span class="grow"></span><button class="btn ghost" data-act="editplan">Editar plan del mes</button><button class="btn" data-act="newhours">+ Cargar horas</button></div>
    <div class="row wrap" style="gap:24px;margin-bottom:8px"><div class="stat"><span class="mute small">Planificadas</span><span class="big">${fmtH(totPh)} h</span></div><div class="stat"><span class="mute small">Cargadas</span><span class="big">${fmtH(totRh)} h</span></div><div class="stat"><span class="mute small">Avance</span><span class="big">${totPh ? Math.round((totRh / totPh) * 100) : 0}%</span></div></div>
    <div class="tscroll"><table><thead><tr><th>Proyecto</th><th>Tarea</th><th class="num">Plan h</th><th class="num">Real h</th><th></th><th class="num">Hechas / plan u.</th></tr></thead><tbody>${body || '<tr><td colspan="6" class="empty">Sin plan ni horas este mes.</td></tr>'}</tbody></table></div>
    <p class="mute small">Unidades hechas: links pasados a Publicado o Cerrado y redacciones Entregadas en el mes.</p></div>
    <div class="card"><h2>Registro del mes</h2><div class="list">${hrs.map(hourItem).join('') || '<div class="empty">Sin horas cargadas.</div>'}</div></div>`;
}
function hoursForm(x = {}) {
  const ps = projs(), p = x.project || ps[0]?.code;
  return `<div class="sheet"><h2>${x.id ? 'Editar horas' : 'Cargar horas'}</h2><form id="hrf" data-id="${h(x.id || '')}"><div class="fields">
    <label>Fecha<input type="date" name="date" value="${h(x.date || hoy())}"></label><label>Horas<input type="number" name="hours" step="0.25" min="0.25" max="24" required value="${h(x.hours)}"></label>
    <label>Proyecto<select name="project" data-act="hrproj">${opts(ps.map((q) => q.code), p)}</select></label><label>Tarea<select name="task_type">${opts(TAREAS[proj(p)?.tipo || 'LIN'], x.task_type)}</select></label>
    <label class="full">Nota<input name="note" value="${h(x.note)}"></label></div><div class="err" id="ferr"></div>
    <div class="actions">${x.id ? '<button type="button" class="btn danger left" data-act="delhours">Borrar</button>' : ''}<button type="button" class="btn ghost" data-act="close">Cancelar</button><button class="btn">Guardar</button></div></form></div>`;
}
function planForm() {
  const mes = S.f.mes, plan = S.data.plan.filter((p) => p.month === mes), get = (c, t) => plan.find((p) => p.project === c && p.task_type === t) || {};
  const rows = projs().flatMap((p) => TAREAS[p.tipo].map((t) => ({ c: p.code, t, ...get(p.code, t) })));
  return `<div class="sheet"><h2>Plan de ${h(mes)}</h2><form id="planf"><div class="tscroll"><table><thead><tr><th>Proyecto</th><th>Tarea</th><th class="num">Horas</th><th class="num">Unidades</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td>${h(r.c)}</td><td>${h(r.t)}<input type="hidden" name="p${i}" value="${h(r.c)}|${h(r.t)}"></td><td><input type="number" step="0.01" min="0" name="h${i}" value="${r.hours || ''}" style="width:90px"></td><td><input type="number" step="1" min="0" name="u${i}" value="${r.units || ''}" style="width:80px"></td></tr>`).join('')}
    </tbody></table></div><div class="err" id="ferr"></div><div class="actions"><button type="button" class="btn ghost" data-act="close">Cancelar</button><button class="btn">Guardar plan</button></div></form></div>`;
}

// ---------- Ajustes ----------
function vAjustes() {
  const st = S.data.settings, pend = S.data.as_pend;
  return `<div class="grid two"><div>
    <div class="card"><h2>🔁 Cambios para reflejar en AppSheet (${pend.length})</h2>
      <p class="mute small" style="margin-top:0">Cada cambio que hacés acá queda anotado. Cuando esté en AppSheet, marcalo como hecho.</p>
      ${pend.length ? `<div class="list">${pend.map((a) => `<label class="item" style="grid-template-columns:auto 1fr;cursor:default"><input type="checkbox" class="asck" value="${a.id}"><div><div class="main" style="color:var(--ink)">${h(a.label)}</div><div class="meta">${h(a.change)} · ${new Date(a.at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</div></div></label>`).join('')}</div>
      <div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="asall">Marcar todos</button><button class="btn sm" data-act="asdone">Marcar seleccionados como hechos</button></div>` : '<div class="empty">Nada pendiente.</div>'}</div>
    <div class="card"><h2>📁 Proyectos y parámetros</h2><p class="mute small" style="margin-top:0">Los topes que valida AppSheet. Si un campo queda vacío, no se controla.</p><form id="projf"><div class="tscroll"><table><thead><tr><th>Activo</th><th>Proyecto</th><th>Cliente</th><th class="num">DR mín.</th><th class="num">Tráfico mín.</th><th class="num">USD máx.</th><th class="num">Repetir medio (días)</th></tr></thead><tbody>
      ${S.data.projects.map((p) => `<tr data-code="${h(p.code)}"><td><input type="checkbox" name="active" ${p.active ? 'checked' : ''}></td><td>${h(p.code)}</td><td><input name="cliente" value="${h(p.cliente)}" style="width:130px"></td>${p.tipo === 'LIN' ? ['drMin', 'trafMin', 'precioMaxUSD', 'repDias'].map((k) => `<td><input type="number" step="any" name="${k}" value="${h(p.params[k] ?? '')}" style="width:80px"></td>`).join('') : '<td colspan="4" class="mute small">Redacción</td>'}</tr>`).join('')}
      </tbody></table></div><button class="btn sm" style="margin-top:8px">Guardar proyectos</button></form></div>
  </div><div>
    <div class="card"><h2>📅 Google Calendar</h2><p class="mute small" style="margin-top:0">Tus deadlines (tareas de LB y redacciones sin terminar) como calendario. Google lo actualiza solo, pero puede tardar varias horas.</p>
      <code class="url" id="calurl">${h(S.calurl || 'Cargando…')}</code>
      <ol class="steps small"><li>Copiá el link.</li><li>En Google Calendar (compu): <b>Otros calendarios → + → Desde URL</b>.</li><li>Pegalo y tocá <b>Agregar calendario</b>.</li></ol>
      <div class="row"><button class="btn sm" data-act="copycal">Copiar link</button><button class="btn sm ghost" data-act="resetcal">Generar link nuevo</button></div></div>
    <div class="card"><h2>🔔 Avisos</h2><label class="row" style="color:var(--ink);font-weight:400"><input type="checkbox" id="avisos" ${st.avisos === '1' ? 'checked' : ''}> Avisos activados</label>
      <div class="fields" style="margin-top:8px"><label>Resumen de deadlines a las<select id="aviso_hora">${opts([...Array(15)].map((_, i) => String(i + 7)), st.aviso_hora, [...Array(15)].map((_, i) => `${i + 7}:00`))}</select></label>
      <label>Si no cargaste horas, avisar a las<select id="horas_hora">${opts([...Array(8)].map((_, i) => String(i + 15)), st.horas_hora, [...Array(8)].map((_, i) => `${i + 15}:00`))}</select></label></div>
      <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="saveavisos">Guardar</button><button class="btn sm ghost" data-act="push">Activar en este dispositivo</button><button class="btn sm ghost" data-act="pushtest">Probar</button></div>
      <p class="mute small" id="pushmsg">En iPhone, primero agregá la app a la pantalla de inicio (Compartir → Agregar a inicio) y activalos desde ahí.</p></div>
    <div class="card"><h2>Cuenta</h2><div class="row wrap"><button class="btn sm ghost" data-act="export">Descargar mis datos (JSON)</button><button class="btn sm ghost" data-act="logout">Cerrar sesión</button></div></div>
  </div></div>`;
}

// ---------- modales ----------
function openModal(html) { $('#modal').innerHTML = html; lbAvisosVivos(); const first = $('#modal input:not([type=hidden]), #modal select'); if (first && matchMedia('(min-width:700px)').matches) first.focus(); }
function closeModal() { $('#modal').innerHTML = ''; }
const formData = (f) => Object.fromEntries(new FormData(f));
async function guardar(fn) { const e = $('#ferr'); try { if (e) e.textContent = ''; await fn(); closeModal(); await load(); } catch (err) { if (e) e.textContent = err.message; else hint(err.message); } }

// ---------- eventos ----------
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el) { if (ev.target.id === 'modal') closeModal(); return; }
  const act = el.dataset.act; if (el.tagName === 'SELECT') return;
  const byId = (arr) => S.data[arr].find((x) => x.id === el.dataset.id);
  switch (act) {
    case 'tab': S.tab = el.dataset.v; localStorage.setItem('pe_tab', S.tab); if (S.tab === 'ajustes') loadCal(); render(); scrollTo(0, 0); break;
    case 'open': if (ev.target.closest('select')) return; openModal(el.dataset.kind === 'lb' ? lbForm(byId('lb')) : redForm(byId('red'))); break;
    case 'newlb': openModal(lbForm()); break;
    case 'newred': openModal(redForm()); break;
    case 'newhours': openModal(hoursForm()); break;
    case 'edithours': openModal(hoursForm(byId('hours'))); break;
    case 'editplan': openModal(planForm()); break;
    case 'close': closeModal(); break;
    case 'dellb': case 'delred': case 'delhours': {
      const f = el.closest('form'), what = { dellb: 'lb', delred: 'red', delhours: 'hours' }[act];
      if (confirm('¿Borrar? No se puede deshacer.')) guardar(() => api(`/api/${what}/${f.dataset.id}`, 'DELETE')); break;
    }
    case 'tstart': { const p = $('#tproj').value, t = $('#ttype').value; try { await setTimer({ project: p, task_type: t, start: Date.now() }); render(); } catch (e) { hint(e.message); } break; }
    case 'tstop': {
      const tm = timer(), hrs = Math.round(((Date.now() - tm.start) / 3600000) * 100) / 100;
      if (hrs < 0.01) { await setTimer(null); render(); break; }
      try { await api('/api/hours', 'POST', { project: tm.project, task_type: tm.task_type, hours: Math.min(hrs, 24), date: hoy(), note: 'Cronómetro' }); await setTimer(null); hint(`Guardadas ${fmtH(hrs)} h`); await load(); } catch (e) { hint(e.message); }
      break;
    }
    case 'tdiscard': if (confirm('¿Descartar el tiempo del cronómetro?')) { await setTimer(null); render(); } break;
    case 'copy': navigator.clipboard?.writeText(el.dataset.v).then(() => hint('Copiado')); break;
    case 'copycal': navigator.clipboard?.writeText(S.calurl || '').then(() => hint('Link copiado')); break;
    case 'resetcal': if (confirm('El link anterior deja de funcionar y vas a tener que volver a agregarlo en Google Calendar. ¿Seguir?')) { S.calurl = (await api('/api/calendar/reset', 'POST')).url; render(); } break;
    case 'asall': document.querySelectorAll('.asck').forEach((c) => { c.checked = true; }); break;
    case 'asdone': { const ids = [...document.querySelectorAll('.asck:checked')].map((c) => Number(c.value)); if (!ids.length) return hint('Elegí al menos uno'); await api('/api/as/done', 'POST', { ids }); await load(); break; }
    case 'saveavisos': await api('/api/settings', 'POST', { avisos: $('#avisos').checked ? '1' : '0', aviso_hora: $('#aviso_hora').value, horas_hora: $('#horas_hora').value }); hint('Guardado'); await load(); break;
    case 'push': enablePush(); break;
    case 'pushtest': { const r = await api('/api/push/test', 'POST'); $('#pushmsg').textContent = r.delivered ? 'Aviso enviado ✔' : 'No hay dispositivos con avisos activados.'; break; }
    case 'export': { const d = await api('/api/export'), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = `proyectos-eleven-${hoy()}.json`; a.click(); break; }
    case 'logout': await api('/api/logout', 'POST').catch(() => {}); S.token = ''; localStorage.removeItem('pe_token'); render(); break;
  }
});
document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.f) { S.f[el.dataset.f] = el.value; render(); return; }
  if (el.dataset.act === 'lbestado' || el.dataset.act === 'redestado') {
    const kind = el.dataset.act === 'lbestado' ? 'lb' : 'red', x = S.data[kind].find((o) => o.id === el.dataset.id);
    try { await api('/api/' + kind, 'POST', { ...x, estado: el.value }); hint('Estado actualizado · anotado para AppSheet'); await load(); } catch (e) { hint(e.message); el.value = x.estado; }
    return;
  }
  if (el.dataset.act === 'tproj') { S.tproj = el.value; $('#ttype').innerHTML = opts(TAREAS[proj(el.value).tipo]); return; }
  if (el.dataset.act === 'hrproj') { el.form.task_type.innerHTML = opts(TAREAS[proj(el.value).tipo]); return; }
  if (el.closest('#lbf')) lbAvisosVivos();
});
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.f && el.type === 'search') { S.f[el.dataset.f] = el.value; clearTimeout(S.qt); S.qt = setTimeout(() => { const pos = el.selectionStart; render(); const n = document.querySelector(`[data-f="${el.dataset.f}"]`); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250); return; }
  if (el.closest('#lbf')) lbAvisosVivos();
});
document.addEventListener('submit', async (ev) => {
  ev.preventDefault(); const f = ev.target;
  if (f.id === 'loginf') {
    try { const r = await api(S.setup ? '/api/setup' : '/api/login', 'POST', { password: f.pw.value }); S.token = r.token; localStorage.setItem('pe_token', r.token); S.setup = false; await load(); }
    catch (e) { $('#lerr').textContent = e.message; }
    return;
  }
  if (f.id === 'lbf') return guardar(() => api('/api/lb', 'POST', { ...formData(f), id: f.dataset.id || undefined }));
  if (f.id === 'redf') return guardar(() => { const d = formData(f); return api('/api/red', 'POST', { ...d, ia: d.ia === '1', id: f.dataset.id || undefined }); });
  if (f.id === 'hrf') return guardar(() => api('/api/hours', 'POST', { ...formData(f), id: f.dataset.id || undefined }));
  if (f.id === 'planf') {
    const d = formData(f), rows = Object.keys(d).filter((k) => k.startsWith('p')).map((k) => { const i = k.slice(1), [project, task_type] = d[k].split('|'); return { project, task_type, hours: d['h' + i], units: d['u' + i] }; });
    return guardar(() => api('/api/plan', 'POST', { month: S.f.mes, rows }));
  }
  if (f.id === 'projf') {
    const projects = [...f.querySelectorAll('tr[data-code]')].map((tr) => { const g = (n) => tr.querySelector(`[name=${n}]`); return { code: tr.dataset.code, cliente: g('cliente').value, active: g('active').checked, params: g('drMin') ? { drMin: g('drMin').value, trafMin: g('trafMin').value, precioMaxUSD: g('precioMaxUSD').value, repDias: g('repDias').value } : {} }; });
    try { await api('/api/projects', 'POST', { projects }); hint('Proyectos guardados'); await load(); } catch (e) { hint(e.message); }
  }
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('#modal').innerHTML) closeModal(); });

async function loadCal() { try { S.calurl = (await api('/api/calendar')).url; const el = $('#calurl'); if (el) el.textContent = S.calurl; } catch { /* sin conexión */ } }

// ---------- notificaciones ----------
function b64uToBytes(s) { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); }
async function enablePush() {
  const msg = (t) => { const el = $('#pushmsg'); if (el) el.textContent = t; };
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return msg('Este navegador no soporta avisos. En iPhone, agregá la app a la pantalla de inicio y abrila desde ahí.');
    if ((await Notification.requestPermission()) !== 'granted') return msg('Permiso denegado. Activalo en los ajustes del navegador o del teléfono.');
    const reg = await navigator.serviceWorker.ready, { publicKey } = await api('/api/vapid');
    const s = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(publicKey) }));
    await api('/api/push/subscribe', 'POST', s.toJSON()); msg('Avisos activados en este dispositivo ✔');
  } catch (e) { msg('No se pudo activar: ' + e.message); }
}

// ---------- arranque ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
(async () => {
  if (S.token) { try { S.data = JSON.parse(localStorage.getItem('pe_cache') || 'null'); } catch { /* nada */ } render(); if (S.tab === 'ajustes') loadCal(); return load(); }
  try { S.setup = (await api('/api/state')).setup; } catch { /* sin conexión */ }
  render();
})();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.token) load(); });
