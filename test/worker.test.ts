// Pruebas del servidor sobre SQLite en memoria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handle, runAvisos, resumenDeadlines } from '../src/worker.ts';
import { avisosLB, hoyEn, addDays, compiladoAMedios, aptoMedio, planificar, alertas, PROYECTOS_INICIALES } from '../public/shared.js';
import { actPing, actAccion, actAgente, horasAuto, elegirModelos } from '../src/worker.ts';

function mkEnv() {
  const db = new DatabaseSync(':memory:');
  const mk = (st: any, a: any[]): any => ({ bind: (...x: any[]) => mk(st, x), first: async () => st.get(...a) ?? null, all: async () => ({ results: st.all(...a) }), run: async () => { st.run(...a); return {}; } });
  const DB = { prepare: (sql: string) => mk(db.prepare(sql), []) };
  (DB as any).batch = async (sts: any[]) => { for (const st of sts) await st.run(); return []; };
  return { DB };
}
const U1 = (env: any) => ({ ...env, U: { id: 'u1', nombre: 'Martín Botana', email: '', admin: 1 } });
const call = async (env: any, path: string, method = 'GET', body?: unknown, token?: string) => {
  const r = await handle(new Request('https://pe.test' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, j: ct.includes('json') ? await r.json() as any : await r.text() };
};

test('alta, ingreso y datos iniciales', async () => {
  const env = mkEnv();
  assert.equal((await call(env, '/api/state')).j.setup, true);
  assert.equal((await call(env, '/api/data')).status, 401);
  assert.equal((await call(env, '/api/setup', 'POST', { password: 'corta' })).status, 400);
  const { j } = await call(env, '/api/setup', 'POST', { password: 'clave-segura-1' });
  assert.ok(j.token);
  assert.equal((await call(env, '/api/setup', 'POST', { password: 'otra-clave-2' })).status, 409);
  assert.equal((await call(env, '/api/login', 'POST', { password: 'mal-clave-x' })).status, 401);
  const tok = (await call(env, '/api/login', 'POST', { password: 'clave-segura-1' })).j.token;
  const d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.deepEqual(d.projects.map((p: any) => p.code), ['GAL-LIN-1', 'GAL-RED-1', 'LAV-LIN-4', 'LAV-RED-5', 'NAV-LIN-5', 'NAV-RED-5', 'OMI-LIN-1', 'OMI-RED-2', 'TEL-LIN-2', 'TEL-RED-2', 'XUB-LIN-1', 'XUB-LIN-2']);
  assert.ok(!d.projects.some((p: any) => p.code === 'XUB-RED-1'));
  assert.equal(d.plan.find((p: any) => p.project === 'TEL-LIN-2').hours, 16);
});

test('tareas, cambios para AppSheet, horas y calendario', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { password: 'clave-segura-1' })).j.token;
  const hoy = hoyEn();
  const lb = await call(env, '/api/lb', 'POST', { project: 'GAL-LIN-1', anchor: 'cotizar seguro auto', medio: 'https://www.lamanana.com.ar/', dr: 19, deadline: hoy, mail_eleven: 'Laura@Eleven-Agencia.net' }, tok);
  assert.equal(lb.status, 200);
  assert.equal((await call(env, '/api/lb', 'POST', { project: 'GAL-RED-1', anchor: 'x' }, tok)).status, 400, 'un proyecto RED no sirve para LB');
  let d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  const t = d.lb[0];
  assert.equal(t.mail_eleven, 'laura@eleven-agencia.net');
  assert.equal(d.as_pend.length, 1);
  await call(env, '/api/lb', 'POST', { ...t, estado: 'Backlink Publicado' }, tok);
  d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.lb[0].publicado, hoy);
  assert.match(d.as_pend[1].change, /estado: No Iniciado → Backlink Publicado/);
  await call(env, '/api/as/done', 'POST', { ids: d.as_pend.map((a: any) => a.id) }, tok);
  assert.equal((await call(env, '/api/data', 'GET', undefined, tok)).j.as_pend.length, 0);

  assert.equal((await call(env, '/api/red', 'POST', { project: 'TEL-RED-2', tema: '' }, tok)).status, 400);
  await call(env, '/api/red', 'POST', { project: 'TEL-RED-2', tema: 'Celulares 5G', fecha_entrega: addDays(hoy, 1), ia: true }, tok);
  assert.equal((await call(env, '/api/hours', 'POST', { project: 'TEL-LIN-2', task_type: 'A - Creación de links', hours: 30 }, tok)).status, 400);
  await call(env, '/api/hours', 'POST', { project: 'TEL-LIN-2', task_type: 'A - Creación de links', hours: 1.5 }, tok);
  await call(env, '/api/hours', 'POST', { project: 'TEL-RED-2', task_type: 'no existe', hours: 1 }, tok);
  d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.hours.filter((x: any) => !x.auto).length, 2);
  assert.equal(d.hours.find((x: any) => x.project === 'TEL-RED-2' && !x.auto).task_type, 'A - Redacción manual', 'tarea inválida → primera del tipo');

  const cal = (await call(env, '/api/calendar', 'GET', undefined, tok)).j.url as string;
  const ics = await call(env, new URL(cal).pathname);
  assert.equal(ics.status, 200);
  assert.match(ics.j, /BEGIN:VCALENDAR/);
  assert.match(ics.j, /Celulares 5G/);
  assert.doesNotMatch(ics.j, /cotizar seguro auto/, 'las publicadas no van al calendario');
  assert.equal((await call(env, '/cal/token-falso.ics')).status, 404);

  const r = await resumenDeadlines(U1(env), hoy);
  assert.match(r!.title, /1 para mañana/);
});

test('avisos de validación como en AppSheet', () => {
  const p = { params: { drMin: 20, trafMin: 500, precioMaxUSD: 100, repDias: 90 } };
  const a = { id: 'a', project: 'GAL-LIN-1', medio: 'lamanana.com.ar', dr: 19, trafico: 400, precio: 120, moneda: 'USD', deadline: '2026-12-31' };
  const b = { id: 'b', project: 'GAL-LIN-1', medio: 'https://www.lamanana.com.ar/nota', as_code: 'GAL-LIN-1-30', deadline: '2026-11-20' };
  const av = avisosLB(a, p, [a, b]);
  assert.equal(av.length, 4);
  assert.ok(av.some(s => s.startsWith('❗Medio repetido') && s.includes('GAL-LIN-1-30')));
  assert.equal(avisosLB({ ...a, dr: 25, trafico: 900, precio: 90 }, p, [a]).length, 0);
  assert.equal(avisosLB({ ...a, precio: 150000, moneda: 'ARS' }, p, [a]).filter(s => s.startsWith('Precio')).length, 0);
});

test('avisos programados: una vez por día', async () => {
  const env = mkEnv(); const tok = (await call(env, '/api/setup', 'POST', { password: 'clave-segura-1' })).j.token;
  await call(env, '/api/red', 'POST', { project: 'NAV-RED-5', tema: 'Link de pago', fecha_entrega: hoyEn() }, tok);
  // martes 2026-11-17 19:00 en Buenos Aires = 22:00 UTC
  const t = Date.parse('2026-11-17T22:00:00Z');
  const s1 = await runAvisos(U1(env), 'https://pe.test', t);
  assert.ok(s1.includes('horas'));
  assert.deepEqual(await runAvisos(U1(env), 'https://pe.test', t + 60000), []);
});

test('redacción manual de una tarea', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { password: 'clave-segura-1' })).j.token;
  const id = (await call(env, '/api/lb', 'POST', { project: 'LAV-LIN-4', estado: 'Gestión de Backlink', anchor: 'pan dulce' }, tok)).j.id;
  await call(env, '/api/as/done', 'POST', { ids: [1] }, tok);
  const r = await call(env, '/api/texto', 'POST', { kind: 'lb', ref: id, titulo: 'Pan dulce casero', cuerpo: 'Uno dos tres cuatro, cinco.', lista: true }, tok);
  assert.equal(r.j.palabras, 5);
  const t = (await call(env, `/api/texto?kind=lb&ref=${id}`, 'GET', undefined, tok)).j;
  assert.equal(t.titulo, 'Pan dulce casero');
  const d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.textos[0].palabras, 5);
  assert.match(d.as_pend.at(-1).change, /Redacción lista/);
  assert.equal((await call(env, '/api/texto', 'POST', { kind: 'lb', ref: 'no-existe', cuerpo: 'x' }, tok)).status, 404);
});

test('cambio de estado en lote y registro automático de tiempo', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { password: 'clave-segura-1' })).j.token;
  const a = (await call(env, '/api/lb', 'POST', { project: 'NAV-LIN-5', anchor: 'a', estado: 'Gestión de Backlink' }, tok)).j.id;
  const b = (await call(env, '/api/lb', 'POST', { project: 'XUB-LIN-1', anchor: 'b', estado: 'Gestión de Backlink' }, tok)).j.id;
  const r = await call(env, '/api/bulk', 'POST', { kind: 'lb', ids: [a, b], estado: 'Para Enviar' }, tok);
  assert.equal(r.j.n, 2);
  let d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.ok(d.lb.every((t: any) => t.estado === 'Para Enviar'));
  assert.equal(d.as_pend.filter((x: any) => /en lote/.test(x.change)).length, 2);
  // tiempo: latidos sobre una tarea + acción sobre dos tareas de proyectos distintos (se reparte) + IA
  await env.DB.prepare('DELETE FROM actividad').run();
  const t0 = Date.now() - 3600_000;
  await actPing(U1(env), [{ kind: 'lb', ref: a }], t0);
  for (let i = 1; i <= 20; i++) await actPing(U1(env), [{ kind: 'lb', ref: a }], t0 + i * 30_000); // 10 min en NAV
  await actAccion(U1(env), [{ kind: 'lb', ref: a }, { kind: 'lb', ref: b }], 'Enviado', t0 + 20 * 30_000 + 10 * 60_000); // 10 min repartidos
  await actAgente(U1(env), 'ia', [{ kind: 'lb', ref: b }], 'Redacción', t0, t0 + 120_000);
  const hs = await horasAuto(U1(env), addDays(hoyEn(), -2));
  const nav = hs.find((x: any) => x.project === 'NAV-LIN-5'), xub = hs.find((x: any) => x.project === 'XUB-LIN-1');
  assert.ok(Math.abs(nav.hours - 0.26) < 0.02, 'NAV ' + nav.hours);   // 30 s + 10 min + 5 min
  assert.ok(Math.abs(xub.hours - 0.12) < 0.02, 'XUB ' + xub.hours);   // 5 min + 2 min de IA
  assert.match(xub.note, /IA \(Gemini\) 2 min/);
  d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.ok(d.hours.some((x: any) => x.auto && x.project === 'NAV-LIN-5'));
});

test('compilado de medios: importa lo que importa y valida por proyecto', async () => {
  const csv = 'Última Actualización (UTC):,2026-11-22\nDominio,Estado,Proveedor,media_id,Categorías,Tráfico,DR,Fecha Actualización Métricas,País Principal,Idioma,Admite temática sensible,Deal Precio,Deal Moneda,Deal Precio (USD),Deal Vencimiento,Cuenta Avatar\nmedia_domain,media_status,x,x,x,x,x,x,x,x,x,x,x,x,x,x\n'
    + 'diario.com.ar,Activo,Prov,id1,"News, Politics",1.500,35,20/11/2026,Argentina,Español,,"120,00",USD,120,31/12/2026,laura@eleven-agencia.net\n'
    + 'diario.com.ar,Activo,Prov2,id1,News,1.500,35,20/11/2026,Argentina,Español,,"80,00",USD,80,31/12/2026,laura@eleven-agencia.net\n'
    + 'viejo.com.ar,Activo,Prov,id2,News,800,25,20/11/2026,Argentina,Español,,"50,00",USD,50,31/10/2026,sofia@eleven-agencia.org\n'
    + 'br.com.br,Activo,P,id3,News,9.000,50,20/11/2026,Brasil,Portugués,,,,,,\n'
    + 'co.com.co,Default,,id4,News,2.000,30,20/11/2026,Colombia,Español,,,,,,\n';
  const ms = compiladoAMedios(csv, { hoy: '2026-11-22' });
  assert.equal(ms.length, 3, 'sin portugués');
  const d = ms.find((m: any) => m.dominio === 'diario.com.ar');
  assert.equal(d.precio_usd, 80, 'deal vigente más barato'); assert.equal(d.trafico, 1500); assert.equal(d.mail, 'laura@eleven-agencia.net');
  assert.equal(ms.find((m: any) => m.dominio === 'viejo.com.ar').precio_usd, null, 'deal vencido no cuenta');
  const gal = { ...PROYECTOS_INICIALES.find((p: any) => p.code === 'GAL-LIN-1'), active: 1 }, xub = { ...PROYECTOS_INICIALES.find((p: any) => p.code === 'XUB-LIN-2'), active: 1 };
  assert.equal(aptoMedio(d, gal, [], '2026-11-22').ok, true);
  assert.match(aptoMedio(d, xub, [], '2026-11-22').motivos[0], /País/);
  assert.match(aptoMedio(d, gal, [{ project: 'GAL-LIN-1', medio: 'https://diario.com.ar/nota', estado: 'Backlink Publicado', publicado: '2026-10-01', as_code: 'GAL-LIN-1-9' }], '2026-11-22').motivos.join(), /Ya usado/);
  // planificación: comparte medio entre proyectos y respeta presupuesto
  const projects = PROYECTOS_INICIALES.filter((p: any) => ['GAL-LIN-1', 'NAV-LIN-5'].includes(p.code)).map((p: any) => ({ ...p, active: 1, params: { ...p.params, costos: { '2026-12': { gastado: 0, tope: 150000 } } } }));
  const medios = [d, { dominio: 'otro.com.ar', mail: 'x@y', dr: 30, trafico: 5000, pais: 'Argentina', precio_usd: 90 }, { dominio: 'solonav.com.ar', mail: 'z@y', dr: 5, trafico: 400, pais: 'Argentina', precio_usd: 20 }, { dominio: 'br.com', pais: 'Brasil', moneda: 'ARS', precio: 150000, precio_usd: 100 }];
  const pl = planificar({ projects, medios, lb: [], plan: [{ month: '2026-12', project: 'GAL-LIN-1', task_type: 'A - Creación de links', units: 1 }, { month: '2026-12', project: 'NAV-LIN-5', task_type: 'A - Creación de links', units: 2 }], month: '2026-12', hoy: '2026-11-22' });
  const g = pl.proyectos.find((p: any) => p.code === 'GAL-LIN-1'), n = pl.proyectos.find((p: any) => p.code === 'NAV-LIN-5');
  assert.equal(g.items[0].dominio, 'diario.com.ar'); assert.deepEqual(g.items[0].tambien, ['NAV-LIN-5']);
  assert.equal(pl.tipoCambio, 1500); assert.equal(n.items.length, 2); assert.ok(n.total <= 150000, 'dentro del tope ' + n.total);
  // servidor
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { password: 'clave-segura-1' })).j.token;
  assert.equal((await call(env, '/api/medios/import', 'POST', { rows: ms, reset: true, last: true }, tok)).j.n, 3);
  assert.equal((await call(env, '/api/medios', 'GET', undefined, tok)).j.length, 3);
  assert.equal((await call(env, '/api/data', 'GET', undefined, tok)).j.medios_n, 3);
  assert.equal((await call(env, '/api/medios/import-key', 'POST', { rows: ms })).status, 401);
});

test('alertas: líder, quietas, impagas e indexación', () => {
  const hoy = '2026-11-22', viejo = Date.parse('2026-10-01');
  const lb = [
    { id: '1', project: 'NAV-LIN-5', as_code: 'NAV-LIN-5-1', usuario: 'Martín Botana', estado: 'Backlink Publicado - REQUIERE ESQUEMA PRECIOS', estado_at: Date.parse(hoy) },
    { id: '2', project: 'NAV-LIN-5', as_code: 'NAV-LIN-5-2', usuario: 'Martín Botana', estado: 'Backlink Publicado', pago_estado: 'Solicitado', precio: 100, moneda: 'ARS', estado_at: Date.parse(hoy) },
    { id: '3', project: 'NAV-LIN-5', as_code: 'NAV-LIN-5-3', usuario: 'Martín Botana', estado: 'Backlink Publicado - MANUAL_INDEX', estado_at: Date.parse(hoy) },
    { id: '4', project: 'GAL-LIN-1', as_code: 'GAL-LIN-1-4', usuario: 'Martín Botana', estado: 'Gestión de Backlink', dr: 10, medio: 'a.com', estado_at: viejo },
    { id: '5', project: 'GAL-LIN-1', as_code: 'GAL-LIN-1-5', usuario: 'Otra', estado: 'Gestión de Backlink', estado_at: viejo },
    { id: '6', project: 'NAV-LIN-5', as_code: 'NAV-LIN-5-6', usuario: 'Martín Botana', estado: 'Para Enviar', mail_eleven: 'laura@x', estado_at: Date.parse(hoy) },
  ];
  const projects = PROYECTOS_INICIALES.map((p: any) => ({ ...p, active: 1 }));
  const a = alertas({ lb, red: [], projects }, { hoy, diasQuieta: 14 });
  assert.deepEqual(a.lider.map((x: any) => x.id).sort(), ['4', 'NAV-LIN-5']);
  assert.match(a.lider.find((x: any) => x.kind === 'proyecto').motivo, /requiere esquema de precios · 1 tarea/);
  assert.deepEqual(a.impagas.map((x: any) => x.id), ['2']);
  assert.deepEqual(a.indexacion.map((x: any) => x.id), ['3']);
  assert.deepEqual(a.quietas.map((x: any) => x.id), ['4'], 'solo las mías');
  assert.match(a.sugerencias[0].texto, /Enviar 1 link desde laura@x/);
});

test('Gemini: elige modelos y pide la clave si falta; notas y prompts', async () => {
  const el = elegirModelos(['gemini-2.5-flash', 'gemini-3.1-pro', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image', 'text-embedding-004', 'gemini-3.1-flash-tts']);
  assert.equal(el.texto, 'gemini-3.1-pro'); assert.equal(el.imagen, 'gemini-3.1-flash-image');
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { password: 'clave-segura-1' })).j.token;
  const id = (await call(env, '/api/lb', 'POST', { project: 'NAV-LIN-5', anchor: 'cobrar con link', estado: 'Gestión de Backlink' }, tok)).j.id;
  const r = await call(env, '/api/ia/redactar', 'POST', { kind: 'lb', ref: id }, tok);
  assert.equal(r.status, 400); assert.match(r.j.error, /conectar Gemini/);
  assert.equal((await call(env, '/api/ia/estado', 'GET', undefined, tok)).j.conectado, false);
  await call(env, '/api/prompts', 'POST', { project: 'NAV-LIN-5', clave: 'lb', texto: 'Escribí sobre {anchor}' }, tok);
  await call(env, '/api/notas', 'POST', { texto: 'Preguntar a Lucas por el esquema de precios', lider: true }, tok);
  const d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.prompts.find((p: any) => p.project === 'NAV-LIN-5' && p.clave === 'lb').texto, 'Escribí sobre {anchor}', 'lo editado no se pisa');
  assert.ok(d.prompts.length >= 28, 'prompts iniciales cargados'); assert.equal(d.notas[0].lider, 1);
  assert.equal(d.settings.gemini, '');
});

test('tipo de pieza de Alicante según el tema', async () => {
  const { tipoPieza } = await import('../src/worker.ts');
  assert.equal(tipoPieza({ tema: 'https://alicante.com.ar/receta/2650-receta-pionono/' }), 'Optimización de recetas');
  assert.equal(tipoPieza({ tema: '/recetas-categoria/recetas-faciles/' }), 'Categorías');
  assert.equal(tipoPieza({ tema: 'Chow fan (arroz frito)' }), 'Recetas CC');
  assert.equal(tipoPieza({ tema: 'x', subproyecto: 'Portal Omint' }), 'Portal Omint');
});

test('tareas de prueba: no van a AppSheet ni suman horas', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { password: 'clave-segura-1' })).j.token;
  const id = (await call(env, '/api/lb', 'POST', { project: 'NAV-LIN-5', anchor: 'prueba', estado: 'Gestión de Backlink', prueba: true }, tok)).j.id;
  const rid = (await call(env, '/api/red', 'POST', { project: 'LAV-RED-5', tema: 'Chow fan', prueba: true }, tok)).j.id;
  let d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  await call(env, '/api/lb', 'POST', { ...d.lb.find((t: any) => t.id === id), estado: 'Para Enviar' }, tok);
  await call(env, '/api/bulk', 'POST', { kind: 'red', ids: [rid], estado: 'Entrega' }, tok);
  await call(env, '/api/texto', 'POST', { kind: 'lb', ref: id, cuerpo: 'hola', lista: true }, tok);
  await call(env, '/api/lb/' + id, 'DELETE', undefined, tok);
  d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.as_pend.length, 0, 'nada para AppSheet');
  assert.equal(d.red.find((r: any) => r.id === rid).prueba, 1);
  assert.equal(d.hours.filter((h: any) => h.auto).length, 0, 'sin horas automáticas');
});

test('varios usuarios: invitación, datos separados y carga desde AppSheet', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { password: 'clave-segura-1', nombre: 'Martín Botana', email: 'martin@x.com' })).j.token;
  await call(env, '/api/lb', 'POST', { project: 'NAV-LIN-5', anchor: 'de Martín' }, tok);
  // sin invitación no hay alta
  assert.equal((await call(env, '/api/signup', 'POST', { invitacion: 'nada', nombre: 'Franco Mercado', email: 'f@x.com', password: 'clave-franco-1' })).status, 403);
  const inv = (await call(env, '/api/invites', 'POST', {}, tok)).j;
  assert.match(inv.link, /\?invitacion=/);
  assert.equal((await call(env, '/api/state?invitacion=' + inv.token)).j.invitacion, true);
  const tf = (await call(env, '/api/signup', 'POST', { invitacion: inv.token, nombre: 'Franco Mercado', email: 'F@x.com', password: 'clave-franco-1' })).j.token;
  assert.ok(tf);
  assert.equal((await call(env, '/api/signup', 'POST', { invitacion: inv.token, nombre: 'Otro', email: 'o@x.com', password: 'clave-otro-123' })).status, 403, 'la invitación se usa una vez');
  // Franco no ve nada de Martín y no puede invitar
  let df = (await call(env, '/api/data', 'GET', undefined, tf)).j;
  assert.equal(df.me.nombre, 'Franco Mercado'); assert.equal(df.lb.length, 0); assert.equal(df.projects.length, 0); assert.equal(df.prompts.length, 0);
  assert.equal((await call(env, '/api/invites', 'POST', {}, tf)).status, 403);
  assert.equal(df.me.modo, 'lider', 'esta versión es solo para líderes');
  // y Martín sigue viendo solo lo suyo
  const dm = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(dm.lb.length, 1); assert.equal(dm.lb[0].anchor, 'de Martín'); assert.equal(dm.usuarios.length, 2);
  assert.equal((await call(env, `/api/lb/${dm.lb[0].id}`, 'DELETE', undefined, tf)).status, 404, 'no puede borrar tareas ajenas');
  // ingreso con mail o nombre
  assert.ok((await call(env, '/api/login', 'POST', { usuario: 'f@x.com', password: 'clave-franco-1' })).j.token);
  assert.ok((await call(env, '/api/login', 'POST', { usuario: 'martín botana', password: 'clave-segura-1' })).j.token);
  assert.equal((await call(env, '/api/login', 'POST', { password: 'clave-segura-1' })).status, 401, 'con dos cuentas hay que decir quién sos');
  // calendario de cada uno
  const cf = (await call(env, '/api/calendar', 'GET', undefined, tf)).j.url as string, cm = (await call(env, '/api/calendar', 'GET', undefined, tok)).j.url as string;
  assert.notEqual(cf, cm);
  assert.match((await call(env, new URL(cf).pathname)).j, /BEGIN:VCALENDAR/);
});

test('migración: la cuenta única de antes pasa a ser el usuario 1', async () => {
  const env = mkEnv();
  const { hashPw } = await import('../src/worker.ts');
  await env.DB.prepare('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  await env.DB.prepare("INSERT INTO settings VALUES ('pw', ?), ('cal_token', 'token-de-calendario-largo-123'), ('gemini_key', 'AIza-clave')").bind(await hashPw('clave-vieja-1')).run();
  const tok = (await call(env, '/api/login', 'POST', { password: 'clave-vieja-1' })).j.token;
  assert.ok(tok);
  const d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.me.id, 'u1'); assert.equal(d.me.admin, 1); assert.equal(d.settings.gemini, '1', 'conserva su clave de Gemini');
  assert.equal((await call(env, '/cal/token-de-calendario-largo-123.ics')).status, 200, 'conserva su calendario');
});

test('modo líder: semáforo y resumen por proyecto', async () => {
  const { semaforo, resumenProyecto } = await import('../public/shared.js');
  const hoy = '2026-11-22';
  assert.equal(semaforo('lb', { estado: 'Backlink Publicado', deadline: '2026-11-30' }, hoy).c, 'ok');
  assert.equal(semaforo('lb', { estado: 'Backlink Publicado - MANUAL_INDEX' }, hoy).c, 'bad');
  assert.equal(semaforo('lb', { estado: 'Gestión de Backlink', deadline: '2026-11-25' }, hoy).c, 'warn');
  assert.equal(semaforo('lb', { estado: 'Para Enviar', deadline: '2026-10-31' }, hoy).c, 'bad');
  assert.equal(semaforo('red', { estado: 'Entrega', entregada: '2026-11-02' }, hoy).c, 'ok');
  const p = { code: 'NAV-LIN-5', cliente: 'Nave', tipo: 'LIN', params: { linksMes: 11, costos: { '2026-11': { gastado: 300, tope: 1000 } } } };
  const lb = [{ project: 'NAV-LIN-5', estado: 'Backlink Publicado', deadline: '2026-11-30' }, { project: 'NAV-LIN-5', estado: 'Para Enviar', deadline: '2026-11-25' }, { project: 'NAV-LIN-5', estado: 'Gestión de Backlink', deadline: '2026-10-31' }];
  const r = resumenProyecto(p, { lb, red: [] }, '2026-11', hoy);
  assert.deepEqual([r.total, r.terminadas, r.porVencer, r.atrasadasDeOtrosMeses, r.pctPresupuesto, r.objetivo], [2, 1, 1, 1, 30, 11]);
});

test('conectar Claude: enlace de un solo uso, objetivos del reporte y link de AppSheet', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { nombre: 'Martín Botana', email: 'm@x.com', password: 'clave-segura-1' })).j.token;
  assert.equal((await call(env, '/api/conectar', 'POST')).status, 401);
  const c = (await call(env, '/api/conectar', 'POST', {}, tok)).j;
  assert.match(c.link, /\?conectar=/);
  const u = await call(env, '/api/conectar/usar', 'POST', { token: c.token });
  assert.equal(u.status, 200); assert.ok(u.j.token); assert.equal(u.j.nombre, 'Martín Botana');
  assert.equal((await call(env, '/api/conectar/usar', 'POST', { token: c.token })).status, 401, 'no se puede reusar');
  let d = (await call(env, '/api/data', 'GET', undefined, u.j.token)).j;
  assert.ok(Number(d.settings.conectado_at) > 0);
  // link de AppSheet: solo el admin y solo appsheet.com/start
  await call(env, '/api/settings', 'POST', { as_url: 'https://evil.com/start/x' }, tok);
  assert.equal((await call(env, '/api/data', 'GET', undefined, tok)).j.settings.as_url, '');
  // sin la app (#appName) el link abre la portada de appsheet.com: se rechaza, y a Claude se le da el link completo de Eleven - Operaciones
  await call(env, '/api/settings', 'POST', { as_url: 'https://www.appsheet.com/start/1234abcd-aaaa-bbbb' }, tok);
  assert.equal((await call(env, '/api/data', 'GET', undefined, tok)).j.settings.as_url, '');
  assert.match((await call(env, '/api/conectar', 'POST', {}, tok)).j.as_url, /^https:\/\/www\.appsheet\.com\/start\/476e1e19-c39a-4544-b72d-14f98b35c046\?platform=desktop#appName=AEApp-Production-609550914-25-02-20&view=Operations$/);
  await call(env, '/api/settings', 'POST', { as_url: 'https://www.appsheet.com/start/1234abcd-aaaa-bbbb?platform=desktop#appName=AEApp-Prueba-1&view=Tasks&vss=xyz' }, tok);
  assert.equal((await call(env, '/api/data', 'GET', undefined, tok)).j.settings.as_url, 'https://www.appsheet.com/start/1234abcd-aaaa-bbbb?platform=desktop#appName=AEApp-Prueba-1&view=Operations');
  assert.equal((await call(env, '/api/conectar', 'POST', {}, tok)).j.as_url, 'https://www.appsheet.com/start/1234abcd-aaaa-bbbb?platform=desktop#appName=AEApp-Prueba-1&view=Operations');
});

test('alta solo con mail: el nombre sale del mail y después de AppSheet', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { email: 'martin.botana@eleven.com', password: 'clave-segura-1' })).j.token;
  assert.equal((await call(env, '/api/data', 'GET', undefined, tok)).j.me.nombre, 'Martin Botana');
  await sincronizar(env, tok, { proy: [PROY('GAL-LIN-1')], lb: [LB('GAL-LIN-1-1')], red: [RED('GAL-RED-1-1')], email: 'martin.botana@eleven.com' });
  const d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.me.nombre, 'Martín Botana', 'toma el nombre tal como figura en AppSheet'); assert.equal(d.lb.length, 1);
});

// ======================= sincronización con AppSheet (a pedido, en etapas, todo o nada) =======================
const H_PROY = ['Cliente', 'Proyecto', 'Estado', 'Fecha Inicio', 'Duración (Meses)', 'Fecha Cierre', 'Presupuesto Mensual', 'Moneda'];
const PROY = (code: string, cliente = 'Galicia Seguros') => ({ c: [cliente, code, 'En Ejecución', '1/2/2026', '12', '31/1/2027', '1,331,469.00', 'ARS'] });
const H_LB = ['', '', 'Código', 'Tipo de Servicio', 'Estado Tarea', 'Anchors', 'Medio', 'Estado Negociación', 'Moneda Backlink', 'Precio Backlink', 'Fecha Entrega', 'Usuario Asignado', 'Mail Eleven', '', ''];
const LB = (code: string, o: Record<string, string> = {}) => { const v = { g: '30/11/2026', tipo: 'Intervalo métrica 21-40', estado: 'Gestión de Backlink', anchor: 'anchor ' + code, medio: 'medio.com', neg: 'Acuerdo Alcanzado', moneda: 'USD', precio: '$95.00', entrega: '', usuario: 'Martín Botana', mail: 'laura@x.com', ...o };
  return { g: v.g, c: ['Abrir tarea', '', code, v.tipo, v.estado, v.anchor, v.medio, v.neg, v.moneda, v.precio, v.entrega, v.usuario, v.mail, '', 'Histórico'] }; };
const H_RED = ['Código', 'Tema', 'País', 'Idioma', 'Sub-Proyecto', 'Variante de Sub-Proyecto', 'Deadline Tarea', 'Prioridad', 'Estado Tarea', 'Deadline Estado', 'Usuario Asignado', 'Fecha Entrega', '', ''];
const RED = (code: string, o: Record<string, string> = {}) => { const v = { tema: 'tema ' + code, deadline: '30/11/2026', estado: 'Entrega', usuario: 'Martín Botana', entrega: '', ...o };
  return { c: [code, v.tema, 'Argentina', 'Español', '', '', v.deadline, 'Normal', v.estado, '', v.usuario, v.entrega, '', 'Histórico'] }; };
const H_OBJ = ['Cliente', 'Proyecto', 'Lider de Proyecto', 'Fecha Inicio', 'Fecha Cierre', 'Tratamiento', 'Periodo de Avance', 'Q. piezas Mensual Plan.', 'Q. Piezas Mensual Entregadas'];
const OBJ = (code: string, n: number | string) => ({ c: ['X', code, 'Líder', 'feb 2026', 'ene 2027', 'Cantidad', 'Mensual', String(n), '0'] });
async function lote(env: any, sid: string, clave: string, parte: string, lectura: number, encabezado: string[], filas: any[], meta?: any, origin = 'https://www.appsheet.com') {
  // en dos tandas, para probar que se juntan bien
  const mitad = Math.ceil(filas.length / 2), tandas = filas.length > 1 ? [filas.slice(0, mitad), filas.slice(mitad)] : [filas];
  let r: Response | null = null;
  for (let i = 0; i < tandas.length; i++) r = await handle(new Request('https://pe.test/api/sync/lote', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sync-key': clave, origin }, body: JSON.stringify({ sid, parte, lectura, seq: i, ultimo: i === tandas.length - 1, encabezado, filas: tandas[i], meta }) }), env);
  return r!;
}
async function sincronizar(env: any, tok: string, o: { proy: any[]; lb: any[]; red: any[]; lb2?: any[]; hLb?: string[]; objLin?: any[]; objRed?: any[]; email?: string; confirmar?: boolean; soloRevisar?: boolean }) {
  const s = (await call(env, '/api/sync/iniciar', 'POST', {}, tok)).j;
  for (const lectura of [1, 2]) {
    await lote(env, s.sid, s.clave, 'lbProy', lectura, H_PROY, o.proy);
    await lote(env, s.sid, s.clave, 'lb', lectura, o.hLb || H_LB, lectura === 2 && o.lb2 ? o.lb2 : o.lb, { as_email: o.email || 'martin.botana@agenciaeleven.com', as_url: 'https://www.appsheet.com/start/476e1e19-c39a-4544-b72d-14f98b35c046?platform=desktop#appName=AEApp-Production-609550914-25-02-20&view=Link_Building&vss=' });
    await lote(env, s.sid, s.clave, 'red', lectura, H_RED, o.red);
    if (o.objLin) await lote(env, s.sid, s.clave, 'objLin', lectura, H_OBJ, o.objLin, undefined, 'https://datastudio.google.com');
    if (o.objRed) await lote(env, s.sid, s.clave, 'objRed', lectura, H_OBJ, o.objRed, undefined, 'https://datastudio.google.com');
  }
  const rev = (await call(env, '/api/sync/revisar', 'POST', { sid: s.sid }, tok)).j;
  if (o.soloRevisar) return { s, rev, ap: null as any };
  const ap = await call(env, '/api/sync/aplicar', 'POST', { sid: s.sid, confirmar: o.confirmar }, tok);
  return { s, rev, ap };
}
const nuevaCuenta = async () => { const env = mkEnv(); await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('seed_v', '99')").run().catch(() => undefined); return env; };

test('sincronización: trae solo lo tuyo, con objetivos, y verifica lo guardado', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { email: 'martin.botana@agenciaeleven.com', password: 'clave-segura-1' })).j.token;
  await env.DB.prepare("DELETE FROM projects").run();
  const { rev, ap } = await sincronizar(env, tok, {
    proy: [PROY('GAL-LIN-1')],
    lb: [LB('GAL-LIN-1-34'), LB('GAL-LIN-1-35', { usuario: 'Franco Mercado', g: '31/12/2026', precio: '$143,537.56', moneda: 'ARS' }), LB('NAV-LIN-5-1', { usuario: 'Franco Mercado' })],
    red: [RED('GAL-RED-1-1'), RED('TEL-RED-2-1', { usuario: 'Franco Mercado' }), RED('MER-RED-SQ-3-7', { usuario: 'Otra' })],
    objLin: [OBJ('GAL-LIN-1', 3), OBJ('MER-LIN-9', 60)], objRed: [OBJ('GAL-RED-1', 8)],
  });
  assert.equal(rev.ok, true, JSON.stringify(rev.errores));
  assert.equal(rev.yo, 'Martín Botana');
  assert.deepEqual(rev.proyectos.tuyos, ['GAL-LIN-1', 'GAL-RED-1']);
  assert.deepEqual([rev.links.total, rev.links.nuevas, rev.redacciones.total], [2, 2, 1]);
  assert.equal(rev.requiereConfirmacion, false);
  assert.equal(ap.status, 200, JSON.stringify(ap.j)); assert.equal(ap.j.verificacion.ok, true);
  const d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.me.nombre, 'Martín Botana');
  const t = d.lb.find((x: any) => x.as_code === 'GAL-LIN-1-35');
  assert.deepEqual([t.deadline, t.precio, t.moneda, t.usuario, t.estado], ['2026-12-31', 143537.56, 'ARS', 'Franco Mercado', 'Gestión de Backlink']);
  assert.equal(d.lb.length, 2); assert.equal(d.red.length, 1);
  const p = (c: string) => d.projects.find((x: any) => x.code === c);
  assert.equal(p('GAL-LIN-1').params.linksMes, 3); assert.equal(p('GAL-LIN-1').params.presupuestoMensual, 1331469); assert.equal(p('GAL-RED-1').params.piezasMes, 8); assert.equal(p('GAL-RED-1').cliente, 'Galicia Seguros');
  assert.ok(Number(d.settings.as_sync_at) > 0); assert.equal(JSON.parse(d.settings.as_sync_info).verificado, true);
  assert.equal(d.settings.as_url, 'https://www.appsheet.com/start/476e1e19-c39a-4544-b72d-14f98b35c046?platform=desktop#appName=AEApp-Production-609550914-25-02-20&view=Operations', 'guarda el link completo de la app');
  // una sincronización aplicada no se puede volver a aplicar
  assert.equal((await call(env, '/api/sync/aplicar', 'POST', { sid: ap.j.sid }, tok)).status, 409);
});

test('sincronización: si las dos lecturas no coinciden no se escribe nada', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { email: 'martin.botana@agenciaeleven.com', password: 'clave-segura-1' })).j.token;
  const lb = [LB('GAL-LIN-1-1'), LB('GAL-LIN-1-2'), LB('GAL-LIN-1-3')];
  const { rev, ap } = await sincronizar(env, tok, { proy: [PROY('GAL-LIN-1')], lb, lb2: [lb[0], lb[2]], red: [RED('GAL-RED-1-1')] });
  assert.equal(rev.ok, false); assert.match(rev.errores.join(' '), /no coinciden.*GAL-LIN-1-2/);
  assert.equal(ap.status, 409);
  const d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.lb.length, 0); assert.equal(d.settings.as_sync_at, '');
  // también si cambia un dato entre lecturas (p. ej. el mes planificado perdido al desplazar)
  const r2 = await sincronizar(env, tok, { proy: [PROY('GAL-LIN-1')], lb, lb2: [lb[0], lb[1], LB('GAL-LIN-1-3', { g: '31/10/2026' })], red: [RED('GAL-RED-1-1')], soloRevisar: true });
  assert.equal(r2.rev.ok, false); assert.match(r2.rev.errores.join(' '), /datos distintos: GAL-LIN-1-3/);
});

test('sincronización: columnas por nombre (no por posición) y filas inválidas frenan todo', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { email: 'martin.botana@agenciaeleven.com', password: 'clave-segura-1' })).j.token;
  // AppSheet agrega o mueve columnas: se ubica todo por nombre
  const hMovido = ['Código', 'Columna nueva', ...H_LB.slice(3)], fila = (code: string) => { const f = LB(code); return { g: f.g, c: [code, 'algo', ...f.c.slice(3)] }; };
  const ok = await sincronizar(env, tok, { proy: [PROY('GAL-LIN-1')], lb: [fila('GAL-LIN-1-1')], red: [RED('GAL-RED-1-1')], hLb: hMovido });
  assert.equal(ok.rev.ok, true, JSON.stringify(ok.rev.errores));
  assert.equal((await call(env, '/api/data', 'GET', undefined, tok)).j.lb[0].tipo_servicio, 'Intervalo métrica 21-40');
  // falta una columna
  const sinEstado = H_LB.map((x) => (x === 'Estado Tarea' ? 'Estado' : x));
  const r1 = await sincronizar(env, tok, { proy: [PROY('GAL-LIN-1')], lb: [LB('GAL-LIN-1-1')], red: [RED('GAL-RED-1-1')], hLb: sinEstado, soloRevisar: true });
  assert.equal(r1.rev.ok, false); assert.match(r1.rev.errores.join(' '), /falta la columna «Estado Tarea»/);
  // sin mes planificado, fecha imposible, importe con formato raro
  const r2 = await sincronizar(env, tok, { proy: [PROY('GAL-LIN-1')], lb: [LB('GAL-LIN-1-1', { g: '' }), LB('GAL-LIN-1-2', { entrega: '31/2/2026' }), LB('GAL-LIN-1-3', { precio: 'USD 95 aprox' })], red: [RED('GAL-RED-1-1')], soloRevisar: true });
  assert.equal(r2.rev.ok, false);
  const e = r2.rev.errores.join(' ');
  assert.match(e, /GAL-LIN-1-1: sin mes planificado/); assert.match(e, /GAL-LIN-1-2: fecha inválida «31\/2\/2026»/); assert.match(e, /GAL-LIN-1-3: importe inválido/);
  // una tabla que no se leyó
  const s = (await call(env, '/api/sync/iniciar', 'POST', {}, tok)).j;
  for (const l of [1, 2]) await lote(env, s.sid, s.clave, 'lbProy', l, H_PROY, [PROY('GAL-LIN-1')]);
  const rev = (await call(env, '/api/sync/revisar', 'POST', { sid: s.sid }, tok)).j;
  assert.match(rev.errores.join(' '), /Gestión Link Building · Tareas: no se leyó/); assert.match(rev.errores.join(' '), /Gestión Content · Tareas: no se leyó/);
});

test('sincronización: foto completa y confirmación ante cambios sospechosos', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { email: 'martin.botana@agenciaeleven.com', password: 'clave-segura-1' })).j.token;
  const lb = [...Array(12)].map((_, i) => LB('GAL-LIN-1-' + (i + 1)));
  await sincronizar(env, tok, { proy: [PROY('GAL-LIN-1')], lb, red: [RED('GAL-RED-1-1', { entrega: '2/11/2026' })] });
  // durante el día: una tarea cambia de estado y otra desaparece de AppSheet → se refleja tal cual
  const lb2 = lb.slice(1).map((f, i) => (i === 0 ? LB('GAL-LIN-1-2', { estado: 'Backlink Publicado' }) : f));
  const r = await sincronizar(env, tok, { proy: [PROY('GAL-LIN-1')], lb: lb2, red: [RED('GAL-RED-1-1', { entrega: '2/11/2026' })] });
  assert.equal(r.rev.requiereConfirmacion, false);
  assert.deepEqual([r.rev.links.cambiadas, r.rev.links.borradas], [1, 1]);
  let d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.lb.length, 11); assert.ok(!d.lb.some((x: any) => x.as_code === 'GAL-LIN-1-1'));
  assert.equal(d.lb.find((x: any) => x.as_code === 'GAL-LIN-1-2').estado, 'Backlink Publicado');
  // un dato clave que queda vacío pide confirmación; sin ella no se aplica nada
  const r3 = await sincronizar(env, tok, { proy: [PROY('GAL-LIN-1')], lb: lb2, red: [RED('GAL-RED-1-1', { deadline: '' })] });
  assert.equal(r3.rev.requiereConfirmacion, true); assert.match(r3.rev.motivosConfirmacion.join(' '), /GAL-RED-1-1: fecha_entrega/);
  assert.equal(r3.ap.status, 409);
  d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.red[0].fecha_entrega, '2026-11-30', 'sin confirmación no cambió nada');
  const ok = await call(env, '/api/sync/aplicar', 'POST', { sid: r3.s.sid, confirmar: true }, tok);
  assert.equal(ok.status, 200); assert.equal(ok.j.verificacion.ok, true);
  // si desaparecen muchas tareas de golpe, también pide confirmación
  const r4 = await sincronizar(env, tok, { proy: [PROY('GAL-LIN-1')], lb: lb2.slice(0, 2), red: [RED('GAL-RED-1-1')], soloRevisar: true });
  assert.equal(r4.rev.requiereConfirmacion, true); assert.match(r4.rev.motivosConfirmacion.join(' '), /9 links ya no están/);
});

test('sincronización: la clave de lote es de un solo uso y solo desde AppSheet o el reporte', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { email: 'martin.botana@agenciaeleven.com', password: 'clave-segura-1' })).j.token;
  const s = (await call(env, '/api/sync/iniciar', 'POST', {}, tok)).j;
  assert.equal((await lote(env, s.sid, 'clave-equivocada-de-relleno-123', 'lb', 1, H_LB, [LB('GAL-LIN-1-1')])).status, 401);
  const ok = await lote(env, s.sid, s.clave, 'lb', 1, H_LB, [LB('GAL-LIN-1-1')]);
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('access-control-allow-origin'), 'https://www.appsheet.com');
  const otro = await lote(env, s.sid, s.clave, 'lb', 1, H_LB, [LB('GAL-LIN-1-1')], undefined, 'https://evil.example');
  assert.equal(otro.headers.get('access-control-allow-origin'), null, 'otros sitios no pueden leer la respuesta');
  assert.equal((await lote(env, s.sid, s.clave, 'nada', 1, H_LB, [])).status, 400);
  // la sincronización de otra cuenta no se puede revisar
  const inv = (await call(env, '/api/invites', 'POST', {}, tok)).j, tf = (await call(env, '/api/signup', 'POST', { invitacion: inv.token, email: 'franco.mercado@x.com', password: 'clave-franco-1' })).j.token;
  assert.equal((await call(env, '/api/sync/revisar', 'POST', { sid: s.sid }, tf)).status, 404);
});

test('sincronización: conversiones de AppSheet', async () => {
  const { fechaAS, importeAS, enteroAS, RE } = await import('../src/sync.ts');
  assert.equal(fechaAS('1/2/2026'), '2026-02-01'); assert.equal(fechaAS(''), '');
  assert.throws(() => fechaAS('31/2/2026')); assert.throws(() => fechaAS('2026-02-01')); assert.throws(() => fechaAS('feb 2026'));
  assert.equal(importeAS('$143,537.56'), 143537.56); assert.equal(importeAS('1,331,469.00'), 1331469); assert.equal(importeAS('$72.00'), 72); assert.equal(importeAS(''), null);
  assert.throws(() => importeAS('$1.234,50')); assert.throws(() => importeAS('USD 95'));
  assert.equal(enteroAS('30'), 30); assert.equal(enteroAS('-'), null); assert.throws(() => enteroAS('-6'));
  for (const c of ['GAL-LIN-1', 'WNP-LIN-13.1']) assert.ok(RE.proyLIN.test(c), c);
  for (const c of ['XUB-RED-1', 'MER-RED-SQ-3', 'ASS-RED-US-2', 'CAL-RED-NE-1']) assert.ok(RE.proyRED.test(c), c);
  for (const c of ['MER-RED-SQ-3-12', 'LAV-RED-5-1']) assert.ok(RE.tareaRED.test(c), c);
  assert.ok(!RE.tareaLIN.test('GAL-LIN-1')); assert.ok(!RE.tareaRED.test('Abrir tarea'));
});

// ======================= favorito «Sincronizar» (sin Claude) =======================
async function favorito(env: any, tok: string, tipo: 'appsheet' | 'reporte', partes: [string, string[], any[]][], origin = 'https://www.appsheet.com') {
  const key = (await call(env, '/api/import-key', 'GET', undefined, tok)).j.key;
  const ini = await handle(new Request('https://pe.test/api/sync/iniciar-clave', { method: 'POST', headers: { 'content-type': 'application/json', 'x-import-key': key, origin }, body: JSON.stringify({ tipo }) }), env);
  const s: any = await ini.json();
  for (const l of [1, 2]) for (const [parte, enc, filas] of partes) await lote(env, s.sid, s.clave, parte, l, enc, filas, { as_email: 'martin.botana@agenciaeleven.com', as_url: 'https://www.appsheet.com/start/476e1e19-c39a-4544-b72d-14f98b35c046?platform=desktop#appName=AEApp-Production-609550914-25-02-20&view=Tasks' }, origin);
  const r = await handle(new Request('https://pe.test/api/sync/cerrar', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sync-key': s.clave, origin }, body: JSON.stringify({ sid: s.sid }) }), env);
  return { status: r.status, j: await r.json() as any, cors: r.headers.get('access-control-allow-origin'), ini };
}
test('favorito: AppSheet se sincroniza solo desde tu navegador, y el reporte trae solo objetivos', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { email: 'martin.botana@agenciaeleven.com', password: 'clave-segura-1' })).j.token;
  await env.DB.prepare('DELETE FROM projects').run();
  // sin clave válida no arranca
  const mal = await handle(new Request('https://pe.test/api/sync/iniciar-clave', { method: 'POST', headers: { 'x-import-key': 'clave-falsa-de-relleno-1234567' } }), env);
  assert.equal(mal.status, 401);
  // el reporte antes que AppSheet: no hay proyectos todavía
  const antes = await favorito(env, tok, 'reporte', [['objLin', H_OBJ, [OBJ('GAL-LIN-1', 3)]], ['objRed', H_OBJ, [OBJ('GAL-RED-1', 8)]]], 'https://datastudio.google.com');
  assert.equal(antes.status, 409); assert.match(antes.j.informe.errores.join(' '), /primero sincronizá AppSheet/);
  // AppSheet: revisa y aplica en el mismo paso, sin pasar por la app ni por Claude
  const as = await favorito(env, tok, 'appsheet', [['lbProy', H_PROY, [PROY('GAL-LIN-1')]], ['lb', H_LB, [LB('GAL-LIN-1-1'), LB('GAL-LIN-1-2')]], ['red', H_RED, [RED('GAL-RED-1-1')]]]);
  assert.equal(as.status, 200, JSON.stringify(as.j)); assert.equal(as.cors, 'https://www.appsheet.com');
  assert.equal(as.j.aplicado, true); assert.equal(as.j.verificacion.ok, true); assert.equal(as.j.links.total, 2);
  assert.ok(!as.j.advertencias.some((a: string) => /Reporte/.test(a)), 'desde AppSheet no se espera el reporte');
  // reporte: solo objetivos, no toca las tareas
  const rep = await favorito(env, tok, 'reporte', [['objLin', H_OBJ, [OBJ('GAL-LIN-1', 3), OBJ('MER-LIN-9', 60)]], ['objRed', H_OBJ, [OBJ('XUB-RED-1', 15)]]], 'https://datastudio.google.com');
  assert.equal(rep.status, 200, JSON.stringify(rep.j)); assert.equal(rep.j.verificacion.ok, true);
  assert.deepEqual(rep.j.objetivos.sinObjetivo, ['GAL-RED-1']);
  const d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.lb.length, 2); assert.equal(d.projects.find((p: any) => p.code === 'GAL-LIN-1').params.linksMes, 3);
  assert.equal(d.projects.find((p: any) => p.code === 'GAL-RED-1').params.piezasMes, null, 'sin objetivo, no se inventa');
  assert.ok(d.settings.obj_at); assert.equal(d.sync_pend, null);
});
test('favorito: si hay cambios sospechosos queda esperando tu confirmación en la app', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { email: 'martin.botana@agenciaeleven.com', password: 'clave-segura-1' })).j.token;
  const lb = [...Array(12)].map((_, i) => LB('GAL-LIN-1-' + (i + 1)));
  await favorito(env, tok, 'appsheet', [['lbProy', H_PROY, [PROY('GAL-LIN-1')]], ['lb', H_LB, lb], ['red', H_RED, [RED('GAL-RED-1-1')]]]);
  const r = await favorito(env, tok, 'appsheet', [['lbProy', H_PROY, [PROY('GAL-LIN-1')]], ['lb', H_LB, lb.slice(0, 2)], ['red', H_RED, [RED('GAL-RED-1-1')]]]);
  assert.equal(r.j.pendienteConfirmacion, true);
  let d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  assert.equal(d.lb.length, 12, 'no se aplicó nada'); assert.ok(d.sync_pend); assert.match(d.sync_pend.motivos.join(' '), /10 links ya no están/);
  // descartar
  await call(env, '/api/sync/descartar', 'POST', { sid: d.sync_pend.sid }, tok);
  d = (await call(env, '/api/data', 'GET', undefined, tok)).j; assert.equal(d.sync_pend, null); assert.equal(d.lb.length, 12);
  // o confirmar desde la app
  const r2 = await favorito(env, tok, 'appsheet', [['lbProy', H_PROY, [PROY('GAL-LIN-1')]], ['lb', H_LB, lb.slice(0, 2)], ['red', H_RED, [RED('GAL-RED-1-1')]]]);
  const ok = await call(env, '/api/sync/aplicar', 'POST', { sid: r2.j.informe.sid, confirmar: true }, tok);
  assert.equal(ok.status, 200); assert.equal(ok.j.verificacion.ok, true);
  d = (await call(env, '/api/data', 'GET', undefined, tok)).j; assert.equal(d.lb.length, 2); assert.equal(d.sync_pend, null);
});
