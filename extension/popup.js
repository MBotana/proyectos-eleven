const m = document.getElementById('m');
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
async function pintar() {
  const { config, ultimo, leyendo } = await chrome.storage.local.get(['config', 'ultimo', 'leyendo']);
  if (!config?.clave) { m.innerHTML = '<p>Todavía no está conectada.</p><p class="mute">Abrí <a href="https://proyectos-eleven.martinbotana.workers.dev/" target="_blank">Proyectos Eleven</a>: se conecta sola.</p>'; return; }
  const al = await chrome.alarms.get('actualizar');
  m.innerHTML = `<div class="mute">Lee ${[config.reporte && 'el Reporte', config.as_url && 'AppSheet'].filter(Boolean).join(' y ')} cada ${config.cadaHoras} h. Solo lectura.</div>
    ${leyendo && Date.now() - leyendo.at < 12 * 60000 ? `<p><b>Leyendo ${h(leyendo.que)}…</b> <span class="mute">(aparece un cartel azul en la pestaña)</span></p>` : ''}
    ${ultimo ? `<p><b>Última vez:</b> ${new Date(ultimo.at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</p><ul>${ultimo.partes.map((p) => `<li class="${p.ok ? 'ok' : 'bad'}">${h(p.que)}: ${h(p.texto.replace(/^listo: /, ''))}</li>`).join('')}</ul>` : '<p class="mute">Todavía no se actualizó.</p>'}
    ${al ? `<div class="mute">Próxima: ${new Date(al.scheduledTime).toLocaleTimeString('es-AR', { timeStyle: 'short' })}</div>` : ''}
    <button id="b">Actualizar ahora</button>`;
  document.getElementById('b').onclick = async (e) => { e.target.disabled = true; e.target.textContent = 'Actualizando… (se abre y cierra una pestaña)'; await chrome.runtime.sendMessage({ pe: 'actualizar' }); pintar(); };
}
pintar();
