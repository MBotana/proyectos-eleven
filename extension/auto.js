// Proyectos Eleven (extensión): cuando abrís AppSheet (Eleven - Operaciones) o el Reporte de Seguimiento y la página terminó
// de cargar con tu sesión, le avisa a la extensión para que lea los datos (solo lectura). Si ya se leyó hace poco, no hace nada.
(async () => {
  const REPORTE = '21888fb7-9f40-4059-98ea-e9a1c198eb08';
  const esAS = location.host.endsWith('appsheet.com');
  if (!esAS && !location.pathname.includes(REPORTE)) return;
  const lista = () => (esAS ? /appName=/.test(location.hash) && !!document.querySelector('.TableView, .TableViewRow') : !!document.querySelector('[role=treeitem]') && /[A-Z0-9]{2,5}-(LIN|RED)-/.test(document.body.innerText));
  for (let i = 0; i < 300 && !lista(); i++) await new Promise((r) => setTimeout(r, 1000));
  if (lista()) chrome.runtime.sendMessage({ pe: 'pagina-lista', tipo: esAS ? 'AppSheet' : 'Reporte' });
})();
