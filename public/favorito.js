// Proyectos Eleven · botón «Sincronizar» (favorito del navegador).
// Se toca con AppSheet (Eleven - Operaciones) abierto, o con el reporte de seguimiento abierto (para los objetivos del mes).
// Solo lee la página: lee cada tabla dos veces y manda las lecturas a tu cuenta, que las valida y recién ahí las aplica.
// La app lo arma reemplazando __CLAVE__ y __ORIGEN__ (la clave es tuya: no compartas el botón).
(async () => {
  const K = '__CLAVE__', O = '__ORIGEN__';
  if (window.__peCorriendo) return;
  window.__peCorriendo = true;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;top:14px;right:14px;width:360px;max-height:80vh;overflow:auto;background:#1d4ed8;color:#fff;padding:12px 16px;border-radius:10px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25);white-space:pre-line;cursor:default';
  document.body.appendChild(box);
  const COL = { run: '#1d4ed8', ok: '#067647', warn: '#b54708', bad: '#b42318' };
  const msg = (t, c = 'run') => { box.textContent = 'Proyectos Eleven\n' + t; box.style.background = COL[c]; };
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  // si cambiás de pestaña, la lectura se pausa (los sitios no dibujan las tablas en segundo plano)
  const aLaVista = async () => {
    if (document.visibilityState === 'visible') return;
    const t = box.textContent; msg('En pausa: volvé a esta pestaña para seguir.', 'warn');
    while (document.visibilityState !== 'visible') await espera(400);
    box.textContent = t; box.style.background = COL.run; await espera(900);
  };
  const post = async (ruta, cuerpo, hdr) => {
    const r = await fetch(O + ruta, { method: 'POST', headers: { 'content-type': 'application/json', ...hdr }, body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && !j.informe) throw new Error(j.error || 'Error ' + r.status);
    return j;
  };
  // espera a que la parte visible de la tabla deje de cambiar (en vez de un tiempo fijo)
  const quieto = async (el, sel) => {
    let antes = null;
    for (let i = 0; i < 25; i++) {
      await espera(i ? 90 : 60);
      const filas = el.querySelectorAll(sel), firma = filas.length + '|' + el.scrollTop + '|' + [...filas].map((f) => f.textContent).join('\u0001');
      if (firma === antes) return;
      antes = firma;
    }
  };
  let SID = '', CLAVE = '';
  const enviar = async (parte, lectura, l, meta) => {
    const n = Math.max(1, Math.ceil(l.filas.length / 150));
    for (let i = 0; i < n; i++) await post('/api/sync/lote', { sid: SID, parte, lectura, seq: i, ultimo: i === n - 1, encabezado: l.encabezado, filas: l.filas.slice(i * 150, (i + 1) * 150), meta }, { 'x-sync-key': CLAVE });
  };
  const t0 = Date.now(), seg = () => Math.round((Date.now() - t0) / 1000);
  try {
    const esAS = /(^|\.)appsheet\.com$/.test(location.host), esRep = /^(datastudio|lookerstudio)\.google\.com$/.test(location.host);
    if (!esAS && !esRep) throw new Error('Tocá este botón con AppSheet (Eleven - Operaciones) o con el reporte de seguimiento abierto.');
    msg('Conectando con tu cuenta…');
    const ini = await post('/api/sync/iniciar-clave', { tipo: esAS ? 'appsheet' : 'reporte' }, { 'x-import-key': K });
    SID = ini.sid; CLAVE = ini.clave;

    if (esAS) {
      // ---------- AppSheet: proyectos y links (Gestión Link Building) y redacciones (Gestión Content) ----------
      const app = (location.hash.match(/appName=([^&]+)/) || [])[1];
      if (!app) throw new Error('Esta pestaña no tiene abierta la app Eleven - Operaciones. Abrila desde Proyectos Eleven (botón Sincronizar) y tocá el favorito otra vez.');
      let as_email = ''; try { as_email = (JSON.parse(localStorage.JeeneeUserInfo || '{}').UserInfo || {}).AuthUserEmail || ''; } catch (e) { /* sin mail */ }
      const meta = { as_email, as_url: location.href };
      const TABLAS = {
        lbProy: { es: (h) => h.includes('Proyecto') && h.includes('Presupuesto Mensual'), clave: 'Proyecto', re: /^[A-Z0-9]{2,5}-LIN-/, nombre: 'proyectos' },
        lb: { es: (h) => h.includes('Código') && h.includes('Anchors'), clave: 'Código', re: /^[A-Z0-9]{2,5}-LIN-.+-\d+$/, grupo: true, nombre: 'links' },
        red: { es: (h) => h.includes('Código') && h.includes('Tema'), clave: 'Código', re: /^[A-Z0-9]{2,5}-RED-.+-\d+$/, nombre: 'redacciones' },
      };
      const tablas = () => [...document.querySelectorAll('.TableView')].map((tv) => ({ tv, enc: [...(tv.querySelector('.TableView__header')?.children || [])].map((c) => c.innerText.trim()) }));
      const buscar = (p) => tablas().find((t) => TABLAS[p].es(t.enc) && [...t.tv.querySelectorAll('.TableViewRow')].some((f) => [...f.children].some((c) => TABLAS[p].re.test(c.innerText.trim()))));
      const ir = async (vista, partes) => {
        location.hash = 'appName=' + app + '&view=Operations'; await espera(1200);
        location.hash = 'appName=' + app + '&view=' + vista + '&vss=';
        for (let i = 0; i < 300 && !partes.every(buscar); i++) { await aLaVista(); await espera(200); }
        if (!partes.every(buscar)) throw new Error('La vista ' + vista + ' no terminó de cargar sus tablas.');
        await quieto(document.body, '.TableViewRow');
      };
      let progreso = '';
      const leer = async (parte, fraccion, lectura) => {
        const T = TABLAS[parte], t = buscar(parte), enc = t.enc, ic = enc.indexOf(T.clave);
        const sc = t.tv.querySelector('.TableView__list') || t.tv, filas = new Map();
        sc.scrollTop = 0; await quieto(sc, '.TableViewRow');
        let quietas = 0, ultimo = null, vueltas = 0;
        while (quietas < 3 && vueltas++ < 5000) {
          await aLaVista();
          let grupo = null;
          for (const el of sc.querySelectorAll('.GroupedHeaderRow, .TableViewRow')) {
            if (el.classList.contains('GroupedHeaderRow')) { grupo = el.innerText.trim(); continue; }
            const c = [...el.children].map((x) => x.innerText.trim()), k = c[ic];
            if (!k || !T.re.test(k)) continue;
            if (T.grupo && grupo === null) grupo = filas.has(k) ? filas.get(k).g : ultimo;
            const f = T.grupo ? { g: grupo || '', c } : { c }, prev = filas.get(k);
            if (prev && JSON.stringify(prev) !== JSON.stringify(f)) throw new Error(k + ' cambió en medio de la lectura (la tabla todavía estaba cargando). Tocá el favorito de nuevo.');
            filas.set(k, f); if (T.grupo) ultimo = grupo;
          }
          msg(`${progreso}Lectura ${lectura} de 2 · ${T.nombre}: ${filas.size}…\nNo cierres esta pestaña.`);
          const antes = sc.scrollTop; sc.scrollTop += Math.max(40, sc.clientHeight * fraccion);
          await quieto(sc, '.TableViewRow');
          quietas = sc.scrollTop === antes ? quietas + 1 : 0;
        }
        return { encabezado: enc, filas: [...filas.values()] };
      };
      const cuenta = {};
      for (const [lectura, fraccion] of [[1, 0.85], [2, 0.55]]) {
        await ir('Link_Building', ['lbProy', 'lb']);
        for (const p of ['lbProy', 'lb']) { const l = await leer(p, fraccion, lectura); cuenta[p + lectura] = l.filas.length; await enviar(p, lectura, l, meta); }
        await ir('Tasks', ['red']);
        { const l = await leer('red', fraccion, lectura); cuenta['red' + lectura] = l.filas.length; await enviar('red', lectura, l, meta); }
        progreso = `Lectura 1: ${cuenta.lb1} links y ${cuenta.red1} redacciones.\n`;
      }
      location.hash = 'appName=' + app + '&view=Operations';
    } else {
      // ---------- reporte de seguimiento: objetivos del mes (páginas Link Building y Content) ----------
      const PAG = { objLin: 'Seguimiento Link Building', objRed: 'Seguimiento Content' };
      const actual = () => Object.keys(PAG).find((p) => document.title.includes(PAG[p]));
      const irPagina = async (p) => {
        if (actual() === p) return;
        const it = [...document.querySelectorAll('[role=treeitem]')].find((e) => e.innerText.trim() === PAG[p]);
        if (!it) throw new Error(`No encontré la página «${PAG[p]}» en el menú del reporte.`);
        // el menú del reporte responde a la secuencia completa del mouse, no a un click() suelto
        const el = it.querySelector('.mat-mdc-list-item-content') || it, r = el.getBoundingClientRect(), o = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
        for (const tipo of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) el.dispatchEvent(tipo.startsWith('pointer') ? new PointerEvent(tipo, { ...o, pointerId: 1, isPrimary: true }) : new MouseEvent(tipo, o));
        for (let i = 0; i < 80 && actual() !== p; i++) await espera(250);
        if (actual() !== p) throw new Error(`No se abrió la página «${PAG[p]}».`);
      };
      const buscarTabla = (p) => {
        for (const hr of document.querySelectorAll('.headerRow')) {
          const enc = [...hr.querySelectorAll('.colName')].map((c) => c.innerText.trim());
          if (!enc.includes('Proyecto') || !enc.includes('Q. piezas Mensual Plan.') || enc.includes('Mes de Planificación')) continue;
          let root = hr; while (root && !root.querySelector('.row .cell')) root = root.parentElement;
          if (root && [...root.querySelectorAll('.row .cell')].some((c) => (p === 'objRed' ? /^[A-Z0-9]{2,5}-RED-/ : /^[A-Z0-9]{2,5}-LIN-/).test(c.innerText.trim()))) return { enc, root };
        }
        return null;
      };
      const orden = actual() === 'objRed' ? ['objRed', 'objLin'] : ['objLin', 'objRed'];
      const leidas = {};
      for (const p of orden) {
        await irPagina(p);
        let t = null;
        for (let i = 0; i < 120 && !(t = buscarTabla(p)); i++) { await aLaVista(); await espera(250); }
        if (!t) throw new Error(`No encontré la tabla de proyectos con «Q. piezas Mensual Plan.» en «${PAG[p]}».`);
        const pag = (t.root.innerText.match(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/) || []).map(Number);
        if (pag.length && (pag[1] !== 1 || pag[2] !== pag[3])) throw new Error('La tabla tiene varias páginas; no se puede leer completa.');
        const ic = t.enc.indexOf('Proyecto');
        const sc = [t.root, ...t.root.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 10 && e.querySelector('.row')).sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0] || t.root;
        for (const [lectura, paso] of [[1, 0.85], [2, 0.55]]) {
          const filas = new Map(); sc.scrollTop = 0; await quieto(t.root, '.row');
          let quietas = 0, vueltas = 0;
          while (quietas < 3 && vueltas++ < 2000) {
            await aLaVista();
            for (const row of t.root.querySelectorAll('.row')) {
              const c = [...row.querySelectorAll('.cell')].map((x) => x.innerText.trim()), k = c[ic];
              if (!k || c.length !== t.enc.length) continue;
              const prev = filas.get(k); if (prev && JSON.stringify(prev.c) !== JSON.stringify(c)) throw new Error(k + ' cambió en medio de la lectura.');
              filas.set(k, { c });
            }
            msg(`Objetivos · ${PAG[p]} · lectura ${lectura} de 2: ${filas.size}…`);
            const antes = sc.scrollTop; sc.scrollTop += Math.max(40, sc.clientHeight * paso); await quieto(t.root, '.row');
            quietas = sc.scrollTop === antes ? quietas + 1 : 0;
          }
          if (pag.length && filas.size !== pag[3]) throw new Error(`Se leyeron ${filas.size} filas y la tabla dice ${pag[3]}.`);
          leidas[p + lectura] = filas.size;
          await enviar(p, lectura, { encabezado: t.enc, filas: [...filas.values()] });
        }
      }
    }

    msg('Revisando todo antes de guardar…');
    const r = await post('/api/sync/cerrar', { sid: SID }, { 'x-sync-key': CLAVE });
    const inf = r.informe || r, adv = (inf.advertencias || []).length ? `\n(${inf.advertencias.length} aviso${inf.advertencias.length > 1 ? 's' : ''}: ver en la app)` : '';
    if (r.pendienteConfirmacion) msg(`La lectura salió bien, pero hay cambios para confirmar:\n• ${inf.motivosConfirmacion.join('\n• ')}\n\nNo se guardó nada todavía: confirmalo en Proyectos Eleven.`, 'warn');
    else if (!r.aplicado) msg(`No se guardó nada.\n• ${(inf.errores || [r.error]).slice(0, 4).join('\n• ')}\n\nTocá el favorito de nuevo.`, 'bad');
    else if (!r.verificacion?.ok) msg(`Se guardó, pero la verificación encontró diferencias:\n• ${r.verificacion.diferencias.slice(0, 4).join('\n• ')}\n\nNo uses estos datos: tocá el favorito de nuevo.`, 'bad');
    else if (inf.tipo === 'reporte') msg(`Listo y verificado (${seg()} s): objetivos del mes en ${inf.objetivos.actualizados} proyectos.${inf.objetivos.sinObjetivo.length ? `\nSin objetivo: ${inf.objetivos.sinObjetivo.join(', ')}` : ''}${adv}\n\nYa podés volver a Proyectos Eleven.`, 'ok');
    else msg(`Listo y verificado (${seg()} s).\nLinks: ${inf.links.total} (${inf.links.nuevas} nuevos, ${inf.links.cambiadas} con cambios, ${inf.links.borradas} borrados)\nRedacciones: ${inf.redacciones.total} (${inf.redacciones.nuevas} nuevas, ${inf.redacciones.cambiadas} con cambios, ${inf.redacciones.borradas} borradas)${adv}\n\nYa podés volver a Proyectos Eleven.`, 'ok');
  } catch (e) {
    msg('No se guardó nada.\n' + e.message, 'bad');
  } finally {
    window.__peCorriendo = false;
    const x = document.createElement('div'); x.textContent = 'Cerrar ✕'; x.style.cssText = 'margin-top:10px;text-align:right;cursor:pointer;font-weight:600';
    x.onclick = () => box.remove(); box.appendChild(x);
  }
})();
