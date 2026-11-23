---
name: proyectos-eleven
description: Sincroniza a pedido la app Proyectos Eleven (versión líder, solo lectura) con AppSheet (Eleven - Operaciones) y el reporte de seguimiento. Lee dos veces cada tabla, valida todo y aplica una foto completa solo si no hay errores. Usar cuando el usuario pida conectar, sincronizar, actualizar o traer datos de AppSheet a Proyectos Eleven.
---

# Proyectos Eleven ← AppSheet (versión líder)

- **APP**: https://proyectos-eleven.martinbotana.workers.dev
- **AppSheet**: la app "Eleven - Operaciones" (www.appsheet.com). El mensaje del usuario suele traer el link.
- **Reporte**: https://datastudio.google.com/u/0/reporting/21888fb7-9f40-4059-98ea-e9a1c198eb08/page/73rOF

Todo se hace en el navegador con **las sesiones del usuario** (el navegador integrado de Claude de escritorio o Claude in Chrome).

## Reglas (no se negocian)

- **Solo lectura.** No cambies nada en AppSheet, en el reporte ni en ninguna planilla o documento. No dejes comentarios en ningún lado.
- Nunca pidas, escribas ni guardes contraseñas o códigos. Si una página pide iniciar sesión, pedile al usuario que lo haga él y esperá su aviso.
- **No insertes scripts externos** (`<script src>`), no crees políticas de Trusted Types y no copies datos a mano: solo ejecutás los códigos de lectura de esta skill tal cual, y ellos mandan los datos directo a la app.
- **Nunca digas "listo" sin que `PE.syncAplicar` devuelva `verificacion.ok === true`.** Si algo falla, no se escribe nada: contale al usuario el error tal como vino y que vuelva a tocar **Sincronizar**.
- La sincronización es **solo a pedido**: no crees tareas programadas ni automáticas.

## 0. Preparar

1. Abrí APP en una pestaña. Si el mensaje trae un "enlace para abrir mi app", abrí **ese** enlace.
2. Con la herramienta de JavaScript, en APP: `await PE.yo()`. Si `PE` no existe, recargá una vez. Si responde `null`, pedile que toque **Sincronizar** en la app para mandarte un enlace nuevo.
3. Guardá la hora de inicio: `window.__inicio = Date.now()`.
4. Abrí AppSheet en otra pestaña (el link del mensaje). Si pide iniciar sesión, pedile que entre con su cuenta de Eleven y esperá su aviso.

## Primera vez (cuando el mensaje lo pide)

1. Si todavía no tiene esta skill guardada, proponésela para guardar (mismo nombre y contenido que este archivo) y seguí.
2. Hacé **Sincronizar** completo. No preguntes nada más: el usuario ya lo pidió.

## Sincronizar

### 1. Iniciar (pestaña APP)

```js
window.__s = await PE.syncIniciar(); window.__s
```
Devuelve `{ sid, clave, origen }`. Vence en 1 hora.

### 2. Leer AppSheet (pestaña AppSheet)

**Poné la pestaña de AppSheet al frente** (AppSheet no dibuja las tablas en una pestaña de fondo) y ejecutá este código **tal cual**, reemplazando solo `SID`, `CLAVE` y `ORIGEN` por los valores del paso 1. No esperes el resultado: tarda de 2 a 5 minutos.

```js
{
const SID = 'SID', CLAVE = 'CLAVE', ORIGEN = 'ORIGEN';
// Proyectos Eleven · lectura de AppSheet. Solo lee la página: lee cada tabla dos veces y manda las lecturas a la app.
window.__peSync = { estado: 'leyendo', paso: 'empezando', leidas: {} };
(async () => {
  const E = window.__peSync, espera = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const app = (location.hash.match(/appName=([^&]+)/) || [])[1];
    if (!/appsheet\.com$/.test(location.host) || !app) throw new Error('Esta pestaña no tiene abierta la app Eleven - Operaciones.');
    let as_email = ''; try { as_email = (JSON.parse(localStorage.JeeneeUserInfo || '{}').UserInfo || {}).AuthUserEmail || ''; } catch (e) { /* sin mail */ }
    const visible = () => { if (document.visibilityState !== 'visible') throw new Error('La pestaña de AppSheet dejó de estar a la vista: AppSheet no dibuja las tablas en segundo plano.'); };
    const TABLAS = {
      lbProy: { es: (h) => h.includes('Proyecto') && h.includes('Presupuesto Mensual'), clave: 'Proyecto', re: /^[A-Z0-9]{2,5}-LIN-/ },
      lb: { es: (h) => h.includes('Código') && h.includes('Anchors'), clave: 'Código', re: /^[A-Z0-9]{2,5}-LIN-.+-\d+$/, grupo: true },
      red: { es: (h) => h.includes('Código') && h.includes('Tema'), clave: 'Código', re: /^[A-Z0-9]{2,5}-RED-.+-\d+$/ },
    };
    const tablas = () => [...document.querySelectorAll('.TableView')].map((tv) => ({ tv, enc: [...(tv.querySelector('.TableView__header')?.children || [])].map((c) => c.innerText.trim()) }));
    const buscar = (p) => tablas().find((t) => TABLAS[p].es(t.enc) && [...t.tv.querySelectorAll('.TableViewRow')].some((f) => [...f.children].some((c) => TABLAS[p].re.test(c.innerText.trim()))));
    const ir = async (vista, partes) => {
      E.paso = 'abriendo ' + vista;
      location.hash = 'appName=' + app + '&view=Operations'; await espera(1500);
      location.hash = 'appName=' + app + '&view=' + vista + '&vss=';
      for (let i = 0; i < 180 && !partes.every(buscar); i++) { visible(); await espera(500); }
      if (!partes.every(buscar)) throw new Error('La vista ' + vista + ' no terminó de cargar sus tablas.');
      await espera(2500);
    };
    const leer = async (parte, fraccion) => {
      const T = TABLAS[parte], t = buscar(parte), enc = t.enc, ic = enc.indexOf(T.clave);
      const sc = t.tv.querySelector('.TableView__list') || t.tv, filas = new Map();
      sc.scrollTop = 0; await espera(1000);
      let quietas = 0, ultimo = null, vueltas = 0;
      while (quietas < 4 && vueltas++ < 5000) {
        visible();
        let grupo = null;
        for (const el of sc.querySelectorAll('.GroupedHeaderRow, .TableViewRow')) {
          if (el.classList.contains('GroupedHeaderRow')) { grupo = el.innerText.trim(); continue; }
          const c = [...el.children].map((x) => x.innerText.trim()), k = c[ic];
          if (!k || !T.re.test(k)) continue;
          if (T.grupo && grupo === null) grupo = filas.has(k) ? filas.get(k).g : ultimo;
          const f = T.grupo ? { g: grupo || '', c } : { c }, prev = filas.get(k);
          if (prev && JSON.stringify(prev) !== JSON.stringify(f)) throw new Error(k + ' cambió en medio de la lectura (la tabla todavía estaba cargando). Volvé a sincronizar.');
          filas.set(k, f); if (T.grupo) ultimo = grupo;
        }
        const antes = sc.scrollTop; sc.scrollTop += Math.max(40, sc.clientHeight * fraccion); await espera(450);
        quietas = sc.scrollTop === antes ? quietas + 1 : 0;
      }
      return { encabezado: enc, filas: [...filas.values()] };
    };
    const enviar = async (parte, lectura, l) => {
      E.paso = `enviando ${parte} (lectura ${lectura})`;
      const n = Math.max(1, Math.ceil(l.filas.length / 150));
      for (let i = 0; i < n; i++) {
        const r = await fetch(ORIGEN + '/api/sync/lote', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sync-key': CLAVE },
          body: JSON.stringify({ sid: SID, parte, lectura, seq: i, ultimo: i === n - 1, encabezado: l.encabezado, filas: l.filas.slice(i * 150, (i + 1) * 150), meta: { as_email } }) });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
      }
      E.leidas[parte + lectura] = l.filas.length;
    };
    for (const [lectura, fraccion] of [[1, 0.5], [2, 0.3]]) {
      await ir('Link_Building', ['lbProy', 'lb']);
      E.paso = `leyendo proyectos (lectura ${lectura})`; await enviar('lbProy', lectura, await leer('lbProy', fraccion));
      E.paso = `leyendo links (lectura ${lectura})`; await enviar('lb', lectura, await leer('lb', fraccion));
      await ir('Tasks', ['red']);
      E.paso = `leyendo redacciones (lectura ${lectura})`; await enviar('red', lectura, await leer('red', fraccion));
    }
    E.estado = 'listo'; E.paso = 'listo';
  } catch (e) { E.estado = 'error'; E.error = e.message; }
})();
'iniciado'
}
```

Consultá `window.__peSync` cada 20 segundos hasta que `estado` sea `listo` o `error`. Mientras tanto **no cambies de pestaña ni la minimices**. Si termina en `error`, traé la pestaña al frente y repetí este paso **una vez** (con el mismo `SID`). Si vuelve a fallar, avisale al usuario con el texto del error y no sigas.

### 3. Leer los objetivos del reporte (pestaña nueva)

1. Abrí el **Reporte** (página "Seguimiento Link Building") y ponelo al frente. Si no carga o pide acceso, no pidas acceso: salteá este paso (la app conserva los objetivos anteriores con su fecha) y avisalo al final.
2. Ejecutá este código tal cual con `PARTE = 'objLin'` (reemplazando `SID`, `CLAVE` y `ORIGEN`):

```js
{
const SID = 'SID', CLAVE = 'CLAVE', ORIGEN = 'ORIGEN', PARTE = 'objLin';
// Proyectos Eleven · lectura del reporte de seguimiento. Solo lee la página: lee la tabla de proyectos dos veces y la manda a la app.
window.__peRep = { estado: 'leyendo', parte: PARTE };
(async () => {
  const E = window.__peRep, espera = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const buscar = () => {
      for (const hr of document.querySelectorAll('.headerRow')) {
        const enc = [...hr.querySelectorAll('.colName')].map((c) => c.innerText.trim());
        if (!enc.includes('Proyecto') || !enc.includes('Q. piezas Mensual Plan.') || enc.includes('Mes de Planificación')) continue;
        let root = hr; while (root && !root.querySelector('.row .cell')) root = root.parentElement;
        if (root) return { enc, root };
      }
      return null;
    };
    let t = null;
    for (let i = 0; i < 60 && !(t = buscar()); i++) await espera(1000);
    if (!t) throw new Error('No encontré la tabla de proyectos con la columna «Q. piezas Mensual Plan.» (¿cargó la página?).');
    const pag = (t.root.innerText.match(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/) || []).map(Number);
    if (pag.length && (pag[1] !== 1 || pag[2] !== pag[3])) throw new Error('La tabla tiene varias páginas; no se puede leer completa.');
    const ic = t.enc.indexOf('Proyecto');
    const sc = [t.root, ...t.root.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 10 && e.querySelector('.row')).sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0] || t.root;
    const leer = async (paso) => {
      const filas = new Map(); sc.scrollTop = 0; await espera(800);
      let quietas = 0, vueltas = 0;
      while (quietas < 4 && vueltas++ < 2000) {
        for (const row of t.root.querySelectorAll('.row')) {
          const c = [...row.querySelectorAll('.cell')].map((x) => x.innerText.trim()), k = c[ic];
          if (!k || c.length !== t.enc.length) continue;
          const prev = filas.get(k); if (prev && JSON.stringify(prev.c) !== JSON.stringify(c)) throw new Error(k + ' cambió en medio de la lectura.');
          filas.set(k, { c });
        }
        const antes = sc.scrollTop; sc.scrollTop += paso; await espera(350);
        quietas = sc.scrollTop === antes ? quietas + 1 : 0;
      }
      if (pag.length && filas.size !== pag[3]) throw new Error(`Se leyeron ${filas.size} filas y la tabla dice ${pag[3]}.`);
      return [...filas.values()];
    };
    for (const [lectura, paso] of [[1, 200], [2, 120]]) {
      const filas = await leer(paso);
      const r = await fetch(ORIGEN + '/api/sync/lote', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sync-key': CLAVE }, body: JSON.stringify({ sid: SID, parte: PARTE, lectura, seq: 0, ultimo: true, encabezado: t.enc, filas }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
      E['lectura' + lectura] = filas.length;
    }
    E.estado = 'listo';
  } catch (e) { E.estado = 'error'; E.error = e.message; }
})();
'iniciado'
}
```

3. Consultá `window.__peRep` hasta que diga `listo` o `error`.
4. Andá a la página **"Seguimiento Content"** (tocá su nombre en el menú del reporte), esperá que cargue y repetí el código con `PARTE = 'objRed'`.
5. Si alguno termina en `error`, repetilo una vez. Si vuelve a fallar, seguí sin esa parte y avisalo al final.

### 4. Revisar (pestaña APP)

```js
window.__inf = await PE.syncRevisar(window.__s.sid); window.__inf
```
- `ok: false` → **no se escribió nada**. Contale al usuario los `errores` tal cual, y que vuelva a tocar **Sincronizar**. Terminá acá.
- `requiereConfirmacion: true` → mostrale los `motivosConfirmacion` en una lista corta y preguntá si los aplica. Sin un "sí" explícito, no apliques.

### 5. Aplicar (pestaña APP)

```js
await PE.syncAplicar(window.__s.sid, false)   // o true si el usuario confirmó en el paso 4
```
Se aplica todo junto o nada. Después la app compara lo guardado con lo leído: tiene que volver `verificacion.ok: true`. Si viene `false`, decile al usuario que la verificación encontró diferencias (copiá las primeras) y que no confíe en esos datos hasta volver a sincronizar.

### 6. Cerrar

1. En APP: `await PE.tiempo('Sincronizar AppSheet', window.__inicio, Date.now())`.
2. Respondé con un resumen breve: links y redacciones (total, nuevas, cambiadas, borradas), proyectos, objetivos actualizados (o por qué no), advertencias y el resultado de la verificación. Decile que ya puede volver a la ventana de Proyectos Eleven: se actualiza sola.
