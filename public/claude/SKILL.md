---
name: proyectos-eleven
description: Conecta y sincroniza la app Proyectos Eleven con AppSheet (Eleven - Operaciones). Hace la configuración de la primera vez, trae las tareas de AppSheet a la app, pasa a AppSheet los cambios pendientes y lee los objetivos del reporte de seguimiento. Usar cuando el usuario pida conectar, sincronizar, actualizar, traer de AppSheet o pasar cambios a AppSheet desde Proyectos Eleven.
---

# Proyectos Eleven ↔ AppSheet

- **APP**: https://proyectos-eleven.martinbotana.workers.dev (la app del usuario).
- **AppSheet**: la app "Eleven - Operaciones" (www.appsheet.com). El mensaje del usuario suele traer el link.
- **Reporte**: https://datastudio.google.com/u/0/reporting/21888fb7-9f40-4059-98ea-e9a1c198eb08/page/73rOF (solo lectura).

Todo se hace en el navegador, con **las sesiones del usuario**: el navegador integrado de Claude de escritorio o Claude in Chrome. Trabajás como si fuera el usuario haciéndolo a mano.

## Reglas (no se negocian)

- Nunca pidas, escribas ni guardes contraseñas o códigos. Si una página pide iniciar sesión, pedile al usuario que lo haga él en esa ventana y esperá a que te avise.
- **AppSheet**: solo cambiás lo que está en la lista de pendientes de la app, después del OK del usuario. Nada más.
- **Planillas y documentos de Google**: no escribas en ninguna. La única excepción es el documento de redacción de una tarea, y solo cuando el usuario pidió esa redacción.
- **Reporte de seguimiento**: solo se mira. No edites, no cambies filtros guardados, no compartas.
- **Nunca dejes comentarios** en ningún lado (Docs, Sheets, AppSheet, reporte).
- Solo las tareas del usuario que te lo pidió. No cambies ajustes de AppSheet ni de la app.
- Nunca marques como hecho algo que no verificaste.

## 0. Preparar (siempre)

1. Abrí APP en una pestaña.
   - Si el mensaje trae un "enlace para abrir mi app", abrí **ese** enlace (deja la app con la sesión del usuario en este navegador).
   - Con la herramienta de JavaScript ejecutá `await PE.yo()`. Si `PE` no existe, recargá una vez. Si responde `null` y no tenés enlace, pedile que toque **Sincronizar** en la app para que te mande uno nuevo.
2. Guardá `const inicio = Date.now()` para registrar tu tiempo.
3. Abrí AppSheet en otra pestaña (el link del mensaje). Si pide iniciar sesión, pedile al usuario que entre con su cuenta de Eleven y esperá su aviso.

## Primera vez (cuando el mensaje lo pide)

1. Si todavía no tiene esta skill guardada, proponésela para guardar (mismo nombre y contenido que este archivo) y seguí.
2. Hacé **0. Preparar**. En AppSheet, apenas esté adentro, decile en un mensaje corto y pedí permiso **una sola vez**:
   > "Ya estás en AppSheet. ¿Te traigo ahora tus tareas a Proyectos Eleven y las actualizo automáticamente cada día hábil? Solo leo AppSheet; nunca cambio nada sin mostrarte antes la lista."
3. Si acepta:
   - Hacé **1. Traer de AppSheet**.
   - Hacé **3. Objetivos del mes**.
   - Si tenés una herramienta para crear tareas programadas, creá una que corra los días hábiles a la mañana, que necesite esta computadora, con el pedido: "Usá la skill proyectos-eleven: traé mis tareas de AppSheet (solo lectura) y actualizá los objetivos del mes." Si no la tenés, decile que use el botón **Sincronizar** de la app.
4. Si no acepta, no traigas nada: decile que puede hacerlo cuando quiera con **Sincronizar**.
5. Cerrá con un mensaje corto: qué se trajo y que ya puede volver a la ventana de Proyectos Eleven (se actualiza sola).

## 1. Traer de AppSheet (solo lectura)

1. En la pestaña de APP: `await PE.traer()` devuelve `{ clave, origen }`.
2. **Poné la pestaña de AppSheet al frente** (que sea la pestaña activa y visible: AppSheet no dibuja las tablas en una pestaña de fondo) y, con la app abierta, ejecutá (reemplazando CLAVE y ORIGEN):

   ```js
   const url = ORIGEN + '/traer.js?v=' + Date.now();
   const el = document.createElement('script');
   el.src = window.trustedTypes ? trustedTypes.createPolicy('pe' + Date.now(), { createScriptURL: (u) => u }).createScriptURL(url) : url;
   await new Promise((ok, ko) => { el.onload = ok; el.onerror = () => ko(new Error('no cargó traer.js')); document.head.appendChild(el); });
   window.__peEstado = 'iniciando';
   traerDeAppSheet(CLAVE, ORIGEN);
   'iniciado'
   ```

   No esperes el resultado: tarda entre 1 y 3 minutos. Consultá `window.__peEstado` cada 15 segundos hasta que empiece con "listo" o con "no se pudo". No toques la pestaña mientras tanto.
   - Mientras lee, la pestaña de AppSheet tiene que seguir **al frente**: no cambies de pestaña ni la minimices.
   - Si termina en "no se pudo… no cargó" o "…se leyó vacía", traé la pestaña de AppSheet al frente y repetí este paso **una vez**. Si vuelve a fallar, avisale al usuario con ese texto y no sigas.
   - El resumen final tiene que decir cuántos links **y** cuántas redacciones llegaron; si alguno es 0, no lo des por bueno.
   - Si el script no carga por políticas de la página, pedí en APP `await PE.codigoTraer()` y ejecutá ese texto tal cual en la pestaña de AppSheet.
3. En APP: `await PE.actualizar()`.

## 2. Pasar cambios a AppSheet (escritura)

1. En APP: `await PE.pendientes()` devuelve `{ id, tipo, codigo, tarea, cambio, fecha }`.
   - `tipo` es `lb` (link) o `red` (redacción). `codigo` es el código de AppSheet (ej. `GAL-LIN-1-34`); vacío si es una tarea nueva.
2. Mostrale la lista al usuario en una tabla corta y pedí **un OK para todo el lote**. Sin OK, no escribas nada.
3. Por cada cambio, en AppSheet:
   - Links: Gestión Link Building (`view=Link_Building`). Redacciones: Gestión Content (`view=Tasks`). Buscá el código con la búsqueda de la vista y abrí la tarea.
   - Tocá Editar (lápiz), cambiá **solo** lo que dice el cambio y Guardá. Verificá que el detalle muestre el valor nuevo.
   - Si AppSheet muestra un aviso que bloquea, no lo fuerces: cancelá, salteá ese cambio y copiá el texto del aviso para el resumen.
   - "Tarea nueva", "Redacción nueva" y "Borrada en la app": no crees ni borres nada; dejalas para el usuario.
   - "Redacción lista… pasarla al documento": probá `await PE.pegarEnDoc(tipo, tarea)` en APP. Si responde `ok`, contala como hecha; si no, dejala.
   - Si la pantalla no coincide con lo que se describe acá, sacá una captura, contale qué ves y preguntá.
4. En APP: `await PE.marcar([ids])` **solo** con los cambios que verificaste.

## 3. Objetivos del mes (solo lectura)

1. En APP: `await PE.proyectos()` devuelve los proyectos del usuario (`code`, `tipo`).
2. Abrí el **Reporte**. Si no carga o pide acceso, no pidas acceso: salteá este paso y avisá en el resumen.
3. En la página "Seguimiento Link Building", leé la tabla de proyectos: columnas Proyecto y "Q. piezas Mensual Plan.". Después andá a "Seguimiento Content" y leé la misma columna. Las tablas cargan filas al desplazarse; este script junta todas las filas de la tabla de la página actual:

   ```js
   const filas = new Set();
   const caja = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 100 && /-(LIN|RED)-/.test(e.innerText || '') && e.innerText.length < 20000).sort((a, b) => a.innerText.length - b.innerText.length)[0];
   for (let y = 0; caja && y < 20000; y += 300) { caja.scrollTop = y; await new Promise((r) => setTimeout(r, 250)); caja.querySelectorAll('.row, [role=row]').forEach((r) => filas.add(r.innerText.replace(/\n/g, ' | '))); if (y > caja.scrollHeight) break; }
   [...filas]
   ```

   Cada fila es `Cliente | Proyecto | Líder | Inicio | Cierre | Tratamiento | Periodo | Q. piezas Mensual Plan. | …`.
4. En APP: `await PE.objetivos([{ code, piezasMes }, …])` solo con los proyectos del usuario que aparezcan en el reporte.

## Cerrar

1. En APP registrá tu tiempo: `await PE.tiempo('Sincronizar AppSheet', inicio, Date.now(), [{ tipo, tarea }, …])` con las tareas que tocaste (o `[]` si solo trajiste).
2. Respondé con un resumen breve: cuántos links y redacciones se trajeron, objetivos actualizados, cambios pasados y los que salteaste con el motivo.
