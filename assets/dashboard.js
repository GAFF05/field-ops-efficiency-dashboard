// Dashboard estático — sin backend, sin build step (mismo criterio que la
// app real de la que nace este caso de estudio, ver CLAUDE.md). Lee
// data/dataset.json una vez al cargar y arma todo client-side.
//
// Paleta y mark specs: copiados tal cual de static/js/supervisor.js en el
// repo privado de la app real — misma paleta categórica ya validada contra
// daltonismo (skill de dataviz) sobre el mismo fondo oscuro (--surf).
const CHART_CATEGORICAL = ['#3987e5','#008300','#d55181','#c98500','#199e70','#d95926'];
const CHART_DASHES      = [[], [6,3], [2,2], [8,3,2,3], [1,3], [10,4]];
const CHART_ACCENT = '#e8a020';
const CHART_GRID   = '#272b35';
const CHART_MUTED  = '#6b7280';
const CHART_TEXT   = '#e4e6ed';
const FOTOS_SEMANA_MAX = 6; // tope de la paleta categórica, igual que en la app real

if (window.Chart) {
  Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";
  Chart.defaults.font.size   = 11;
  Chart.defaults.color       = CHART_MUTED;
}

let charts = {};
function renderChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), config);
}

// Una sola escala por gráfico — nunca eje dual (ver skill de dataviz).
function chartOpts({ indexAxis = 'x', horizontal = false, xMax, legend = false, tooltipLabel } = {}) {
  return {
    indexAxis, responsive: true, maintainAspectRatio: false,
    scales: {
      x: { grid: { color: CHART_GRID }, ticks: { color: CHART_MUTED }, beginAtZero: true, max: horizontal ? xMax : undefined },
      y: { grid: { color: CHART_GRID }, ticks: { color: CHART_MUTED }, beginAtZero: !horizontal, max: horizontal ? undefined : xMax },
    },
    plugins: {
      legend: { display: legend, labels: { color: CHART_TEXT, boxWidth: 16 } },
      tooltip: tooltipLabel ? { callbacks: { label: tooltipLabel } } : {},
    },
  };
}

function nombreTecnico(dataset, id) {
  return dataset.tecnicos.find(t => t.id === id)?.nombre ?? id;
}

function renderStats(dataset) {
  const registros = dataset.registros;
  const abiertos   = registros.filter(r => r.estado === 'activo' || r.estado === 'en_revision');
  const atrasados  = abiertos.filter(r => r.atrasado).length;
  const pctAtrasados = abiertos.length ? Math.round(atrasados / abiertos.length * 100) : 0;

  const completados = registros.filter(r => r.estado === 'completado').map(r => r.id);
  const dias = [];
  for (const rid of completados) {
    const filas = dataset.historial_estados.filter(h => h.registro_id === rid);
    const inicio = filas.find(h => h.estado === 'activo')?.fecha;
    const fin     = filas.find(h => h.estado === 'completado')?.fecha;
    if (inicio && fin) dias.push((new Date(fin) - new Date(inicio)) / 86400000);
  }
  const cicloProm = dias.length ? (dias.reduce((a, b) => a + b, 0) / dias.length).toFixed(1) : '—';

  const stats = [
    { num: dataset.tecnicos.length, label: 'Técnicos' },
    { num: registros.length, label: 'Registros en el período' },
    { num: `${pctAtrasados}%`, label: 'Atrasados (en curso)' },
    { num: cicloProm === '—' ? '—' : `${cicloProm}d`, label: 'Tiempo de ciclo promedio' },
  ];
  document.getElementById('stats-grid').innerHTML = stats.map(s => `
    <div class="stat-card"><div class="stat-num">${s.num}</div><div class="stat-label">${s.label}</div></div>
  `).join('');
}

let fotosSemanaSel = null;
let colorSlot = new Map();
function colorSlotFor(id) {
  if (!colorSlot.has(id)) colorSlot.set(id, colorSlot.size % CHART_CATEGORICAL.length);
  return colorSlot.get(id);
}

function chartFotosSemana(dataset) {
  const rows = dataset.fotos_por_tecnico_semana;
  const semanas = [...new Set(rows.map(r => r.semana))].sort();
  const tecnicoIds = [...new Set(rows.map(r => r.tecnico_id))];
  const totales = Object.fromEntries(tecnicoIds.map(id =>
    [id, rows.filter(r => r.tecnico_id === id).reduce((s, r) => s + r.cantidad, 0)]));
  tecnicoIds.sort((a, b) => totales[b] - totales[a]);

  if (fotosSemanaSel === null) fotosSemanaSel = new Set(tecnicoIds.slice(0, FOTOS_SEMANA_MAX));
  const seleccionados = tecnicoIds.filter(id => fotosSemanaSel.has(id));
  seleccionados.forEach(colorSlotFor);

  document.getElementById('fotos-semana-filtro').innerHTML = tecnicoIds.map(id => {
    const activo = fotosSemanaSel.has(id);
    const dot = activo ? `<i style="display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;background:${CHART_CATEGORICAL[colorSlotFor(id)]}"></i>` : '';
    return `<button type="button" class="chip ${activo ? 'active' : ''}" data-tecnico="${id}">${dot}${nombreTecnico(dataset, id)}</button>`;
  }).join('');
  document.querySelectorAll('#fotos-semana-filtro .chip').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.tecnico;
      if (fotosSemanaSel.has(id)) fotosSemanaSel.delete(id); else fotosSemanaSel.add(id);
      chartFotosSemana(dataset);
    };
  });

  const serieDe = id => semanas.map(s => rows.find(r => r.tecnico_id === id && r.semana === s)?.cantidad || 0);
  const datasets = seleccionados.map(id => ({
    label: nombreTecnico(dataset, id), data: serieDe(id),
    borderColor: CHART_CATEGORICAL[colorSlotFor(id)],
    backgroundColor: CHART_CATEGORICAL[colorSlotFor(id)],
    borderDash: CHART_DASHES[colorSlotFor(id)],
    borderWidth: 2, pointRadius: 3, tension: .25,
  }));
  renderChart('chart-fotos-semana', {
    type: 'line',
    data: {
      labels: semanas.map(s => new Date(s + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })),
      datasets,
    },
    options: chartOpts({ legend: datasets.length > 1 }),
  });
}

function chartCumplimientoCategoria(dataset) {
  const porCat = {};
  for (const r of dataset.registros) {
    porCat[r.categoria] ??= [];
    porCat[r.categoria].push(r.cumplimiento_pct);
  }
  const filas = Object.entries(porCat)
    .map(([categoria, pcts]) => ({ categoria, pct: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) }))
    .sort((a, b) => a.pct - b.pct); // peor primero, mismo criterio que la app real

  renderChart('chart-cumplimiento-cat', {
    type: 'bar',
    data: { labels: filas.map(f => f.categoria),
            datasets: [{ data: filas.map(f => f.pct), backgroundColor: CHART_ACCENT, borderRadius: 4, maxBarThickness: 22 }] },
    options: chartOpts({ indexAxis: 'y', horizontal: true, xMax: 100,
      tooltipLabel: ctx => `${filas[ctx.dataIndex].pct}% de cumplimiento` }),
  });
}

function renderTabla(dataset) {
  const filas = [...dataset.registros]
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
    .slice(0, 12);
  document.querySelector('#tabla-registros tbody').innerHTML = filas.map(r => `
    <tr>
      <td>${r.nombre_proyecto}</td>
      <td>${r.categoria}</td>
      <td>${r.estado}${r.atrasado ? ' ⚠️' : ''}</td>
      <td>${r.cumplimiento_pct}%</td>
    </tr>
  `).join('');
}

fetch('data/dataset.json')
  .then(res => res.json())
  .then(dataset => {
    document.getElementById('aviso-fecha').innerHTML =
      `<b>Dataset sintético generado el ${dataset.generado_en}</b> — ventana simulada: ` +
      `${dataset.periodo.desde} a ${dataset.periodo.hasta}. Ninguna fila de esta página es real.`;
    renderStats(dataset);
    chartFotosSemana(dataset);
    chartCumplimientoCategoria(dataset);
    renderTabla(dataset);
  })
  .catch(err => {
    document.getElementById('aviso-fecha').textContent =
      'No se pudo cargar data/dataset.json — ' + err.message;
  });
