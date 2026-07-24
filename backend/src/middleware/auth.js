const { supabaseAdmin, createUserClient } = require('../config/supabase');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    // Obtener perfil del usuario
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('usuarios')
      .select('*, roles(nombre)')
      .eq('auth_user_id', user.id)
      .single();

    if (perfilError || !perfil) {
      return res.status(403).json({ error: 'Usuario sin perfil en el sistema' });
    }

    req.user = {
      ...user,
      perfil,
      rol: perfil.roles?.nombre
    };
    req.token = token;
    req.supabase = createUserClient(token);

    next();
  } catch (err) {
    console.error('Error en autenticación:', err.message);
    return res.status(500).json({ error: 'Error interno de autenticación' });
  }
}

// Middleware para verificar rol administrador
function adminOnly(req, res, next) {
  if (req.user.rol !== 'administrador') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
