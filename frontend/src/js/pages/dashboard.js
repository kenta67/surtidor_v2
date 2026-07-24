import { api } from '../api.js';
import { formatCurrency, getLevelClass, getLevelBinary } from '../utils.js';

export async function renderDashboard(container) {
  try {
    const [resumen, inventario, alertas] = await Promise.all([
      api.get('/reportes/resumen'),
      api.get('/reportes/inventario'),
      api.get('/alertas?atendida=false')
    ]);

    container.innerHTML = `
      <!-- KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div class="kpi-info">
            <div class="kpi-value">Bs. ${formatCurrency(resumen.ventas_hoy.total_bs)}</div>
            <div class="kpi-label">Ingresos del día</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="6" x2="12" y2="14"/><circle cx="12" cy="17" r="1"/></svg>
          </div>
          <div class="kpi-info">
            <div class="kpi-value">${resumen.surtidores_activos}</div>
            <div class="kpi-label">Surtidores activos</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon yellow">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <div class="kpi-info">
            <div class="kpi-value">${resumen.alertas_pendientes}</div>
            <div class="kpi-label">Alertas pendientes</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div class="kpi-info">
            <div class="kpi-value">${resumen.ventas_hoy.cantidad}</div>
            <div class="kpi-label">Ventas realizadas hoy</div>
          </div>
        </div>
      </div>

      <div class="dashboard-grid">
        <!-- Estado de surtidores -->
        <div class="card">
          <div class="card-header">
            <h3>Estado de Surtidores</h3>
          </div>
          <div class="card-body">
            <div class="surtidor-grid" id="surtidor-status-grid">
              ${inventario.length === 0
                ? '<p class="text-muted text-center">No hay surtidores registrados</p>'
                : inventario.map(s => `
                  <div class="surtidor-status-card">
                    <div class="number">
                      <span>Surtidor #${s.surtidor}</span>
                      <span class="binary-code">${getLevelBinary(s.porcentaje)}</span>
                    </div>
                    <div class="text-muted mb-1" style="font-size: 0.75rem;">${s.combustible}</div>
                    <div class="level-bar">
                      <div class="level-bar-fill ${getLevelClass(s.porcentaje)}" style="width: ${Math.min(s.porcentaje, 100)}%"></div>
                    </div>
                    <div class="level-info">
                      <span>${formatCurrency(s.nivel_actual)} / ${formatCurrency(s.capacidad_total)} L</span>
                      <span>${s.porcentaje}%</span>
                    </div>
                  </div>
                `).join('')
              }
            </div>
          </div>
        </div>

        <!-- Alertas activas -->
        <div class="card">
          <div class="card-header">
            <h3>Alertas Activas</h3>
            ${alertas.length > 0 ? `<span class="badge badge-danger">${alertas.length}</span>` : ''}
          </div>
          <div class="card-body">
            ${alertas.length === 0
              ? '<p class="text-muted text-center" style="padding: 2rem 0;">Sin alertas pendientes</p>'
              : `<div style="display: flex; flex-direction: column; gap: 0.5rem;">
                  ${alertas.slice(0, 8).map(a => `
                    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem; border: 1px solid var(--border); border-radius: var(--radius);">
                      <span class="badge ${a.tipo_alerta === 'critico' ? 'badge-danger' : 'badge-warning'}">
                        ${a.tipo_alerta === 'critico' ? 'CRÍTICO' : 'BAJO'}
                      </span>
                      <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.8125rem; font-weight: 500;">Surtidor #${a.surtidores?.numero || '?'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${a.surtidores?.tipos_combustible?.nombre || ''}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>`
            }
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body"><p class="text-danger">Error al cargar el dashboard: ${err.message}</p></div></div>`;
  }
}
