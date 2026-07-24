const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

// GET /api/vehiculos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('vehiculos')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error listando vehículos:', err.message);
    res.status(500).json({ error: 'Error al obtener vehículos' });
  }
});

// POST /api/vehiculos
router.post('/', authMiddleware, async (req, res) => {
  const { placa, marca, modelo, color } = req.body;

  if (!placa) {
    return res.status(400).json({ error: 'La placa es requerida' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('vehiculos')
      .insert({ placa: placa.toUpperCase(), marca, modelo, color })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Placa ya registrada' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Error creando vehículo:', err.message);
    res.status(500).json({ error: 'Error al crear vehículo' });
  }
});

// PUT /api/vehiculos/:id
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { placa, marca, modelo, color, activo } = req.body;

  try {
    const updateData = {};
    if (placa !== undefined) updateData.placa = placa.toUpperCase();
    if (marca !== undefined) updateData.marca = marca;
    if (modelo !== undefined) updateData.modelo = modelo;
    if (color !== undefined) updateData.color = color;
    if (activo !== undefined) updateData.activo = activo;

    const { data, error } = await supabaseAdmin
      .from('vehiculos')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Placa ya registrada' });
      }
      throw error;
    }

    res.json(data);
  } catch (err) {
    console.error('Error actualizando vehículo:', err.message);
    res.status(500).json({ error: 'Error al actualizar vehículo' });
  }
});

// DELETE /api/vehiculos/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('vehiculos')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Vehículo eliminado' });
  } catch (err) {
    console.error('Error eliminando vehículo:', err.message);
    res.status(500).json({ error: 'Error al eliminar vehículo' });
  }
});

module.exports = router;
