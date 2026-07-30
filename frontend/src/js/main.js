import { auth } from './auth.js';
import { initRouter, navigateTo } from './router.js';
import { showToast, closeModal } from './utils.js';
import { api } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Setup theme toggle
  setupThemeToggle();

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

function setupThemeToggle() {
  const currentTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  const toggles = [document.getElementById('theme-toggle-login'), document.getElementById('theme-toggle-app')];
  
  function updateIcons(theme) {
    const icon = theme === 'dark' 
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    
    toggles.forEach(t => {
      if (t) t.innerHTML = icon;
    });
  }
  
  updateIcons(currentTheme);

  toggles.forEach(t => {
    if (t) {
      t.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        let targetTheme = theme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', targetTheme);
        localStorage.setItem('theme', targetTheme);
        updateIcons(targetTheme);
      });
    }
  });
}
