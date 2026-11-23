/* Sincronización con AppSheet y el reporte de seguimiento: validación y comparación (funciones puras).
 *
 * Reglas:
 * - Cada tabla se lee DOS veces por separado (con pasos de desplazamiento distintos). Si las lecturas no coinciden fila por fila, no se escribe nada.
 * - Las columnas se ubican por su NOMBRE en el encabezado de la tabla, nunca por posición. Si falta una columna, no se escribe nada.
 * - Cada fila se valida (código, fechas, importes, números). Un solo error frena todo.
 * - Lo que se aplica es una foto completa: lo que ya no está en AppSheet se borra de la app.
 * - Cambios sospechosos (datos clave que quedan vacíos, muchas tareas que desaparecen, proyectos que se van) piden confirmación.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ESTADOS_LB, ESTADOS_NEG, ESTADOS_RED, MONEDAS } from '../public/shared.js';

export type Parte = 'lbProy' | 'lb' | 'red' | 'objLin' | 'objRed';
export interface Lote { parte: Parte; lectura: number; seq: number; ultimo: boolean; encabezado: string[]; filas: { g?: string; c: string[] }[]; meta?: Record<string, unknown> }

export const RE = {
  // ej. GAL-LIN-1, WNP-LIN-13.1, MER-RED-SQ-3, ASS-RED-US-2 (las tareas suman "-<número>")
  proyLIN: /^[A-Z0-9]{2,5}-LIN-([A-Z]{2,3}-)?\d+(\.\d+)?$/,
  proyRED: /^[A-Z0-9]{2,5}-RED-([A-Z]{2,3}-)?\d+(\.\d+)?$/,
  tareaLIN: /^[A-Z0-9]{2,5}-LIN-([A-Z]{2,3}-)?\d+(\.\d+)?-\d+$/,
  tareaRED: /^[A-Z0-9]{2,5}-RED-([A-Z]{2,3}-)?\d+(\.\d+)?-\d+$/,
};
export const proyectoDe = (code: string) => code.replace(/-\d+$/, '');

/** Columnas que tiene que tener cada tabla (por nombre). */
export const ESQUEMA: Record<Parte, { nombre: string; columnas: string[]; clave: string; grupo?: string; opcional?: boolean }> = {
  lbProy: { nombre: 'Gestión Link Building · Detalles del proyecto', columnas: ['Cliente', 'Proyecto', 'Estado', 'Fecha Inicio', 'Fecha Cierre', 'Presupuesto Mensual', 'Moneda'], clave: 'Proyecto' },
  lb: { nombre: 'Gestión Link Building · Tareas', columnas: ['Código', 'Tipo de Servicio', 'Estado Tarea', 'Anchors', 'Medio', 'Estado Negociación', 'Moneda Backlink', 'Precio Backlink', 'Fecha Entrega', 'Usuario Asignado', 'Mail Eleven'], clave: 'Código', grupo: 'Mes planificado' },
  red: { nombre: 'Gestión Content · Tareas', columnas: ['Código', 'Tema', 'País', 'Idioma', 'Sub-Proyecto', 'Variante de Sub-Proyecto', 'Deadline Tarea', 'Prioridad', 'Estado Tarea', 'Deadline Estado', 'Usuario Asignado', 'Fecha Entrega'], clave: 'Código' },
  objLin: { nombre: 'Reporte · Seguimiento Link Building', columnas: ['Proyecto', 'Q. piezas Mensual Plan.'], clave: 'Proyecto', opcional: true },
  objRed: { nombre: 'Reporte · Seguimiento Content', columnas: ['Proyecto', 'Q. piezas Mensual Plan.'], clave: 'Proyecto', opcional: true },
};
export const PARTES = Object.keys(ESQUEMA) as Parte[];

const limpiarTit = (s: unknown) => String(s ?? '').replace(/[▼▲]/g, '').replace(/\s+/g, ' ').trim();
const t = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** "31/12/2026" → "2026-12-31". Vacío → "". Cualquier otra cosa → error. */
export function fechaAS(s: unknown): string {
  const v = t(s); if (!v) return '';
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (!m) throw new Error(`fecha inválida «${v}»`);
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])], iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(iso + 'T00:00:00Z');
  if (isNaN(dt.getTime()) || dt.getUTCDate() !== d || dt.getUTCMonth() + 1 !== mo || y < 2015 || y > 2100) throw new Error(`fecha inválida «${v}»`);
  return iso;
}
/** "$143,537.56" / "1,331,469.00" → número. Vacío → null. Cualquier otra cosa → error. */
export function importeAS(s: unknown): number | null {
  const v = t(s).replace(/\s/g, ''); if (!v) return null;
  if (!/^-?\$?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(v)) throw new Error(`importe inválido «${v}»`);
  return Number(v.replace(/[$,]/g, ''));
}
/** Cantidad entera ≥ 0. "-" o vacío → null. */
export function enteroAS(s: unknown): number | null {
  const v = t(s); if (!v || v === '-') return null;
  if (!/^\d+$/.test(v.replace(/[.,]/g, ''))) throw new Error(`número inválido «${v}»`);
  return Number(v.replace(/[.,]/g, ''));
}

/** Arma cada lectura de una parte a partir de sus lotes; controla que estén completos y con el mismo encabezado. */
export function juntar(lotes: Lote[], parte: Parte, errores: string[]) {
  const esq = ESQUEMA[parte], out: Record<number, { encabezado: string[]; filas: { g?: string; c: string[] }[]; meta: Record<string, unknown> }> = {};
  for (const lectura of [1, 2]) {
    const ls = lotes.filter((l) => l.parte === parte && l.lectura === lectura).sort((a, b) => a.seq - b.seq);
    if (!ls.length) continue;
    if (!ls.some((l) => l.ultimo) || ls.some((l, i) => l.seq !== i)) { errores.push(`${esq.nombre}: la lectura ${lectura} llegó incompleta.`); continue; }
    const enc = ls[0].encabezado.map(limpiarTit);
    if (ls.some((l) => JSON.stringify(l.encabezado.map(limpiarTit)) !== JSON.stringify(enc))) { errores.push(`${esq.nombre}: el encabezado cambió en medio de la lectura ${lectura}.`); continue; }
    out[lectura] = { encabezado: enc, filas: ls.flatMap((l) => l.filas || []), meta: Object.assign({}, ...ls.map((l) => l.meta || {})) };
  }
  return out;
}

/** Valida y normaliza una lectura (columnas por nombre). Devuelve un mapa clave → fila normalizada. */
export function normalizar(parte: Parte, lec: { encabezado: string[]; filas: { g?: string; c: string[] }[] }, errores: string[], advertencias: string[]) {
  const esq = ESQUEMA[parte], idx: Record<string, number> = {};
  for (const col of esq.columnas) {
    const i = lec.encabezado.indexOf(col), j = lec.encabezado.lastIndexOf(col);
    if (i < 0) { errores.push(`${esq.nombre}: falta la columna «${col}». Columnas leídas: ${lec.encabezado.filter(Boolean).join(', ') || '(ninguna)'}.`); continue; }
    if (i !== j) { errores.push(`${esq.nombre}: la columna «${col}» aparece dos veces.`); continue; }
    idx[col] = i;
  }
  const mapa = new Map<string, any>();
  if (Object.keys(idx).length !== esq.columnas.length) return mapa;
  const v = (f: { c: string[] }, col: string) => t(f.c[idx[col]]);
  let errFilas = 0;
  const err = (msg: string) => { if (errFilas++ < 15) errores.push(`${esq.nombre}: ${msg}`); };
  for (const f of lec.filas) {
    if (!Array.isArray(f?.c)) { err('fila sin celdas.'); continue; }
    const clave = v(f, esq.clave);
    try {
      let n: any;
      if (parte === 'lb') {
        if (!RE.tareaLIN.test(clave)) throw new Error(`código inválido «${clave}»`);
        const deadline = fechaAS(f.g); if (!deadline) throw new Error('sin mes planificado (encabezado de grupo)');
        const estado = v(f, 'Estado Tarea'); if (!estado) throw new Error('sin estado');
        n = { as_code: clave, project: proyectoDe(clave), deadline, tipo_servicio: v(f, 'Tipo de Servicio'), estado, anchor: v(f, 'Anchors'), medio: v(f, 'Medio'), estado_neg: v(f, 'Estado Negociación'),
          moneda: v(f, 'Moneda Backlink'), precio: importeAS(v(f, 'Precio Backlink')), publicado: fechaAS(v(f, 'Fecha Entrega')), usuario: v(f, 'Usuario Asignado'), mail_eleven: v(f, 'Mail Eleven').toLowerCase() };
        if (!ESTADOS_LB.includes(estado)) advertencias.push(`${clave}: estado nuevo en AppSheet «${estado}» (se copia tal cual).`);
        if (n.estado_neg && !ESTADOS_NEG.includes(n.estado_neg)) advertencias.push(`${clave}: estado de negociación nuevo «${n.estado_neg}» (se copia tal cual).`);
        if (n.moneda && !MONEDAS.includes(n.moneda)) advertencias.push(`${clave}: moneda nueva «${n.moneda}» (se copia tal cual).`);
      } else if (parte === 'red') {
        if (!RE.tareaRED.test(clave)) throw new Error(`código inválido «${clave}»`);
        const estado = v(f, 'Estado Tarea'); if (!estado) throw new Error('sin estado');
        n = { as_code: clave, project: proyectoDe(clave), tema: v(f, 'Tema'), pais: v(f, 'País'), idioma: v(f, 'Idioma'), subproyecto: v(f, 'Sub-Proyecto'), variante: v(f, 'Variante de Sub-Proyecto'),
          fecha_entrega: fechaAS(v(f, 'Deadline Tarea')), prioridad: v(f, 'Prioridad'), estado, deadline_estado: fechaAS(v(f, 'Deadline Estado')), usuario: v(f, 'Usuario Asignado'), entregada: fechaAS(v(f, 'Fecha Entrega')) };
        if (!ESTADOS_RED.includes(estado) && estado !== 'Anulado') advertencias.push(`${clave}: estado nuevo en AppSheet «${estado}» (se copia tal cual).`);
      } else if (parte === 'lbProy') {
        if (!RE.proyLIN.test(clave)) throw new Error(`código de proyecto inválido «${clave}»`);
        n = { code: clave, cliente: v(f, 'Cliente'), estado: v(f, 'Estado'), inicio: fechaAS(v(f, 'Fecha Inicio')), cierre: fechaAS(v(f, 'Fecha Cierre')), presupuesto: importeAS(v(f, 'Presupuesto Mensual')), moneda: v(f, 'Moneda') };
        if (!n.cliente) throw new Error(`${clave} sin cliente`);
      } else {
        const re = parte === 'objLin' ? RE.proyLIN : RE.proyRED;
        if (!re.test(clave)) throw new Error(`código de proyecto inválido «${clave}»`);
        n = { code: clave, piezasMes: enteroAS(v(f, 'Q. piezas Mensual Plan.')) };
      }
      const prev = mapa.get(clave);
      if (prev && JSON.stringify(prev) !== JSON.stringify(n)) throw new Error(`«${clave}» aparece dos veces con datos distintos`);
      mapa.set(clave, n);
    } catch (e: any) { err(`fila ${clave || '(sin código)'}: ${e.message}.`); }
  }
  if (errFilas > 15) errores.push(`${esq.nombre}: … y ${errFilas - 15} errores más.`);
  return mapa;
}

/** Compara las dos lecturas: tienen que ser idénticas fila por fila. */
export function compararLecturas(parte: Parte, a: Map<string, any>, b: Map<string, any>, errores: string[]) {
  const esq = ESQUEMA[parte], soloA = [...a.keys()].filter((k) => !b.has(k)), soloB = [...b.keys()].filter((k) => !a.has(k));
  const distintas = [...a.keys()].filter((k) => b.has(k) && JSON.stringify(a.get(k)) !== JSON.stringify(b.get(k)));
  if (soloA.length || soloB.length || distintas.length) {
    errores.push(`${esq.nombre}: las dos lecturas no coinciden (${a.size} vs ${b.size} filas` +
      (soloA.length ? `; solo en la 1.ª: ${soloA.slice(0, 5).join(', ')}` : '') + (soloB.length ? `; solo en la 2.ª: ${soloB.slice(0, 5).join(', ')}` : '') +
      (distintas.length ? `; con datos distintos: ${distintas.slice(0, 5).join(', ')}` : '') + '). Puede que la tabla haya cambiado mientras se leía o que no haya terminado de cargar: volvé a sincronizar.');
    return false;
  }
  return true;
}

const sinTilde = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Nombre de la persona tal como figura en AppSheet, a partir de su mail ("martin.botana@…" → "Martín Botana"). */
export function nombreEnAppSheet(email: string, nombres: string[]) {
  const del = sinTilde(String(email || '').split('@')[0].replace(/[._-]+/g, ' '));
  return del ? nombres.find((n) => n && sinTilde(n) === del) || '' : '';
}

export const CAMPOS = {
  lb: ['project', 'deadline', 'tipo_servicio', 'estado', 'anchor', 'medio', 'estado_neg', 'moneda', 'precio', 'publicado', 'usuario', 'mail_eleven'],
  red: ['project', 'tema', 'pais', 'idioma', 'subproyecto', 'variante', 'fecha_entrega', 'prioridad', 'estado', 'deadline_estado', 'usuario', 'entregada'],
} as const;
const CRITICOS = { lb: ['deadline', 'estado'], red: ['fecha_entrega', 'estado'] };
const vacio = (x: unknown) => x === null || x === undefined || x === '';
const igual = (x: unknown, y: unknown) => (vacio(x) && vacio(y)) || (typeof x === 'number' || typeof y === 'number' ? Number(x) === Number(y) : String(x) === String(y));

/** Diferencias entre lo que hay en la app y la foto nueva. */
export function diferencias(kind: 'lb' | 'red', actuales: any[], nuevas: any[]) {
  const porCod = new Map(actuales.filter((x) => x.as_code).map((x) => [x.as_code, x]));
  const out = { nuevas: 0, cambiadas: 0, iguales: 0, borradas: [] as string[], vaciados: [] as { code: string; campo: string; antes: unknown; critico: boolean }[], cambios: [] as { code: string; campos: string[] }[] };
  const vistos = new Set<string>();
  for (const n of nuevas) {
    vistos.add(n.as_code);
    const a = porCod.get(n.as_code); if (!a) { out.nuevas++; continue; }
    const campos = CAMPOS[kind].filter((c) => !igual(a[c], n[c]));
    if (!campos.length) { out.iguales++; continue; }
    out.cambiadas++; out.cambios.push({ code: n.as_code, campos });
    for (const c of campos) if (!vacio(a[c]) && vacio(n[c])) out.vaciados.push({ code: n.as_code, campo: c, antes: a[c], critico: (CRITICOS[kind] as readonly string[]).includes(c) });
  }
  for (const k of porCod.keys()) if (!vistos.has(k)) out.borradas.push(k);
  return out;
}

/** Compara lo guardado contra la foto (después de aplicar). */
export function verificarGuardado(kind: 'lb' | 'red', guardadas: any[], foto: any[]) {
  const porCod = new Map(guardadas.map((x) => [x.as_code, x])), dif: string[] = [];
  if (guardadas.length !== foto.length) dif.push(`${kind === 'lb' ? 'links' : 'redacciones'}: se guardaron ${guardadas.length} y se leyeron ${foto.length}`);
  for (const n of foto) {
    const g = porCod.get(n.as_code); if (!g) { dif.push(`${n.as_code} no quedó guardada`); continue; }
    for (const c of CAMPOS[kind]) if (!igual(g[c], n[c])) dif.push(`${n.as_code}: ${c} quedó «${g[c]}» y en AppSheet es «${n[c]}»`);
  }
  return dif.slice(0, 30);
}
