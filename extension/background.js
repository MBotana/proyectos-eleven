// Proyectos Eleven (extensión): cada tantas horas abre el Reporte y AppSheet en una pestaña de fondo, los lee con tu sesión
// (solo lectura, el mismo código que el botón de favoritos) y cierra la pestaña. Nunca escribe en AppSheet ni en el Reporte.
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function programar() {
  const { config } = await chrome.storage.local.get('config');
  await chrome.alarms.clear('actualizar');
  if (config?.clave) chrome.alarms.create('actualizar', { delayInMinutes: 1, periodInMinutes: 60 * (config.cadaHoras || 3) });
}
chrome.runtime.onInstalled.addListener(programar);
chrome.runtime.onStartup.addListener(programar);
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'actualizar') actualizar(); });
const propias = new Set(); // pestañas que abre la extensión (no disparan una segunda lectura)
const MEDIA_HORA = 30 * 60000;
chrome.runtime.onMessage.addListener((m, s, responder) => {
  if (m?.pe === 'programar') programar();
  if (m?.pe === 'leer-ya') chrome.storage.local.set({ pedido: Date.now() });
  if (m?.pe === 'pagina-lista' && s.tab?.id && !propias.has(s.tab.id)) alAbrir(s.tab.id, m.tipo);
  if (m?.pe === 'actualizar') { actualizar().then(() => responder({ ok: true })); return true; }
});

/** Cuando el usuario abre AppSheet o el Reporte: si hace rato que no se lee (o la app lo pidió), lo lee en esa misma pestaña. */
async function alAbrir(tabId, que) {
  const { config, ultimas = {}, pedido = 0 } = await chrome.storage.local.get(['config', 'ultimas', 'pedido']);
  if (!config?.clave || corriendo) return;
  const reciente = Date.now() - (ultimas[que] || 0) < MEDIA_HORA, pedidoVivo = Date.now() - pedido < MEDIA_HORA;
  if (reciente && !pedidoVivo) return;
  corriendo = true;
  chrome.action.setBadgeText({ text: '…' }); chrome.action.setBadgeBackgroundColor({ color: '#1d4ed8' });
  const partes = [await correrEn(tabId, config, que, que === 'AppSheet' ? 8 * 60000 : 4 * 60000)];
  if (que === 'AppSheet' && partes[0].ok) await chrome.storage.local.set({ pedido: 0 });
  // después de AppSheet, el Reporte en segundo plano (si hace rato que no se lee)
  const u = (await chrome.storage.local.get('ultimas')).ultimas || {};
  if (partes[0].ok && que === 'AppSheet' && config.reporte && Date.now() - (u.Reporte || 0) > MEDIA_HORA) partes.push(await leerEn(config.reporte, config, 'Reporte', 4 * 60000));
  await terminar(partes);
}
async function terminar(partes) {
  const { ultimas = {} } = await chrome.storage.local.get('ultimas');
  for (const p of partes) if (p.ok) ultimas[p.que] = Date.now();
  await chrome.storage.local.set({ ultimo: { at: Date.now(), partes }, ultimas });
  const mal = partes.some((p) => !p.ok);
  chrome.action.setBadgeText({ text: mal ? '!' : '' }); chrome.action.setBadgeBackgroundColor({ color: '#b42318' });
  corriendo = false;
}

let corriendo = false;
async function actualizar() {
  if (corriendo) return; corriendo = true;
  const { config } = await chrome.storage.local.get('config');
  const resultado = { at: Date.now(), partes: [] };
  try {
    if (!config?.clave) throw new Error('Abrí Proyectos Eleven para conectar la extensión');
    chrome.action.setBadgeText({ text: '…' }); chrome.action.setBadgeBackgroundColor({ color: '#1d4ed8' });
    if (config.as_url) resultado.partes.push(await leerEn(config.as_url, config, 'AppSheet', 8 * 60000));
    if (config.reporte) resultado.partes.push(await leerEn(config.reporte, config, 'Reporte', 4 * 60000));
  } catch (e) {
    resultado.partes.push({ que: 'Extensión', ok: false, texto: e.message });
  }
  await terminar(resultado.partes);
}

/** Abre la página en una pestaña de fondo, la lee y la cierra. */
async function leerEn(url, config, que, limite) {
  const tab = await chrome.tabs.create({ url, active: false }); propias.add(tab.id);
  try {
    for (let i = 0; i < 120; i++) { await espera(1000); const t = await chrome.tabs.get(tab.id); if (t.status === 'complete') break; }
    return await correrEn(tab.id, config, que, limite);
  } finally { propias.delete(tab.id); chrome.tabs.remove(tab.id).catch(() => {}); }
}
/** Corre el lector (el mismo del botón de favoritos) en una pestaña ya abierta y espera su resultado. */
async function correrEn(tabId, config, que, limite) {
  try {
    if (que === 'AppSheet') { // AppSheet completa el link con el nombre de la app al cargar; si pide iniciar sesión, no hay tabla
      let ok = false;
      for (let i = 0; i < 90 && !ok; i++) { const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: () => /appName=/.test(location.hash) && !!document.querySelector('.TableView, .TableViewRow') }); ok = !!r?.result; if (!ok) await espera(1000); }
      if (!ok) return { que, ok: false, texto: 'hay que iniciar sesión en AppSheet' };
    }
    await espera(3000);
    await chrome.scripting.executeScript({ target: { tabId }, files: ['traer.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, func: (k, o) => { window.__peEstado = 'iniciando'; traerDeAppSheet(k, o); }, args: [config.clave, config.origen] });
    const fin = Date.now() + limite;
    while (Date.now() < fin) {
      await espera(5000);
      const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: () => window.__peEstado || '' });
      const t = r?.result || '';
      if (/^listo/.test(t)) return { que, ok: true, texto: t };
      if (/^no se pudo/.test(t)) return { que, ok: false, texto: t };
    }
    return { que, ok: false, texto: 'tardó demasiado' };
  } catch (e) {
    return { que, ok: false, texto: /signin|ServiceLogin|accounts\.google|Cannot access/.test(String(e)) ? 'hay que iniciar sesión' : e.message };
  }
}
