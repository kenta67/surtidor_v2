const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

// GET /api/surtidores
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('surtidores')
      .select('*, tipos_combustible(id, nombre, codigo_binario, precio_por_litro)')
      .order('numero', { ascending: true });

    if (error) throw error;

    // Agregar nivel binario calculado
    const result = data.map(s => {
      const porcentaje = s.capacidad_total > 0 ? (s.nivel_actual / s.capacidad_total) * 100 : 0;
      let nivel_binario = '00'; // vacío
      if (porcentaje >= 75) nivel_binario = '11';
      else if (porcentaje >= 50) nivel_binario = '10';
      else if (porcentaje >= 25) nivel_binario = '01';
      return { ...s, porcentaje_nivel: Math.round(porcentaje * 100) / 100, nivel_binario };
    });

    res.json(result);
  } catch (err) {
    console.error('Error listando surtidores:', err.message);
    res.status(500).json({ error: 'Error al obtener surtidores' });
  }
});

// GET /api/surtidores/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('surtidores')
      .select('*, tipos_combustible(id, nombre, codigo_binario, precio_por_litro)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Surtidor no encontrado' });

    const porcentaje = data.capacidad_total > 0 ? (data.nivel_actual / data.capacidad_total) * 100 : 0;
    let nivel_binario = '00';
    if (porcentaje >= 75) nivel_binario = '11';
    else if (porcentaje >= 50) nivel_binario = '10';
    else if (porcentaje >= 25) nivel_binario = '01';

    res.json({ ...data, porcentaje_nivel: Math.round(porcentaje * 100) / 100, nivel_binario });
  } catch (err) {
    console.error('Error obteniendo surtidor:', err.message);
    res.status(500).json({ error: 'Error al obtener surtidor' });
  }
});

// POST /api/surtidores
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { numero, tipo_combustible_id, capacidad_total, nivel_actual } = req.body;

  if (!numero || !tipo_combustible_id || !capacidad_total) {
    return res.status(400).json({ error: 'Campos requeridos: numero, tipo_combustible_id, capacidad_total' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('surtidores')
      .insert({
        numero,
        tipo_combustible_id,
        capacidad_total,
        nivel_actual: nivel_actual || 0
      })
      .select('*, tipos_combustible(id, nombre, codigo_binario)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un surtidor con ese número' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Error creando surtidor:', err.message);
    res.status(500).json({ error: 'Error al crear surtidor' });
  }
});

// PUT /api/surtidores/:id
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { numero, tipo_combustible_id, capacidad_total, nivel_actual, activo } = req.body;

  try {
    const updateData = {};
    if (numero !== undefined) updateData.numero = numero;
    if (tipo_combustible_id !== undefined) updateData.tipo_combustible_id = tipo_combustible_id;
    if (capacidad_total !== undefined) updateData.capacidad_total = capacidad_total;
    if (nivel_actual !== undefined) updateData.nivel_actual = nivel_actual;
    if (activo !== undefined) updateData.activo = activo;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('surtidores')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*, tipos_combustible(id, nombre, codigo_binario)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un surtidor con ese número' });
      }
      throw error;
    }

    // Verificar alertas después de actualizar nivel
    if (nivel_actual !== undefined) {
      await verificarAlertas(data);
    }

    res.json(data);
  } catch (err) {
    console.error('Error actualizando surtidor:', err.message);
    res.status(500).json({ error: 'Error al actualizar surtidor' });
  }
});

// DELETE /api/surtidores/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('surtidores')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Surtidor eliminado' });
  } catch (err) {
    console.error('Error eliminando surtidor:', err.message);
    res.status(500).json({ error: 'Error al eliminar surtidor' });
  }
});

// Función para verificar y crear alertas
async function verificarAlertas(surtidor) {
  try {
    const { data: config } = await supabaseAdmin
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['umbral_bajo_porcentaje', 'umbral_critico_porcentaje']);

    const umbrales = {};
    config.forEach(c => { umbrales[c.clave] = parseFloat(c.valor); });

    const porcentaje = surtidor.capacidad_total > 0
      ? (surtidor.nivel_actual / surtidor.capacidad_total) * 100
      : 0;

    if (porcentaje <= umbrales.umbral_critico_porcentaje) {
      await supabaseAdmin.from('alertas').upsert({
        surtidor_id: surtidor.id,
        tipo_alerta: 'critico',
        atendida: false
      }, { onConflict: 'surtidor_id,tipo_alerta,atendida', ignoreDuplicates: true });
    } else if (porcentaje <= umbrales.umbral_bajo_porcentaje) {
      await supabaseAdmin.from('alertas').upsert({
        surtidor_id: surtidor.id,
        tipo_alerta: 'bajo',
        atendida: false
      }, { onConflict: 'surtidor_id,tipo_alerta,atendida', ignoreDuplicates: true });
    }
  } catch (err) {
    console.error('Error verificando alertas:', err.message);
  }
}

module.exports = router;
