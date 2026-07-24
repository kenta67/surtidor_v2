const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

// GET /api/alertas
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { atendida } = req.query;

    let query = req.supabase
      .from('alertas')
      .select(`
        *,
        surtidores(numero, nivel_actual, capacidad_total, tipos_combustible(nombre)),
        usuarios:usuario_atendio(nombre_completo)
      `)
      .order('fecha_hora', { ascending: false });

    if (atendida !== undefined) {
      query = query.eq('atendida', atendida === 'true');
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Error listando alertas:', err.message);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
});

// PUT /api/alertas/:id/atender
router.put('/:id/atender', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('alertas')
      .update({
        atendida: true,
        usuario_atendio: req.user.perfil.id
      })
      .eq('id', req.params.id)
      .eq('atendida', false)
      .select(`
        *,
        surtidores(numero, tipos_combustible(nombre)),
        usuarios:usuario_atendio(nombre_completo)
      `)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Alerta no encontrada o ya atendida' });

    res.json(data);
  } catch (err) {
    console.error('Error atendiendo alerta:', err.message);
    res.status(500).json({ error: 'Error al atender alerta' });
  }
});

module.exports = router;
