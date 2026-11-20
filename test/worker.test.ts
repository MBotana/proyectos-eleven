// Pruebas del servidor sobre SQLite en memoria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handle, runAvisos, resumenDeadlines } from '../src/worker.ts';
import { avisosLB, hoyEn, addDays } from '../public/shared.js';

function mkEnv() {
  const db = new DatabaseSync(':memory:');
  const DB = { prepare: (sql: string) => { const st = db.prepare(sql); let a: any[] = [];
    const o: any = { bind: (...x: any[]) => { a = x; return o; }, first: async () => st.get(...a) ?? null, all: async () => ({ results: st.all(...a) }), run: async () => { st.run(...a); return {}; } }; return o; } };
  return { DB };
}
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
  assert.deepEqual(d.projects.map((p: any) => p.code), ['GAL-LIN-1', 'GAL-RED-1', 'LAV-LIN-4', 'LAV-RED-5', 'NAV-LIN-5', 'NAV-RED-5', 'TEL-LIN-2', 'TEL-RED-2']);
  assert.ok(!d.projects.some((p: any) => /OMI|XUB/.test(p.code)));
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
  assert.equal(d.hours.length, 2);
  assert.equal(d.hours.find((x: any) => x.project === 'TEL-RED-2').task_type, 'A - Redacción manual', 'tarea inválida → primera del tipo');

  const cal = (await call(env, '/api/calendar', 'GET', undefined, tok)).j.url as string;
  const ics = await call(env, new URL(cal).pathname);
  assert.equal(ics.status, 200);
  assert.match(ics.j, /BEGIN:VCALENDAR/);
  assert.match(ics.j, /Celulares 5G/);
  assert.doesNotMatch(ics.j, /cotizar seguro auto/, 'las publicadas no van al calendario');
  assert.equal((await call(env, '/cal/token-falso.ics')).status, 404);

  const r = await resumenDeadlines(env as any, hoy);
  assert.match(r!.title, /1 para mañana/);
});

test('avisos de validación como en AppSheet', () => {
  const p = { params: { drMin: 20, trafMin: 500, precioMaxUSD: 100, repDias: 90 } };
  const a = { id: 'a', project: 'GAL-LIN-1', medio: 'lamanana.com.ar', dr: 19, trafico: 400, precio: 120, moneda: 'USD', deadline: '2026-12-31' };
  const b = { id: 'b', project: 'GAL-LIN-1', medio: 'https://www.lamanana.com.ar/nota', as_code: 'GAL-LIN-1-30', deadline: '2026-11-20' };
  const av = avisosLB(a, p, [a, b]);
  assert.equal(av.length, 4);
  assert.ok(av.some(s => s.startsWith('Medio repetido') && s.includes('GAL-LIN-1-30')));
  assert.equal(avisosLB({ ...a, dr: 25, trafico: 900, precio: 90 }, p, [a]).length, 0);
  assert.equal(avisosLB({ ...a, precio: 150000, moneda: 'ARS' }, p, [a]).filter(s => s.startsWith('Precio')).length, 0);
});

test('avisos programados: una vez por día', async () => {
  const env = mkEnv(); const tok = (await call(env, '/api/setup', 'POST', { password: 'clave-segura-1' })).j.token;
  await call(env, '/api/red', 'POST', { project: 'NAV-RED-5', tema: 'Link de pago', fecha_entrega: hoyEn() }, tok);
  // martes 2026-11-17 19:00 en Buenos Aires = 22:00 UTC
  const t = Date.parse('2026-11-17T22:00:00Z');
  const s1 = await runAvisos(env as any, 'https://pe.test', t);
  assert.ok(s1.includes('horas'));
  assert.deepEqual(await runAvisos(env as any, 'https://pe.test', t + 60000), []);
});
