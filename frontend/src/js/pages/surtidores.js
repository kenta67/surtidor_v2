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
    <div class="card">
      <div class="card-header">
        <h3>Listado de Surtidores</h3>
        ${auth.isAdmin() ? '<button class="btn btn-primary btn-sm" id="btn-add-surtidor">+ Nuevo Surtidor</button>' : ''}
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Combustible</th>
                <th>Código</th>
                <th>Nivel</th>
                <th>Capacidad</th>
                <th>Estado</th>
                <th>Nivel Binario</th>
                ${auth.isAdmin() ? '<th>Acciones</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${data.length === 0 ? `<tr><td colspan="${auth.isAdmin() ? 8 : 7}" class="table-empty">No hay surtidores registrados</td></tr>` : ''}
              ${data.map(s => {
                const pct = s.porcentaje_nivel || 0;
                return `
                <tr>
                  <td><strong>${s.numero}</strong></td>
                  <td>${s.tipos_combustible?.nombre || '-'}</td>
                  <td><span class="binary-code">${s.tipos_combustible?.codigo_binario || '--'}</span></td>
                  <td style="min-width: 150px;">
                    <div class="level-bar">
                      <div class="level-bar-fill ${getLevelClass(pct)}" style="width: ${Math.min(pct, 100)}%"></div>
                    </div>
                    <div class="level-info">
                      <span>${formatCurrency(s.nivel_actual)} L</span>
                      <span>${pct}%</span>
                    </div>
                  </td>
                  <td>${formatCurrency(s.capacidad_total)} L</td>
                  <td><span class="badge ${s.activo ? 'badge-success' : 'badge-neutral'}">${s.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td><span class="binary-code">${s.nivel_binario}</span></td>
                  ${auth.isAdmin() ? `
                  <td>
                    <div class="table-actions">
                      <button class="btn-icon" title="Editar" data-edit="${s.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="btn-icon text-danger" title="Eliminar" data-delete="${s.id}" data-name="Surtidor #${s.numero}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>` : ''}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
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
