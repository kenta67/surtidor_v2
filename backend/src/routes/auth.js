const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Obtener perfil del usuario
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('usuarios')
      .select('*, roles(nombre, descripcion)')
      .eq('auth_user_id', data.user.id)
      .single();

    if (perfilError || !perfil) {
      return res.status(403).json({ error: 'Usuario sin perfil asignado en el sistema' });
    }

    if (!perfil.activo) {
      return res.status(403).json({ error: 'Usuario desactivado. Contacte al administrador' });
    }

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      },
      user: {
        id: perfil.id,
        auth_user_id: data.user.id,
        email: data.user.email,
        nombre_completo: perfil.nombre_completo,
        rol: perfil.roles?.nombre,
        rol_descripcion: perfil.roles?.descripcion
      }
    });
  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    try {
      await supabaseAdmin.auth.admin.signOut(token);
    } catch (e) {
      // Ignorar errores de logout
    }
  }
  res.json({ message: 'Sesión cerrada' });
});

// GET /api/auth/me - requiere auth middleware aplicado desde server.js
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const { data: perfil } = await supabaseAdmin
      .from('usuarios')
      .select('*, roles(nombre, descripcion)')
      .eq('auth_user_id', user.id)
      .single();

    if (!perfil) {
      return res.status(403).json({ error: 'Sin perfil en el sistema' });
    }

    res.json({
      id: perfil.id,
      auth_user_id: user.id,
      email: user.email,
      nombre_completo: perfil.nombre_completo,
      rol: perfil.roles?.nombre,
      rol_descripcion: perfil.roles?.descripcion,
      activo: perfil.activo
    });
  } catch (err) {
    console.error('Error en /me:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
