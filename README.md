# Proyectos Eleven

App de escritorio (PWA instalable en Chrome o Edge) para líderes: tablero de solo lectura con los proyectos de Eleven en AppSheet (links, redacciones, semáforo, objetivos del reporte de seguimiento y presupuesto). Cloudflare Worker + D1.

**Esta versión es solo modo líder.** El modo técnico (edición, IA, horas, pruebas) está deshabilitado.

## Sincronización con AppSheet (a pedido)

La app no se actualiza sola. **Sincronizar** abre AppSheet en el navegador y ahí se toca el favorito **⟳ Sincronizar Eleven** (`public/favorito.js`, armado por la app con la clave de la cuenta). En el reporte de seguimiento, el mismo favorito trae los objetivos del mes. Lee todo dos veces en menos de un minuto y no necesita Claude (la skill `public/claude/SKILL.md` queda como alternativa).

1. `POST /api/sync/iniciar-clave` (favorito, clave de la cuenta) o `POST /api/sync/iniciar` (sesión) → `sid` y una clave de un solo uso (vence en 1 hora).
2. Se lee **dos veces** cada tabla (con pasos de desplazamiento distintos) y cada lectura va a `POST /api/sync/lote` (solo desde appsheet.com y el reporte, con esa clave). `POST /api/sync/cerrar` revisa y, si no hay nada para confirmar, aplica; si lo hay, la app lo muestra para confirmar o descartar.
3. `POST /api/sync/revisar`: ubica las columnas por nombre, valida cada fila (códigos, fechas, importes), exige que las dos lecturas sean idénticas y compara con lo que hay. No escribe nada.
4. `POST /api/sync/aplicar`: si no hay errores (y, cuando hace falta, con confirmación), reemplaza todo de una vez por la foto completa —incluye borrar lo que ya no está en AppSheet— y después compara lo guardado con lo leído.

Validación y comparación: `src/sync.ts`. Servidor: `src/worker.ts`. Esquema: `src/schema.ts`. App: `public/`.

Pruebas: `npm test`. Servidor local: `npm run dev` (puerto 8787). Publicar: push a `main`.
