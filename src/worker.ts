/* Proyectos Eleven — servidor (Cloudflare Worker + D1). Un solo usuario (Martín).
 * Todo /api/* (salvo estado, alta inicial e ingreso) exige Authorization: Bearer <token de sesión>.
 * El calendario se publica en /cal/<token>.ics para suscribirse desde Google Calendar. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SCHEMA, MIGRATIONS } from './schema.ts';
import { PROYECTOS_INICIALES, PLAN_INICIAL, SEED_VERSION, TIPOS_SERVICIO, ESTADOS_NEG, PRIORIDADES, MONEDAS, PUBLICADOS, TAREAS, YO, hoyEn, addDays } from '../public/shared.js';

export interface Env { DB: any; ASSETS?: any }
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
  // Datos iniciales y actualizaciones: suma proyectos y filas de plan nuevas sin pisar lo que ya editaste.
  const v = Number((await env.DB.prepare("SELECT value FROM settings WHERE key = 'seed_v'").first())?.value ?? 0);
  if (v < SEED_VERSION) {
    let i = 0;
    for (const p of PROYECTOS_INICIALES) {
      const old = await env.DB.prepare('SELECT params FROM projects WHERE code = ?').bind(p.code).first();
      if (!old) await env.DB.prepare('INSERT INTO projects (code, cliente, tipo, active, params, orden) VALUES (?, ?, ?, 1, ?, ?)').bind(p.code, p.cliente, p.tipo, JSON.stringify(p.params), i).run();
      else {
        const cur = JSON.parse((old.params as string) || '{}');
        const merged: Record<string, unknown> = { ...p.params };
        for (const [k, val] of Object.entries(cur)) if (val !== null && val !== '' && val !== undefined) merged[k] = val;
        await env.DB.prepare('UPDATE projects SET params = ?, orden = ? WHERE code = ?').bind(JSON.stringify(merged), i, p.code).run();
      }
      i++;
    }
    for (const [project, task_type, hours, units] of PLAN_INICIAL.rows)
      await env.DB.prepare('INSERT OR IGNORE INTO plan (month, project, task_type, hours, units) VALUES (?, ?, ?, ?, ?)').bind(PLAN_INICIAL.month, project, task_type, hours, units).run();
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('seed_v', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(SEED_VERSION)).run();
  }
  ready.add(env.DB);
}
async function getS(env: Env, key: string): Promise<string | null> {
  const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return r ? (r.value as string) : null;
}
async function putS(env: Env, key: string, value: string) {
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
}
const PUBLIC_SETTINGS: Record<string, string> = { aviso_hora: '9', horas_hora: '18', avisos: '1', timer: '', as_sync_at: '' };

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
async function newSession(env: Env) {
  const token = b64u(rand(32)), now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (th, created_at, seen_at) VALUES (?, ?, ?)').bind(await sha256hex(token), now, now).run();
  return token;
}
async function authed(req: Request, env: Env) {
  const tok = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (tok.length < 20) return false;
  const th = await sha256hex(tok), r = await env.DB.prepare('SELECT seen_at FROM sessions WHERE th = ?').bind(th).first();
  if (!r) return false;
  const now = Date.now();
  if (now - Number(r.seen_at) > 180 * 864e5) { await env.DB.prepare('DELETE FROM sessions WHERE th = ?').bind(th).run(); return false; }
  if (now - Number(r.seen_at) > 864e5) await env.DB.prepare('UPDATE sessions SET seen_at = ? WHERE th = ?').bind(now, th).run();
  return true;
}
async function throttled(env: Env) { const v = Number(await getS(env, 'lock_until') ?? 0); return v > Date.now(); }
async function badTry(env: Env) {
  const n = Number(await getS(env, 'fails') ?? 0) + 1;
  if (n >= 8) { await putS(env, 'lock_until', String(Date.now() + 15 * 60000)); await putS(env, 'fails', '0'); } else await putS(env, 'fails', String(n));
}

// ---------- registro de cambios para replicar en AppSheet ----------
async function logAS(env: Env, entity: 'lb' | 'red', ref: string, label: string, change: string) {
  await env.DB.prepare('INSERT INTO as_log (entity, ref, label, change, at, done) VALUES (?, ?, ?, ?, ?, 0)').bind(entity, ref, label, change, Date.now()).run();
}

// ---------- tareas de link building ----------
const LB_FIELDS = ['project', 'as_code', 'estado', 'usuario', 'url_publicacion', 'tipo_servicio', 'anchor', 'url_cliente', 'medio', 'dr', 'trafico', 'precio', 'moneda', 'estado_neg', 'mail_eleven', 'contacto_medio', 'deadline', 'notas'] as const;
function cleanLB(b: any) {
  return {
    project: str(b.project, 40), as_code: str(b.as_code, 40).toUpperCase(), estado: str(b.estado, 80) || 'No Iniciado', usuario: str(b.usuario, 80) || YO, url_publicacion: str(b.url_publicacion, 500),
    tipo_servicio: oneOf(b.tipo_servicio, TIPOS_SERVICIO, 'Intervalo métrica 21-40'), anchor: str(b.anchor, 300), url_cliente: str(b.url_cliente, 500),
    medio: str(b.medio, 200), dr: numOrNull(b.dr), trafico: numOrNull(b.trafico), precio: numOrNull(b.precio), moneda: oneOf(b.moneda, [...MONEDAS, ''], 'USD'),
    estado_neg: str(b.estado_neg, 60), mail_eleven: str(b.mail_eleven, 120).toLowerCase(), contacto_medio: str(b.contacto_medio, 200),
    deadline: isDate(b.deadline) ? b.deadline : '', notas: str(b.notas, 2000),
  };
}
async function saveLB(env: Env, b: any) {
  const v = cleanLB(b), now = Date.now(), hoy = hoyEn(TZ, now);
  if (!(await env.DB.prepare("SELECT 1 AS x FROM projects WHERE code = ? AND tipo = 'LIN'").bind(v.project).first())) throw Object.assign(new Error('Proyecto de link building inválido'), { status: 400 });
  const label = v.as_code || `${v.project} · ${v.anchor || v.medio || 'tarea nueva'}`;
  if (b.id) {
    const old = await env.DB.prepare('SELECT * FROM lb_tasks WHERE id = ?').bind(b.id).first();
    if (!old) throw Object.assign(new Error('La tarea no existe'), { status: 404 });
    const changes: string[] = [];
    for (const k of LB_FIELDS) if (k !== 'notas' && String(old[k] ?? '') !== String((v as any)[k] ?? '')) changes.push(`${k}: ${old[k] ?? '—'} → ${(v as any)[k] ?? '—'}`);
    const publicado = PUBLICADOS.has(v.estado) ? (old.publicado || hoy) : '';
    await env.DB.prepare(`UPDATE lb_tasks SET ${LB_FIELDS.map(k => `${k} = ?`).join(', ')}, publicado = ?, updated_at = ? WHERE id = ?`)
      .bind(...LB_FIELDS.map(k => (v as any)[k]), publicado, now, b.id).run();
    if (changes.length) await logAS(env, 'lb', b.id, label, changes.join(' · '));
    return b.id as string;
  }
  const id = newId();
  await env.DB.prepare(`INSERT INTO lb_tasks (id, ${LB_FIELDS.join(', ')}, publicado, created_at, updated_at) VALUES (?, ${LB_FIELDS.map(() => '?').join(', ')}, ?, ?, ?)`)
    .bind(id, ...LB_FIELDS.map(k => (v as any)[k]), PUBLICADOS.has(v.estado) ? hoy : '', now, now).run();
  await logAS(env, 'lb', id, label, `Tarea nueva (${v.estado})`);
  return id;
}

// ---------- redacciones ----------
const RED_FIELDS = ['project', 'as_code', 'tema', 'subproyecto', 'variante', 'idioma', 'pais', 'fecha_entrega', 'deadline_estado', 'prioridad', 'ia', 'estado', 'usuario', 'notas'] as const;
function cleanRED(b: any) {
  return {
    project: str(b.project, 40), as_code: str(b.as_code, 40).toUpperCase(), tema: str(b.tema, 300), subproyecto: str(b.subproyecto, 120), variante: str(b.variante, 120),
    deadline_estado: isDate(b.deadline_estado) ? b.deadline_estado : '', usuario: str(b.usuario, 80) || YO, idioma: str(b.idioma, 40) || 'Español', pais: str(b.pais, 60) || 'Argentina',
    fecha_entrega: isDate(b.fecha_entrega) ? b.fecha_entrega : '', prioridad: str(b.prioridad, 30) || 'Normal', ia: b.ia ? 1 : 0,
    estado: str(b.estado, 80) || 'Pendiente', notas: str(b.notas, 2000),
  };
}
async function saveRED(env: Env, b: any) {
  const v = cleanRED(b), now = Date.now(), hoy = hoyEn(TZ, now);
  if (!v.tema) throw Object.assign(new Error('Falta el tema'), { status: 400 });
  if (!(await env.DB.prepare("SELECT 1 AS x FROM projects WHERE code = ? AND tipo = 'RED'").bind(v.project).first())) throw Object.assign(new Error('Proyecto de redacción inválido'), { status: 400 });
  if (b.id) {
    const old = await env.DB.prepare('SELECT * FROM redacciones WHERE id = ?').bind(b.id).first();
    if (!old) throw Object.assign(new Error('La redacción no existe'), { status: 404 });
    const changes: string[] = [];
    for (const k of RED_FIELDS) if (k !== 'notas' && String(old[k] ?? '') !== String((v as any)[k] ?? '')) changes.push(`${k}: ${old[k] ?? '—'} → ${(v as any)[k] ?? '—'}`);
    const entregada = old.entregada || '';
    await env.DB.prepare(`UPDATE redacciones SET ${RED_FIELDS.map(k => `${k} = ?`).join(', ')}, entregada = ?, updated_at = ? WHERE id = ?`)
      .bind(...RED_FIELDS.map(k => (v as any)[k]), entregada, now, b.id).run();
    if (changes.length) await logAS(env, 'red', b.id, `${v.project} · ${v.tema}`, changes.join(' · '));
    return b.id as string;
  }
  const id = newId();
  await env.DB.prepare(`INSERT INTO redacciones (id, ${RED_FIELDS.join(', ')}, entregada, created_at, updated_at) VALUES (?, ${RED_FIELDS.map(() => '?').join(', ')}, ?, ?, ?)`)
    .bind(id, ...RED_FIELDS.map(k => (v as any)[k]), '', now, now).run();
  await logAS(env, 'red', id, `${v.project} · ${v.tema}`, 'Redacción nueva: cargar en AppSheet (Carga de Redacciones)');
  return id;
}

// ---------- horas ----------
async function saveHours(env: Env, b: any) {
  const project = str(b.project, 40), hours = Number(b.hours), date = isDate(b.date) ? b.date : hoyEn(TZ);
  const p = await env.DB.prepare('SELECT tipo FROM projects WHERE code = ?').bind(project).first();
  if (!p) throw Object.assign(new Error('Proyecto inválido'), { status: 400 });
  const task_type = oneOf(b.task_type, (TAREAS as any)[p.tipo] as string[], (TAREAS as any)[p.tipo][0]);
  if (!(hours > 0 && hours <= 24)) throw Object.assign(new Error('Horas inválidas (entre 0 y 24)'), { status: 400 });
  const id = b.id || newId();
  await env.DB.prepare('INSERT INTO hours (id, date, project, task_type, hours, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET date = excluded.date, project = excluded.project, task_type = excluded.task_type, hours = excluded.hours, note = excluded.note')
    .bind(id, date, project, task_type, Math.round(hours * 100) / 100, str(b.note, 300), Date.now()).run();
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
export async function importAS(env: Env, b: any) {
  const now = Date.now(), codes = new Set(((await env.DB.prepare('SELECT code FROM projects').all()).results as any[]).map(r => r.code));
  const out = { lb: 0, red: 0, saltadas: 0 };
  for (const r of Array.isArray(b.lb) ? b.lb : []) {
    const code = str(r[0], 40).toUpperCase(), project = code.replace(/-\d+$/, '');
    if (!codes.has(project)) { out.saltadas++; continue; }
    const pub = asDate(r[9]);
    await env.DB.prepare(`INSERT INTO lb_tasks (id, project, as_code, estado, usuario, tipo_servicio, anchor, medio, estado_neg, moneda, precio, mail_eleven, deadline, publicado, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, usuario = excluded.usuario, tipo_servicio = excluded.tipo_servicio, anchor = excluded.anchor, medio = excluded.medio,
        estado_neg = excluded.estado_neg, moneda = excluded.moneda, precio = excluded.precio, mail_eleven = excluded.mail_eleven, deadline = excluded.deadline, publicado = excluded.publicado, updated_at = excluded.updated_at`)
      .bind(code, project, code, str(r[3], 80) || 'No Iniciado', str(r[10], 80), str(r[2], 60), str(r[4], 300), str(r[5], 200), str(r[6], 60), str(r[7], 8), asMoney(r[8]), str(r[11], 120).toLowerCase(), asDate(r[1]), pub, now, now).run();
    out.lb++;
  }
  for (const r of Array.isArray(b.red) ? b.red : []) {
    const code = str(r[0], 40).toUpperCase(), project = code.replace(/-\d+$/, '');
    if (!codes.has(project)) { out.saltadas++; continue; }
    await env.DB.prepare(`INSERT INTO redacciones (id, project, as_code, tema, pais, idioma, subproyecto, variante, fecha_entrega, prioridad, estado, deadline_estado, usuario, entregada, ia, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET tema = excluded.tema, pais = excluded.pais, idioma = excluded.idioma, subproyecto = excluded.subproyecto, variante = excluded.variante, fecha_entrega = excluded.fecha_entrega,
        prioridad = excluded.prioridad, estado = excluded.estado, deadline_estado = excluded.deadline_estado, usuario = excluded.usuario, entregada = excluded.entregada, updated_at = excluded.updated_at`)
      .bind(code, project, code, str(r[1], 300), str(r[2], 60), str(r[3], 40), str(r[4], 120), str(r[5], 120), asDate(r[6]), str(r[7], 30) || 'Normal', str(r[8], 80), asDate(r[9]), str(r[10], 80), asDate(r[11]), now, now).run();
    out.red++;
  }
  await putS(env, 'as_sync_at', String(now));
  return out;
}

// ---------- calendario (.ics) ----------
const icsEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line: string) => { const out: string[] = []; let s = line; while (enc(s).length > 74) { let n = 74; while (enc(s.slice(0, n)).length > 74) n--; out.push(s.slice(0, n)); s = ' ' + s.slice(n); } out.push(s); return out.join('\r\n'); };
export async function buildICS(env: Env, origin: string) {
  const lb = (await env.DB.prepare("SELECT * FROM lb_tasks WHERE deadline != '' AND estado NOT LIKE 'Backlink Publicado%' AND estado NOT IN ('Cerrado', 'Anulado') AND usuario = ?").bind(YO).all()).results as any[];
  const red = (await env.DB.prepare("SELECT * FROM redacciones WHERE fecha_entrega != '' AND estado NOT IN ('Cerrado', 'Anulado') AND usuario = ?").bind(YO).all()).results as any[];
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
  const subs = (await env.DB.prepare('SELECT endpoint FROM push_subscriptions').all()).results as { endpoint: string }[];
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
  const lb = (await env.DB.prepare("SELECT project, anchor, as_code, deadline FROM lb_tasks WHERE deadline != '' AND deadline <= ? AND estado NOT LIKE 'Backlink Publicado%' AND estado NOT IN ('Cerrado', 'Anulado') AND usuario = ?").bind(man, YO).all()).results as any[];
  const red = (await env.DB.prepare("SELECT project, tema, fecha_entrega AS deadline FROM redacciones WHERE fecha_entrega != '' AND fecha_entrega <= ? AND estado NOT IN ('Cerrado', 'Anulado') AND usuario = ?").bind(man, YO).all()).results as any[];
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
    const tot = await env.DB.prepare('SELECT COALESCE(SUM(hours), 0) AS h FROM hours WHERE date = ?').bind(hoy).first();
    if (Number(tot?.h ?? 0) === 0 && await onceFor(env, 'horas', hoy)) { await push(env, origin, 'Horas de hoy', 'Todavía no cargaste horas hoy.'); sent.push('horas'); }
  }
  return sent;
}

// ---------- lectura de todo ----------
async function allData(env: Env) {
  const q = async (sql: string) => (await env.DB.prepare(sql).all()).results;
  const projects = ((await q('SELECT * FROM projects ORDER BY orden')) as any[]).map(p => ({ ...p, params: JSON.parse(p.params || '{}') }));
  const settings: Record<string, string> = {};
  for (const k of Object.keys(PUBLIC_SETTINGS)) settings[k] = (await getS(env, k)) ?? PUBLIC_SETTINGS[k];
  return {
    projects,
    lb: await q('SELECT * FROM lb_tasks ORDER BY CASE WHEN deadline = \'\' THEN 1 ELSE 0 END, deadline, created_at'),
    red: await q('SELECT * FROM redacciones ORDER BY CASE WHEN fecha_entrega = \'\' THEN 1 ELSE 0 END, fecha_entrega, created_at'),
    hours: await q('SELECT * FROM hours ORDER BY date DESC, created_at DESC'),
    plan: await q('SELECT * FROM plan ORDER BY month, project, task_type'),
    as_pend: await q('SELECT * FROM as_log WHERE done = 0 ORDER BY at'),
    textos: await q('SELECT kind, ref, palabras, lista, updated_at FROM textos'),
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
      const tok = path.slice(5).replace(/\.ics$/, ''), cal = await getS(env, 'cal_token');
      if (!cal || !sameStr(tok, cal)) return new Response('Not found', { status: 404 });
      return new Response(await buildICS(env, url.origin), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
    }
    // importación desde la página de AppSheet (clave de un solo uso guardada en la base)
    if (path === '/api/import') {
      const cors = { 'access-control-allow-origin': 'https://www.appsheet.com', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-import-key', 'access-control-max-age': '600' };
      if (m === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      const key = await getS(env, 'import_key'), given = req.headers.get('x-import-key') ?? '';
      if (m !== 'POST' || !key || key.length < 20 || !sameStr(given, key)) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { ...cors, 'content-type': 'application/json' } });
      const r = await importAS(env, await body());
      return new Response(JSON.stringify(r), { headers: { ...cors, 'content-type': 'application/json' } });
    }
    if (path === '/api/state' && m === 'GET') return json({ setup: !(await getS(env, 'pw')) });
    if (path === '/api/setup' && m === 'POST') {
      if (await getS(env, 'pw')) return fail('La contraseña ya está creada', 409);
      const b = await body(); if (typeof b.password !== 'string' || b.password.length < 8) return fail('La contraseña debe tener al menos 8 caracteres');
      await putS(env, 'pw', await hashPw(b.password)); await putS(env, 'cal_token', b64u(rand(24)));
      return json({ token: await newSession(env) });
    }
    if (path === '/api/login' && m === 'POST') {
      if (await throttled(env)) return fail('Demasiados intentos. Probá en 15 minutos.', 429);
      const b = await body(), pw = await getS(env, 'pw');
      if (!pw || typeof b.password !== 'string' || !(await verifyPw(b.password, pw))) { await badTry(env); return fail('Contraseña incorrecta', 401); }
      await putS(env, 'fails', '0'); return json({ token: await newSession(env) });
    }
    if (path === '/api/last-notification' && m === 'GET') {
      const sub = await env.DB.prepare('SELECT 1 AS x FROM push_subscriptions WHERE endpoint = ?').bind(url.searchParams.get('ep') ?? '').first();
      const n = sub ? await getS(env, 'last_notification') : null;
      return json(n ? JSON.parse(n) : { title: 'Proyectos Eleven', body: 'Tenés un aviso.' });
    }
    if (!(await authed(req, env))) return fail('Sesión vencida', 401);

    if (path === '/api/data' && m === 'GET') return json(await allData(env));
    if (path === '/api/logout' && m === 'POST') {
      const tok = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
      await env.DB.prepare('DELETE FROM sessions WHERE th = ?').bind(await sha256hex(tok)).run(); return json({ ok: true });
    }
    if (path === '/api/lb' && m === 'POST') return json({ id: await saveLB(env, await body()) });
    if (path === '/api/red' && m === 'POST') return json({ id: await saveRED(env, await body()) });
    if (path === '/api/hours' && m === 'POST') return json({ id: await saveHours(env, await body()) });
    const del = path.match(/^\/api\/(lb|red|hours)\/([\w-]+)$/);
    if (del && m === 'DELETE') {
      const table = { lb: 'lb_tasks', red: 'redacciones', hours: 'hours' }[del[1] as 'lb' | 'red' | 'hours'];
      if (del[1] !== 'hours') {
        const r = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(del[2]).first();
        if (r) await logAS(env, del[1] as 'lb' | 'red', del[2], r.as_code || `${r.project} · ${r.anchor || r.tema || ''}`, 'Borrada en la app (revisar si hay que borrarla en AppSheet)');
      }
      await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(del[2]).run(); return json({ ok: true });
    }
    if (path === '/api/texto' && m === 'GET') {
      const r = await env.DB.prepare('SELECT * FROM textos WHERE kind = ? AND ref = ?').bind(url.searchParams.get('kind') ?? '', url.searchParams.get('ref') ?? '').first();
      return json(r ?? { titulo: '', cuerpo: '', url: '', palabras: 0, lista: 0 });
    }
    if (path === '/api/texto' && m === 'POST') {
      const b = await body(), kind = b.kind === 'red' ? 'red' : 'lb', ref = str(b.ref, 60);
      const t = await env.DB.prepare(`SELECT * FROM ${kind === 'lb' ? 'lb_tasks' : 'redacciones'} WHERE id = ?`).bind(ref).first();
      if (!t) return fail('La tarea no existe', 404);
      const cuerpo = typeof b.cuerpo === 'string' ? b.cuerpo.slice(0, 200000) : '', palabras = (cuerpo.match(/[\p{L}\p{N}]+/gu) || []).length;
      const old = await env.DB.prepare('SELECT lista FROM textos WHERE kind = ? AND ref = ?').bind(kind, ref).first();
      await env.DB.prepare('INSERT INTO textos (kind, ref, titulo, cuerpo, url, palabras, lista, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(kind, ref) DO UPDATE SET titulo = excluded.titulo, cuerpo = excluded.cuerpo, url = excluded.url, palabras = excluded.palabras, lista = excluded.lista, updated_at = excluded.updated_at')
        .bind(kind, ref, str(b.titulo, 300), cuerpo, str(b.url, 500), palabras, b.lista ? 1 : 0, Date.now()).run();
      if (b.lista && !(old && old.lista)) await logAS(env, kind, ref, t.as_code || `${t.project} · ${t.anchor || t.tema || ''}`, `Redacción lista en la app (${palabras} palabras): pasarla al documento de AppSheet`);
      return json({ ok: true, palabras });
    }
    if (path === '/api/projects' && m === 'POST') {
      const b = await body(); if (!Array.isArray(b.projects)) return fail('Faltan los proyectos');
      for (const p of b.projects) {
        const pr = p.params || {}, params = { drMin: numOrNull(pr.drMin), trafMin: numOrNull(pr.trafMin), precioMaxUSD: numOrNull(pr.precioMaxUSD), repDias: numOrNull(pr.repDias), palabrasMin: numOrNull(pr.palabrasMin), dominio: str(pr.dominio, 120), paises: str(pr.paises, 120), servicio: str(pr.servicio, 60) };
        await env.DB.prepare('UPDATE projects SET cliente = ?, active = ?, params = ? WHERE code = ?').bind(str(p.cliente, 80), p.active ? 1 : 0, JSON.stringify(params), str(p.code, 40)).run();
      }
      return json({ ok: true });
    }
    if (path === '/api/plan' && m === 'POST') {
      const b = await body(); if (!isMonth(b.month) || !Array.isArray(b.rows)) return fail('Plan inválido');
      await env.DB.prepare('DELETE FROM plan WHERE month = ?').bind(b.month).run();
      for (const r of b.rows) {
        const h = Number(r.hours) || 0, u = Math.round(Number(r.units) || 0);
        if (h > 0 || u > 0) await env.DB.prepare('INSERT INTO plan (month, project, task_type, hours, units) VALUES (?, ?, ?, ?, ?)').bind(b.month, str(r.project, 40), str(r.task_type, 60), h, u).run();
      }
      return json({ ok: true });
    }
    if (path === '/api/as/done' && m === 'POST') {
      const b = await body(), ids: number[] = Array.isArray(b.ids) ? b.ids.map(Number).filter(Number.isFinite) : [];
      for (const id of ids) await env.DB.prepare('UPDATE as_log SET done = 1 WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
    if (path === '/api/settings' && m === 'POST') {
      const b = await body();
      for (const k of Object.keys(PUBLIC_SETTINGS)) if (k in b) await putS(env, k, str(b[k], 300));
      return json({ ok: true });
    }
    if (path === '/api/calendar' && m === 'GET') return json({ url: `${url.origin}/cal/${await getS(env, 'cal_token')}.ics` });
    if (path === '/api/calendar/reset' && m === 'POST') { await putS(env, 'cal_token', b64u(rand(24))); return json({ url: `${url.origin}/cal/${await getS(env, 'cal_token')}.ics` }); }
    if (path === '/api/vapid' && m === 'GET') return json({ publicKey: (await vapid(env)).pub });
    if (path === '/api/push/subscribe' && m === 'POST') {
      const b = await body(); if (typeof b.endpoint !== 'string' || !b.keys?.p256dh) return fail('Suscripción inválida');
      await env.DB.prepare('INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth')
        .bind(b.endpoint, b.keys.p256dh, b.keys.auth ?? '', Date.now()).run();
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
      await runAvisos(env, (await getS(env, 'origin')) ?? 'https://proyectos-eleven.workers.dev').catch(() => undefined);
    })());
  },
};
