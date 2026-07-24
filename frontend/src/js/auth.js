import { api } from './api.js';

class Auth {
  constructor() {
    this.user = null;
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        this.user = JSON.parse(stored);
      }
    } catch {
      this.user = null;
    }
  }

  async login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    api.setToken(data.session.access_token);
    localStorage.setItem('refresh_token', data.session.refresh_token);
    this.user = data.user;
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  }

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignorar errores de logout
    }
    this.user = null;
    api.setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('refresh_token');
  }

  async verifySession() {
    const token = api.getToken();
    if (!token) return false;

    try {
      const user = await api.get('/auth/me');
      this.user = user;
      localStorage.setItem('user', JSON.stringify(user));
      return true;
    } catch {
      this.user = null;
      api.setToken(null);
      localStorage.removeItem('user');
      return false;
    }
  }

  isAuthenticated() {
    return !!api.getToken() && !!this.user;
  }

  isAdmin() {
    return this.user?.rol === 'administrador';
  }

  getUser() {
    return this.user;
  }
}

export const auth = new Auth();
