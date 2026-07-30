import { api } from '../api.js';
import { auth } from '../auth.js';
import { showToast, openModal, closeModal, confirmDelete } from '../utils.js';

export async function renderClientes(container) {
  try {
    await loadTable(container);
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body text-danger">Error: ${err.message}</div></div>`;
  }
}

async function loadTable(container) {
  const data = await api.get('/clientes');

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Listado de Clientes</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-cliente">+ Nuevo Cliente</button>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo Doc.</th>
                <th>Nro. Documento</th>
                <th>Teléfono</th>
                <th>Estado</th>
                ${auth.isAdmin() ? '<th>Acciones</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${data.length === 0 ? `<tr><td colspan="${auth.isAdmin() ? 6 : 5}" class="table-empty">No hay clientes registrados</td></tr>` : ''}
              ${data.map(c => `
                <tr>
                  <td><strong>${c.nombre}</strong></td>
                  <td><span class="badge badge-info">${c.tipo_documento}</span></td>
                  <td>${c.numero_documento}</td>
                  <td>${c.telefono || '-'}</td>
                  <td><span class="badge ${c.activo ? 'badge-success' : 'badge-neutral'}">${c.activo ? 'Activo' : 'Inactivo'}</span></td>
                  ${auth.isAdmin() ? `
                  <td>
                    <div class="table-actions">
                      <button class="btn-icon" title="Editar" data-edit="${c.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="btn-icon text-danger" title="Eliminar" data-delete="${c.id}" data-name="${c.nombre}">
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

  document.getElementById('btn-add-cliente').addEventListener('click', () => openForm());
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = data.find(x => x.id === parseInt(btn.dataset.edit));
      if (c) openForm(c);
    });
  });
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirmDelete(btn.dataset.name)) {
        try {
          await api.delete(`/clientes/${btn.dataset.delete}`);
          showToast('Cliente eliminado', 'success');
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
    isEdit ? 'Editar Cliente' : 'Nuevo Cliente',
    `<form id="cliente-form">
      <div class="form-group">
        <label for="cli-nombre">Nombre completo</label>
        <input type="text" id="cli-nombre" required value="${item?.nombre || ''}" placeholder="Nombre del cliente">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="cli-tipo-doc">Tipo de documento</label>
          <select id="cli-tipo-doc" required>
            <option value="">Seleccionar...</option>
            <option value="CI" ${item?.tipo_documento === 'CI' ? 'selected' : ''}>CI</option>
            <option value="NIT" ${item?.tipo_documento === 'NIT' ? 'selected' : ''}>NIT</option>
            <option value="Otro" ${item?.tipo_documento === 'Otro' ? 'selected' : ''}>Otro</option>
          </select>
        </div>
        <div class="form-group">
          <label for="cli-num-doc">Número de documento</label>
          <input type="text" id="cli-num-doc" required value="${item?.numero_documento || ''}" placeholder="Ej: 12345678">
        </div>
      </div>
      <div class="form-group">
        <label for="cli-telefono">Teléfono</label>
        <input type="text" id="cli-telefono" value="${item?.telefono || ''}" placeholder="Ej: +591 12345678">
      </div>
      ${isEdit ? `
      <div class="form-group">
        <label for="cli-activo">Estado</label>
        <select id="cli-activo">
          <option value="true" ${item.activo ? 'selected' : ''}>Activo</option>
          <option value="false" ${!item.activo ? 'selected' : ''}>Inactivo</option>
        </select>
      </div>` : ''}
    </form>`,
    `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').style.display='none'">Cancelar</button>
     <button class="btn btn-primary" id="btn-save-cliente">${isEdit ? 'Guardar' : 'Crear'}</button>`
  );

  document.getElementById('btn-save-cliente').addEventListener('click', async () => {
    const payload = {
      nombre: document.getElementById('cli-nombre').value.trim(),
      tipo_documento: document.getElementById('cli-tipo-doc').value,
      numero_documento: document.getElementById('cli-num-doc').value.trim(),
      telefono: document.getElementById('cli-telefono').value.trim() || null
    };

    if (!payload.nombre || !payload.tipo_documento || !payload.numero_documento) {
      showToast('Complete los campos requeridos', 'warning');
      return;
    }

    if (isEdit) {
      payload.activo = document.getElementById('cli-activo').value === 'true';
    }

    try {
      if (isEdit) {
        await api.put(`/clientes/${item.id}`, payload);
        showToast('Cliente actualizado', 'success');
      } else {
        await api.post('/clientes', payload);
        showToast('Cliente registrado', 'success');
      }
      closeModal();
      await loadTable(document.getElementById('page-content'));
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
