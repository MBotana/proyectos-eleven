// Proyectos Eleven — "Traer de AppSheet". Corre dentro de la página de AppSheet (Eleven - Operaciones) con la sesión
// de quien lo toca: lee las tablas de Gestión Link Building y Gestión Content y las manda a su cuenta de la app.
// Este archivo es la fuente legible; el botón (marcador) lleva una copia comprimida con la clave de cada usuario.
async function traerDeAppSheet(K, O) {
  if (!/appsheet\.com$/.test(location.host)) return alert('Abrí AppSheet (Eleven - Operaciones) y tocá el botón de nuevo.');
  const app = (location.hash.match(/appName=([^&]+)/) || [])[1];
  if (!app) return alert('Abrí la app Eleven - Operaciones y tocá el botón de nuevo.');
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;top:14px;right:14px;max-width:360px;background:#1d4ed8;color:#fff;padding:12px 16px;border-radius:10px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)';
  document.body.appendChild(box);
  const msg = (t) => { box.textContent = 'Proyectos Eleven · ' + t; window.__peEstado = t; };
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const ir = async (v) => {
    location.hash = 'appName=' + app + '&view=' + v + '&vss='; // vss vacío: tablero sin proyecto seleccionado
    for (let i = 0; i < 40; i++) { await espera(500); if (document.querySelector('.TableView .TableViewRow')) break; }
    await espera(1500);
  };
  const leer = async (tv, re) => {
    const sc = tv.querySelector('.TableView__list') || tv, filas = new Map();
    sc.scrollTop = 0; await espera(400);
    let quietas = 0;
    while (quietas < 3) {
      let grupo = '';
      for (const el of sc.querySelectorAll('.GroupedHeaderRow, .TableViewRow')) {
        if (el.classList.contains('GroupedHeaderRow')) { grupo = el.innerText.trim(); continue; }
        const c = [...el.children].map((x) => x.innerText.trim()), i = c.findIndex((x) => re.test(x));
        if (i >= 0 && !filas.has(c[i])) filas.set(c[i], { c: c.slice(i), grupo, primera: c });
      }
      const t = sc.scrollTop; sc.scrollTop += sc.clientHeight * 0.8; await espera(300);
      if (sc.scrollTop === t) quietas++;
    }
    return [...filas.values()];
  };
  try {
    msg('leyendo Gestión Link Building…');
    await ir('Link_Building');
    let tvs = [...document.querySelectorAll('.TableView')];
    const proyectos = [], clientes = {};
    for (const f of await leer(tvs[0], /^[A-Z0-9]{2,5}-LIN-[\d.]+$/)) { proyectos.push(f.c[0]); clientes[f.c[0]] = f.primera[0]; }
    tvs = [...document.querySelectorAll('.TableView')];
    const lb = (await leer(tvs[tvs.length - 1], /^[A-Z0-9]{2,5}-LIN-[\d.]+-\d+$/)).map((f) => { const c = f.c; return [c[0], f.grupo, c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10]]; });
    msg(`${lb.length} links leídos. Leyendo Gestión Content…`);
    await ir('Tasks');
    const red = (await leer(document.querySelector('.TableView'), /^[A-Z0-9]{2,5}-RED-[\d.]+-\d+$/)).map((f) => f.c.slice(0, 12));
    msg(`${lb.length} links y ${red.length} redacciones leídos. Enviando…`);
    const tot = { lb: 0, red: 0, nuevos: [] };
    const enviar = async (cuerpo) => {
      if (O === 'PRUEBA') { tot.lb += cuerpo.lb.length; tot.red += cuerpo.red.length; window.__prueba = (window.__prueba || []).concat([cuerpo]); return; }
      const r = await fetch(O + '/api/import', { method: 'POST', headers: { 'content-type': 'application/json', 'x-import-key': K }, body: JSON.stringify(cuerpo) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
      tot.lb += j.lb || 0; tot.red += j.red || 0; tot.nuevos.push(...(j.proyectosNuevos || []));
    };
    for (let i = 0; i < Math.max(lb.length, 1); i += 150) await enviar({ lb: lb.slice(i, i + 150), red: [], proyectos, clientes, as_url: location.origin + location.pathname });
    for (let i = 0; i < red.length; i += 150) { msg(`enviando redacciones ${i + 1}–${Math.min(i + 150, red.length)} de ${red.length}…`); await enviar({ lb: [], red: red.slice(i, i + 150) }); }
    box.style.background = '#067647';
    msg(`listo: ${tot.lb} links y ${tot.red} redacciones de tus proyectos${tot.nuevos.length ? ` · proyectos nuevos: ${tot.nuevos.join(', ')}` : ''}. Volvé a la app y tocá Actualizar.`);
  } catch (e) { box.style.background = '#b42318'; msg('no se pudo: ' + e.message); }
  setTimeout(() => box.remove(), 20000);
}
