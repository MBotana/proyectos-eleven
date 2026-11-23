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
chrome.runtime.onMessage.addListener((m, _s, responder) => {
  if (m?.pe === 'programar') programar();
  if (m?.pe === 'actualizar') { actualizar().then(() => responder({ ok: true })); return true; }
});

let corriendo = false;
async function actualizar() {
  if (corriendo) return; corriendo = true;
  const { config } = await chrome.storage.local.get('config');
  const resultado = { at: Date.now(), partes: [] };
  try {
    if (!config?.clave) throw new Error('Abrí Proyectos Eleven para conectar la extensión');
    chrome.action.setBadgeText({ text: '…' }); chrome.action.setBadgeBackgroundColor({ color: '#1d4ed8' });
    if (config.reporte) resultado.partes.push(await leerEn(config.reporte, config, 'Reporte', 4 * 60000));
    if (config.as_url) resultado.partes.push(await leerEn(config.as_url, config, 'AppSheet', 8 * 60000));
    const mal = resultado.partes.filter((p) => !p.ok);
    chrome.action.setBadgeText({ text: mal.length ? '!' : '' }); chrome.action.setBadgeBackgroundColor({ color: '#b42318' });
  } catch (e) {
    resultado.partes.push({ que: 'Extensión', ok: false, texto: e.message });
    chrome.action.setBadgeText({ text: '!' }); chrome.action.setBadgeBackgroundColor({ color: '#b42318' });
  }
  await chrome.storage.local.set({ ultimo: resultado });
  corriendo = false;
}

/** Abre la página en una pestaña de fondo, espera a que cargue, corre el lector y devuelve su último mensaje. */
async function leerEn(url, config, que, limite) {
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    for (let i = 0; i < 120; i++) { await espera(1000); const t = await chrome.tabs.get(tab.id); if (t.status === 'complete') break; }
    if (que === 'AppSheet') { // AppSheet completa el link con el nombre de la app después de cargar
      for (let i = 0; i < 60; i++) { const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => /appName=/.test(location.hash) }); if (r?.result) break; await espera(1000); }
    }
    await espera(4000);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['traer.js'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (k, o) => { window.__peEstado = 'iniciando'; traerDeAppSheet(k, o); }, args: [config.clave, config.origen] });
    const fin = Date.now() + limite;
    while (Date.now() < fin) {
      await espera(5000);
      const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.__peEstado || '' });
      const t = r?.result || '';
      if (/^listo/.test(t)) return { que, ok: true, texto: t };
      if (/^no se pudo/.test(t)) return { que, ok: false, texto: t };
    }
    return { que, ok: false, texto: 'tardó demasiado' };
  } catch (e) {
    return { que, ok: false, texto: /signin|ServiceLogin|accounts\.google/.test(String(e)) ? 'hay que iniciar sesión' : e.message };
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}
