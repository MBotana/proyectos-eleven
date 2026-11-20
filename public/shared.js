// Proyectos Eleven — datos y reglas compartidas entre el servidor y la app.

/** Estados de tarea de Link Building, en el orden en que avanza en AppSheet. */
export const ESTADOS_LB = ['No Iniciado', 'Gestión de Backlink', 'Para Enviar', 'Enviado a Medio', 'Revisión y Validación', 'FLAG NO_EDITION_DOC', 'Backlink Publicado', 'Backlink Publicado - MANUAL_INDEX', 'Backlink Publicado - Sin Pago', 'Backlink Publicado - REQUIERE ESQUEMA PRECIOS', 'Cerrado', 'Anulado'];
/** Link publicado (unidad hecha): cualquier variante de "Backlink Publicado", o Cerrado. */
export const esPublicado = (e) => /^Backlink Publicado/.test(e || '') || e === 'Cerrado';
/** Fuera de la lista de activas (como en AppSheet). */
export const esCerradoLB = (e) => e === 'Cerrado' || e === 'Anulado';
/** Compatibilidad: objeto con .has() para el resto del código. */
export const PUBLICADOS = { has: esPublicado };
/** Estados de la negociación con el medio. */
export const ESTADOS_NEG = ['', 'Solicitado', 'En Negociación', 'Acuerdo Alcanzado', 'Acuerdo Vencido', 'Acuerdo Agotado'];
/** Estados de redacción vistos en AppSheet (Gestión Content → Tasks). "Pendiente" = creada acá, todavía no cargada en AppSheet. */
export const ESTADOS_RED = ['Pendiente', 'Revisión General', 'Entrega', 'Entrega - REQUIERE ESQUEMA PRECIOS', 'Para CMS', 'Para CMS - REQUIERE ESQUEMA PRECIOS', 'Cerrado'];
export const esCerradoRED = (e) => e === 'Cerrado' || e === 'Anulado';
/** Tu usuario en AppSheet. */
export const YO = 'Martín Botana';
export const PRIORIDADES = ['Baja', 'Normal', 'Alta'];
export const MONEDAS = ['USD', 'ARS', 'EUR'];
export const TIPOS_SERVICIO = ['Intervalo métrica 21-40', 'Intervalo métrica 41-60'];

/** Tipos de tarea de la planilla de horas, por tipo de proyecto. */
export const TAREAS = {
  LIN: ['A - Creación de links', 'B - Gestión de proyecto de LB'],
  RED: ['A - Redacción manual', 'B - Redacción automatizada', 'C - Carga manual pieza en CMS'],
};

/** Proyectos habilitados en AppSheet (verificado el 2026-11-20). Los de la planilla que no están en AppSheet quedan afuera (XUB-RED-1).
 *  Parámetros tomados de "Parámetros del Proyecto" en Gestión Link Building. */
export const SEED_VERSION = 2;
export const PROYECTOS_INICIALES = [
  { code: 'GAL-LIN-1', cliente: 'Galicia Seguros', tipo: 'LIN', params: { drMin: 20, trafMin: 500, precioMaxUSD: 100, repDias: 90, palabrasMin: 500, dominio: 'answerseguros.com.ar', paises: 'Argentina', servicio: 'Intervalo métrica 21-40' } },
  { code: 'GAL-RED-1', cliente: 'Galicia Seguros', tipo: 'RED', params: {} },
  { code: 'LAV-LIN-4', cliente: 'LaVirginia', tipo: 'LIN', params: { drMin: 21, trafMin: 300, precioMaxUSD: null, repDias: 90, palabrasMin: 500, dominio: 'alicante.com.ar', paises: 'Argentina', servicio: 'Intervalo métrica 21-40' } },
  { code: 'LAV-RED-5', cliente: 'LaVirginia', tipo: 'RED', params: {} },
  { code: 'NAV-LIN-5', cliente: 'Nave', tipo: 'LIN', params: { drMin: 1, trafMin: 300, precioMaxUSD: null, repDias: 90, palabrasMin: 500, dominio: 'navenegocios.ar', paises: 'Argentina', servicio: 'Intervalo métrica 21-40' } },
  { code: 'NAV-RED-5', cliente: 'Nave', tipo: 'RED', params: {} },
  { code: 'OMI-LIN-1', cliente: 'Omint', tipo: 'LIN', params: { drMin: 41, trafMin: 300, precioMaxUSD: null, repDias: 90, palabrasMin: 500, dominio: 'omint.com.ar', paises: 'Argentina', servicio: 'Intervalo métrica 41-60' } },
  { code: 'OMI-RED-2', cliente: 'Omint', tipo: 'RED', params: {} },
  { code: 'TEL-LIN-2', cliente: 'Telecom', tipo: 'LIN', params: { drMin: 20, trafMin: 1000, precioMaxUSD: 100, repDias: 60, palabrasMin: 800, dominio: 'personal.com.ar', paises: 'Argentina', servicio: 'Intervalo métrica 21-40' } },
  { code: 'TEL-RED-2', cliente: 'Telecom', tipo: 'RED', params: {} },
  { code: 'XUB-LIN-1', cliente: 'Xubio', tipo: 'LIN', params: { drMin: 21, trafMin: 300, precioMaxUSD: null, repDias: 90, palabrasMin: 500, dominio: 'xubio.com/ar', paises: 'Argentina, Colombia', servicio: 'Intervalo métrica 21-40' } },
  { code: 'XUB-LIN-2', cliente: 'Xubio', tipo: 'LIN', params: { drMin: 21, trafMin: 300, precioMaxUSD: null, repDias: 90, palabrasMin: 500, dominio: 'xubio.com/co', paises: 'Colombia', servicio: 'Intervalo métrica 21-40' } },
];

/** Plan de horas y unidades de la planilla (noviembre 2026). */
export const PLAN_INICIAL = {
  month: '2026-11',
  rows: [
    ['GAL-LIN-1', 'A - Creación de links', 0, 0], ['GAL-LIN-1', 'B - Gestión de proyecto de LB', 0, 0],
    ['GAL-RED-1', 'A - Redacción manual', 0, 0],
    ['LAV-LIN-4', 'A - Creación de links', 0, 0], ['LAV-LIN-4', 'B - Gestión de proyecto de LB', 0, 0],
    ['LAV-RED-5', 'A - Redacción manual', 0, 0], ['LAV-RED-5', 'B - Redacción automatizada', 0, 0], ['LAV-RED-5', 'C - Carga manual pieza en CMS', 0, 0],
    ['NAV-LIN-5', 'A - Creación de links', 8.79, 11], ['NAV-LIN-5', 'B - Gestión de proyecto de LB', 0, 0],
    ['NAV-RED-5', 'A - Redacción manual', 1.58, 2],
    ['OMI-LIN-1', 'A - Creación de links', 4.51, 6],
    ['OMI-RED-2', 'B - Redacción automatizada', 4.28, 16],
    ['TEL-LIN-2', 'A - Creación de links', 16, 20],
    ['TEL-RED-2', 'B - Redacción automatizada', 4.28, 16],
    ['XUB-LIN-1', 'A - Creación de links', 4.83, 7],
    ['XUB-LIN-2', 'A - Creación de links', 1.58, 2],
  ],
};

export const normDomain = (s) => String(s || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
const num = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));

/**
 * Avisos de una tarea de LB según los parámetros del proyecto (los mismos que valida AppSheet).
 * Devuelve textos; una lista vacía = sin problemas.
 */
export function avisosLB(t, proyecto, todas = []) {
  const p = (proyecto && proyecto.params) || {}, out = [];
  const dr = num(t.dr), traf = num(t.trafico), precio = num(t.precio);
  if (num(p.drMin) !== null && dr !== null && dr < Number(p.drMin)) out.push(`DR ${dr} menor al mínimo (${p.drMin}): necesita validación del líder.`);
  if (num(p.trafMin) !== null && traf !== null && traf < Number(p.trafMin)) out.push(`Tráfico ${traf} menor al mínimo (${p.trafMin}).`);
  if (num(p.precioMaxUSD) !== null && precio !== null && (t.moneda || 'USD') === 'USD' && precio > Number(p.precioMaxUSD)) out.push(`Precio USD ${precio} mayor al máximo (${p.precioMaxUSD}).`);
  const dom = normDomain(t.medio);
  if (dom) {
    const dias = num(p.repDias) ?? 0, ref = Date.parse((t.deadline || t.created || '').slice(0, 10)) || Date.now();
    const rep = todas.find((o) => o.id !== t.id && o.project === t.project && normDomain(o.medio) === dom &&
      (!dias || Math.abs((Date.parse((o.deadline || o.created || '').slice(0, 10)) || ref) - ref) < dias * 864e5));
    if (rep) out.push(`Medio repetido: ${dom} ya está en ${rep.as_code || 'otra tarea'} de este proyecto${dias ? ` (no se repite antes de ${dias} días)` : ''}.`);
  }
  return out;
}

/** Fecha AAAA-MM-DD en una zona horaria. */
export function hoyEn(tz = 'America/Argentina/Buenos_Aires', ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
export const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
