const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

// GET /api/combustibles
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('tipos_combustible')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error listando combustibles:', err.message);
    res.status(500).json({ error: 'Error al obtener combustibles' });
  }
});

// POST /api/combustibles
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { codigo_binario, nombre, precio_por_litro } = req.body;

  if (!codigo_binario || !nombre || !precio_por_litro) {
    return res.status(400).json({ error: 'Campos requeridos: codigo_binario, nombre, precio_por_litro' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('tipos_combustible')
      .insert({ codigo_binario, nombre, precio_por_litro })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Código binario ya registrado' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Error creando combustible:', err.message);
    res.status(500).json({ error: 'Error al crear combustible' });
  }
});

// PUT /api/combustibles/:id
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { nombre, precio_por_litro, activo } = req.body;

  try {
    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (precio_por_litro !== undefined) updateData.precio_por_litro = precio_por_litro;
    if (activo !== undefined) updateData.activo = activo;

    const { data, error } = await supabaseAdmin
      .from('tipos_combustible')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error actualizando combustible:', err.message);
    res.status(500).json({ error: 'Error al actualizar combustible' });
  }
});

// DELETE /api/combustibles/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('tipos_combustible')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Combustible eliminado' });
  } catch (err) {
    console.error('Error eliminando combustible:', err.message);
    res.status(500).json({ error: 'Error al eliminar combustible' });
  }
});

module.exports = router;
