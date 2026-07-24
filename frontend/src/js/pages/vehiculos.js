import { api } from '../api.js';
import { auth } from '../auth.js';
import { showToast, openModal, closeModal, confirmDelete } from '../utils.js';

export async function renderVehiculos(container) {
  try {
    await loadTable(container);
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body text-danger">Error: ${err.message}</div></div>`;
  }
}

async function loadTable(container) {
  const data = await api.get('/vehiculos');

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Listado de Vehículos</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-vehiculo">+ Nuevo Vehículo</button>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Color</th>
                <th>Estado</th>
                ${auth.isAdmin() ? '<th>Acciones</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${data.length === 0 ? `<tr><td colspan="${auth.isAdmin() ? 6 : 5}" class="table-empty">No hay vehículos registrados</td></tr>` : ''}
              ${data.map(v => `
                <tr>
                  <td><strong>${v.placa}</strong></td>
                  <td>${v.marca || '-'}</td>
                  <td>${v.modelo || '-'}</td>
                  <td>${v.color || '-'}</td>
                  <td><span class="badge ${v.activo ? 'badge-success' : 'badge-neutral'}">${v.activo ? 'Activo' : 'Inactivo'}</span></td>
                  ${auth.isAdmin() ? `
                  <td>
                    <div class="table-actions">
                      <button class="btn-icon" title="Editar" data-edit="${v.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="btn-icon text-danger" title="Eliminar" data-delete="${v.id}" data-name="${v.placa}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-add-vehiculo').addEventListener('click', () => openForm());
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = data.find(x => x.id === parseInt(btn.dataset.edit));
      if (v) openForm(v);
    });
  });
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirmDelete(btn.dataset.name)) {
        try {
          await api.delete(`/vehiculos/${btn.dataset.delete}`);
          showToast('Vehículo eliminado', 'success');
          await loadTable(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

function openForm(item = null) {
  const isEdit = !!item;

  openModal(
    isEdit ? 'Editar Vehículo' : 'Nuevo Vehículo',
    `<form id="vehiculo-form">
      <div class="form-group">
        <label for="veh-placa">Placa</label>
        <input type="text" id="veh-placa" required value="${item?.placa || ''}" placeholder="Ej: ABC-1234" style="text-transform: uppercase;">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="veh-marca">Marca</label>
          <input type="text" id="veh-marca" value="${item?.marca || ''}" placeholder="Ej: Toyota">
        </div>
        <div class="form-group">
          <label for="veh-modelo">Modelo</label>
          <input type="text" id="veh-modelo" value="${item?.modelo || ''}" placeholder="Ej: Hilux">
        </div>
      </div>
      <div class="form-group">
        <label for="veh-color">Color</label>
        <input type="text" id="veh-color" value="${item?.color || ''}" placeholder="Ej: Blanco">
      </div>
      ${isEdit ? `
      <div class="form-group">
        <label for="veh-activo">Estado</label>
        <select id="veh-activo">
          <option value="true" ${item.activo ? 'selected' : ''}>Activo</option>
          <option value="false" ${!item.activo ? 'selected' : ''}>Inactivo</option>
        </select>
      </div>` : ''}
    </form>`,
    `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').style.display='none'">Cancelar</button>
     <button class="btn btn-primary" id="btn-save-vehiculo">${isEdit ? 'Guardar' : 'Crear'}</button>`
  );

  document.getElementById('btn-save-vehiculo').addEventListener('click', async () => {
    const payload = {
      placa: document.getElementById('veh-placa').value.trim().toUpperCase(),
      marca: document.getElementById('veh-marca').value.trim(),
      modelo: document.getElementById('veh-modelo').value.trim(),
      color: document.getElementById('veh-color').value.trim()
    };

    if (!payload.placa) {
      showToast('La placa es requerida', 'warning');
      return;
    }

    if (isEdit) {
      payload.activo = document.getElementById('veh-activo').value === 'true';
    }

    try {
      if (isEdit) {
        await api.put(`/vehiculos/${item.id}`, payload);
        showToast('Vehículo actualizado', 'success');
      } else {
        await api.post('/vehiculos', payload);
        showToast('Vehículo registrado', 'success');
      }
      closeModal();
      await loadTable(document.getElementById('page-content'));
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
