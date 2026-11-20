# Proyectos Eleven

App personal de escritorio (PWA instalable en Chrome o Edge) para seguir los proyectos de Eleven habilitados en AppSheet: tareas de link building, redacciones, horas contra el plan del mes, deadlines en Google Calendar y avisos. Cloudflare Worker + D1.

- `src/worker.ts` — API (una sola cuenta con contraseña), calendario `.ics`, avisos push y registro de cambios para reflejar en AppSheet.
- `src/schema.ts` — tablas (el servidor las crea solo, con los proyectos y el plan iniciales).
- `public/shared.js` — estados de AppSheet, tipos de tarea, proyectos iniciales y validaciones (DR, tráfico, precio, medio repetido).
- `public/` — la app (`app.js`, `style.css`, `sw.js`).

Pruebas: `npm test`. Servidor local: `npm run dev` (puerto 8787). Publicar: push a `main`.
