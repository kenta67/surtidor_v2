import { api } from '../api.js';
import { showToast, openModal, closeModal, formatDateTime, formatCurrency } from '../utils.js';

export async function renderVentas(container) {
  try {
    await loadVentas(container);
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body text-danger">Error: ${err.message}</div></div>`;
  }
}

async function loadVentas(container) {
  const ventas = await api.get('/ventas');

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Registro de Ventas</h3>
        <button class="btn btn-primary btn-sm" id="btn-nueva-venta">+ Nueva Venta</button>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Surtidor</th>
                <th>Combustible</th>
                <th>Cliente</th>
                <th>Vehículo</th>
                <th>Litros</th>
                <th>Precio/L</th>
                <th>Total</th>
                <th>Despachador</th>
              </tr>
            </thead>
            <tbody>
              ${ventas.length === 0 ? '<tr><td colspan="9" class="table-empty">No hay ventas registradas</td></tr>' : ''}
              ${ventas.map(v => `
                <tr>
                  <td>${formatDateTime(v.fecha_hora)}</td>
                  <td>#${v.surtidores?.numero || v.surtidor_id}</td>
                  <td>${v.tipos_combustible?.nombre || '-'}</td>
                  <td>${v.clientes?.nombre || '-'}<br><small class="text-muted">${v.clientes?.numero_documento || ''}</small></td>
                  <td>${v.vehiculos?.placa || '-'}<br><small class="text-muted">${v.vehiculos?.marca || ''} ${v.vehiculos?.modelo || ''}</small></td>
                  <td>${formatCurrency(v.litros)}</td>
                  <td>Bs. ${formatCurrency(v.precio_por_litro)}</td>
                  <td><strong>Bs. ${formatCurrency(v.total)}</strong></td>
                  <td>${v.usuarios?.nombre_completo || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-nueva-venta').addEventListener('click', () => openVentaForm(container));
}

async function openVentaForm(container) {
  try {
    const [surtidores, clientes, vehiculos] = await Promise.all([
      api.get('/surtidores'),
      api.get('/clientes'),
      api.get('/vehiculos')
    ]);

    const surtActivos = surtidores.filter(s => s.activo && s.nivel_actual > 0);

    openModal(
      'Registrar Venta',
      `<form id="venta-form">
        <div class="form-group">
          <label for="venta-surtidor">Surtidor</label>
          <select id="venta-surtidor" required>
            <option value="">Seleccionar surtidor...</option>
            ${surtActivos.map(s => `<option value="${s.id}" data-precio="${s.tipos_combustible?.precio_por_litro}" data-nivel="${s.nivel_actual}" data-combustible="${s.tipos_combustible?.nombre}">#${s.numero} - ${s.tipos_combustible?.nombre} (Disp: ${formatCurrency(s.nivel_actual)} L)</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="venta-cliente">Cliente</label>
          <div style="display: flex; gap: 0.5rem;">
            <select id="venta-cliente-tipo" style="width: 110px;">
              <option value="NIT">NIT</option>
              <option value="CI">CI</option>
              <option value="Otro">Otro</option>
            </select>
            <input type="text" id="venta-cliente" list="clientes-list" autocomplete="off" required placeholder="Escriba el nombre o documento..." style="flex: 1;">
          </div>
          <datalist id="clientes-list">
            ${clientes.filter(c => c.activo).map(c => `<option value="${c.numero_documento} - ${c.nombre}"></option>`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label for="venta-vehiculo">Vehículo (Placa)</label>
          <input type="text" id="venta-vehiculo" list="vehiculos-list" autocomplete="off" required placeholder="Escriba la placa del vehículo...">
          <datalist id="vehiculos-list">
            ${vehiculos.filter(v => v.activo).map(v => `<option value="${v.placa}"></option>`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label for="venta-litros">Litros</label>
          <input type="number" id="venta-litros" step="0.01" min="0.01" required placeholder="0.00">
        </div>
        <div style="padding: 0.75rem; background: var(--bg-primary); border-radius: var(--radius); margin-top: 0.5rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8125rem;">
            <span>Precio por litro:</span>
            <span id="venta-precio-display">Bs. 0.00</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 1rem; font-weight: 700; margin-top: 0.5rem; color: var(--accent);">
            <span>Total:</span>
            <span id="venta-total-display">Bs. 0.00</span>
          </div>
        </div>
      </form>`,
      `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').style.display='none'">Cancelar</button>
       <button class="btn btn-primary" id="btn-save-venta">Registrar Venta</button>`
    );

    // Calcular total dinámicamente
    const surtSelect = document.getElementById('venta-surtidor');
    const litrosInput = document.getElementById('venta-litros');

    function updateTotal() {
      const opt = surtSelect.selectedOptions[0];
      const precio = parseFloat(opt?.dataset?.precio || 0);
      const litros = parseFloat(litrosInput.value || 0);
      document.getElementById('venta-precio-display').textContent = `Bs. ${formatCurrency(precio)}`;
      document.getElementById('venta-total-display').textContent = `Bs. ${formatCurrency(precio * litros)}`;
    }

    surtSelect.addEventListener('change', updateTotal);
    litrosInput.addEventListener('input', updateTotal);

    document.getElementById('btn-save-venta').addEventListener('click', async () => {
      const surtidor_id = parseInt(surtSelect.value);
      const cliente_texto = document.getElementById('venta-cliente').value.trim();
      const cliente_tipo = document.getElementById('venta-cliente-tipo').value;
      const vehiculo_texto = document.getElementById('venta-vehiculo').value.trim().toUpperCase();
      const litros = parseFloat(litrosInput.value);

      if (!surtidor_id || !cliente_texto || !vehiculo_texto || !litros) {
        showToast('Complete todos los campos requeridos', 'warning');
        return;
      }

      try {
        await api.post('/ventas', { surtidor_id, cliente_texto, cliente_tipo, vehiculo_texto, litros });
        showToast('Venta registrada correctamente', 'success');
        closeModal();
        await loadVentas(container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  } catch (err) {
    showToast('Error al cargar datos: ' + err.message, 'error');
  }
}
