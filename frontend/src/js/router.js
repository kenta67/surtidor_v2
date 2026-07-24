import { auth } from './auth.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderSurtidores } from './pages/surtidores.js';
import { renderVentas } from './pages/ventas.js';
import { renderAlertas } from './pages/alertas.js';
import { renderCombustibles } from './pages/combustibles.js';
import { renderVehiculos } from './pages/vehiculos.js';
import { renderClientes } from './pages/clientes.js';
import { renderUsuarios } from './pages/usuarios.js';
import { renderReportes } from './pages/reportes.js';

const routes = {
  '/dashboard': { title: 'Dashboard', render: renderDashboard },
  '/surtidores': { title: 'Surtidores', render: renderSurtidores },
  '/ventas': { title: 'Ventas', render: renderVentas },
  '/alertas': { title: 'Alertas', render: renderAlertas },
  '/combustibles': { title: 'Tipos de Combustible', render: renderCombustibles },
  '/vehiculos': { title: 'Vehículos', render: renderVehiculos },
  '/clientes': { title: 'Clientes', render: renderClientes },
  '/usuarios': { title: 'Usuarios', render: renderUsuarios, adminOnly: true },
  '/reportes': { title: 'Reportes', render: renderReportes }
};

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

export function navigateTo(path) {
  window.location.hash = `#${path}`;
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || '/dashboard';

  if (!auth.isAuthenticated()) {
    showLogin();
    return;
  }

  const route = routes[hash];
  if (!route) {
    navigateTo('/dashboard');
    return;
  }

  if (route.adminOnly && !auth.isAdmin()) {
    navigateTo('/dashboard');
    return;
  }

  showApp();
  setActiveNav(hash);
  document.getElementById('page-title').textContent = route.title;
  document.getElementById('topbar-actions').innerHTML = '';

  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="content-loader"><div class="loader-spinner"></div></div>';

  route.render(content);
}

function showLogin() {
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('app-view').style.display = 'none';
}

function showApp() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('app-view').style.display = 'flex';
  updateUserUI();
  updateAdminVisibility();
}

function setActiveNav(path) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('href') === `#${path}`);
  });
}

function updateUserUI() {
  const user = auth.getUser();
  if (user) {
    document.getElementById('user-name').textContent = user.nombre_completo || user.email;
    document.getElementById('user-role').textContent = user.rol || '';
    document.getElementById('user-avatar').textContent = (user.nombre_completo || user.email || 'U').charAt(0).toUpperCase();
  }
}

function updateAdminVisibility() {
  const isAdmin = auth.isAdmin();
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
}
