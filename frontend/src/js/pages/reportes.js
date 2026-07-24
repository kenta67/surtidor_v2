import { api } from '../api.js';
import { formatCurrency } from '../utils.js';

let chartInstances = [];

export async function renderReportes(container) {
  // Limpiar gráficos anteriores
  chartInstances.forEach(c => c.destroy());
  chartInstances = [];

  try {
    const [ventasDiarias, inventario, ingresos] = await Promise.all([
      api.get('/reportes/ventas-diarias?dias=7'),
      api.get('/reportes/inventario'),
      api.get('/reportes/ingresos-combustible?dias=30')
    ]);

    container.innerHTML = `
      <div class="dashboard-grid">
        <!-- Ventas Diarias -->
        <div class="card">
          <div class="card-header">
            <h3>Ventas de los últimos 7 días</h3>
          </div>
          <div class="card-body">
            ${ventasDiarias.length > 0
              ? '<div class="chart-container"><canvas id="chart-ventas"></canvas></div>'
              : '<p class="text-muted text-center" style="padding: 2rem;">Sin datos de ventas en los últimos 7 días</p>'
            }
          </div>
        </div>

        <!-- Ingresos por Combustible -->
        <div class="card">
          <div class="card-header">
            <h3>Ingresos por Combustible (30 días)</h3>
          </div>
          <div class="card-body">
            ${ingresos.length > 0
              ? '<div class="chart-container"><canvas id="chart-ingresos"></canvas></div>'
              : '<p class="text-muted text-center" style="padding: 2rem;">Sin datos de ingresos</p>'
            }
          </div>
        </div>
      </div>

      <!-- Inventario -->
      <div class="card mt-2">
        <div class="card-header">
          <h3>Inventario Actual</h3>
        </div>
        <div class="card-body">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Surtidor</th>
                  <th>Combustible</th>
                  <th>Código</th>
                  <th>Nivel Actual (L)</th>
                  <th>Capacidad (L)</th>
                  <th>Porcentaje</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${inventario.length === 0
                  ? '<tr><td colspan="7" class="table-empty">Sin surtidores registrados</td></tr>'
                  : inventario.map(s => `
                    <tr>
                      <td><strong>#${s.surtidor}</strong></td>
                      <td>${s.combustible}</td>
                      <td><span class="binary-code">${s.codigo_binario}</span></td>
                      <td>${formatCurrency(s.nivel_actual)}</td>
                      <td>${formatCurrency(s.capacidad_total)}</td>
                      <td>${s.porcentaje}%</td>
                      <td>
                        <span class="badge ${s.estado === 'critico' ? 'badge-danger' : s.estado === 'bajo' ? 'badge-warning' : 'badge-success'}">
                          ${s.estado === 'critico' ? 'Crítico' : s.estado === 'bajo' ? 'Bajo' : 'Normal'}
                        </span>
                      </td>
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tabla de ingresos -->
      ${ingresos.length > 0 ? `
      <div class="card mt-2">
        <div class="card-header">
          <h3>Detalle de Ingresos por Combustible</h3>
        </div>
        <div class="card-body">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Combustible</th>
                  <th>Código</th>
                  <th>Ventas</th>
                  <th>Litros</th>
                  <th>Total (Bs.)</th>
                </tr>
              </thead>
              <tbody>
                ${ingresos.map(i => `
                  <tr>
                    <td><strong>${i.combustible}</strong></td>
                    <td><span class="binary-code">${i.codigo_binario}</span></td>
                    <td>${i.cantidad_ventas}</td>
                    <td>${formatCurrency(i.total_litros)}</td>
                    <td><strong>Bs. ${formatCurrency(i.total_bs)}</strong></td>
                  </tr>
                `).join('')}
                <tr style="background: var(--bg-primary);">
                  <td colspan="2"><strong>TOTAL</strong></td>
                  <td><strong>${ingresos.reduce((s, i) => s + i.cantidad_ventas, 0)}</strong></td>
                  <td><strong>${formatCurrency(ingresos.reduce((s, i) => s + i.total_litros, 0))}</strong></td>
                  <td><strong>Bs. ${formatCurrency(ingresos.reduce((s, i) => s + i.total_bs, 0))}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>` : ''}
    `;

    // Renderizar gráficos
    if (ventasDiarias.length > 0) {
      await renderVentasChart(ventasDiarias);
    }
    if (ingresos.length > 0) {
      await renderIngresosChart(ingresos);
    }
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body text-danger">Error al cargar reportes: ${err.message}</div></div>`;
  }
}

async function renderVentasChart(data) {
  const { Chart, registerables } = await import('chart.js');
  Chart.register(...registerables);

  const ctx = document.getElementById('chart-ventas');
  if (!ctx) return;

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => {
        const date = new Date(d.fecha + 'T12:00:00');
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      }),
      datasets: [{
        label: 'Ingresos (Bs.)',
        data: data.map(d => d.total),
        backgroundColor: 'rgba(37, 99, 235, 0.7)',
        borderColor: 'rgba(37, 99, 235, 1)',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: v => `Bs. ${v}`
          }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });

  chartInstances.push(chart);
}

async function renderIngresosChart(data) {
  const { Chart, registerables } = await import('chart.js');
  Chart.register(...registerables);

  const ctx = document.getElementById('chart-ingresos');
  if (!ctx) return;

  const colors = [
    'rgba(37, 99, 235, 0.8)',
    'rgba(5, 150, 105, 0.8)',
    'rgba(217, 119, 6, 0.8)',
    'rgba(220, 38, 38, 0.8)'
  ];

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.combustible),
      datasets: [{
        data: data.map(d => d.total_bs),
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10,
            font: { size: 12 }
          }
        }
      }
    }
  });

  chartInstances.push(chart);
}
