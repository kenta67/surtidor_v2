const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

// GET /api/reportes/resumen - KPIs del dashboard
router.get('/resumen', authMiddleware, async (req, res) => {
  try {
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();

    // Ventas del día
    const { data: ventasHoy } = await supabaseAdmin
      .from('ventas')
      .select('total, litros')
      .gte('fecha_hora', inicioHoy);

    const totalVentasHoy = ventasHoy?.reduce((sum, v) => sum + parseFloat(v.total), 0) || 0;
    const totalLitrosHoy = ventasHoy?.reduce((sum, v) => sum + parseFloat(v.litros), 0) || 0;

    // Surtidores activos
    const { data: surtidores } = await supabaseAdmin
      .from('surtidores')
      .select('id, activo')
      .eq('activo', true);

    // Alertas sin atender
    const { data: alertas } = await supabaseAdmin
      .from('alertas')
      .select('id')
      .eq('atendida', false);

    // Clientes registrados
    const { data: clientes } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('activo', true);

    res.json({
      ventas_hoy: {
        cantidad: ventasHoy?.length || 0,
        total_bs: Math.round(totalVentasHoy * 100) / 100,
        total_litros: Math.round(totalLitrosHoy * 100) / 100
      },
      surtidores_activos: surtidores?.length || 0,
      alertas_pendientes: alertas?.length || 0,
      clientes_activos: clientes?.length || 0
    });
  } catch (err) {
    console.error('Error en resumen:', err.message);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

// GET /api/reportes/ventas-diarias
router.get('/ventas-diarias', authMiddleware, async (req, res) => {
  try {
    const { dias = 7 } = req.query;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - parseInt(dias));

    const { data, error } = await supabaseAdmin
      .from('ventas')
      .select('fecha_hora, total, litros, tipos_combustible(nombre)')
      .gte('fecha_hora', fecha.toISOString())
      .order('fecha_hora', { ascending: true });

    if (error) throw error;

    // Agrupar por día
    const porDia = {};
    data.forEach(v => {
      const dia = v.fecha_hora.split('T')[0];
      if (!porDia[dia]) porDia[dia] = { fecha: dia, total: 0, litros: 0, cantidad: 0 };
      porDia[dia].total += parseFloat(v.total);
      porDia[dia].litros += parseFloat(v.litros);
      porDia[dia].cantidad += 1;
    });

    res.json(Object.values(porDia));
  } catch (err) {
    console.error('Error en ventas diarias:', err.message);
    res.status(500).json({ error: 'Error al obtener ventas diarias' });
  }
});

// GET /api/reportes/inventario
router.get('/inventario', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('surtidores')
      .select('*, tipos_combustible(nombre, codigo_binario)')
      .eq('activo', true)
      .order('numero', { ascending: true });

    if (error) throw error;

    const inventario = data.map(s => {
      const porcentaje = s.capacidad_total > 0 ? (s.nivel_actual / s.capacidad_total) * 100 : 0;
      let estado = 'normal';
      if (porcentaje <= 5) estado = 'critico';
      else if (porcentaje <= 25) estado = 'bajo';

      return {
        surtidor: s.numero,
        combustible: s.tipos_combustible?.nombre,
        codigo_binario: s.tipos_combustible?.codigo_binario,
        capacidad_total: parseFloat(s.capacidad_total),
        nivel_actual: parseFloat(s.nivel_actual),
        porcentaje: Math.round(porcentaje * 100) / 100,
        estado
      };
    });

    res.json(inventario);
  } catch (err) {
    console.error('Error en inventario:', err.message);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

// GET /api/reportes/ingresos-combustible
router.get('/ingresos-combustible', authMiddleware, async (req, res) => {
  try {
    const { dias = 30 } = req.query;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - parseInt(dias));

    const { data, error } = await supabaseAdmin
      .from('ventas')
      .select('total, litros, tipos_combustible(id, nombre, codigo_binario)')
      .gte('fecha_hora', fecha.toISOString());

    if (error) throw error;

    // Agrupar por tipo de combustible
    const porTipo = {};
    data.forEach(v => {
      const nombre = v.tipos_combustible?.nombre || 'Desconocido';
      const id = v.tipos_combustible?.id;
      if (!porTipo[id]) {
        porTipo[id] = {
          combustible: nombre,
          codigo_binario: v.tipos_combustible?.codigo_binario,
          total_bs: 0,
          total_litros: 0,
          cantidad_ventas: 0
        };
      }
      porTipo[id].total_bs += parseFloat(v.total);
      porTipo[id].total_litros += parseFloat(v.litros);
      porTipo[id].cantidad_ventas += 1;
    });

    // Redondear valores
    Object.values(porTipo).forEach(t => {
      t.total_bs = Math.round(t.total_bs * 100) / 100;
      t.total_litros = Math.round(t.total_litros * 100) / 100;
    });

    res.json(Object.values(porTipo));
  } catch (err) {
    console.error('Error en ingresos por combustible:', err.message);
    res.status(500).json({ error: 'Error al obtener ingresos' });
  }
});

module.exports = router;
