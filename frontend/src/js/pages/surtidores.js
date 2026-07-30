import { api } from '../api.js';
import { auth } from '../auth.js';
import { showToast, openModal, closeModal, confirmDelete, formatCurrency, getLevelClass, getLevelBinary } from '../utils.js';

let combustiblesList = [];

export async function renderSurtidores(container) {
  try {
    combustiblesList = await api.get('/combustibles');
    await loadTable(container);
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body text-danger">Error: ${err.message}</div></div>`;
  }
}

async function loadTable(container) {
  const data = await api.get('/surtidores');

  container.innerHTML = `
    <div class="card" style="background: transparent; border: none; box-shadow: none;">
      <div class="card-header" style="background: var(--bg-secondary); border-radius: var(--radius-lg); margin-bottom: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
        <h3>Estación de Combustible</h3>
        ${auth.isAdmin() ? '<button class="btn btn-primary btn-sm" id="btn-add-surtidor">+ Nuevo Surtidor</button>' : ''}
      </div>
      <div class="surtidores-page-grid">
        ${data.length === 0 ? `<div class="table-empty" style="grid-column: 1 / -1; background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border);">No hay surtidores registrados</div>` : ''}
        ${data.map(s => {
          const cap = parseFloat(s.capacidad_total) || 1;
          const nivel = parseFloat(s.nivel_actual) || 0;
          const pct = Math.min(100, Math.max(0, (nivel / cap) * 100));
          
          // Cambiar tono (Hue) de 0 (Rojo) a 120 (Verde)
          const hue = 120 * (pct / 100);
          const pumpColor = `hsl(${hue}, 75%, 64%)`;

          return `
          <div class="surtidor-pump-card" style="--pump-color: ${pumpColor};">
            <div class="pump-cap-top"></div>
            <div class="pump-main">
              <div class="pump-screen-area">
                <div class="pump-screen">
                  <div class="screen-content">
                    <div class="screen-row">
                      <span class="screen-val bold">${s.tipos_combustible?.nombre || '-'}</span>
                    </div>
                    <div class="screen-row">
                      <span class="screen-val">${formatCurrency(s.nivel_actual)} L</span>
                    </div>
                  </div>
                  <div class="pump-dial-container">
                    <div class="pump-dial">
                      <div class="pump-dial-needle" style="transform: rotate(${-90 + (pct * 1.8)}deg);"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="pump-buttons">
                <div class="pump-btn"></div>
                <div class="pump-btn"></div>
                <div class="pump-btn"></div>
              </div>
              
              <div class="pump-info-bottom">
                <div class="pump-number">#${s.numero}</div>
                <span class="badge ${s.activo ? 'badge-success' : 'badge-neutral'}">${s.activo ? 'Activo' : 'Inactivo'}</span>
              </div>
              
              ${auth.isAdmin() ? `
              <div class="pump-actions">
                <button class="btn btn-sm btn-icon" style="background: rgba(255,255,255,0.2); color: white;" title="Editar" data-edit="${s.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn btn-sm btn-icon" style="background: rgba(255,255,255,0.2); color: white;" title="Eliminar" data-delete="${s.id}" data-name="Surtidor #${s.numero}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>` : ''}
            </div>
            <div class="pump-cap-bottom"></div>
            
            <div class="pump-hose-assembly">
              <div class="pump-hose-pipe"></div>
              <div class="pump-nozzle-handle"></div>
              <div class="pump-nozzle-tip"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('btn-add-surtidor')?.addEventListener('click', () => openForm());
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = data.find(x => x.id === parseInt(btn.dataset.edit));
      if (s) openForm(s);
    });
  });
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirmDelete(btn.dataset.name)) {
        try {
          await api.delete(`/surtidores/${btn.dataset.delete}`);
          showToast('Surtidor eliminado', 'success');
          await loadTable(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

function openForm(surtidor = null) {
  const isEdit = !!surtidor;
  const combOptions = combustiblesList
    .filter(c => c.activo)
    .map(c => `<option value="${c.id}" ${surtidor?.tipo_combustible_id === c.id ? 'selected' : ''}>${c.nombre} (${c.codigo_binario})</option>`)
    .join('');

  openModal(
    isEdit ? 'Editar Surtidor' : 'Nuevo Surtidor',
    `<form id="surtidor-form">
      <div class="form-group">
        <label for="surt-numero">Número de surtidor</label>
        <input type="number" id="surt-numero" min="1" required value="${surtidor?.numero || ''}">
      </div>
      <div class="form-group">
        <label for="surt-combustible">Tipo de combustible</label>
        <select id="surt-combustible" required>
          <option value="">Seleccionar...</option>
          ${combOptions}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="surt-capacidad">Capacidad total (L)</label>
          <input type="number" id="surt-capacidad" step="0.01" min="1" required value="${surtidor?.capacidad_total || ''}">
        </div>
        <div class="form-group">
          <label for="surt-nivel">Nivel actual (L)</label>
          <input type="number" id="surt-nivel" step="0.01" min="0" required value="${surtidor?.nivel_actual || '0'}">
        </div>
      </div>
      ${isEdit ? `
      <div class="form-group">
        <label for="surt-activo">Estado</label>
        <select id="surt-activo">
          <option value="true" ${surtidor.activo ? 'selected' : ''}>Activo</option>
          <option value="false" ${!surtidor.activo ? 'selected' : ''}>Inactivo</option>
        </select>
      </div>` : ''}
    </form>`,
    `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').style.display='none'">Cancelar</button>
     <button class="btn btn-primary" id="btn-save-surtidor">${isEdit ? 'Guardar' : 'Crear'}</button>`
  );

  document.getElementById('btn-save-surtidor').addEventListener('click', async () => {
    const payload = {
      numero: parseInt(document.getElementById('surt-numero').value),
      tipo_combustible_id: parseInt(document.getElementById('surt-combustible').value),
      capacidad_total: parseFloat(document.getElementById('surt-capacidad').value),
      nivel_actual: parseFloat(document.getElementById('surt-nivel').value)
    };

    if (!payload.numero || !payload.tipo_combustible_id || !payload.capacidad_total) {
      showToast('Complete todos los campos requeridos', 'warning');
      return;
    }

    if (isEdit) {
      payload.activo = document.getElementById('surt-activo').value === 'true';
    }

    try {
      if (isEdit) {
        await api.put(`/surtidores/${surtidor.id}`, payload);
        showToast('Surtidor actualizado', 'success');
      } else {
        await api.post('/surtidores', payload);
        showToast('Surtidor creado', 'success');
      }
      closeModal();
      await loadTable(document.getElementById('page-content'));
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
