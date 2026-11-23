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
  // espera a que la vista tenga filas de verdad (hasta 90 s). AppSheet no dibuja las tablas si la pestaña no está a la vista.
  const ir = async (v, re) => {
    location.hash = 'appName=' + app + '&view=' + v + '&vss='; // vss vacío: tablero sin proyecto seleccionado
    const hay = () => [...document.querySelectorAll('.TableView .TableViewRow')].some((f) => [...f.children].some((c) => re.test(c.innerText.trim())));
    for (let i = 0; i < 180 && !hay(); i++) { if (i % 10 === 0) msg(`esperando que cargue ${v === 'Tasks' ? 'Gestión Content' : 'Gestión Link Building'}… (dejá esta pestaña a la vista)`); await espera(500); }
    if (!hay()) throw new Error(`${v === 'Tasks' ? 'Gestión Content' : 'Gestión Link Building'} no cargó. Dejá la pestaña de AppSheet a la vista y volvé a intentar.`);
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
    await ir('Link_Building', /^[A-Z0-9]{2,5}-LIN-[\d.]+-\d+$/);
    let tvs = [...document.querySelectorAll('.TableView')];
    const proyectos = [], clientes = {};
    for (const f of await leer(tvs[0], /^[A-Z0-9]{2,5}-LIN-[\d.]+$/)) { proyectos.push(f.c[0]); clientes[f.c[0]] = f.primera[0]; }
    tvs = [...document.querySelectorAll('.TableView')];
    const lb = (await leer(tvs[tvs.length - 1], /^[A-Z0-9]{2,5}-LIN-[\d.]+-\d+$/)).map((f) => { const c = f.c; return [c[0], f.grupo, c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10]]; });
    if (!lb.length || !proyectos.length) throw new Error('Gestión Link Building se leyó vacía. Dejá la pestaña de AppSheet a la vista y volvé a intentar.');
    msg(`${lb.length} links leídos. Leyendo Gestión Content…`);
    await ir('Tasks', /^[A-Z0-9]{2,5}-RED-[\d.]+-\d+$/);
    const red = (await leer(document.querySelector('.TableView'), /^[A-Z0-9]{2,5}-RED-[\d.]+-\d+$/)).map((f) => f.c.slice(0, 12));
    if (!red.length) throw new Error('Gestión Content se leyó vacía. Dejá la pestaña de AppSheet a la vista y volvé a intentar.');
    msg(`${lb.length} links y ${red.length} redacciones leídos. Enviando…`);
    const tot = { lb: 0, red: 0, nuevos: [] };
    const enviar = async (cuerpo) => {
      if (O === 'PRUEBA') { tot.lb += cuerpo.lb.length; tot.red += cuerpo.red.length; window.__prueba = (window.__prueba || []).concat([cuerpo]); return; }
      const r = await fetch(O + '/api/import', { method: 'POST', headers: { 'content-type': 'application/json', 'x-import-key': K }, body: JSON.stringify(cuerpo) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
      tot.lb += j.lb || 0; tot.red += j.red || 0; tot.nuevos.push(...(j.proyectosNuevos || []));
    };
    let as_email = ''; try { as_email = (JSON.parse(localStorage.JeeneeUserInfo || '{}').UserInfo || {}).AuthUserEmail || ''; } catch {}
    const sinT = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const delMail = sinT(as_email.split('@')[0].replace(/[._-]+/g, ' '));
    const as_nombre = delMail ? ([...lb, ...red].map((r) => r[10]).find((n) => n && sinT(n) === delMail) || '') : '';
    for (let i = 0; i < Math.max(lb.length, 1); i += 150) await enviar({ lb: lb.slice(i, i + 150), red: [], proyectos, clientes, as_nombre, as_url: location.origin + location.pathname });
    for (let i = 0; i < red.length; i += 150) { msg(`enviando redacciones ${i + 1}–${Math.min(i + 150, red.length)} de ${red.length}…`); await enviar({ lb: [], red: red.slice(i, i + 150) }); }
    box.style.background = '#067647';
    msg(`listo: ${tot.lb} links y ${tot.red} redacciones de tus proyectos${tot.nuevos.length ? ` · proyectos nuevos: ${tot.nuevos.join(', ')}` : ''}. Volvé a la app y tocá Actualizar.`);
  } catch (e) { box.style.background = '#b42318'; msg('no se pudo: ' + e.message); }
  setTimeout(() => box.remove(), 20000);
}
