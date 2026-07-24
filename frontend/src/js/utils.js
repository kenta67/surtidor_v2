export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

export function showLoader() {
  document.getElementById('global-loader').style.display = 'flex';
}

export function hideLoader() {
  document.getElementById('global-loader').style.display = 'none';
}

export function openModal(title, bodyHtml, footerHtml = '') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml;
  document.getElementById('modal-overlay').style.display = 'flex';
}

export function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

export function confirmDelete(itemName) {
  return new Promise((resolve) => {
    openModal(
      'Confirmar eliminación',
      `<p>¿Está seguro que desea eliminar <strong>${itemName}</strong>?</p>
       <p class="text-muted mt-1" style="font-size: 0.8125rem;">Esta acción no se puede deshacer.</p>`,
      `<button class="btn btn-secondary" id="confirm-cancel">Cancelar</button>
       <button class="btn btn-danger" id="confirm-delete">Eliminar</button>`
    );

    document.getElementById('confirm-cancel').onclick = () => { closeModal(); resolve(false); };
    document.getElementById('confirm-delete').onclick = () => { closeModal(); resolve(true); };
  });
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function formatCurrency(value) {
  return parseFloat(value || 0).toFixed(2);
}

export function getLevelClass(porcentaje) {
  if (porcentaje <= 5) return 'level-critical';
  if (porcentaje <= 25) return 'level-low';
  return 'level-ok';
}

export function getLevelBinary(porcentaje) {
  if (porcentaje >= 75) return '11';
  if (porcentaje >= 50) return '10';
  if (porcentaje >= 25) return '01';
  return '00';
}
