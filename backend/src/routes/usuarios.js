const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

// GET /api/usuarios
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('*, roles(nombre, descripcion)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Obtener emails de auth.users
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
    const emailMap = {};
    authUsers.forEach(u => { emailMap[u.id] = u.email; });

    const result = data.map(u => ({
      ...u,
      email: emailMap[u.auth_user_id] || 'N/A'
    }));

    res.json(result);
  } catch (err) {
    console.error('Error listando usuarios:', err.message);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/usuarios - Crear usuario (crea en auth + perfil)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { email, password, nombre_completo, rol_id } = req.body;

  if (!email || !password || !nombre_completo || !rol_id) {
    return res.status(400).json({ error: 'Campos requeridos: email, password, nombre_completo, rol_id' });
  }

  try {
    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Crear perfil en tabla usuarios
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        auth_user_id: authData.user.id,
        nombre_completo,
        rol_id
      })
      .select('*, roles(nombre)')
      .single();

    if (perfilError) {
      // Rollback: eliminar usuario de auth si falla el perfil
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw perfilError;
    }

    res.status(201).json({ ...perfil, email });
  } catch (err) {
    console.error('Error creando usuario:', err.message);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/usuarios/:id
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { nombre_completo, rol_id, activo, password } = req.body;

  try {
    const updateData = {};
    if (nombre_completo !== undefined) updateData.nombre_completo = nombre_completo;
    if (rol_id !== undefined) updateData.rol_id = rol_id;
    if (activo !== undefined) updateData.activo = activo;

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*, roles(nombre)')
      .single();

    if (error) throw error;

    // Si se envió nueva contraseña, actualizar en auth
    if (password) {
      await supabaseAdmin.auth.admin.updateUserById(data.auth_user_id, { password });
    }

    res.json(data);
  } catch (err) {
    console.error('Error actualizando usuario:', err.message);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/usuarios/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Obtener auth_user_id antes de eliminar
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('auth_user_id')
      .eq('id', req.params.id)
      .single();

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Eliminar perfil (cascade eliminará de auth.users por la FK)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(usuario.auth_user_id);
    if (error) throw error;

    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    console.error('Error eliminando usuario:', err.message);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;
