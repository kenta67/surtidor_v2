const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

// GET /api/clientes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('clientes')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error listando clientes:', err.message);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// POST /api/clientes
router.post('/', authMiddleware, async (req, res) => {
  const { nombre, tipo_documento, numero_documento, telefono } = req.body;

  if (!nombre || !tipo_documento || !numero_documento) {
    return res.status(400).json({ error: 'Campos requeridos: nombre, tipo_documento, numero_documento' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .insert({ nombre, tipo_documento, numero_documento, telefono })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Número de documento ya registrado' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Error creando cliente:', err.message);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

// PUT /api/clientes/:id
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { nombre, tipo_documento, numero_documento, telefono, activo } = req.body;

  try {
    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (tipo_documento !== undefined) updateData.tipo_documento = tipo_documento;
    if (numero_documento !== undefined) updateData.numero_documento = numero_documento;
    if (telefono !== undefined) updateData.telefono = telefono;
    if (activo !== undefined) updateData.activo = activo;

    const { data, error } = await supabaseAdmin
      .from('clientes')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Número de documento ya registrado' });
      }
      throw error;
    }

    res.json(data);
  } catch (err) {
    console.error('Error actualizando cliente:', err.message);
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

// DELETE /api/clientes/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('clientes')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Cliente eliminado' });
  } catch (err) {
    console.error('Error eliminando cliente:', err.message);
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

module.exports = router;
