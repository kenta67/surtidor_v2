import { api } from '../api.js';
import { showToast, formatDateTime } from '../utils.js';

export async function renderAlertas(container) {
  try {
    await loadAlertas(container);
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body text-danger">Error: ${err.message}</div></div>`;
  }
}

async function loadAlertas(container) {
  const alertas = await api.get('/alertas');

  const pendientes = alertas.filter(a => !a.atendida);
  const atendidas = alertas.filter(a => a.atendida);

  container.innerHTML = `
    <div class="card mb-2">
      <div class="card-header">
        <h3>Alertas Pendientes</h3>
        ${pendientes.length > 0 ? `<span class="badge badge-danger">${pendientes.length}</span>` : ''}
      </div>
      <div class="card-body">
        ${pendientes.length === 0
          ? '<p class="text-muted text-center" style="padding: 2rem 0;">No hay alertas pendientes</p>'
          : `<div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Surtidor</th>
                    <th>Combustible</th>
                    <th>Nivel Actual</th>
                    <th>Fecha</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${pendientes.map(a => `
                    <tr>
                      <td>
                        <span class="badge ${a.tipo_alerta === 'critico' ? 'badge-danger' : 'badge-warning'}">
                          ${a.tipo_alerta === 'critico' ? '● CRÍTICO' : '● BAJO'}
                        </span>
                      </td>
                      <td><strong>#${a.surtidores?.numero || '?'}</strong></td>
                      <td>${a.surtidores?.tipos_combustible?.nombre || '-'}</td>
                      <td>${a.surtidores ? `${parseFloat(a.surtidores.nivel_actual).toFixed(2)} / ${parseFloat(a.surtidores.capacidad_total).toFixed(2)} L` : '-'}</td>
                      <td>${formatDateTime(a.fecha_hora)}</td>
                      <td>
                        <button class="btn btn-success btn-sm" data-atender="${a.id}">Atender</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    </div>

    ${atendidas.length > 0 ? `
    <div class="card mt-2">
      <div class="card-header">
        <h3>Historial de Alertas Atendidas</h3>
        <span class="badge badge-neutral">${atendidas.length}</span>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Surtidor</th>
                <th>Fecha</th>
                <th>Atendida por</th>
              </tr>
            </thead>
            <tbody>
              ${atendidas.slice(0, 20).map(a => `
                <tr>
                  <td><span class="badge badge-neutral">${a.tipo_alerta.toUpperCase()}</span></td>
                  <td>#${a.surtidores?.numero || '?'}</td>
                  <td>${formatDateTime(a.fecha_hora)}</td>
                  <td>${a.usuarios?.nombre_completo || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>` : ''}
  `;

  // Event listeners
  container.querySelectorAll('[data-atender]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api.put(`/alertas/${btn.dataset.atender}/atender`);
        showToast('Alerta marcada como atendida', 'success');
        await loadAlertas(container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}
