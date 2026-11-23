/* Proyectos Eleven — servidor (Cloudflare Worker + D1). Un solo usuario (Martín).
 * Todo /api/* (salvo estado, alta inicial e ingreso) exige Authorization: Bearer <token de sesión>.
 * El calendario se publica en /cal/<token>.ics para suscribirse desde Google Calendar. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SCHEMA, MIGRATIONS, REBUILD } from './schema.ts';
import { PROMPTS_INICIALES, PROMPTS_VERSION } from './prompts.ts';
import { PROYECTOS_INICIALES, PLAN_INICIAL, SEED_VERSION, TIPOS_SERVICIO, ESTADOS_NEG, PRIORIDADES, MONEDAS, PUBLICADOS, TAREAS, YO, hoyEn, addDays, tipoHoras, QUIEN, DOC_EDITABLE_LB } from '../public/shared.js';

/** Usuario de la sesión (cada uno ve solo lo suyo). */
export interface User { id: string; nombre: string; email: string; admin: number; modo?: string; alcance?: string }
export interface Env { DB: any; ASSETS?: any; U?: User }
const uidOf = (env: Env) => { if (!env.U) throw Object.assign(new Error('Sin usuario'), { status: 401 }); return env.U.id; };
const yoOf = (env: Env) => env.U?.nombre || YO;
/** Id interno de una tarea copiada de AppSheet: el código; para usuarios nuevos, con prefijo (dos personas pueden ver la misma tarea). */
const idTarea = (env: Env, code: string) => (uidOf(env) === 'u1' ? code : `${uidOf(env)}_${code}`);
const TZ = 'America/Argentina/Buenos_Aires';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (msg: string, status = 400) => json({ error: msg }, status);
const enc = (s: string) => new TextEncoder().encode(s);
const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const unb64u = (s: string) => { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const sha256hex = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const newId = () => b64u(rand(9));
const sameStr = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const isDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const isMonth = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}$/.test(d);
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : v === null || v === undefined ? '' : String(v).slice(0, max));
const numOrNull = (v: unknown) => (v === '' || v === null || v === undefined || !isFinite(Number(v)) ? null : Number(v));
const oneOf = <T extends string>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def);

// ---------- esquema y datos iniciales ----------
const ready = new WeakSet<object>();
export async function ensureSchema(env: Env) {
  if (ready.has(env.DB)) return;
  for (const s of SCHEMA) await env.DB.prepare(s).run();
  for (const s of MIGRATIONS) await env.DB.prepare(s).run().catch(() => undefined);
  // varios usuarios: tablas con clave por usuario (una vez)
  for (const [t, d] of Object.entries(REBUILD)) {
    const cols = ((await env.DB.prepare(`PRAGMA table_info(${t})`).all()).results as any[]).map(c => c.name);
    if (cols.includes('uid')) continue;
    await env.DB.prepare(`DROP TABLE IF EXISTS ${t}_n`).run();
    await env.DB.prepare(d.create).run();
    await env.DB.prepare(`INSERT INTO ${t}_n (uid, ${d.cols}) SELECT 'u1', ${d.cols} FROM ${t}`).run();
    await env.DB.prepare(`DROP TABLE ${t}`).run();
    await env.DB.prepare(`ALTER TABLE ${t}_n RENAME TO ${t}`).run();
  }
  // la cuenta única de antes pasa a ser el usuario u1 (admin)
  const oldPw = await env.DB.prepare("SELECT value FROM settings WHERE key = 'pw'").first();
  if (oldPw && !(await env.DB.prepare('SELECT 1 AS x FROM users LIMIT 1').first())) {
    await env.DB.prepare("INSERT INTO users (id, nombre, email, pw, admin, created_at) VALUES ('u1', ?, 'martin.botana@agenciaeleven.com', ?, 1, ?)").bind(YO, oldPw.value, Date.now()).run();
    for (const k of USER_KEYS) await env.DB.prepare("UPDATE settings SET key = 'u1:' || key WHERE key = ?").bind(k).run();
    await env.DB.prepare("DELETE FROM settings WHERE key = 'pw'").run();
  }
  // Datos iniciales y actualizaciones: suma proyectos y filas de plan nuevas sin pisar lo que ya editaste.
  const v = Number((await env.DB.prepare("SELECT value FROM settings WHERE key = 'seed_v'").first())?.value ?? 0);
  if (v < SEED_VERSION) {
    let i = 0;
    for (const p of PROYECTOS_INICIALES) {
      const old = await env.DB.prepare("SELECT params FROM projects WHERE uid = 'u1' AND code = ?").bind(p.code).first();
      if (!old) await env.DB.prepare("INSERT INTO projects (uid, code, cliente, tipo, active, params, orden) VALUES ('u1', ?, ?, ?, 1, ?, ?)").bind(p.code, p.cliente, p.tipo, JSON.stringify(p.params), i).run();
      else {
        const cur = JSON.parse((old.params as string) || '{}');
        const merged: Record<string, unknown> = { ...p.params };
        for (const [k, val] of Object.entries(cur)) if (val !== null && val !== '' && val !== undefined) merged[k] = val;
        await env.DB.prepare("UPDATE projects SET params = ?, orden = ? WHERE uid = 'u1' AND code = ?").bind(JSON.stringify(merged), i, p.code).run();
      }
      i++;
    }
    for (const [project, task_type, hours, units] of PLAN_INICIAL.rows)
      await env.DB.prepare("INSERT OR IGNORE INTO plan (uid, month, project, task_type, hours, units) VALUES ('u1', ?, ?, ?, ?, ?)").bind(PLAN_INICIAL.month, project, task_type, hours, units).run();
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('seed_v', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(SEED_VERSION)).run();
  }
  const pv = Number((await env.DB.prepare("SELECT value FROM settings WHERE key = 'prompts_v'").first())?.value ?? 0);
  if (pv < PROMPTS_VERSION) {
    for (const [project, clave, texto] of PROMPTS_INICIALES) await env.DB.prepare("INSERT INTO prompts (uid, project, clave, texto, updated_at) VALUES ('u1', ?, ?, ?, ?) ON CONFLICT(uid, project, clave) DO UPDATE SET texto = CASE WHEN prompts.texto = '' THEN excluded.texto ELSE prompts.texto END").bind(project, clave, texto, Date.now()).run();
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('prompts_v', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(PROMPTS_VERSION)).run();
  }
  ready.add(env.DB);
}
/** Ajustes de cada usuario (se guardan como "<uid>:<clave>"); el resto es global. */
const USER_KEYS = new Set(['cal_token', 'timer', 'avisos', 'aviso_hora', 'horas_hora', 'as_sync_at', 'dias_quieta', 'gemini_key', 'gemini_model_texto', 'gemini_model_imagen', 'gas_url', 'gas_secret', 'last_notification', 'import_key', 'conectar_tok', 'conectar_exp', 'conectado_at']);
const skey = (env: Env, key: string) => (USER_KEYS.has(key) ? `${uidOf(env)}:${key}` : key);
async function getS(env: Env, key: string): Promise<string | null> {
  const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(skey(env, key)).first();
  return r ? (r.value as string) : null;
}
async function putS(env: Env, key: string, value: string) {
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(skey(env, key), value).run();
}
/** Usuario dueño de un ajuste con ese valor (calendario, clave de importación). */
/** Link de la app de AppSheet (solo www.appsheet.com/start/…). */
export function linkAppSheet(v: unknown) { const m = String(v ?? '').trim().match(/^https:\/\/www\.appsheet\.com\/start\/[\w-]{8,80}/); return m ? m[0] : ''; }
async function userBySetting(env: Env, key: string, value: string): Promise<User | null> {
  if (!value || value.length < 20) return null;
  const r: any = await env.DB.prepare("SELECT key FROM settings WHERE key LIKE ? AND value = ?").bind('%:' + key, value).first();
  return r ? userById(env, String(r.key).split(':')[0]) : null;
}
async function userById(env: Env, id: string): Promise<User | null> {
  const u: any = await env.DB.prepare('SELECT id, nombre, email, admin, modo, alcance FROM users WHERE id = ?').bind(id).first();
  return u ? { id: u.id, nombre: u.nombre, email: u.email, admin: Number(u.admin), modo: u.modo || 'tecnico', alcance: u.alcance || 'propio' } : null;
}
export const conUsuario = (env: Env, U: User): Env => ({ ...env, U });
const PUBLIC_SETTINGS: Record<string, string> = { aviso_hora: '9', horas_hora: '18', avisos: '1', timer: '', as_sync_at: '', dias_quieta: '14', gemini_model_texto: '', gemini_model_imagen: '', gas_url: '', medios_at: '', conectado_at: '', as_url: '', reporte_at: '' };

// ---------- acceso (una sola cuenta: contraseña) ----------
const PBKDF2_IT = 100000;
async function pbkdf2(pw: string, salt: Uint8Array, it: number) {
  const k = await crypto.subtle.importKey('raw', enc(pw), 'PBKDF2', false, ['deriveBits']);
  return b64u(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: it }, k, 256));
}
export async function hashPw(pw: string) { const salt = rand(16); return `pbkdf2$${PBKDF2_IT}$${b64u(salt)}$${await pbkdf2(pw, salt, PBKDF2_IT)}`; }
export async function verifyPw(pw: string, stored: string) {
  const [alg, it, salt, h] = stored.split('$'); if (alg !== 'pbkdf2' || !salt || !h) return false;
  return sameStr(await pbkdf2(pw, unb64u(salt), Number(it)), h);
}
async function newSession(env: Env, uid: string) {
  const token = b64u(rand(32)), now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (th, created_at, seen_at, uid) VALUES (?, ?, ?, ?)').bind(await sha256hex(token), now, now, uid).run();
  return token;
}
async function authed(req: Request, env: Env): Promise<User | null> {
  const tok = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (tok.length < 20) return null;
  const th = await sha256hex(tok), r = await env.DB.prepare('SELECT seen_at, uid FROM sessions WHERE th = ?').bind(th).first();
  if (!r) return null;
  const now = Date.now();
  if (now - Number(r.seen_at) > 180 * 864e5) { await env.DB.prepare('DELETE FROM sessions WHERE th = ?').bind(th).run(); return null; }
  if (now - Number(r.seen_at) > 864e5) await env.DB.prepare('UPDATE sessions SET seen_at = ? WHERE th = ?').bind(now, th).run();
  return userById(env, String(r.uid || 'u1'));
}
async function throttled(env: Env) { const v = Number(await getS(env, 'lock_until') ?? 0); return v > Date.now(); }
async function badTry(env: Env) {
  const n = Number(await getS(env, 'fails') ?? 0) + 1;
  if (n >= 8) { await putS(env, 'lock_until', String(Date.now() + 15 * 60000)); await putS(env, 'fails', '0'); } else await putS(env, 'fails', String(n));
}

// ---------- registro de cambios para replicar en AppSheet ----------
async function logAS(env: Env, entity: 'lb' | 'red', ref: string, label: string, change: string) {
  await env.DB.prepare('INSERT INTO as_log (entity, ref, label, change, at, done, uid) VALUES (?, ?, ?, ?, ?, 0, ?)').bind(entity, ref, label, change, Date.now(), uidOf(env)).run();
}

// ---------- tareas de link building ----------
const LB_FIELDS = ['project', 'as_code', 'estado', 'usuario', 'url_publicacion', 'tipo_servicio', 'anchor', 'url_cliente', 'medio', 'dr', 'trafico', 'precio', 'moneda', 'estado_neg', 'mail_eleven', 'contacto_medio', 'deadline', 'notas', 'doc_url'] as const;
const NO_AS = new Set(['notas', 'doc_url']);
function cleanLB(b: any, yo = YO) {
  return {
    project: str(b.project, 40), as_code: str(b.as_code, 40).toUpperCase(), estado: str(b.estado, 80) || 'No Iniciado', usuario: str(b.usuario, 80) || yo, url_publicacion: str(b.url_publicacion, 500),
    tipo_servicio: oneOf(b.tipo_servicio, TIPOS_SERVICIO, 'Intervalo métrica 21-40'), anchor: str(b.anchor, 300), url_cliente: str(b.url_cliente, 500),
    medio: str(b.medio, 200), dr: numOrNull(b.dr), trafico: numOrNull(b.trafico), precio: numOrNull(b.precio), moneda: oneOf(b.moneda, [...MONEDAS, ''], 'USD'),
    estado_neg: str(b.estado_neg, 60), mail_eleven: str(b.mail_eleven, 120).toLowerCase(), contacto_medio: str(b.contacto_medio, 200),
    deadline: isDate(b.deadline) ? b.deadline : '', notas: str(b.notas, 2000), doc_url: str(b.doc_url, 500),
  };
}
async function saveLB(env: Env, b: any) {
  const v = cleanLB(b, yoOf(env)), now = Date.now(), hoy = hoyEn(TZ, now), uid = uidOf(env);
  if (!(await env.DB.prepare("SELECT 1 AS x FROM projects WHERE uid = ? AND code = ? AND tipo = 'LIN'").bind(uid, v.project).first())) throw Object.assign(new Error('Proyecto de link building inválido'), { status: 400 });
  const label = v.as_code || `${v.project} · ${v.anchor || v.medio || 'tarea nueva'}`;
  if (b.id) {
    const old = await env.DB.prepare('SELECT * FROM lb_tasks WHERE id = ? AND uid = ?').bind(b.id, uid).first();
    if (!old) throw Object.assign(new Error('La tarea no existe'), { status: 404 });
    const changes: string[] = [];
    for (const k of LB_FIELDS) if (!NO_AS.has(k) && String(old[k] ?? '') !== String((v as any)[k] ?? '')) changes.push(`${k}: ${old[k] ?? '—'} → ${(v as any)[k] ?? '—'}`);
    const publicado = PUBLICADOS.has(v.estado) ? (old.publicado || hoy) : '';
    await env.DB.prepare(`UPDATE lb_tasks SET ${LB_FIELDS.map(k => `${k} = ?`).join(', ')}, publicado = ?, updated_at = ?, estado_at = ? WHERE id = ? AND uid = ?`)
      .bind(...LB_FIELDS.map(k => (v as any)[k]), publicado, now, old.estado !== v.estado ? now : (old.estado_at ?? now), b.id, uid).run();
    if (changes.length && !old.prueba) await logAS(env, 'lb', b.id, label, changes.join(' · '));
    return b.id as string;
  }
  const id = newId();
  await env.DB.prepare(`INSERT INTO lb_tasks (id, ${LB_FIELDS.join(', ')}, publicado, created_at, updated_at, estado_at, prueba, uid) VALUES (?, ${LB_FIELDS.map(() => '?').join(', ')}, ?, ?, ?, ?, ?, ?)`)
    .bind(id, ...LB_FIELDS.map(k => (v as any)[k]), PUBLICADOS.has(v.estado) ? hoy : '', now, now, now, b.prueba ? 1 : 0, uid).run();
  if (!b.prueba) await logAS(env, 'lb', id, label, `Tarea nueva (${v.estado})`);
  return id;
}

// ---------- redacciones ----------
const RED_FIELDS = ['project', 'as_code', 'tema', 'subproyecto', 'variante', 'idioma', 'pais', 'fecha_entrega', 'deadline_estado', 'prioridad', 'ia', 'estado', 'usuario', 'notas', 'doc_url'] as const;
function cleanRED(b: any, yo = YO) {
  return {
    project: str(b.project, 40), as_code: str(b.as_code, 40).toUpperCase(), tema: str(b.tema, 300), subproyecto: str(b.subproyecto, 120), variante: str(b.variante, 120),
    deadline_estado: isDate(b.deadline_estado) ? b.deadline_estado : '', usuario: str(b.usuario, 80) || yo, idioma: str(b.idioma, 40) || 'Español', pais: str(b.pais, 60) || 'Argentina',
    fecha_entrega: isDate(b.fecha_entrega) ? b.fecha_entrega : '', prioridad: str(b.prioridad, 30) || 'Normal', ia: b.ia ? 1 : 0,
    estado: str(b.estado, 80) || 'Pendiente', notas: str(b.notas, 2000), doc_url: str(b.doc_url, 500),
  };
}
async function saveRED(env: Env, b: any) {
  const v = cleanRED(b, yoOf(env)), now = Date.now(), hoy = hoyEn(TZ, now), uid = uidOf(env);
  if (!v.tema) throw Object.assign(new Error('Falta el tema'), { status: 400 });
  if (!(await env.DB.prepare("SELECT 1 AS x FROM projects WHERE uid = ? AND code = ? AND tipo = 'RED'").bind(uid, v.project).first())) throw Object.assign(new Error('Proyecto de redacción inválido'), { status: 400 });
  if (b.id) {
    const old = await env.DB.prepare('SELECT * FROM redacciones WHERE id = ? AND uid = ?').bind(b.id, uid).first();
    if (!old) throw Object.assign(new Error('La redacción no existe'), { status: 404 });
    const changes: string[] = [];
    for (const k of RED_FIELDS) if (!NO_AS.has(k) && String(old[k] ?? '') !== String((v as any)[k] ?? '')) changes.push(`${k}: ${old[k] ?? '—'} → ${(v as any)[k] ?? '—'}`);
    const entregada = old.entregada || '';
    await env.DB.prepare(`UPDATE redacciones SET ${RED_FIELDS.map(k => `${k} = ?`).join(', ')}, entregada = ?, updated_at = ?, estado_at = ? WHERE id = ? AND uid = ?`)
      .bind(...RED_FIELDS.map(k => (v as any)[k]), entregada, now, old.estado !== v.estado ? now : (old.estado_at ?? now), b.id, uid).run();
    if (changes.length && !old.prueba) await logAS(env, 'red', b.id, `${v.project} · ${v.tema}`, changes.join(' · '));
    return b.id as string;
  }
  const id = newId();
  await env.DB.prepare(`INSERT INTO redacciones (id, ${RED_FIELDS.join(', ')}, entregada, created_at, updated_at, estado_at, prueba, uid) VALUES (?, ${RED_FIELDS.map(() => '?').join(', ')}, ?, ?, ?, ?, ?, ?)`)
    .bind(id, ...RED_FIELDS.map(k => (v as any)[k]), '', now, now, now, b.prueba ? 1 : 0, uid).run();
  if (!b.prueba) await logAS(env, 'red', id, `${v.project} · ${v.tema}`, 'Redacción nueva: cargar en AppSheet (Carga de Redacciones)');
  return id;
}

// ---------- horas ----------
async function saveHours(env: Env, b: any) {
  const project = str(b.project, 40), hours = Number(b.hours), date = isDate(b.date) ? b.date : hoyEn(TZ);
  const uid = uidOf(env), p = await env.DB.prepare('SELECT tipo FROM projects WHERE uid = ? AND code = ?').bind(uid, project).first();
  if (!p) throw Object.assign(new Error('Proyecto inválido'), { status: 400 });
  if (b.id && !(await env.DB.prepare('SELECT 1 AS x FROM hours WHERE id = ? AND uid = ?').bind(b.id, uid).first())) throw Object.assign(new Error('No existe esa carga'), { status: 404 });
  const task_type = oneOf(b.task_type, (TAREAS as any)[p.tipo] as string[], (TAREAS as any)[p.tipo][0]);
  if (!(hours > 0 && hours <= 24)) throw Object.assign(new Error('Horas inválidas (entre 0 y 24)'), { status: 400 });
  const id = b.id || newId();
  await env.DB.prepare('INSERT INTO hours (id, date, project, task_type, hours, note, created_at, uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET date = excluded.date, project = excluded.project, task_type = excluded.task_type, hours = excluded.hours, note = excluded.note')
    .bind(id, date, project, task_type, Math.round(hours * 100) / 100, str(b.note, 300), Date.now(), uid).run();
  return id;
}


// ---------- importación desde AppSheet ----------
/** "30/11/2026" → "2026-11-30". */
export const asDate = (s: unknown) => { const m = String(s ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
/** "$143,537.56" → 143537.56 */
export const asMoney = (s: unknown) => { const t = String(s ?? '').replace(/[^\d.\-]/g, ''); return t ? Number(t) : null; };
/**
 * Carga o actualiza tareas copiadas de AppSheet (id = código de AppSheet). Pisa solo lo que trae AppSheet;
 * los datos que existen solo acá (DR, tráfico, URL, contacto del medio, notas) se conservan. No genera pendientes para AppSheet.
 * lb:  [código, mes planificado, tipo, estado, anchor, medio, negociación, moneda, precio, fecha entrega, usuario, mail]
 * red: [código, tema, país, idioma, subproyecto, variante, deadline, prioridad, estado, deadline estado, usuario, fecha entrega]
 */
const sinTildes = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Proyectos vigentes que el Reporte de Seguimiento asigna a este usuario como líder (por nombre). */
async function proyectosQueLidera(env: Env) {
  const yo = sinTildes(yoOf(env)), hoyMes = hoyEn(TZ).slice(0, 7);
  const rows = (await env.DB.prepare('SELECT proyecto, lider, cierre, plan_mes FROM reporte').all()).results as any[];
  return rows.filter((r) => sinTildes(r.lider) === yo && (Number(r.plan_mes) > 0 || !r.cierre || r.cierre === '-' || mesReporte(r.cierre) >= hoyMes)).map((r) => r.proyecto as string);
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
/** "sept 2026" → "2026-09" (vacío si no se entiende). */
export function mesReporte(v: unknown) { const m = sinTildes(v).match(/^([a-z]+)\.? (\d{4})$/); if (!m) return ''; const i = MESES.findIndex((x) => m[1].startsWith(x.slice(0, 3))); return i < 0 ? '' : `${m[2]}-${String(i + 1).padStart(2, '0')}`; }
/** Guarda el Reporte de Seguimiento (lo lee el botón de favoritos en Looker Studio, solo lectura) y suma al líder sus proyectos. */
export async function importReporte(env: Env, b: any) {
  const now = Date.now(); let n = 0;
  for (const f of (Array.isArray(b.filas) ? b.filas : []).slice(0, 1000)) {
    const proyecto = str(f.proyecto, 40).toUpperCase(); if (!/^[A-Z0-9]{2,5}-(LIN|RED)-[\w.-]+$/.test(proyecto)) continue;
    await env.DB.prepare(`INSERT INTO reporte (proyecto, tipo, cliente, lider, inicio, cierre, tratamiento, periodo, plan_mes, entregadas_mes, total, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(proyecto) DO UPDATE SET tipo = excluded.tipo, cliente = excluded.cliente, lider = excluded.lider, inicio = excluded.inicio, cierre = excluded.cierre, tratamiento = excluded.tratamiento,
        periodo = excluded.periodo, plan_mes = excluded.plan_mes, entregadas_mes = excluded.entregadas_mes, total = COALESCE(excluded.total, reporte.total), updated_at = excluded.updated_at`)
      .bind(proyecto, proyecto.includes('-LIN-') ? 'LIN' : 'RED', str(f.cliente, 80), str(f.lider, 80), str(f.inicio, 20), str(f.cierre, 20), str(f.tratamiento, 30), str(f.periodo, 30), numOrNull(f.plan), numOrNull(f.entregadasMes), numOrNull(f.total), now).run();
    n++;
  }
  if (n) { await putS(env, 'reporte_at', String(now)); }
  const out = { filas: n, proyectosNuevos: [] as string[] };
  if (env.U?.alcance === 'lider') {
    const r = await importAS(env, { lb: [], red: [], proyectos: await proyectosQueLidera(env), clientes: Object.fromEntries((b.filas || []).map((f: any) => [str(f.proyecto, 40).toUpperCase(), str(f.cliente, 80)])), soloProyectos: true });
    out.proyectosNuevos = r.proyectosNuevos;
  }
  return out;
}
export async function importAS(env: Env, b: any) {
  const now = Date.now(), uid = uidOf(env), yo = yoOf(env);
  const codes = new Set(((await env.DB.prepare('SELECT code FROM projects WHERE uid = ?').bind(uid).all()).results as any[]).map(r => r.code));
  const out = { lb: 0, red: 0, saltadas: 0, proyectosNuevos: [] as string[] };
  // proyectos: los de "Tus Proyectos" en AppSheet y los que tengan alguna tarea asignada a esta persona
  const proyDe = (code: string) => str(code, 40).toUpperCase().replace(/-\d+$/, '');
  const quiero = new Set<string>([...(Array.isArray(b.proyectos) ? b.proyectos.map((c: unknown) => str(c, 40).toUpperCase()) : []),
    ...(Array.isArray(b.lb) ? b.lb : []).filter((r: any) => str(r[10], 80) === yo).map((r: any) => proyDe(r[0])),
    ...(Array.isArray(b.red) ? b.red : []).filter((r: any) => str(r[10], 80) === yo).map((r: any) => proyDe(r[0]))]);
  if (env.U?.alcance === 'lider') for (const c of await proyectosQueLidera(env)) quiero.add(c);
  let orden = codes.size;
  for (const c of quiero) {
    if (codes.has(c) || !/^[A-Z0-9]{2,5}-(LIN|RED)-[\d.]+$/.test(c)) continue;
    const ref: any = await env.DB.prepare("SELECT * FROM projects WHERE code = ? ORDER BY uid = 'u1' DESC LIMIT 1").bind(c).first();
    const cliente = ref?.cliente || str(b.clientes?.[c], 80) || c.split('-')[0];
    await env.DB.prepare('INSERT INTO projects (uid, code, cliente, tipo, active, params, orden) VALUES (?, ?, ?, ?, 1, ?, ?)').bind(uid, c, cliente, c.includes('-LIN-') ? 'LIN' : 'RED', ref?.params || '{}', orden++).run();
    if (ref) await env.DB.prepare('INSERT OR IGNORE INTO prompts (uid, project, clave, texto, updated_at) SELECT ?, project, clave, texto, ? FROM prompts WHERE uid = ? AND project = ?').bind(uid, now, ref.uid, c).run();
    codes.add(c); out.proyectosNuevos.push(c);
  }
  for (const r of Array.isArray(b.lb) ? b.lb : []) {
    const code = str(r[0], 40).toUpperCase(), project = code.replace(/-\d+$/, '');
    if (!codes.has(project)) { out.saltadas++; continue; }
    const pub = asDate(r[9]), id = idTarea(env, code);
    await env.DB.prepare(`INSERT INTO lb_tasks (id, project, as_code, estado, usuario, tipo_servicio, anchor, medio, estado_neg, moneda, precio, mail_eleven, deadline, publicado, created_at, updated_at, estado_at, uid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, usuario = excluded.usuario, tipo_servicio = excluded.tipo_servicio, anchor = excluded.anchor, medio = excluded.medio,
        estado_neg = excluded.estado_neg, moneda = excluded.moneda, precio = excluded.precio, mail_eleven = excluded.mail_eleven, deadline = excluded.deadline, publicado = excluded.publicado, updated_at = excluded.updated_at,
        estado_at = CASE WHEN lb_tasks.estado = excluded.estado THEN COALESCE(lb_tasks.estado_at, excluded.estado_at) ELSE excluded.estado_at END`)
      .bind(id, project, code, str(r[3], 80) || 'No Iniciado', str(r[10], 80), str(r[2], 60), str(r[4], 300), str(r[5], 200), str(r[6], 60), str(r[7], 8), asMoney(r[8]), str(r[11], 120).toLowerCase(), asDate(r[1]), pub, now, now, now, uid).run();
    // opcionales: [12] estado del pago, [13] aviso que muestra AppSheet, [14] URL de la publicación, [15] DR, [16] tráfico, [17] URL del cliente, [18] link del documento
    if (r.length > 12) await env.DB.prepare(`UPDATE lb_tasks SET pago_estado = ?, as_aviso = ?, url_publicacion = CASE WHEN ? != '' THEN ? ELSE url_publicacion END, dr = COALESCE(?, dr), trafico = COALESCE(?, trafico),
        url_cliente = CASE WHEN ? != '' THEN ? ELSE url_cliente END, doc_url = CASE WHEN ? != '' THEN ? ELSE doc_url END WHERE id = ?`)
      .bind(str(r[12], 60), str(r[13], 500), str(r[14], 500), str(r[14], 500), numOrNull(r[15]), numOrNull(r[16]), str(r[17], 500), str(r[17], 500), str(r[18], 500), str(r[18], 500), id).run();
    out.lb++;
  }
  for (const r of Array.isArray(b.red) ? b.red : []) {
    const code = str(r[0], 40).toUpperCase(), project = code.replace(/-\d+$/, '');
    if (!codes.has(project)) { out.saltadas++; continue; }
    const id = idTarea(env, code);
    await env.DB.prepare(`INSERT INTO redacciones (id, project, as_code, tema, pais, idioma, subproyecto, variante, fecha_entrega, prioridad, estado, deadline_estado, usuario, entregada, ia, created_at, updated_at, estado_at, uid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET tema = excluded.tema, pais = excluded.pais, idioma = excluded.idioma, subproyecto = excluded.subproyecto, variante = excluded.variante, fecha_entrega = excluded.fecha_entrega,
        prioridad = excluded.prioridad, estado = excluded.estado, deadline_estado = excluded.deadline_estado, usuario = excluded.usuario, entregada = excluded.entregada, updated_at = excluded.updated_at,
        estado_at = CASE WHEN redacciones.estado = excluded.estado THEN COALESCE(redacciones.estado_at, excluded.estado_at) ELSE excluded.estado_at END`)
      .bind(id, project, code, str(r[1], 300), str(r[2], 60), str(r[3], 40), str(r[4], 120), str(r[5], 120), asDate(r[6]), str(r[7], 30) || 'Normal', str(r[8], 80), asDate(r[9]), str(r[10], 80), asDate(r[11]), now, now, now, uid).run();
    // opcionales: [12] aviso de AppSheet, [13] link del documento
    if (r.length > 12) await env.DB.prepare(`UPDATE redacciones SET as_aviso = ?, doc_url = CASE WHEN ? != '' THEN ? ELSE doc_url END WHERE id = ?`).bind(str(r[12], 500), str(r[13], 500), str(r[13], 500), id).run();
    out.red++;
  }
  if (!b.soloProyectos) await putS(env, 'as_sync_at', String(now));
  return out;
}

// ---------- calendario (.ics) ----------
const icsEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line: string) => { const out: string[] = []; let s = line; while (enc(s).length > 74) { let n = 74; while (enc(s.slice(0, n)).length > 74) n--; out.push(s.slice(0, n)); s = ' ' + s.slice(n); } out.push(s); return out.join('\r\n'); };
export async function buildICS(env: Env, origin: string) {
  const lb = (await env.DB.prepare("SELECT * FROM lb_tasks WHERE deadline != '' AND estado NOT LIKE 'Backlink Publicado%' AND estado NOT IN ('Cerrado', 'Anulado') AND usuario = ? AND prueba = 0 AND uid = ?").bind(yoOf(env), uidOf(env)).all()).results as any[];
  const red = (await env.DB.prepare("SELECT * FROM redacciones WHERE fecha_entrega != '' AND estado NOT IN ('Cerrado', 'Anulado') AND usuario = ? AND prueba = 0 AND uid = ?").bind(yoOf(env), uidOf(env)).all()).results as any[];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const ev = (uid: string, date: string, summary: string, desc: string) => [
    'BEGIN:VEVENT', `UID:${uid}@proyectos-eleven`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(date, 1).replace(/-/g, '')}`,
    `SUMMARY:${icsEsc(summary)}`, `DESCRIPTION:${icsEsc(desc)}`, `URL:${origin}/`, 'TRANSP:TRANSPARENT', 'END:VEVENT'];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Proyectos Eleven//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Proyectos Eleven', `X-WR-TIMEZONE:${TZ}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  for (const t of lb) lines.push(...ev('lb-' + t.id, t.deadline, `🔗 ${t.project}${t.anchor ? ' · ' + t.anchor : ''}`, [t.as_code, t.estado, t.medio, t.mail_eleven && 'Mail: ' + t.mail_eleven].filter(Boolean).join('\n')));
  for (const r of red) lines.push(...ev('red-' + r.id, r.fecha_entrega, `✍️ ${r.project} · ${r.tema}`, [r.estado, 'Prioridad ' + r.prioridad, r.ia ? 'Redacción IA' : 'Redacción manual'].join('\n')));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// ---------- notificaciones (Web Push con VAPID, sin payload) ----------
async function vapid(env: Env) {
  let pub = await getS(env, 'vapid_pub'), priv = await getS(env, 'vapid_priv');
  if (!pub || !priv) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
    priv = JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey));
    await putS(env, 'vapid_pub', pub); await putS(env, 'vapid_priv', priv);
  }
  return { pub, jwk: JSON.parse(priv) };
}
async function vapidAuth(env: Env, endpoint: string, origin: string) {
  const { pub, jwk } = await vapid(env), e = (o: unknown) => b64u(enc(JSON.stringify(o)));
  const data = `${e({ typ: 'JWT', alg: 'ES256' })}.${e({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: origin })}`;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return `vapid t=${data}.${b64u(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(data)))}, k=${pub}`;
}
async function push(env: Env, origin: string, title: string, body: string) {
  await putS(env, 'last_notification', JSON.stringify({ title, body, at: Date.now() }));
  const subs = (await env.DB.prepare('SELECT endpoint FROM push_subscriptions WHERE uid = ?').bind(uidOf(env)).all()).results as { endpoint: string }[];
  let ok = 0;
  for (const s of subs) {
    try {
      const res = await fetch(s.endpoint, { method: 'POST', headers: { Authorization: await vapidAuth(env, s.endpoint, origin), TTL: '86400', Urgency: 'normal' } });
      if (res.status === 404 || res.status === 410) await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(s.endpoint).run();
      else if (res.ok) ok++;
    } catch { /* se reintenta en la próxima corrida */ }
  }
  return ok;
}
async function onceFor(env: Env, kind: string, date: string) {
  kind = `${uidOf(env)}:${kind}`;
  if (await env.DB.prepare('SELECT 1 AS x FROM notification_log WHERE kind = ? AND date = ?').bind(kind, date).first()) return false;
  await env.DB.prepare('INSERT OR IGNORE INTO notification_log (kind, date, sent_at) VALUES (?, ?, ?)').bind(kind, date, Date.now()).run();
  return true;
}
/** Hora local (0–23) y día de semana (0 = domingo) en Buenos Aires. */
function horaLocal(ms: number) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(ms));
  const h = Number(f.find(p => p.type === 'hour')?.value ?? 0) % 24, wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(f.find(p => p.type === 'weekday')?.value ?? 'Sun');
  return { h, wd };
}
/** Textos de los avisos del día (vencidas, hoy, mañana). Exportada para las pruebas. */
export async function resumenDeadlines(env: Env, hoy: string) {
  const man = addDays(hoy, 1);
  const lb = (await env.DB.prepare("SELECT project, anchor, as_code, deadline FROM lb_tasks WHERE deadline != '' AND deadline <= ? AND estado NOT LIKE 'Backlink Publicado%' AND estado NOT IN ('Cerrado', 'Anulado') AND usuario = ? AND prueba = 0 AND uid = ?").bind(man, yoOf(env), uidOf(env)).all()).results as any[];
  const red = (await env.DB.prepare("SELECT project, tema, fecha_entrega AS deadline FROM redacciones WHERE fecha_entrega != '' AND fecha_entrega <= ? AND estado NOT IN ('Cerrado', 'Anulado') AND usuario = ? AND prueba = 0 AND uid = ?").bind(man, yoOf(env), uidOf(env)).all()).results as any[];
  const all = [...lb.map(t => ({ d: t.deadline, txt: `${t.project} ${t.anchor || t.as_code || ''}`.trim() })), ...red.map(r => ({ d: r.deadline, txt: `${r.project} ${r.tema}` }))];
  const venc = all.filter(x => x.d < hoy), hoyL = all.filter(x => x.d === hoy), manL = all.filter(x => x.d === man);
  const parts: string[] = [];
  if (venc.length) parts.push(`${venc.length} vencida${venc.length > 1 ? 's' : ''}`);
  if (hoyL.length) parts.push(`${hoyL.length} para hoy`);
  if (manL.length) parts.push(`${manL.length} para mañana`);
  if (!parts.length) return null;
  const first = [...venc, ...hoyL, ...manL].slice(0, 3).map(x => x.txt).join(' · ');
  return { title: `Deadlines: ${parts.join(', ')}`, body: first };
}
export async function runAvisos(env: Env, origin: string, now = Date.now()) {
  const st = { ...PUBLIC_SETTINGS }; for (const k of Object.keys(st)) st[k] = (await getS(env, k)) ?? st[k];
  if (st.avisos !== '1') return [];
  const hoy = hoyEn(TZ, now), { h, wd } = horaLocal(now), sent: string[] = [];
  if (h >= Number(st.aviso_hora) && await onceFor(env, 'deadlines', hoy)) {
    const r = await resumenDeadlines(env, hoy);
    if (r) { await push(env, origin, r.title, r.body); sent.push('deadlines'); }
  }
  if (wd >= 1 && wd <= 5 && h >= Number(st.horas_hora)) {
    const tot = await env.DB.prepare('SELECT COALESCE(SUM(hours), 0) AS h FROM hours WHERE date = ? AND uid = ?').bind(hoy, uidOf(env)).first();
    const auto = (await horasAuto(env, hoy)).filter(x => x.date === hoy).reduce((a, x) => a + x.hours, 0);
    if (Number(tot?.h ?? 0) + auto === 0 && await onceFor(env, 'horas', hoy)) { await push(env, origin, 'Horas de hoy', 'Todavía no cargaste horas hoy.'); sent.push('horas'); }
  }
  return sent;
}

// ---------- registro automático de tiempo ----------
type Ref = { kind: 'lb' | 'red'; ref: string };
const refsKey = (refs: Ref[]) => JSON.stringify([...refs].map(r => ({ kind: r.kind === 'red' ? 'red' : 'lb', ref: str(r.ref, 60) })).sort((a, b) => (a.kind + a.ref).localeCompare(b.kind + b.ref)));
const PING_MS = 90_000, GAP_MAX = 15 * 60_000;
/** Mientras la app está en primer plano y estás trabajando en una tarea, suma tiempo a esa tarea (latido cada 30 s). */
export async function actPing(env: Env, refs: Ref[], now = Date.now()) {
  if (!refs.length) return;
  const key = refsKey(refs), last = await env.DB.prepare("SELECT * FROM actividad WHERE quien = 'yo' AND uid = ? ORDER BY fin DESC LIMIT 1").bind(uidOf(env)).first();
  if (last && last.refs === key && now - Number(last.fin) <= PING_MS && hoyEn(TZ, now) === last.fecha) { await env.DB.prepare('UPDATE actividad SET fin = ? WHERE id = ?').bind(now, last.id).run(); return; }
  const desde = last ? Math.max(Number(last.fin), now - 30_000) : now - 30_000;
  await env.DB.prepare("INSERT INTO actividad (quien, refs, accion, inicio, fin, fecha, uid) VALUES ('yo', ?, '', ?, ?, ?, ?)").bind(key, desde, now, hoyEn(TZ, now), uidOf(env)).run();
}
/** Una acción (cambio de estado, guardar, envío) se lleva el tiempo desde la acción anterior (hasta 15 min): cubre lo que hiciste fuera de la app, como escribir el mail. */
export async function actAccion(env: Env, refs: Ref[], accion: string, now = Date.now()) {
  if (!refs.length) return;
  const last = await env.DB.prepare("SELECT fin FROM actividad WHERE quien = 'yo' AND uid = ? ORDER BY fin DESC LIMIT 1").bind(uidOf(env)).first();
  const gap = last ? now - Number(last.fin) : 0;
  const desde = gap > 0 && gap <= GAP_MAX ? Number(last!.fin) : now - 60_000;
  await env.DB.prepare("INSERT INTO actividad (quien, refs, accion, inicio, fin, fecha, uid) VALUES ('yo', ?, ?, ?, ?, ?, ?)").bind(refsKey(refs), str(accion, 80), desde, now, hoyEn(TZ, now), uidOf(env)).run();
}
/** Tiempo de la IA, de Claude o de la sincronización con AppSheet sobre tareas concretas. */
export async function actAgente(env: Env, quien: string, refs: Ref[], accion: string, inicio: number, fin: number) {
  if (!refs.length || !(fin > inicio)) return;
  await env.DB.prepare('INSERT INTO actividad (quien, refs, accion, inicio, fin, fecha, uid) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(oneOf(quien, ['ia', 'claude', 'sync', 'yo'], 'claude'), refsKey(refs), str(accion, 80), inicio, fin, hoyEn(TZ, inicio), uidOf(env)).run();
}
/** Horas automáticas por día, proyecto y tarea de la planilla (el tiempo de una acción sobre varias tareas se reparte en partes iguales). */
export async function horasAuto(env: Env, desde: string) {
  const uid = uidOf(env), rows = (await env.DB.prepare('SELECT * FROM actividad WHERE fecha >= ? AND uid = ? ORDER BY inicio').bind(desde, uid).all()).results as any[];
  if (!rows.length) return [];
  const lb = new Map(((await env.DB.prepare('SELECT id, project, estado FROM lb_tasks WHERE prueba = 0 AND uid = ?').bind(uid).all()).results as any[]).map(t => [t.id, t]));
  const red = new Map(((await env.DB.prepare('SELECT id, project, estado, ia FROM redacciones WHERE prueba = 0 AND uid = ?').bind(uid).all()).results as any[]).map(t => [t.id, t]));
  const plan = (await env.DB.prepare('SELECT * FROM plan WHERE month >= ? AND uid = ?').bind(desde.slice(0, 7), uid).all()).results as any[];
  const acc = new Map<string, { date: string; project: string; task_type: string; s: number; por: Record<string, number> }>();
  for (const a of rows) {
    let refs: Ref[] = []; try { refs = JSON.parse(a.refs); } catch { /* fila rota */ }
    const seg = Math.max(0, (Number(a.fin) - Number(a.inicio)) / 1000) / (refs.length || 1);
    for (const r of refs) {
      const t = (r.kind === 'red' ? red : lb).get(r.ref); if (!t) continue;
      const tipo = tipoHoras(r.kind, t, plan.filter(p => p.month === a.fecha.slice(0, 7))), k = `${a.fecha}|${t.project}|${tipo}`;
      const o = acc.get(k) || { date: a.fecha, project: t.project, task_type: tipo, s: 0, por: {} };
      o.s += seg; o.por[a.quien] = (o.por[a.quien] || 0) + seg; acc.set(k, o);
    }
  }
  return [...acc.entries()].filter(([, o]) => o.s >= 30).map(([k, o]) => ({
    id: 'auto:' + k, date: o.date, project: o.project, task_type: o.task_type, hours: Math.round(o.s / 36) / 100, auto: 1, created_at: 0,
    note: 'Automático · ' + Object.entries(o.por).map(([q, s]) => `${(QUIEN as any)[q] || q} ${Math.round(s / 60)} min`).join(' · '),
  }));
}

// ---------- cambio de estado en lote ----------
async function bulkEstado(env: Env, b: any) {
  const kind = b.kind === 'red' ? 'red' : 'lb', ids: string[] = Array.isArray(b.ids) ? b.ids.map((x: unknown) => str(x, 60)).filter(Boolean).slice(0, 500) : [];
  const estado = str(b.estado, 80); if (!estado || !ids.length) throw Object.assign(new Error('Elegí tareas y un estado'), { status: 400 });
  const table = kind === 'lb' ? 'lb_tasks' : 'redacciones', now = Date.now(), hoy = hoyEn(TZ, now); let n = 0;
  for (const id of ids) {
    const t = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ? AND uid = ?`).bind(id, uidOf(env)).first(); if (!t || t.estado === estado) continue;
    if (kind === 'lb') await env.DB.prepare('UPDATE lb_tasks SET estado = ?, estado_at = ?, updated_at = ?, publicado = ? WHERE id = ? AND uid = ?').bind(estado, now, now, PUBLICADOS.has(estado) ? (t.publicado || hoy) : '', id, uidOf(env)).run();
    else await env.DB.prepare('UPDATE redacciones SET estado = ?, estado_at = ?, updated_at = ? WHERE id = ? AND uid = ?').bind(estado, now, now, id, uidOf(env)).run();
    if (!t.prueba) await logAS(env, kind, id, t.as_code || `${t.project} · ${t.anchor || t.tema || ''}`, `estado: ${t.estado} → ${estado} (en lote)`); n++;
  }
  await actAccion(env, ids.map(ref => ({ kind, ref })), `Cambio de estado en lote → ${estado}`, now);
  return n;
}

// ---------- compilado de medios ----------
const MEDIO_COLS = ['dominio', 'estado', 'mail', 'dr', 'trafico', 'pais', 'idioma', 'sensible', 'precio_usd', 'precio', 'moneda', 'vence', 'proveedor', 'actualizado'] as const;
export async function importMedios(env: Env, b: any) {
  const rows: any[] = Array.isArray(b.rows) ? b.rows.slice(0, 2000) : [];
  if (b.reset) await env.DB.prepare('DELETE FROM medios').run();
  const st = env.DB.prepare(`INSERT INTO medios (${MEDIO_COLS.join(', ')}) VALUES (${MEDIO_COLS.map(() => '?').join(', ')}) ON CONFLICT(dominio) DO UPDATE SET ${MEDIO_COLS.slice(1).map(k => `${k} = excluded.${k}`).join(', ')}`);
  const vals = rows.filter(r => r && r.dominio).map(r => st.bind(str(r.dominio, 200).toLowerCase(), str(r.estado, 20), str(r.mail, 120).toLowerCase(), numOrNull(r.dr), numOrNull(r.trafico), str(r.pais, 60), str(r.idioma, 30), r.sensible ? 1 : 0, numOrNull(r.precio_usd), numOrNull(r.precio), str(r.moneda, 8), str(r.vence, 10), str(r.proveedor, 120), str(r.actualizado, 10)));
  for (let i = 0; i < vals.length; i += 100) await env.DB.batch(vals.slice(i, i + 100));
  if (b.last) await putS(env, 'medios_at', String(Date.now()));
  return vals.length;
}

// ---------- IA (Gemini) ----------
const GEM = 'https://generativelanguage.googleapis.com/v1beta';
async function gemKey(env: Env) { const k = await getS(env, 'gemini_key'); if (!k) throw Object.assign(new Error('Falta conectar Gemini (Ajustes → IA)'), { status: 400 }); return k; }
export async function gemModelos(env: Env, key?: string) {
  const r = await fetch(`${GEM}/models?pageSize=200`, { headers: { 'x-goog-api-key': key ?? await gemKey(env) } });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || `Gemini respondió ${r.status}`), { status: 400 });
  return ((j.models || []) as any[]).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name).replace(/^models\//, ''));
}
const ver = (n: string) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
export function elegirModelos(lista: string[]) {
  const limpio = (n: string) => !/(tts|audio|live|embedding|aqa|learnlm|robotics|computer|preview-\d|exp|lite)/.test(n);
  const txt = lista.filter(n => /^gemini-/.test(n) && !/image/.test(n) && limpio(n)).sort((a, b) => ver(b) - ver(a) || (/pro/.test(b) ? 1 : 0) - (/pro/.test(a) ? 1 : 0));
  const img = lista.filter(n => /^gemini-.*image/.test(n) && !/preview/.test(n)).sort((a, b) => ver(b) - ver(a) || (/flash/.test(b) ? 1 : 0) - (/flash/.test(a) ? 1 : 0));
  return { texto: txt[0] || '', imagen: img[0] || lista.find(n => /image/.test(n)) || '' };
}
async function gemGenerar(env: Env, model: string, prompt: string, imagen = false, aspecto = '16:9') {
  const r = await fetch(`${GEM}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': await gemKey(env), 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: imagen ? { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspecto } } : { temperature: 0.8 } }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || `Gemini respondió ${r.status}`), { status: 502 });
  const parts: any[] = j?.candidates?.[0]?.content?.parts || [];
  return { text: parts.filter(p => p.text).map(p => p.text).join(''), img: parts.find(p => p.inlineData)?.inlineData as { mimeType: string; data: string } | undefined };
}
const PROMPT_BASE: Record<string, string> = {
  lb: `Escribí un artículo en {idioma} para publicar en el medio {medio} ({pais}). Tiene que sonar editorial, útil para el lector del medio y no publicitario.
Incluí una sola vez, de forma natural y en el cuerpo del texto, el enlace con el texto ancla exacto "{anchor}" apuntando a {url_cliente}. Mínimo {palabras_min} palabras.
Formato de salida: primera línea "TÍTULO: <título>", después el cuerpo en Markdown con subtítulos (##). Marcá el enlace como [{anchor}]({url_cliente}).`,
  red: `Escribí en {idioma} ({pais}) el contenido para "{tema}" del cliente {cliente}.{subproyecto_linea}
Formato de salida: primera línea "TÍTULO: <título>", después el cuerpo en Markdown con subtítulos (##).{material_linea}`,
  imagen: `Fotografía editorial horizontal 16:9, realista, sin texto ni logos, que ilustre el artículo "{titulo}". Luz natural, colores sobrios.`,
};
async function promptDe(env: Env, project: string, claves: string[]) {
  for (const c of claves) { const r = await env.DB.prepare('SELECT texto FROM prompts WHERE uid = ? AND project = ? AND clave = ?').bind(uidOf(env), project, c).first(); if (r && String(r.texto).trim()) return String(r.texto); }
  return '';
}
/** Tipo de pieza de una redacción: el subproyecto si está; si no, se deduce del tema (URL de receta → optimización, URL de categoría → categoría, texto → contenido nuevo). */
export function tipoPieza(t: any) {
  if (t.subproyecto) return t.subproyecto as string;
  const tema = String(t.tema || '');
  if (/^https?:\/\/|^\//.test(tema)) return /categor/i.test(tema) ? 'Categorías' : /\/receta\//i.test(tema) ? 'Optimización de recetas' : 'Optimización';
  return 'Recetas CC';
}
/** Texto principal de una página publicada (para optimizar lo que ya existe). */
async function textoDePagina(url: string) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (ProyectosEleven)' }, redirect: 'follow' });
    if (!r.ok) return '';
    let html = (await r.text()).slice(0, 600_000);
    const i = html.search(/<(article|main)[\s>]/i); if (i > 0) html = html.slice(i);
    return html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, '\n').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&[a-z]+;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, 15000);
  } catch { return ''; }
}
const rellenar = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
/** Tarea del usuario de la sesión (null si no existe o es de otra persona). */
async function tareaDe(env: Env, kind: string, ref: string): Promise<any> {
  return env.DB.prepare(`SELECT * FROM ${kind === 'red' ? 'redacciones' : 'lb_tasks'} WHERE id = ? AND uid = ?`).bind(ref, uidOf(env)).first();
}
async function varsTarea(env: Env, kind: 'lb' | 'red', ref: string, extra: Record<string, string> = {}) {
  const t: any = await tareaDe(env, kind, ref);
  if (!t) throw Object.assign(new Error('La tarea no existe'), { status: 404 });
  const p: any = await env.DB.prepare('SELECT * FROM projects WHERE uid = ? AND code = ?').bind(uidOf(env), t.project).first();
  const pp = JSON.parse(p?.params || '{}'), tx: any = await env.DB.prepare('SELECT titulo, cuerpo FROM textos WHERE kind = ? AND ref = ?').bind(kind, ref).first();
  const v: Record<string, string> = {
    codigo: t.as_code || '', proyecto: t.project, cliente: p?.cliente || '', dominio_cliente: pp.dominio || '', anchor: t.anchor || '', url_cliente: t.url_cliente || '',
    medio: (t.medio || '').replace(/^https?:\/\//, ''), dr: String(t.dr ?? ''), palabras_min: String(pp.palabrasMin ?? 500), pais: t.pais || pp.paises || 'Argentina', idioma: t.idioma || 'Español',
    tema: t.tema || '', subproyecto: t.subproyecto || '', variante: t.variante || '', titulo: extra.titulo || tx?.titulo || t.tema || t.anchor || '', texto: (tx?.cuerpo || '').slice(0, 4000), material: extra.material || '',
  };
  v.tipo_pieza = kind === 'red' ? tipoPieza(t) : '';
  v.url_actual = /^https?:\/\//.test(t.tema || '') ? t.tema : /^\//.test(t.tema || '') && pp.dominio ? `https://${pp.dominio}${t.tema}` : '';
  v.subproyecto_linea = v.subproyecto ? `\nTipo de pieza: ${v.subproyecto}${v.variante ? ' · ' + v.variante : ''}.` : '';
  v.material_linea = v.material ? `\n\nMaterial de base que te paso (usalo como fuente, no lo copies textual):\n${v.material}` : '';
  return { t, v };
}
export async function iaRedactar(env: Env, b: any) {
  const kind = b.kind === 'red' ? 'red' : 'lb', ref = str(b.ref, 60), { t, v } = await varsTarea(env, kind, ref, { material: str(b.material, 20000) });
  const tpl = (await promptDe(env, t.project, kind === 'red' ? [`red:${v.tipo_pieza}`, 'red'] : [kind])) || PROMPT_BASE[kind];
  if (tpl.includes('{pagina_actual}')) v.pagina_actual = v.url_actual ? (await textoDePagina(v.url_actual)) || '(no se pudo leer la página)' : '(no hay URL publicada)';
  const model = (await getS(env, 'gemini_model_texto')) || elegirModelos(await gemModelos(env)).texto, t0 = Date.now();
  const { text } = await gemGenerar(env, model, rellenar(tpl, v));
  if (!text.trim()) throw Object.assign(new Error('Gemini no devolvió texto'), { status: 502 });
  const m = text.match(/^\s*\**T[ÍI]TULO:?\**\s*(.+)\n+/i), titulo = (m ? m[1] : '').replace(/[*#]/g, '').trim(), cuerpo = (m ? text.slice(m[0].length) : text).trim();
  const palabras = (cuerpo.match(/[\p{L}\p{N}]+/gu) || []).length, now = Date.now();
  await env.DB.prepare('INSERT INTO textos (kind, ref, titulo, cuerpo, url, palabras, lista, updated_at) VALUES (?, ?, ?, ?, \'\', ?, 0, ?) ON CONFLICT(kind, ref) DO UPDATE SET titulo = excluded.titulo, cuerpo = excluded.cuerpo, palabras = excluded.palabras, updated_at = excluded.updated_at')
    .bind(kind, ref, titulo, cuerpo, palabras, now).run();
  await actAgente(env, 'ia', [{ kind, ref }], 'Redacción con IA', t0, now);
  return { titulo, cuerpo, palabras, modelo: model, segundos: Math.round((now - t0) / 1000) };
}
export async function iaImagen(env: Env, b: any) {
  const kind = b.kind === 'red' ? 'red' : 'lb', ref = str(b.ref, 60), { t, v } = await varsTarea(env, kind, ref, { titulo: str(b.titulo, 300) });
  const tpl = (await promptDe(env, t.project, kind === 'red' ? [`imagen:${v.tipo_pieza}`, 'imagen'] : ['imagen'])) || PROMPT_BASE.imagen;
  const model = (await getS(env, 'gemini_model_imagen')) || elegirModelos(await gemModelos(env)).imagen, t0 = Date.now();
  if (!model) throw Object.assign(new Error('Tu cuenta de Gemini no tiene un modelo de imágenes disponible'), { status: 400 });
  const { img } = await gemGenerar(env, model, rellenar(tpl, v), true, kind === 'lb' ? '3:2' : '16:9');
  if (!img) throw Object.assign(new Error('Gemini no devolvió una imagen (probá de nuevo o ajustá el prompt)'), { status: 502 });
  await env.DB.prepare('DELETE FROM imagenes WHERE kind = ? AND ref = ?').bind(kind, ref).run();
  const CH = 600_000;
  for (let i = 0; i * CH < img.data.length; i++) await env.DB.prepare('INSERT INTO imagenes (kind, ref, seq, mime, data) VALUES (?, ?, ?, ?, ?)').bind(kind, ref, i, img.mimeType, img.data.slice(i * CH, (i + 1) * CH)).run();
  await actAgente(env, 'ia', [{ kind, ref }], 'Imagen con IA', t0, Date.now());
  return { ok: true, modelo: model };
}
async function imagenDe(env: Env, kind: string, ref: string) {
  if (!(await tareaDe(env, kind, ref))) return null;
  const rows = (await env.DB.prepare('SELECT mime, data FROM imagenes WHERE kind = ? AND ref = ? ORDER BY seq').bind(kind, ref).all()).results as any[];
  return rows.length ? { mime: rows[0].mime as string, data: rows.map(r => r.data).join('') } : null;
}

// ---------- envío al Google Doc (Apps Script con tu cuenta de Eleven) ----------
async function enviarDoc(env: Env, b: any) {
  const url = await getS(env, 'gas_url'), secret = await getS(env, 'gas_secret');
  if (!url || !secret) throw Object.assign(new Error('Falta conectar el script de Google (Ajustes → Google Docs)'), { status: 400 });
  const kind = b.kind === 'red' ? 'red' : 'lb', ref = str(b.ref, 60);
  const t: any = await tareaDe(env, kind, ref);
  const tx: any = await env.DB.prepare('SELECT * FROM textos WHERE kind = ? AND ref = ?').bind(kind, ref).first();
  if (!t || !tx?.cuerpo) throw Object.assign(new Error('No hay texto para enviar'), { status: 400 });
  if (kind === 'lb' && !DOC_EDITABLE_LB.includes(t.estado)) throw Object.assign(new Error(`El documento solo se puede editar en ${DOC_EDITABLE_LB.join(' o ')} (la tarea está en ${t.estado})`), { status: 400 });
  const doc = str(b.doc_url, 500) || tx.url || t.doc_url; const img = b.conImagen ? await imagenDe(env, kind, ref) : null, t0 = Date.now();
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain' }, redirect: 'follow', body: JSON.stringify({ secret, doc, codigo: t.as_code, tipo: kind === 'lb' ? 'REDACCIÓNLINKBUILDING' : 'REDACCIÓN', titulo: tx.titulo, cuerpo: tx.cuerpo, imagen: img }) });
  const j: any = await r.json().catch(() => ({ error: 'El script no respondió JSON (¿está publicado como aplicación web?)' }));
  if (!r.ok || j.error) throw Object.assign(new Error(j.error || `El script respondió ${r.status}`), { status: 502 });
  if (j.doc && j.doc !== tx.url) await env.DB.prepare('UPDATE textos SET url = ? WHERE kind = ? AND ref = ?').bind(j.doc, kind, ref).run();
  await actAgente(env, 'ia', [{ kind, ref }], 'Texto enviado al documento', t0, Date.now());
  return { ok: true, doc: j.doc || doc };
}

// ---------- lectura de todo ----------
async function allData(env: Env) {
  const uid = uidOf(env), q = async (sql: string) => (await env.DB.prepare(sql).bind(uid).all()).results;
  const projects = ((await q('SELECT * FROM projects WHERE uid = ? ORDER BY orden')) as any[]).map(p => ({ ...p, params: JSON.parse(p.params || '{}') }));
  const settings: Record<string, string> = {};
  for (const k of Object.keys(PUBLIC_SETTINGS)) settings[k] = (await getS(env, k)) ?? PUBLIC_SETTINGS[k];
  settings.gemini = (await getS(env, 'gemini_key')) ? '1' : '';
  settings.gas = (await getS(env, 'gas_secret')) && settings.gas_url ? '1' : '';
  const hoy = hoyEn(TZ), desde = addDays(hoy.slice(0, 7) + '-01', -31);
  const auto = await horasAuto(env, desde);
  return {
    projects,
    me: env.U, usuarios: env.U?.admin ? ((await env.DB.prepare('SELECT id, nombre, email, admin, modo, alcance, created_at FROM users ORDER BY created_at').all()).results) : [],
    reporte: await q('SELECT r.* FROM reporte r JOIN projects p ON p.code = r.proyecto AND p.uid = ? ORDER BY r.tipo, r.cliente, r.proyecto'),
    lb: await q('SELECT * FROM lb_tasks WHERE uid = ? ORDER BY CASE WHEN deadline = \'\' THEN 1 ELSE 0 END, deadline, created_at'),
    red: await q('SELECT * FROM redacciones WHERE uid = ? ORDER BY CASE WHEN fecha_entrega = \'\' THEN 1 ELSE 0 END, fecha_entrega, created_at'),
    hours: [...auto, ...(await q('SELECT * FROM hours WHERE uid = ? ORDER BY date DESC, created_at DESC')) as any[]].sort((a, b) => b.date.localeCompare(a.date)),
    actividad: await q(`SELECT id, quien, refs, accion, inicio, fin FROM actividad WHERE uid = ? AND fecha = '${hoy}' ORDER BY inicio`),
    notas: await q('SELECT * FROM notas WHERE uid = ? ORDER BY hecha, created_at DESC'),
    prompts: await q('SELECT * FROM prompts WHERE uid = ? ORDER BY project, clave'),
    planes: await q('SELECT month, estado, validacion, updated_at FROM planes WHERE uid = ? ORDER BY month DESC'),
    medios_n: Number(((await env.DB.prepare('SELECT COUNT(*) AS n FROM medios').first()) as any)?.n ?? 0),
    plan: await q('SELECT * FROM plan WHERE uid = ? ORDER BY month, project, task_type'),
    as_pend: await q('SELECT * FROM as_log WHERE uid = ? AND done = 0 ORDER BY at'),
    textos: (await env.DB.prepare("SELECT kind, ref, palabras, lista, updated_at FROM textos WHERE (kind = 'lb' AND ref IN (SELECT id FROM lb_tasks WHERE uid = ?)) OR (kind = 'red' AND ref IN (SELECT id FROM redacciones WHERE uid = ?))").bind(uid, uid).all()).results,
    settings,
  };
}

// ---------- rutas ----------
export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url), path = url.pathname, m = req.method;
  if (!path.startsWith('/api/') && !path.startsWith('/cal/')) return env.ASSETS ? env.ASSETS.fetch(req) : new Response('Not found', { status: 404 });
  await ensureSchema(env);
  if (!(await getS(env, 'origin'))) await putS(env, 'origin', url.origin);
  const body = async () => { try { return await req.json() as any; } catch { return {}; } };
  try {
    // calendario público con token secreto
    if (path.startsWith('/cal/') && m === 'GET') {
      const U = await userBySetting(env, 'cal_token', path.slice(5).replace(/\.ics$/, ''));
      if (!U) return new Response('Not found', { status: 404 });
      return new Response(await buildICS(conUsuario(env, U), url.origin), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
    }
    // importación desde la página de AppSheet (botón "Traer de AppSheet": clave propia de cada usuario)
    if (path === '/api/import') {
      const cors = { 'access-control-allow-origin': 'https://www.appsheet.com', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-import-key', 'access-control-max-age': '600' };
      if (m === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      const U = m === 'POST' ? await userBySetting(env, 'import_key', req.headers.get('x-import-key') ?? '') : null;
      if (!U) return new Response(JSON.stringify({ error: 'No autorizado: volvé a copiar el botón desde Ajustes de la app' }), { status: 401, headers: { ...cors, 'content-type': 'application/json' } });
      const cuerpo = await body(), link = linkAppSheet(cuerpo.as_url);
      if (link) await putS(env, 'as_url', link);
      const r = await importAS(conUsuario(env, U), cuerpo);
      return new Response(JSON.stringify(r), { headers: { ...cors, 'content-type': 'application/json' } });
    }
    // Reporte de Seguimiento (Looker Studio): lo lee el botón de favoritos con la sesión del usuario, solo lectura
    if (path === '/api/reporte') {
      const o = req.headers.get('origin') || '', okO = /^https:\/\/(datastudio|lookerstudio)\.google\.com$/.test(o) ? o : 'https://lookerstudio.google.com';
      const cors = { 'access-control-allow-origin': okO, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-import-key', 'access-control-max-age': '600', vary: 'origin' };
      if (m === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      const U = m === 'POST' ? await userBySetting(env, 'import_key', req.headers.get('x-import-key') ?? '') : null;
      if (!U) return new Response(JSON.stringify({ error: 'No autorizado: volvé a copiar el botón desde Ajustes de la app' }), { status: 401, headers: { ...cors, 'content-type': 'application/json' } });
      const r = await importReporte(conUsuario(env, U), await body());
      return new Response(JSON.stringify(r), { headers: { ...cors, 'content-type': 'application/json' } });
    }
    // compilado de medios desde la planilla de Google (la abro yo en el navegador con tu sesión de Eleven)
    if (path === '/api/medios/import-key') {
      const cors = { 'access-control-allow-origin': 'https://docs.google.com', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-import-key', 'access-control-max-age': '600' };
      if (m === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      const U = m === 'POST' ? await userBySetting(env, 'import_key', req.headers.get('x-import-key') ?? '') : null;
      if (!U) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { ...cors, 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ n: await importMedios(env, await body()) }), { headers: { ...cors, 'content-type': 'application/json' } });
    }
    if (path === '/api/state' && m === 'GET') {
      const inv = url.searchParams.get('invitacion'), ok = inv ? await env.DB.prepare("SELECT 1 AS x FROM invites WHERE token = ? AND used_by = ''").bind(inv).first() : null;
      return json({ setup: !(await env.DB.prepare('SELECT 1 AS x FROM users LIMIT 1').first()), invitacion: inv ? !!ok : undefined });
    }
    if (path === '/api/setup' && m === 'POST') {
      if (await env.DB.prepare('SELECT 1 AS x FROM users LIMIT 1').first()) return fail('La cuenta ya está creada', 409);
      const b = await body(); if (typeof b.password !== 'string' || b.password.length < 8) return fail('La contraseña debe tener al menos 8 caracteres');
      await env.DB.prepare("INSERT INTO users (id, nombre, email, pw, admin, created_at) VALUES ('u1', ?, ?, ?, 1, ?)").bind(str(b.nombre, 80) || YO, str(b.email, 120).toLowerCase(), await hashPw(b.password), Date.now()).run();
      await putS(conUsuario(env, { id: 'u1', nombre: '', email: '', admin: 1 }), 'cal_token', b64u(rand(24)));
      return json({ token: await newSession(env, 'u1') });
    }
    // alta con invitación: nombre igual que en AppSheet, mail y contraseña
    if (path === '/api/signup' && m === 'POST') {
      const b = await body(), tok = str(b.invitacion, 80);
      const inv: any = await env.DB.prepare("SELECT * FROM invites WHERE token = ? AND used_by = ''").bind(tok).first();
      if (!inv) return fail('La invitación no existe o ya se usó. Pedile un link nuevo a quien te invitó.', 403);
      const nombre = str(b.nombre, 80), email = str(b.email, 120).toLowerCase();
      if (nombre.length < 3) return fail('Escribí tu nombre tal como aparece en AppSheet');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('El mail no parece válido');
      if (typeof b.password !== 'string' || b.password.length < 8) return fail('La contraseña debe tener al menos 8 caracteres');
      if (await env.DB.prepare('SELECT 1 AS x FROM users WHERE lower(email) = ? OR lower(nombre) = lower(?)').bind(email, nombre).first()) return fail('Ya hay una cuenta con ese mail o ese nombre', 409);
      const id = newId();
      await env.DB.prepare('INSERT INTO users (id, nombre, email, pw, admin, created_at) VALUES (?, ?, ?, ?, 0, ?)').bind(id, nombre, email, await hashPw(b.password), Date.now()).run();
      await env.DB.prepare('UPDATE invites SET used_by = ? WHERE token = ?').bind(id, tok).run();
      await putS(conUsuario(env, { id, nombre, email, admin: 0 }), 'cal_token', b64u(rand(24)));
      return json({ token: await newSession(env, id) });
    }
    if (path === '/api/login' && m === 'POST') {
      if (await throttled(env)) return fail('Demasiados intentos. Probá en 15 minutos.', 429);
      const b = await body(), quien = str(b.usuario, 120).toLowerCase();
      const users = (await env.DB.prepare('SELECT * FROM users').all()).results as any[];
      const u = quien ? users.find(x => x.email === quien || String(x.nombre).toLowerCase() === quien) : users.length === 1 ? users[0] : null;
      if (!u || typeof b.password !== 'string' || !(await verifyPw(b.password, u.pw))) { await badTry(env); return fail(quien || users.length <= 1 ? 'Usuario o contraseña incorrectos' : 'Escribí tu mail o tu nombre', 401); }
      await putS(env, 'fails', '0'); return json({ token: await newSession(env, u.id) });
    }
    if (path === '/api/conectar/usar' && m === 'POST') {
      if (await throttled(env)) return fail('Demasiados intentos. Probá en 15 minutos.', 429);
      const b = await body(), U2 = await userBySetting(env, 'conectar_tok', str(b.token, 80));
      if (!U2) { await badTry(env); return fail('Este enlace ya se usó o no existe. Volvé a tocar «Conectar Claude» en la app.', 401); }
      const e2 = conUsuario(env, U2), exp = Number(await getS(e2, 'conectar_exp'));
      await putS(e2, 'conectar_tok', ''); await putS(e2, 'conectado_at', String(Date.now()));
      if (!(exp > Date.now())) return fail('Este enlace venció. Volvé a tocar «Conectar Claude» en la app.', 401);
      return json({ token: await newSession(env, U2.id), nombre: U2.nombre });
    }
    if (path === '/api/last-notification' && m === 'GET') {
      const sub: any = await env.DB.prepare('SELECT uid FROM push_subscriptions WHERE endpoint = ?').bind(url.searchParams.get('ep') ?? '').first();
      const U = sub ? await userById(env, sub.uid) : null, n = U ? await getS(conUsuario(env, U), 'last_notification') : null;
      return json(n ? JSON.parse(n) : { title: 'Proyectos Eleven', body: 'Tenés un aviso.' });
    }
    const U = await authed(req, env);
    if (!U) return fail('Sesión vencida', 401);
    env = conUsuario(env, U);
    if (path === '/api/invites' && m === 'POST') {
      if (!U.admin) return fail('Solo quien administra la app puede invitar', 403);
      const token = b64u(rand(18));
      await env.DB.prepare('INSERT INTO invites (token, created_by, created_at) VALUES (?, ?, ?)').bind(token, U.id, Date.now()).run();
      return json({ token, link: `${url.origin}/?invitacion=${token}` });
    }
    if (path === '/api/conectar' && m === 'POST') {
      const tok = b64u(rand(24)); await putS(env, 'conectar_tok', tok); await putS(env, 'conectar_exp', String(Date.now() + 60 * 60000));
      return json({ token: tok, link: `${url.origin}/?conectar=${tok}`, as_url: (await getS(env, 'as_url')) || '' });
    }
    // objetivos mensuales por proyecto (los lee Claude del reporte de seguimiento, solo lectura)
    if (path === '/api/objetivos' && m === 'POST') {
      const b = await body(); if (!Array.isArray(b.items)) return fail('Faltan los objetivos');
      let n = 0;
      for (const it of b.items.slice(0, 200)) {
        const code = str(it.code, 40), q = numOrNull(it.piezasMes); if (q === null) continue;
        const row: any = await env.DB.prepare('SELECT tipo, params FROM projects WHERE uid = ? AND code = ?').bind(U.id, code).first(); if (!row) continue;
        const pr = JSON.parse(row.params || '{}');
        await env.DB.prepare('UPDATE projects SET params = ? WHERE uid = ? AND code = ?').bind(JSON.stringify({ ...pr, piezasMes: q, ...(row.tipo === 'LIN' ? { linksMes: q } : {}), objetivosAt: hoyEn(TZ) }), U.id, code).run(); n++;
      }
      return json({ ok: true, actualizados: n });
    }
    // modo predeterminado de cada usuario (Líder o Técnico): lo elige quien administra
    if (path === '/api/usuarios/modo' && m === 'POST') {
      if (!U.admin) return fail('Solo quien administra la app puede cambiarlo', 403);
      const b = await body();
      if (b.modo !== undefined) await env.DB.prepare('UPDATE users SET modo = ? WHERE id = ?').bind(oneOf(b.modo, ['lider', 'tecnico'], 'tecnico'), str(b.id, 40)).run();
      if (b.alcance !== undefined) await env.DB.prepare('UPDATE users SET alcance = ? WHERE id = ?').bind(oneOf(b.alcance, ['lider', 'propio'], 'propio'), str(b.id, 40)).run();
      return json({ ok: true });
    }
    if (path === '/api/import-key' && m === 'GET') {
      let k = await getS(env, 'import_key'); if (!k || url.searchParams.get('nueva')) { k = b64u(rand(24)); await putS(env, 'import_key', k); }
      return json({ key: k, origin: url.origin });
    }

    if (path === '/api/data' && m === 'GET') return json(await allData(env));
    if (path === '/api/logout' && m === 'POST') {
      const tok = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
      await env.DB.prepare('DELETE FROM sessions WHERE th = ?').bind(await sha256hex(tok)).run(); return json({ ok: true });
    }
    if (path === '/api/lb' && m === 'POST') { const id = await saveLB(env, await body()); await actAccion(env, [{ kind: 'lb', ref: id }], 'Guardar tarea'); return json({ id }); }
    if (path === '/api/red' && m === 'POST') { const id = await saveRED(env, await body()); await actAccion(env, [{ kind: 'red', ref: id }], 'Guardar redacción'); return json({ id }); }
    if (path === '/api/bulk' && m === 'POST') return json({ n: await bulkEstado(env, await body()) });
    if (path === '/api/act/ping' && m === 'POST') { const b = await body(); await actPing(env, Array.isArray(b.refs) ? b.refs.slice(0, 50) : []); return json({ ok: true }); }
    if (path === '/api/act/accion' && m === 'POST') { const b = await body(); await actAccion(env, Array.isArray(b.refs) ? b.refs.slice(0, 500) : [], str(b.accion, 80)); return json({ ok: true }); }
    if (path === '/api/act/agente' && m === 'POST') { const b = await body(); await actAgente(env, str(b.quien, 10), Array.isArray(b.refs) ? b.refs.slice(0, 500) : [], str(b.accion, 80), Number(b.inicio), Number(b.fin)); return json({ ok: true }); }
    if (path === '/api/medios' && m === 'GET') return json((await env.DB.prepare('SELECT * FROM medios').all()).results);
    if (path === '/api/medios/import' && m === 'POST') return json({ n: await importMedios(env, await body()) });
    if (path === '/api/notas' && m === 'POST') {
      const b = await body(), id = str(b.id, 40) || newId();
      if (!str(b.texto, 2000)) return fail('Escribí la nota');
      await env.DB.prepare('INSERT INTO notas (id, texto, kind, ref, lider, hecha, created_at, uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET texto = excluded.texto, lider = excluded.lider, hecha = excluded.hecha WHERE notas.uid = excluded.uid')
        .bind(id, str(b.texto, 2000), str(b.kind, 4), str(b.ref, 60), b.lider ? 1 : 0, b.hecha ? 1 : 0, Date.now(), U.id).run();
      return json({ id });
    }
    const delNota = path.match(/^\/api\/notas\/([\w-]+)$/);
    if (delNota && m === 'DELETE') { await env.DB.prepare('DELETE FROM notas WHERE id = ? AND uid = ?').bind(delNota[1], U.id).run(); return json({ ok: true }); }
    if (path === '/api/prompts' && m === 'POST') {
      const b = await body(), project = str(b.project, 40), clave = str(b.clave, 80);
      if (!project || !clave) return fail('Falta proyecto o tipo');
      await env.DB.prepare('INSERT INTO prompts (uid, project, clave, texto, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(uid, project, clave) DO UPDATE SET texto = excluded.texto, updated_at = excluded.updated_at').bind(U.id, project, clave, typeof b.texto === 'string' ? b.texto.slice(0, 30000) : '', Date.now()).run();
      return json({ ok: true });
    }
    if (path === '/api/ia/key' && m === 'POST') {
      const b = await body(), key = str(b.key, 200); if (key.length < 20) return fail('La clave no parece válida');
      const lista = await gemModelos(env, key), el = elegirModelos(lista);
      await putS(env, 'gemini_key', key); await putS(env, 'gemini_model_texto', el.texto); await putS(env, 'gemini_model_imagen', el.imagen);
      return json({ ok: true, ...el, modelos: lista });
    }
    if (path === '/api/ia/estado' && m === 'GET') {
      if (!(await getS(env, 'gemini_key'))) return json({ conectado: false });
      try { const lista = await gemModelos(env); return json({ conectado: true, modelos: lista, texto: await getS(env, 'gemini_model_texto'), imagen: await getS(env, 'gemini_model_imagen') }); }
      catch (e: any) { return json({ conectado: false, error: e.message }); }
    }
    if (path === '/api/ia/prueba' && m === 'POST') {
      const model = (await getS(env, 'gemini_model_texto')) || '', t0 = Date.now();
      const r = await gemGenerar(env, model, 'Respondé solo: "Conexión OK" y el nombre de tu modelo.');
      return json({ ok: true, modelo: model, respuesta: r.text.trim().slice(0, 200), ms: Date.now() - t0 });
    }
    if (path === '/api/ia/redactar' && m === 'POST') return json(await iaRedactar(env, await body()));
    if (path === '/api/ia/imagen' && m === 'POST') return json(await iaImagen(env, await body()));
    if (path === '/api/imagen' && m === 'GET') {
      const im = await imagenDe(env, url.searchParams.get('kind') ?? '', url.searchParams.get('ref') ?? '');
      if (!im) return new Response(null, { status: 204 });
      return new Response(unb64(im.data), { headers: { 'content-type': im.mime, 'cache-control': 'no-store' } });
    }
    if (path === '/api/doc/enviar' && m === 'POST') return json(await enviarDoc(env, await body()));
    if (path === '/api/gas' && m === 'POST') {
      const b = await body(); await putS(env, 'gas_url', str(b.url, 500));
      if (!(await getS(env, 'gas_secret'))) await putS(env, 'gas_secret', b64u(rand(24)));
      return json({ ok: true });
    }
    if (path === '/api/gas/secret' && m === 'GET') { if (!(await getS(env, 'gas_secret'))) await putS(env, 'gas_secret', b64u(rand(24))); return json({ secret: await getS(env, 'gas_secret') }); }
    if (path === '/api/planes' && m === 'GET') { const r: any = await env.DB.prepare('SELECT * FROM planes WHERE uid = ? AND month = ?').bind(U.id, url.searchParams.get('month') ?? '').first(); return json(r ? { ...r, data: JSON.parse(r.data) } : null); }
    if (path === '/api/planes' && m === 'POST') {
      const b = await body(); if (!isMonth(b.month)) return fail('Mes inválido');
      await env.DB.prepare("INSERT INTO planes (uid, month, estado, data, validacion, updated_at) VALUES (?, ?, ?, ?, '', ?) ON CONFLICT(uid, month) DO UPDATE SET estado = excluded.estado, data = excluded.data, validacion = CASE WHEN excluded.estado = 'borrador' THEN '' ELSE planes.validacion END, updated_at = excluded.updated_at")
        .bind(U.id, b.month, oneOf(b.estado, ['borrador', 'pedida', 'validada'], 'borrador'), JSON.stringify(b.data ?? {}).slice(0, 900000), Date.now()).run();
      return json({ ok: true });
    }
    if (path === '/api/hours' && m === 'POST') return json({ id: await saveHours(env, await body()) });
    const del = path.match(/^\/api\/(lb|red|hours)\/([\w-]+)$/);
    if (del && m === 'DELETE') {
      const table = { lb: 'lb_tasks', red: 'redacciones', hours: 'hours' }[del[1] as 'lb' | 'red' | 'hours'];
      const r = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ? AND uid = ?`).bind(del[2], U.id).first();
      if (!r) return fail('No existe', 404);
      if (del[1] !== 'hours') {
        if (r && !r.prueba) await logAS(env, del[1] as 'lb' | 'red', del[2], r.as_code || `${r.project} · ${r.anchor || r.tema || ''}`, 'Borrada en la app (revisar si hay que borrarla en AppSheet)');
      }
      await env.DB.prepare(`DELETE FROM ${table} WHERE id = ? AND uid = ?`).bind(del[2], U.id).run(); return json({ ok: true });
    }
    if (path === '/api/texto' && m === 'GET') {
      if (!(await tareaDe(env, url.searchParams.get('kind') ?? '', url.searchParams.get('ref') ?? ''))) return fail('La tarea no existe', 404);
      const r = await env.DB.prepare('SELECT * FROM textos WHERE kind = ? AND ref = ?').bind(url.searchParams.get('kind') ?? '', url.searchParams.get('ref') ?? '').first();
      return json(r ?? { titulo: '', cuerpo: '', url: '', palabras: 0, lista: 0 });
    }
    if (path === '/api/texto' && m === 'POST') {
      const b = await body(), kind = b.kind === 'red' ? 'red' : 'lb', ref = str(b.ref, 60);
      const t = await tareaDe(env, kind, ref);
      if (!t) return fail('La tarea no existe', 404);
      const cuerpo = typeof b.cuerpo === 'string' ? b.cuerpo.slice(0, 200000) : '', palabras = (cuerpo.match(/[\p{L}\p{N}]+/gu) || []).length;
      const old = await env.DB.prepare('SELECT lista FROM textos WHERE kind = ? AND ref = ?').bind(kind, ref).first();
      await env.DB.prepare('INSERT INTO textos (kind, ref, titulo, cuerpo, url, palabras, lista, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(kind, ref) DO UPDATE SET titulo = excluded.titulo, cuerpo = excluded.cuerpo, url = excluded.url, palabras = excluded.palabras, lista = excluded.lista, updated_at = excluded.updated_at')
        .bind(kind, ref, str(b.titulo, 300), cuerpo, str(b.url, 500), palabras, b.lista ? 1 : 0, Date.now()).run();
      if (b.lista && !(old && old.lista) && !t.prueba) await logAS(env, kind, ref, t.as_code || `${t.project} · ${t.anchor || t.tema || ''}`, `Redacción lista en la app (${palabras} palabras): pasarla al documento de AppSheet`);
      return json({ ok: true, palabras });
    }
    if (path === '/api/projects' && m === 'POST') {
      const b = await body(); if (!Array.isArray(b.projects)) return fail('Faltan los proyectos');
      for (const p of b.projects) {
        const prev = JSON.parse(((await env.DB.prepare('SELECT params FROM projects WHERE uid = ? AND code = ?').bind(U.id, str(p.code, 40)).first()) as any)?.params || '{}');
        const pr = p.params || {}, params = { drMin: numOrNull(pr.drMin), trafMin: numOrNull(pr.trafMin), precioMaxUSD: numOrNull(pr.precioMaxUSD), repDias: numOrNull(pr.repDias), palabrasMin: numOrNull(pr.palabrasMin), linksMes: numOrNull(pr.linksMes), piezasMes: numOrNull(pr.piezasMes ?? pr.linksMes), dominio: str(pr.dominio, 120), paises: str(pr.paises, 120), servicio: str(pr.servicio, 60) };
        await env.DB.prepare('UPDATE projects SET cliente = ?, active = ?, params = ? WHERE uid = ? AND code = ?').bind(str(p.cliente, 80), p.active ? 1 : 0, JSON.stringify({ ...prev, ...params, ...(pr.costos && typeof pr.costos === 'object' ? { costos: pr.costos, costosAt: hoyEn(TZ) } : {}), ...(numOrNull(pr.presupuestoMensualARS) !== null ? { presupuestoMensualARS: numOrNull(pr.presupuestoMensualARS), costoObjetivo: numOrNull(pr.costoObjetivo) ?? 30 } : {}) }), U.id, str(p.code, 40)).run();
      }
      return json({ ok: true });
    }
    if (path === '/api/plan' && m === 'POST') {
      const b = await body(); if (!isMonth(b.month) || !Array.isArray(b.rows)) return fail('Plan inválido');
      await env.DB.prepare('DELETE FROM plan WHERE uid = ? AND month = ?').bind(U.id, b.month).run();
      for (const r of b.rows) {
        const h = Number(r.hours) || 0, u = Math.round(Number(r.units) || 0);
        if (h > 0 || u > 0) await env.DB.prepare('INSERT INTO plan (uid, month, project, task_type, hours, units) VALUES (?, ?, ?, ?, ?, ?)').bind(U.id, b.month, str(r.project, 40), str(r.task_type, 60), h, u).run();
      }
      return json({ ok: true });
    }
    if (path === '/api/as/done' && m === 'POST') {
      const b = await body(), ids: number[] = Array.isArray(b.ids) ? b.ids.map(Number).filter(Number.isFinite) : [];
      for (const id of ids) await env.DB.prepare('UPDATE as_log SET done = 1 WHERE id = ? AND uid = ?').bind(id, U.id).run();
      return json({ ok: true });
    }
    if (path === '/api/settings' && m === 'POST') {
      const b = await body();
      for (const k of Object.keys(PUBLIC_SETTINGS)) if (k in b && k !== 'as_url' && k !== 'conectado_at') await putS(env, k, str(b[k], 300));
      if ('as_url' in b && U.admin) { const v = linkAppSheet(b.as_url); if (v || !b.as_url) await putS(env, 'as_url', v); }
      return json({ ok: true });
    }
    if (path === '/api/calendar' && m === 'GET') return json({ url: `${url.origin}/cal/${await getS(env, 'cal_token')}.ics` });
    if (path === '/api/calendar/reset' && m === 'POST') { await putS(env, 'cal_token', b64u(rand(24))); return json({ url: `${url.origin}/cal/${await getS(env, 'cal_token')}.ics` }); }
    if (path === '/api/vapid' && m === 'GET') return json({ publicKey: (await vapid(env)).pub });
    if (path === '/api/push/subscribe' && m === 'POST') {
      const b = await body(); if (typeof b.endpoint !== 'string' || !b.keys?.p256dh) return fail('Suscripción inválida');
      await env.DB.prepare('INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at, uid) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, uid = excluded.uid')
        .bind(b.endpoint, b.keys.p256dh, b.keys.auth ?? '', Date.now(), U.id).run();
      return json({ ok: true });
    }
    if (path === '/api/push/test' && m === 'POST') return json({ delivered: await push(env, url.origin, 'Proyectos Eleven', 'Los avisos funcionan.') });
    if (path === '/api/export' && m === 'GET') return json(await allData(env));
    return fail('No encontrado', 404);
  } catch (e: any) {
    return fail(e?.message ?? 'Error', e?.status ?? 500);
  }
}

export default {
  fetch: (req: Request, env: Env) => handle(req, env),
  scheduled: async (_e: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) => {
    ctx.waitUntil((async () => {
      await ensureSchema(env);
      const origin = (await getS(env, 'origin')) ?? 'https://proyectos-eleven.workers.dev';
      for (const u of (await env.DB.prepare('SELECT id, nombre, email, admin FROM users').all()).results as any[]) await runAvisos(conUsuario(env, u), origin).catch(() => undefined);
    })());
  },
};
