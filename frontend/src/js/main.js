import { auth } from './auth.js';
import { initRouter, navigateTo } from './router.js';
import { showToast, closeModal } from './utils.js';
import { api } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Setup login form
  setupLoginForm();

  // Setup logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await auth.logout();
    navigateTo('/login');
    document.getElementById('login-view').style.display = 'flex';
    document.getElementById('app-view').style.display = 'none';
    showToast('Sesión cerrada', 'info');
  });

  // Setup modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Setup sidebar mobile
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Close sidebar on nav click (mobile)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  // Toggle password visibility
  document.getElementById('toggle-password')?.addEventListener('click', () => {
    const input = document.getElementById('login-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Verify existing session
  if (auth.isAuthenticated()) {
    const valid = await auth.verifySession();
    if (valid) {
      initRouter();
      loadAlertsBadge();
      return;
    }
  }

  // No session, show login
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('app-view').style.display = 'none';
  initRouter();
});

function setupLoginForm() {
  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      errorDiv.textContent = 'Complete todos los campos';
      errorDiv.style.display = 'block';
      return;
    }

    // Show loading
    btn.querySelector('.btn-text').style.display = 'none';
    btn.querySelector('.btn-loader').style.display = 'inline-flex';
    btn.disabled = true;

    try {
      await auth.login(email, password);
      showToast('Bienvenido al sistema', 'success');
      navigateTo('/dashboard');
      loadAlertsBadge();
      // Trigger hash change to render dashboard
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (err) {
      errorDiv.textContent = err.message;
      errorDiv.style.display = 'block';
    } finally {
      btn.querySelector('.btn-text').style.display = 'inline';
      btn.querySelector('.btn-loader').style.display = 'none';
      btn.disabled = false;
    }
  });
}

async function loadAlertsBadge() {
  try {
    const alertas = await api.get('/alertas?atendida=false');
    const badge = document.getElementById('alertas-badge');
    if (alertas.length > 0) {
      badge.textContent = alertas.length;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  } catch {
    // Silenciar errores del badge
  }
}

// Recargar badge cada 60s
setInterval(loadAlertsBadge, 60000);

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed, continue without it
    });
  });
}
