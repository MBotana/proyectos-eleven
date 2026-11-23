// Proyectos Eleven — "Traer de AppSheet". Corre dentro de la página de AppSheet (Eleven - Operaciones) con la sesión
// de quien lo toca: lee las tablas de Gestión Link Building y Gestión Content y las manda a su cuenta de la app.
// Este archivo es la fuente legible; el botón (marcador) lleva una copia comprimida con la clave de cada usuario.
async function traerDeAppSheet(K, O) {
  if (/(datastudio|lookerstudio)\.google\.com$/.test(location.host)) return traerReporte(K, O);
  if (!/appsheet\.com$/.test(location.host)) return alert('Abrí AppSheet (Eleven - Operaciones) o el Reporte de Seguimiento y tocá el botón de nuevo.');
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

// Reporte de Seguimiento (Looker Studio): solo lee las tablas de proyectos de Link Building y de Content. No toca filtros ni escribe nada.
async function traerReporte(K, O) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;top:14px;right:14px;max-width:360px;background:#1d4ed8;color:#fff;padding:12px 16px;border-radius:10px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)';
  document.body.appendChild(box);
  const msg = (t) => { box.textContent = 'Proyectos Eleven · ' + t; window.__peEstado = t; };
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const PROY = /^[A-Z0-9]{2,5}-(LIN|RED)-[\w.-]+$/;
  const num = (v) => { const t = String(v || '').trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); return t === '' || t === '-' || isNaN(Number(t)) ? null : Number(t); };
  const cajas = (tipo) => [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 100 && new RegExp('[A-Z0-9]{2,5}-' + tipo + '-').test(e.innerText || '') && e.innerText.length < 60000);
  const filaDe = (r) => {
    const c = r.innerText.split('\n').map((x) => x.trim()).filter((x) => x !== '');
    return c.length >= 9 && PROY.test(c[1]) && /^(Cantidad|Monto)$/i.test(c[5]) ? { cliente: c[0], proyecto: c[1], lider: c[2], inicio: c[3], cierre: c[4], tratamiento: c[5], periodo: c[6], plan: num(c[7]), entregadasMes: num(c[8]), total: c.length > 9 ? num(c[9]) : null } : null;
  };
  const visibles = (tipo) => [...document.querySelectorAll('.row, [role=row]')].map(filaDe).filter((f) => f && f.proyecto.includes('-' + tipo + '-'));
  const leerPagina = async (tipo) => {
    for (let i = 0; i < 80 && !visibles(tipo).length; i++) await espera(500);
    await espera(1000);
    const filas = new Map();
    const juntar = () => visibles(tipo).forEach((f) => filas.set(f.proyecto, f));
    juntar();
    for (const caja of cajas(tipo)) {
      for (let y = 0; y < 30000; y += 300) { caja.scrollTop = y; await espera(250); juntar(); if (y > caja.scrollHeight) break; }
      caja.scrollTop = 0;
    }
    return [...filas.values()];
  };
  const irA = async (nombre) => {
    const it = [...document.querySelectorAll('[role=treeitem]')].find((e) => e.innerText.trim() === nombre);
    if (!it) throw new Error('no encontré la página «' + nombre + '» del reporte');
    if (it.getAttribute('aria-current') === 'true') return;
    it.scrollIntoView({ block: 'center' });
    const b = it.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2, el = document.elementFromPoint(x, y);
    const blanco = el && it.contains(el) ? el : it.querySelector('div, span, a') || it, o = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) blanco.dispatchEvent(t.startsWith('pointer') ? new PointerEvent(t, { ...o, pointerType: 'mouse' }) : new MouseEvent(t, o));
    for (let i = 0; i < 20 && it.getAttribute('aria-current') !== 'true'; i++) await espera(500);
    await espera(3000);
  };
  try {
    msg('leyendo Seguimiento Link Building…');
    await irA('Seguimiento Link Building');
    const lin = (await leerPagina('LIN')).filter((f) => f.proyecto.includes('-LIN-'));
    msg(`${lin.length} proyectos de link building. Leyendo Seguimiento Content…`);
    await irA('Seguimiento Content');
    const red = (await leerPagina('RED')).filter((f) => f.proyecto.includes('-RED-'));
    if (!lin.length && !red.length) throw new Error('no encontré las tablas de proyectos');
    let r = { filas: lin.length + red.length, proyectosNuevos: [] };
    if (O === 'PRUEBA') window.__prueba = { lin, red };
    else {
      const res = await fetch(O + '/api/reporte', { method: 'POST', headers: { 'content-type': 'application/json', 'x-import-key': K }, body: JSON.stringify({ filas: [...lin, ...red] }) });
      r = await res.json().catch(() => ({})); if (!res.ok) throw new Error(r.error || 'Error ' + res.status);
    }
    box.style.background = '#067647';
    msg(`listo: ${lin.length} proyectos de link building y ${red.length} de content${r.proyectosNuevos && r.proyectosNuevos.length ? ` · proyectos nuevos: ${r.proyectosNuevos.join(', ')}` : ''}. Volvé a la app y tocá Actualizar.`);
  } catch (e) { box.style.background = '#b42318'; msg('no se pudo: ' + e.message); }
  setTimeout(() => box.remove(), 20000);
}
