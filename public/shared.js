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
  const dom = normDomain(t.medio);
  if (dom) {
    const dias = num(p.repDias) ?? 0, ref = Date.parse((t.deadline || t.created || '').slice(0, 10)) || Date.now();
    const rep = todas.find((o) => o.id !== t.id && o.project === t.project && normDomain(o.medio) === dom && o.estado !== 'Anulado' &&
      (!dias || Math.abs((Date.parse((o.deadline || o.created || '').slice(0, 10)) || ref) - ref) < dias * 864e5));
    // Texto igual al de AppSheet
    if (rep) out.push(`❗Medio repetido: ya está en otra tarea de este proyecto y todavía no puede repetirse. Revise qué tarea debe conservarlo; mientras tanto esta no va a poder avanzar. (${rep.as_code || 'otra tarea'})`);
  }
  if (num(p.drMin) !== null && dr !== null && dr < Number(p.drMin)) out.push(`❗ El valor de DR ingresado (${dr.toFixed(2)}) es menor al mínimo permitido (${p.drMin}). De continuar será necesaria la validación del líder del proyecto.`);
  // Estos dos no los vi escritos en AppSheet: texto propio
  if (num(p.trafMin) !== null && traf !== null && traf < Number(p.trafMin)) out.push(`Tráfico ${traf} menor al mínimo del proyecto (${p.trafMin}).`);
  if (num(p.precioMaxUSD) !== null && precio !== null && (t.moneda || 'USD') === 'USD' && precio > Number(p.precioMaxUSD)) out.push(`Precio USD ${precio} mayor al máximo del proyecto (${p.precioMaxUSD}).`);
  return out;
}

/**
 * Qué pide AppSheet en cada estado de una tarea de link building (relevado el 20/11/2026 mirando tareas reales).
 * botones = acciones que muestra AppSheet en ese estado; falta = qué completar para que aparezca "Continuar".
 * confirmado: false = deducido, falta verificarlo con las tareas de prueba.
 */
export const PASOS_LB = {
  'No Iniciado': { botones: ['Edit'], falta: ['URL del cliente', 'Anchor text', 'Medio (dominio, tráfico, DR)'], sigue: 'Gestión de Backlink', confirmado: false },
  'Gestión de Backlink': { botones: ['Crear redacción', 'Solicitar Negociación', 'Edit'], falta: ['Negociación en "Acuerdo Alcanzado" (aparece "Continuar")', 'Sin avisos de medio repetido', 'Redacción creada'], sigue: 'Para Enviar', confirmado: false },
  'Para Enviar': { botones: ['Auditar Redacción', 'Continuar', 'Edit'], falta: ['Redacción auditada', 'Pago solicitado (se genera en "Pagos")'], sigue: 'Enviado a Medio', confirmado: false },
  'FLAG NO_EDITION_DOC': { botones: ['Auditar Redacción', 'Continuar'], falta: ['El documento de redacción no está editado/auditado: auditar la redacción'], sigue: 'Para Enviar', confirmado: false },
  'Enviado a Medio': { botones: ['Continuar', 'Edit'], falta: ['Que el medio publique la nota'], sigue: 'Backlink Publicado', confirmado: false },
  'Revisión y Validación': { botones: [], falta: ['Validación del líder del proyecto (por DR o parámetros fuera de rango)'], sigue: 'Gestión de Backlink', confirmado: false },
  'Backlink Publicado': { botones: ['Continuar', 'Edit'], falta: ['URL de la publicación', 'Pago / comprobante'], sigue: 'Cerrado', confirmado: false },
  'Backlink Publicado - MANUAL_INDEX': { botones: ['Continuar'], falta: ['Indexación manual de la URL publicada'], sigue: 'Cerrado', confirmado: false },
  'Backlink Publicado - Sin Pago': { botones: ['Continuar'], falta: ['Registrar o eximir el pago'], sigue: 'Cerrado', confirmado: false },
  'Backlink Publicado - REQUIERE ESQUEMA PRECIOS': { botones: [], falta: ['Que Operaciones cargue el esquema de precios del cliente'], sigue: 'Cerrado', confirmado: false },
};
export const PASOS_RED = {
  'Revisión General': { botones: ['Edit'], falta: ['Revisión del texto'], sigue: 'Entrega', confirmado: false },
  'Entrega': { botones: ['Edit'], falta: ['Entregable listo (Post_Entregable)'], sigue: 'Para CMS', confirmado: false },
  'Entrega - REQUIERE ESQUEMA PRECIOS': { botones: ['Edit'], falta: ['Que Operaciones cargue el esquema de precios'], sigue: 'Para CMS', confirmado: false },
  'Para CMS': { botones: ['Edit'], falta: ['Cargar la pieza en el CMS del cliente'], sigue: 'Cerrado', confirmado: false },
  'Para CMS - REQUIERE ESQUEMA PRECIOS': { botones: ['Edit'], falta: ['Esquema de precios + carga en CMS'], sigue: 'Cerrado', confirmado: false },
};
/** Desde qué estado se puede cargar la redacción de un link (en AppSheet aparece "Crear redacción" en Gestión de Backlink). */
export const puedeRedactarLB = (estado) => estado !== 'No Iniciado' && estado !== 'Anulado';

/** Fecha AAAA-MM-DD en una zona horaria. */
export function hoyEn(tz = 'America/Argentina/Buenos_Aires', ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
export const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

// ======================= Compilado de medios =======================
/** CSV → filas (soporta comillas y saltos de línea dentro de celdas). */
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const numAR = (s) => { const t = String(s ?? '').trim(); if (!t) return null; const n = Number(t.replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; };
const fechaAR = (s) => { const m = String(s ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const RANGO_ESTADO = { Activo: 0, Outreach: 1, Default: 2, Drenado: 3 };
/**
 * Compilado de medios (planilla finance_01_report de Eleven) → un registro por dominio con lo que importa:
 * dominio, mail de contacto (Cuenta Avatar), DR, tráfico, precio, país e idioma. Media_id, categorías y demás quedan afuera.
 * Precio = el deal vigente más barato (en USD). Solo idiomas pedidos (por defecto español).
 */
export function compiladoAMedios(text, { idiomas = ['Español'], hoy = hoyEn() } = {}) {
  const rows = parseCSV(text), hi = rows.findIndex((r) => r[0] === 'Dominio');
  if (hi < 0) throw new Error('No encontré la columna "Dominio": ¿es el compilado de medios?');
  const H = rows[hi], ix = (n) => H.indexOf(n), g = (r, n) => (ix(n) >= 0 ? (r[ix(n)] ?? '').trim() : '');
  const out = new Map();
  for (const r of rows.slice(hi + 1)) {
    const dom = normDomain(g(r, 'Dominio')); if (!dom || dom === 'media_domain') continue;
    if (idiomas.length && !idiomas.includes(g(r, 'Idioma'))) continue;
    const estado = g(r, 'Estado'); if (estado === 'Drenado') continue;
    const m = out.get(dom) || { dominio: dom, estado, mail: '', mails: {}, dr: null, trafico: null, pais: '', idioma: g(r, 'Idioma'), sensible: 0, precio_usd: null, precio: null, moneda: '', vence: '', proveedor: '', actualizado: '' };
    if ((RANGO_ESTADO[estado] ?? 9) < (RANGO_ESTADO[m.estado] ?? 9)) m.estado = estado;
    const dr = numAR(g(r, 'DR')), tr = numAR(g(r, 'Tráfico'));
    if (dr !== null) m.dr = Math.max(m.dr ?? 0, dr);
    if (tr !== null) m.trafico = Math.max(m.trafico ?? 0, tr);
    m.pais = m.pais || g(r, 'País Principal');
    if (g(r, 'Admite temática sensible') === 'TRUE') m.sensible = 1;
    const mail = g(r, 'Cuenta Avatar').toLowerCase(); if (mail) m.mails[mail] = (m.mails[mail] || 0) + 1;
    m.actualizado = fechaAR(g(r, 'Fecha Actualización Métricas')) || m.actualizado;
    const pu = numAR(g(r, 'Deal Precio (USD)')), vence = fechaAR(g(r, 'Deal Vencimiento'));
    if (pu !== null && pu > 0 && (!vence || vence >= hoy) && (m.precio_usd === null || pu < m.precio_usd)) {
      m.precio_usd = pu; m.precio = numAR(g(r, 'Deal Precio')); m.moneda = g(r, 'Deal Moneda'); m.vence = vence; m.proveedor = g(r, 'Proveedor');
    }
    if (!m.proveedor) m.proveedor = g(r, 'Proveedor');
    out.set(dom, m);
  }
  return [...out.values()].map(({ mails, ...m }) => ({ ...m, mail: Object.entries(mails).sort((a, b) => b[1] - a[1])[0]?.[0] || '' }));
}

/** Países del proyecto ("Argentina, Colombia") → lista. */
const paisesDe = (p) => String(p?.params?.paises || '').split(/[,;/]/).map((s) => s.trim()).filter(Boolean);
/**
 * ¿Se puede usar este medio en este proyecto? Mismos topes que valida AppSheet (DR, tráfico, precio, país)
 * más la regla de medio repetido (otra tarea del proyecto con el mismo dominio dentro de los días de espera).
 */
export function aptoMedio(m, p, lb = [], hoy = hoyEn()) {
  const pp = (p && p.params) || {}, motivos = [];
  const paises = paisesDe(p);
  if (paises.length && !paises.includes(m.pais)) motivos.push(m.pais ? `País ${m.pais}` : 'País sin dato');
  if (num(pp.drMin) !== null && (m.dr ?? -1) < Number(pp.drMin)) motivos.push(`DR ${m.dr ?? '—'} < ${pp.drMin}`);
  if (num(pp.trafMin) !== null && (m.trafico ?? -1) < Number(pp.trafMin)) motivos.push(`Tráfico ${m.trafico ?? '—'} < ${pp.trafMin}`);
  if (num(pp.precioMaxUSD) !== null && m.precio_usd !== null && m.precio_usd > Number(pp.precioMaxUSD)) motivos.push(`USD ${m.precio_usd} > ${pp.precioMaxUSD}`);
  const dias = num(pp.repDias) ?? 0, ref = Date.parse(hoy);
  const rep = lb.find((t) => t.project === p.code && t.estado !== 'Anulado' && normDomain(t.medio) === m.dominio &&
    (!dias || Math.abs((Date.parse((t.publicado || t.deadline || hoy).slice(0, 10)) || ref) - ref) < dias * 864e5));
  if (rep) motivos.push(`Ya usado (${rep.as_code || 'tarea'})`);
  return { ok: !motivos.length, motivos };
}

// ======================= Planificación del mes =======================
/**
 * Arma la planificación: para cada proyecto de links, cuántos links faltan en el mes (plan de unidades menos tareas ya planificadas)
 * y qué medios usar dentro del presupuesto. Prioriza medios que sirven para varios proyectos (un mismo contacto, varias notas)
 * y, entre esos, el más barato con mejor DR. Medios sin precio quedan como alternativas para negociar.
 */
export function planificar({ projects, medios, lb, plan, month, hoy = hoyEn() }) {
  const lin = projects.filter((p) => p.active && p.tipo === 'LIN');
  const aptos = new Map(lin.map((p) => [p.code, medios.filter((m) => aptoMedio(m, p, lb, hoy).ok)]));
  const usoCount = new Map();
  for (const [, arr] of aptos) for (const m of arr) usoCount.set(m.dominio, (usoCount.get(m.dominio) || 0) + 1);
  const proyectos = lin.map((p) => {
    const unidades = plan.filter((r) => r.month === month && r.project === p.code && /^A /.test(r.task_type)).reduce((a, r) => a + (r.units || 0), 0);
    const ya = lb.filter((t) => t.project === p.code && t.estado !== 'Anulado' && (t.deadline || '').startsWith(month));
    const gastado = ya.reduce((a, t) => a + ((t.moneda || 'USD') === 'USD' && t.precio ? Number(t.precio) : 0), 0);
    const presupuesto = num(p.params?.presupuestoUSD);
    return { code: p.code, cliente: p.cliente, unidades, yaPlanificadas: ya.length, falta: Math.max(0, unidades - ya.length), presupuesto, gastado, disponible: presupuesto === null ? null : Math.max(0, presupuesto - gastado), items: [], alternativas: [], aptos: aptos.get(p.code).length };
  });
  const usados = new Map(); // dominio → proyectos donde ya se asignó
  const orden = [...proyectos].sort((a, b) => a.aptos - b.aptos);
  for (const pr of orden) {
    const cand = aptos.get(pr.code).filter((m) => m.precio_usd !== null)
      .sort((a, b) => (usoCount.get(b.dominio) - usoCount.get(a.dominio)) || ((usados.has(b.dominio) ? 1 : 0) - (usados.has(a.dominio) ? 1 : 0)) || (a.precio_usd - b.precio_usd) || ((b.dr || 0) - (a.dr || 0)));
    let resto = pr.disponible;
    for (const m of cand) {
      if (pr.items.length >= pr.falta) break;
      const quedan = pr.falta - pr.items.length;
      if (resto !== null) { const piso = Math.min(...cand.map((c) => c.precio_usd)); if (m.precio_usd + piso * (quedan - 1) > resto + 1e-9) continue; }
      pr.items.push({ dominio: m.dominio, mail: m.mail, dr: m.dr, trafico: m.trafico, pais: m.pais, precio_usd: m.precio_usd, proveedor: m.proveedor, compartible: usoCount.get(m.dominio) });
      if (resto !== null) resto -= m.precio_usd;
      usados.set(m.dominio, [...(usados.get(m.dominio) || []), pr.code]);
    }
    pr.alternativas = aptos.get(pr.code).filter((m) => m.precio_usd === null).sort((a, b) => (usoCount.get(b.dominio) - usoCount.get(a.dominio)) || ((b.dr || 0) - (a.dr || 0)))
      .slice(0, Math.max(5, pr.falta * 2)).map((m) => ({ dominio: m.dominio, mail: m.mail, dr: m.dr, trafico: m.trafico, compartible: usoCount.get(m.dominio) }));
    pr.total = pr.items.reduce((a, x) => a + x.precio_usd, 0);
  }
  for (const pr of proyectos) for (const it of pr.items) it.tambien = (usados.get(it.dominio) || []).filter((c) => c !== pr.code);
  return { month, creado: Date.now(), proyectos };
}

// ======================= Alertas, notas y sugerencias =======================
const LIDER_RE = /REQUIERE ESQUEMA PRECIOS|Sin Pago|Revisión y Validación/i;
/**
 * Alertas de tus tareas: qué hablar con el líder, tareas quietas hace mucho, links publicados sin pagar,
 * problemas de indexación y avisos que muestra AppSheet. Devuelve { lider, quietas, impagas, indexacion, appsheet, sugerencias }.
 */
export function alertas({ lb, red, projects }, { hoy = hoyEn(), diasQuieta = 14, yo = YO } = {}) {
  const mias = lb.filter((t) => t.usuario === yo), miasR = red.filter((r) => r.usuario === yo);
  const P = (c) => projects.find((p) => p.code === c);
  const out = { lider: [], quietas: [], impagas: [], indexacion: [], appsheet: [], sugerencias: [] };
  const lim = Date.parse(hoy) - diasQuieta * 864e5;
  for (const t of mias) {
    if (esCerradoLB(t.estado)) continue;
    const it = { kind: 'lb', id: t.id, code: t.as_code || t.project, project: t.project, estado: t.estado, titulo: t.anchor || normDomain(t.medio) };
    if (LIDER_RE.test(t.estado)) out.lider.push({ ...it, motivo: t.estado });
    else { const av = esPublicado(t.estado) ? [] : avisosLB(t, P(t.project), lb).filter((a) => /líder/.test(a)); if (av.length) out.lider.push({ ...it, motivo: av[0] }); }
    if (t.estado === 'Backlink Publicado - MANUAL_INDEX' || /indexaci/i.test(t.as_aviso || '')) out.indexacion.push({ ...it, motivo: t.as_aviso || 'Publicado con indexación manual: revisar que Google la indexe' });
    if (esPublicado(t.estado) && t.estado !== 'Cerrado' && t.pago_estado && !/^pagad/i.test(t.pago_estado) && !/exim/i.test(t.pago_estado)) out.impagas.push({ ...it, motivo: `Pago "${t.pago_estado}"${t.precio ? ` · ${t.moneda} ${t.precio}` : ''}` });
    if (t.as_aviso && !/indexaci/i.test(t.as_aviso)) out.appsheet.push({ ...it, motivo: t.as_aviso });
    if (t.estado_at && t.estado_at < lim && t.estado !== 'Cerrado') out.quietas.push({ ...it, motivo: `${Math.floor((Date.parse(hoy) - t.estado_at) / 864e5)} días en "${t.estado}"`, dias: Math.floor((Date.parse(hoy) - t.estado_at) / 864e5) });
  }
  for (const r of miasR) {
    if (esCerradoRED(r.estado)) continue;
    const it = { kind: 'red', id: r.id, code: r.as_code || r.project, project: r.project, estado: r.estado, titulo: r.tema };
    if (LIDER_RE.test(r.estado)) out.lider.push({ ...it, motivo: r.estado });
    if (r.as_aviso) out.appsheet.push({ ...it, motivo: r.as_aviso });
    if (r.estado_at && r.estado_at < lim) out.quietas.push({ ...it, motivo: `${Math.floor((Date.parse(hoy) - r.estado_at) / 864e5)} días en "${r.estado}"`, dias: Math.floor((Date.parse(hoy) - r.estado_at) / 864e5) });
  }
  out.quietas.sort((a, b) => b.dias - a.dias);
  // sugerencias: trabajo por acción
  const porMail = {};
  for (const t of mias.filter((t) => t.estado === 'Para Enviar')) (porMail[t.mail_eleven || '(sin mail)'] ||= []).push(t);
  for (const [mail, arr] of Object.entries(porMail)) out.sugerencias.push({ texto: `Enviar ${arr.length} link${arr.length > 1 ? 's' : ''} desde ${mail}`, detalle: [...new Set(arr.map((t) => t.project))].join(', '), filtro: { lbEstado: 'Para Enviar', lbMail: mail === '(sin mail)' ? '' : mail } });
  const gest = mias.filter((t) => t.estado === 'Gestión de Backlink');
  if (gest.length) out.sugerencias.push({ texto: `${gest.length} link${gest.length > 1 ? 's' : ''} en Gestión de Backlink: redactar o negociar`, detalle: [...new Set(gest.map((t) => t.project))].join(', '), filtro: { lbEstado: 'Gestión de Backlink' } });
  const flag = mias.filter((t) => t.estado === 'FLAG NO_EDITION_DOC');
  if (flag.length) out.sugerencias.push({ texto: `${flag.length} con FLAG NO_EDITION_DOC: falta el documento de redacción`, detalle: flag.map((t) => t.as_code).join(', '), filtro: { lbEstado: 'FLAG NO_EDITION_DOC' } });
  const venceRed = miasR.filter((r) => r.fecha_entrega && r.fecha_entrega <= addDays(hoy, 3) && !r.entregada);
  if (venceRed.length) out.sugerencias.push({ texto: `${venceRed.length} redacci${venceRed.length > 1 ? 'ones vencen' : 'ón vence'} en 3 días o menos`, detalle: [...new Set(venceRed.map((r) => r.project))].join(', '), filtro: { view: 'red' } });
  return out;
}

// ======================= Registro automático de tiempo =======================
/** A qué tarea de la planilla de horas va el tiempo de una tarea de la app. */
export function tipoHoras(kind, t, planMes = []) {
  let tipo;
  if (kind === 'lb') tipo = 'A - Creación de links';
  else tipo = /^Para CMS/.test(t.estado || '') ? 'C - Carga manual pieza en CMS' : t.ia ? 'B - Redacción automatizada' : 'A - Redacción manual';
  const delProy = planMes.filter((p) => p.project === t.project && (p.hours > 0 || p.units > 0)).map((p) => p.task_type);
  return delProy.length && !delProy.includes(tipo) ? delProy[0] : tipo;
}
export const QUIEN = { yo: 'Vos', ia: 'IA (Gemini)', claude: 'Claude', sync: 'Sincronización AppSheet' };
