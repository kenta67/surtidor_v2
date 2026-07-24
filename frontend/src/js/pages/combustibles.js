import { api } from '../api.js';
import { auth } from '../auth.js';
import { showToast, openModal, closeModal, confirmDelete, formatCurrency } from '../utils.js';

export async function renderCombustibles(container) {
  try {
    await loadTable(container);
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body text-danger">Error: ${err.message}</div></div>`;
  }
}

async function loadTable(container) {
  const data = await api.get('/combustibles');

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Tipos de Combustible</h3>
        ${auth.isAdmin() ? '<button class="btn btn-primary btn-sm" id="btn-add-comb">+ Nuevo Tipo</button>' : ''}
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código Binario</th>
                <th>Nombre</th>
                <th>Precio por Litro</th>
                <th>Estado</th>
                ${auth.isAdmin() ? '<th>Acciones</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${data.length === 0 ? `<tr><td colspan="${auth.isAdmin() ? 6 : 5}" class="table-empty">No hay combustibles registrados</td></tr>` : ''}
              ${data.map(c => `
                <tr>
                  <td>${c.id}</td>
                  <td><span class="binary-code">${c.codigo_binario}</span></td>
                  <td><strong>${c.nombre}</strong></td>
                  <td>Bs. ${formatCurrency(c.precio_por_litro)}</td>
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

  document.getElementById('btn-add-comb')?.addEventListener('click', () => openForm());
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
          await api.delete(`/combustibles/${btn.dataset.delete}`);
          showToast('Combustible eliminado', 'success');
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
    isEdit ? 'Editar Combustible' : 'Nuevo Combustible',
    `<form id="comb-form">
      <div class="form-group">
        <label for="comb-codigo">Código Binario (2 bits)</label>
        <select id="comb-codigo" ${isEdit ? 'disabled' : 'required'}>
          <option value="">Seleccionar...</option>
          <option value="00" ${item?.codigo_binario === '00' ? 'selected' : ''}>00</option>
          <option value="01" ${item?.codigo_binario === '01' ? 'selected' : ''}>01</option>
          <option value="10" ${item?.codigo_binario === '10' ? 'selected' : ''}>10</option>
          <option value="11" ${item?.codigo_binario === '11' ? 'selected' : ''}>11</option>
        </select>
      </div>
      <div class="form-group">
        <label for="comb-nombre">Nombre</label>
        <input type="text" id="comb-nombre" required value="${item?.nombre || ''}" placeholder="Ej: Gasolina Premium">
      </div>
      <div class="form-group">
        <label for="comb-precio">Precio por Litro (Bs.)</label>
        <input type="number" id="comb-precio" step="0.01" min="0.01" required value="${item?.precio_por_litro || ''}">
      </div>
      ${isEdit ? `
      <div class="form-group">
        <label for="comb-activo">Estado</label>
        <select id="comb-activo">
          <option value="true" ${item.activo ? 'selected' : ''}>Activo</option>
          <option value="false" ${!item.activo ? 'selected' : ''}>Inactivo</option>
        </select>
      </div>` : ''}
    </form>`,
    `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').style.display='none'">Cancelar</button>
     <button class="btn btn-primary" id="btn-save-comb">${isEdit ? 'Guardar' : 'Crear'}</button>`
  );

  document.getElementById('btn-save-comb').addEventListener('click', async () => {
    const payload = {
      nombre: document.getElementById('comb-nombre').value.trim(),
      precio_por_litro: parseFloat(document.getElementById('comb-precio').value)
    };

    if (!isEdit) {
      payload.codigo_binario = document.getElementById('comb-codigo').value;
    }
    if (isEdit) {
      payload.activo = document.getElementById('comb-activo').value === 'true';
    }

    if (!payload.nombre || !payload.precio_por_litro) {
      showToast('Complete todos los campos', 'warning');
      return;
    }

    try {
      if (isEdit) {
        await api.put(`/combustibles/${item.id}`, payload);
        showToast('Combustible actualizado', 'success');
      } else {
        await api.post('/combustibles', payload);
        showToast('Combustible creado', 'success');
      }
      closeModal();
      await loadTable(document.getElementById('page-content'));
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
