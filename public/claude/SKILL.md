---
name: proyectos-eleven
description: Sincroniza la app Proyectos Eleven con AppSheet (Eleven - Operaciones). Trae las tareas de AppSheet a la app y pasa a AppSheet los cambios pendientes. Usar cuando el usuario pida sincronizar, actualizar, traer de AppSheet o pasar cambios a AppSheet desde Proyectos Eleven.
---

# Proyectos Eleven ↔ AppSheet

- **APP**: https://proyectos-eleven.martinbotana.workers.dev (la app del usuario).
- **AppSheet**: la app "Eleven - Operaciones" en https://www.appsheet.com.

Todo se hace en el navegador del usuario (el navegador integrado de Claude o Claude in Chrome), con **sus** sesiones. Nunca pidas ni escribas contraseñas: si una sesión no está iniciada, pedile que inicie sesión y seguí cuando avise.

## 0. Preparar

1. Abrí APP en una pestaña. Con la herramienta de JavaScript, ejecutá `await PE.yo()`.
   - Si `PE` no existe, recargá la página una vez.
   - Si responde `null`, pedile al usuario que entre a la app.
2. Guardá `const inicio = Date.now()` (lo vas a necesitar para registrar tu tiempo).
3. Abrí AppSheet (Eleven - Operaciones) en otra pestaña. Si pide iniciar sesión, pedile que entre.

Según lo que pida el usuario, hacé el paso 1, el 2 o los dos (en ese orden).

## 1. Traer de AppSheet (solo lectura)

1. En la pestaña de APP: `await PE.traer()` devuelve `{ clave, origen }`.
2. En la pestaña de AppSheet, con la app abierta, ejecutá (reemplazando CLAVE y ORIGEN):

   ```js
   const s = await fetch(ORIGEN + '/traer.js').then((r) => r.text());
   window.__peEstado = 'iniciando';
   new Function(s + '\nreturn traerDeAppSheet;')()(CLAVE, ORIGEN);
   'iniciado'
   ```

   No esperes el resultado: tarda entre 1 y 3 minutos. Consultá `window.__peEstado` cada 15 segundos hasta que empiece con "listo" o con "no se pudo". No toques la pestaña mientras tanto.
   - Si el `fetch` o `new Function` fallan por políticas de la página, pedí en APP `await PE.codigoTraer()` y ejecutá ese texto tal cual en la pestaña de AppSheet.
3. En APP: `await PE.actualizar()`.

## 2. Pasar cambios a AppSheet (escritura)

1. En APP: `await PE.pendientes()` devuelve la lista de cambios: `{ id, tipo, codigo, tarea, cambio, fecha }`.
   - `tipo` es `lb` (link) o `red` (redacción).
   - `codigo` es el código de AppSheet (ej. `GAL-LIN-1-34`); puede venir vacío si es una tarea nueva.
2. Mostrale la lista al usuario en una tabla corta y pedí **un OK para todo el lote**. Sin OK, no escribas nada.
3. Por cada cambio, en AppSheet:
   - Links: vista Gestión Link Building (`view=Link_Building`). Redacciones: Gestión Content (`view=Tasks`). Buscá el código con la búsqueda de la vista y abrí la tarea.
   - Tocá Editar (lápiz), cambiá **solo** lo que dice el cambio (ej. "estado: A → B" → el estado pasa a B) y Guardá. Después verificá que el detalle muestre el valor nuevo.
   - Si AppSheet muestra un aviso que bloquea (validación, campo obligatorio, estado no permitido), no lo fuerces: cancelá, salteá ese cambio y copiá el texto del aviso para el resumen.
   - "Tarea nueva", "Redacción nueva" y "Borrada en la app": no crees ni borres nada; dejalas para el usuario.
   - "Redacción lista… pasarla al documento": probá `await PE.pegarEnDoc(tipo, tarea)` en APP. Si responde `ok`, contala como hecha; si no, dejala.
   - Si la pantalla no coincide con lo que se describe acá, sacá una captura, contale al usuario qué ves y preguntá antes de seguir.
4. En APP: `await PE.marcar([ids])` **solo** con los cambios que verificaste en AppSheet.

## 3. Cerrar

1. En APP registrá tu tiempo: `await PE.tiempo('Sincronizar AppSheet', inicio, Date.now(), [{ tipo, tarea }, …])` con las tareas que tocaste (o `[]` si solo trajiste).
2. Respondé con un resumen breve: cuántos links y redacciones se trajeron, cuántos cambios se pasaron, cuáles salteaste y por qué (con el texto del aviso).

## Reglas

- Solo las tareas del usuario que te lo pidió.
- No cambies nada que no esté en la lista de pendientes ni ajustes de AppSheet o de la app.
- Nunca marques como reflejado algo que no verificaste.
