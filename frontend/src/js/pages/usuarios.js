import { api } from '../api.js';
import { showToast, openModal, closeModal, confirmDelete } from '../utils.js';

export async function renderUsuarios(container) {
  try {
    await loadTable(container);
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body text-danger">Error: ${err.message}</div></div>`;
  }
}

async function loadTable(container) {
  const data = await api.get('/usuarios');

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Gestión de Usuarios</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-usuario">+ Nuevo Usuario</button>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${data.length === 0 ? '<tr><td colspan="5" class="table-empty">No hay usuarios registrados</td></tr>' : ''}
              ${data.map(u => `
                <tr>
                  <td><strong>${u.nombre_completo}</strong></td>
                  <td>${u.email}</td>
                  <td><span class="badge ${u.roles?.nombre === 'administrador' ? 'badge-info' : 'badge-neutral'}">${u.roles?.nombre || '-'}</span></td>
                  <td><span class="badge ${u.activo ? 'badge-success' : 'badge-danger'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="btn-icon" title="Editar" data-edit="${u.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="btn-icon text-danger" title="Eliminar" data-delete="${u.id}" data-name="${u.nombre_completo}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-add-usuario').addEventListener('click', () => openForm());
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = data.find(x => x.id === btn.dataset.edit);
      if (u) openForm(u);
    });
  });
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirmDelete(btn.dataset.name)) {
        try {
          await api.delete(`/usuarios/${btn.dataset.delete}`);
          showToast('Usuario eliminado', 'success');
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
    isEdit ? 'Editar Usuario' : 'Nuevo Usuario',
    `<form id="usuario-form">
      ${!isEdit ? `
      <div class="form-group">
        <label for="usr-email">Correo electrónico</label>
        <input type="email" id="usr-email" required placeholder="usuario@ejemplo.com">
      </div>
      <div class="form-group">
        <label for="usr-password">Contraseña</label>
        <input type="password" id="usr-password" required minlength="6" placeholder="Mínimo 6 caracteres">
      </div>` : ''}
      <div class="form-group">
        <label for="usr-nombre">Nombre completo</label>
        <input type="text" id="usr-nombre" required value="${item?.nombre_completo || ''}" placeholder="Nombre y apellido">
      </div>
      <div class="form-group">
        <label for="usr-rol">Rol</label>
        <select id="usr-rol" required>
          <option value="1" ${item?.rol_id === 1 ? 'selected' : ''}>Administrador</option>
          <option value="2" ${item?.rol_id === 2 || !item ? 'selected' : ''}>Despachador</option>
        </select>
      </div>
      ${isEdit ? `
      <div class="form-group">
        <label for="usr-activo">Estado</label>
        <select id="usr-activo">
          <option value="true" ${item.activo ? 'selected' : ''}>Activo</option>
          <option value="false" ${!item.activo ? 'selected' : ''}>Inactivo</option>
        </select>
      </div>
      <div class="form-group">
        <label for="usr-password-new">Nueva contraseña (dejar vacío para no cambiar)</label>
        <input type="password" id="usr-password-new" placeholder="Nueva contraseña">
      </div>` : ''}
    </form>`,
    `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').style.display='none'">Cancelar</button>
     <button class="btn btn-primary" id="btn-save-usuario">${isEdit ? 'Guardar' : 'Crear'}</button>`
  );

  document.getElementById('btn-save-usuario').addEventListener('click', async () => {
    const nombre_completo = document.getElementById('usr-nombre').value.trim();
    const rol_id = parseInt(document.getElementById('usr-rol').value);

    if (!nombre_completo) {
      showToast('El nombre es requerido', 'warning');
      return;
    }

    try {
      if (isEdit) {
        const payload = { nombre_completo, rol_id };
        payload.activo = document.getElementById('usr-activo').value === 'true';
        const newPass = document.getElementById('usr-password-new').value;
        if (newPass) payload.password = newPass;

        await api.put(`/usuarios/${item.id}`, payload);
        showToast('Usuario actualizado', 'success');
      } else {
        const email = document.getElementById('usr-email').value.trim();
        const password = document.getElementById('usr-password').value;

        if (!email || !password) {
          showToast('Email y contraseña son requeridos', 'warning');
          return;
        }

        await api.post('/usuarios', { email, password, nombre_completo, rol_id });
        showToast('Usuario creado', 'success');
      }
      closeModal();
      await loadTable(document.getElementById('page-content'));
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
