// Proyectos Eleven (extensión): puente con la app. La app le pasa la configuración (clave y links) sin que haya que copiar nada.
(() => {
  const avisar = async () => {
    const { config, ultimo } = await chrome.storage.local.get(['config', 'ultimo']);
    window.postMessage({ pe: 'ext-hola', version: chrome.runtime.getManifest().version, conectada: !!config?.clave, ultimo: ultimo || null }, location.origin);
  };
  window.addEventListener('message', async (e) => {
    if (e.source !== window || e.origin !== location.origin || !e.data || typeof e.data !== 'object') return;
    if (e.data.pe === 'ext-config') {
      const c = e.data;
      if (typeof c.clave !== 'string' || c.clave.length < 20) return;
      await chrome.storage.local.set({ config: { clave: c.clave, origen: location.origin, as_url: /^https:\/\/www\.appsheet\.com\/start\//.test(c.as_url || '') ? c.as_url : '', reporte: /^https:\/\/(datastudio|lookerstudio)\.google\.com\//.test(c.reporte || '') ? c.reporte : '', cadaHoras: Math.min(24, Math.max(1, Number(c.cadaHoras) || 3)) } });
      chrome.runtime.sendMessage({ pe: 'programar' });
      avisar();
    }
    if (e.data.pe === 'ext-actualizar') chrome.runtime.sendMessage({ pe: 'actualizar' });
    if (e.data.pe === 'ext-leer-ya') chrome.runtime.sendMessage({ pe: 'leer-ya' });
    if (e.data.pe === 'ext-estado') avisar();
  });
  avisar();
})();
