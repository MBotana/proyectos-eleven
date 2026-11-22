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

test('importación desde AppSheet', async () => {
  const env = mkEnv(), tok = (await call(env, '/api/setup', 'POST', { password: 'clave-segura-1' })).j.token;
  const lb = [['GAL-LIN-1-31', '30/11/2026', 'Intervalo métrica 21-40', 'Enviado a Medio', 'cotizar seguro auto', 'lamanana.com.ar', 'Acuerdo Alcanzado', 'ARS', '$143,537.56', '', 'Martín Botana', 'laura@eleven-agencia.net'],
    ['TEL-LIN-2-164', '30/11/2026', 'Intervalo métrica 21-40', 'Backlink Publicado', 'Honor X5c', 'inneuquen.info', 'Acuerdo Vencido', 'USD', '$160.00', '19/11/2026', 'Franco Mercado', 'natalia@eleven-agencia.net'],
    ['BOD-LIN-1-1', '30/11/2026', '', 'No Iniciado', '', '', '', '', '', '', 'X', '']];
  const red = [['LAV-RED-5-90', 'Receta de vitel toné', 'Argentina', 'Español', '', '', '30/11/2026', 'Normal', 'Para CMS', '', 'Martín Botana', '2/11/2026']];
  assert.equal((await call(env, '/api/import', 'POST', { lb, red })).status, 401, 'sin clave no entra');
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('u1:import_key', 'clave-de-importacion-larga-123')").run();
  const r = await handle(new Request('https://pe.test/api/import', { method: 'POST', headers: { 'content-type': 'application/json', 'x-import-key': 'clave-de-importacion-larga-123' }, body: JSON.stringify({ lb, red }) }), env as any);
  const j: any = await r.json();
  assert.deepEqual(j, { lb: 2, red: 1, saltadas: 1, proyectosNuevos: [] });
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://www.appsheet.com');
  // los datos propios se conservan al reimportar
  let d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  const t = d.lb.find((x: any) => x.id === 'GAL-LIN-1-31');
  assert.equal(t.precio, 143537.56); assert.equal(t.deadline, '2026-11-30'); assert.equal(t.estado, 'Enviado a Medio');
  assert.equal(d.as_pend.length, 0, 'importar no genera pendientes');
  await call(env, '/api/lb', 'POST', { ...t, notas: 'nota mía', dr: 30 }, tok);
  await handle(new Request('https://pe.test/api/import', { method: 'POST', headers: { 'x-import-key': 'clave-de-importacion-larga-123' }, body: JSON.stringify({ lb: [lb[0].map((v, i) => (i === 3 ? 'Backlink Publicado' : i === 9 ? '20/11/2026' : v))] }) }), env as any);
  d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  const t2 = d.lb.find((x: any) => x.id === 'GAL-LIN-1-31');
  assert.equal(t2.estado, 'Backlink Publicado'); assert.equal(t2.publicado, '2026-11-20'); assert.equal(t2.notas, 'nota mía'); assert.equal(t2.dr, 30);
  assert.equal(d.red[0].entregada, '2026-11-02'); assert.equal(d.red[0].usuario, 'Martín Botana');
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
  assert.equal((await call(env, '/api/usuarios/modo', 'POST', { id: 'u1', modo: 'lider' }, tf)).status, 403);
  await call(env, '/api/usuarios/modo', 'POST', { id: df.me.id, modo: 'lider' }, tok);
  assert.equal((await call(env, '/api/data', 'GET', undefined, tf)).j.me.modo, 'lider', 'el admin le elige el modo');
  // carga desde AppSheet con su clave: crea sus proyectos (copiando parámetros y prompts) y no pisa las tareas de Martín
  const key = (await call(env, '/api/import-key', 'GET', undefined, tf)).j.key;
  const lb = [['TEL-LIN-2-164', '30/11/2026', 'Intervalo métrica 21-40', 'Backlink Publicado', 'Honor X5c', 'inneuquen.info', 'Acuerdo Vencido', 'USD', '$160.00', '19/11/2026', 'Franco Mercado', 'natalia@x'],
    ['NAV-LIN-5-60', '30/11/2026', 'Intervalo métrica 21-40', 'Gestión de Backlink', 'medios de pago', 'x.com', '', '', '', '', 'Martín Botana', '']];
  const r = await handle(new Request('https://pe.test/api/import', { method: 'POST', headers: { 'x-import-key': key }, body: JSON.stringify({ lb, red: [], proyectos: ['TEL-LIN-2'] }) }), env as any);
  const j: any = await r.json();
  assert.deepEqual(j.proyectosNuevos, ['TEL-LIN-2']); assert.equal(j.lb, 1); assert.equal(j.saltadas, 1, 'NAV no es proyecto suyo');
  df = (await call(env, '/api/data', 'GET', undefined, tf)).j;
  assert.equal(df.lb[0].as_code, 'TEL-LIN-2-164'); assert.notEqual(df.lb[0].id, 'TEL-LIN-2-164', 'id propio');
  assert.equal(df.projects[0].params.drMin, 20, 'copia los parámetros del proyecto');
  assert.ok(df.prompts.some((p: any) => p.project === 'TEL-LIN-2'), 'copia los prompts');
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
  // objetivos: LIN copia a linksMes; RED queda en piezasMes; proyectos ajenos se ignoran
  const o = (await call(env, '/api/objetivos', 'POST', { items: [{ code: 'XUB-LIN-1', piezasMes: 6 }, { code: 'LAV-RED-5', piezasMes: 30 }, { code: 'MER-LIN-9', piezasMes: 60 }] }, tok)).j;
  assert.equal(o.actualizados, 2);
  d = (await call(env, '/api/data', 'GET', undefined, tok)).j;
  const p = (code: string) => d.projects.find((x: any) => x.code === code).params;
  assert.equal(p('XUB-LIN-1').linksMes, 6); assert.equal(p('LAV-RED-5').piezasMes, 30); assert.ok(p('LAV-RED-5').objetivosAt);
  // link de AppSheet: solo el admin y solo appsheet.com/start
  await call(env, '/api/settings', 'POST', { as_url: 'https://evil.com/start/x' }, tok);
  assert.equal((await call(env, '/api/data', 'GET', undefined, tok)).j.settings.as_url, '');
  await call(env, '/api/settings', 'POST', { as_url: 'https://www.appsheet.com/start/1234abcd-aaaa-bbbb#appName=x' }, tok);
  assert.equal((await call(env, '/api/data', 'GET', undefined, tok)).j.settings.as_url, 'https://www.appsheet.com/start/1234abcd-aaaa-bbbb');
});
