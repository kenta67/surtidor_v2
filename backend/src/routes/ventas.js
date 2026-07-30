const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

// GET /api/ventas
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, surtidor_id, tipo_combustible_id } = req.query;

    let query = req.supabase
      .from('ventas')
      .select(`
        *,
        surtidores(numero),
        tipos_combustible(nombre, codigo_binario),
        vehiculos(placa, marca, modelo),
        clientes(nombre, numero_documento),
        usuarios(nombre_completo)
      `)
      .order('fecha_hora', { ascending: false });

    if (fecha_inicio) query = query.gte('fecha_hora', fecha_inicio);
    if (fecha_fin) query = query.lte('fecha_hora', fecha_fin);
    if (surtidor_id) query = query.eq('surtidor_id', surtidor_id);
    if (tipo_combustible_id) query = query.eq('tipo_combustible_id', tipo_combustible_id);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Error listando ventas:', err.message);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

// POST /api/ventas
router.post('/', authMiddleware, async (req, res) => {
  const { surtidor_id, cliente_texto, cliente_tipo, vehiculo_texto, litros } = req.body;

  if (!surtidor_id || !cliente_texto || !vehiculo_texto || !litros) {
    return res.status(400).json({ error: 'Campos requeridos: surtidor_id, cliente_texto, vehiculo_texto, litros' });
  }

  try {
    // Obtener surtidor con tipo de combustible
    const { data: surtidor, error: surtError } = await supabaseAdmin
      .from('surtidores')
      .select('*, tipos_combustible(id, precio_por_litro)')
      .eq('id', surtidor_id)
      .single();

    if (surtError || !surtidor) {
      return res.status(404).json({ error: 'Surtidor no encontrado' });
    }

    if (!surtidor.activo) {
      return res.status(400).json({ error: 'Surtidor no está activo' });
    }

    if (surtidor.nivel_actual < litros) {
      return res.status(400).json({
        error: `Stock insuficiente. Disponible: ${surtidor.nivel_actual} litros`
      });
    }

    const precio_por_litro = surtidor.tipos_combustible.precio_por_litro;

    // Procesar Vehículo por texto
    let vehiculo_id;
    const placaClean = vehiculo_texto.trim().toUpperCase();
    const { data: vehiculos } = await supabaseAdmin
      .from('vehiculos')
      .select('id')
      .eq('placa', placaClean)
      .limit(1);
      
    if (vehiculos && vehiculos.length > 0) {
      vehiculo_id = vehiculos[0].id;
    } else {
      const { data: newVehiculo, error: vErr } = await supabaseAdmin
        .from('vehiculos')
        .insert({ placa: placaClean, marca: 'Genérico', modelo: 'Genérico', color: 'N/A' })
        .select('id')
        .single();
      if (vErr) throw vErr;
      vehiculo_id = newVehiculo.id;
    }

    // Procesar Cliente
    let cliente_id;
    let doc = cliente_texto;
    let nom = 'S/N';
    
    if (cliente_texto.includes(' - ')) {
      const parts = cliente_texto.split(' - ');
      doc = parts[0].trim();
      nom = parts.slice(1).join(' - ').trim();
    } else {
      if (/^\\d+$/.test(cliente_texto)) {
        doc = cliente_texto;
      } else {
        nom = cliente_texto;
        doc = 'S/N-' + Date.now().toString().slice(-6);
      }
    }

    // Buscar si existe el cliente
    const { data: clientes } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .or(`numero_documento.eq."${doc}",nombre.eq."${cliente_texto}"`)
      .limit(1);

    if (clientes && clientes.length > 0) {
      cliente_id = clientes[0].id;
    } else {
      // Crear cliente nuevo
      const { data: newCliente, error: cErr } = await supabaseAdmin
        .from('clientes')
        .insert({ nombre: nom, tipo_documento: cliente_tipo || 'Otro', numero_documento: doc })
        .select('id')
        .single();
      if (cErr) throw cErr;
      cliente_id = newCliente.id;
    }

    // Registrar venta
    const { data: venta, error: ventaError } = await supabaseAdmin
      .from('ventas')
      .insert({
        surtidor_id,
        tipo_combustible_id: surtidor.tipos_combustible.id,
        vehiculo_id,
        cliente_id,
        litros,
        precio_por_litro,
        usuario_id: req.user.perfil.id
      })
      .select(`
        *,
        surtidores(numero),
        tipos_combustible(nombre),
        vehiculos(placa),
        clientes(nombre)
      `)
      .single();

    if (ventaError) throw ventaError;

    // Descontar nivel del surtidor
    const nuevoNivel = parseFloat(surtidor.nivel_actual) - parseFloat(litros);
    await supabaseAdmin
      .from('surtidores')
      .update({ nivel_actual: nuevoNivel, updated_at: new Date().toISOString() })
      .eq('id', surtidor_id);

    // Verificar alertas
    const porcentaje = surtidor.capacidad_total > 0 ? (nuevoNivel / surtidor.capacidad_total) * 100 : 0;

    const { data: config } = await supabaseAdmin
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['umbral_bajo_porcentaje', 'umbral_critico_porcentaje']);

    const umbrales = {};
    config.forEach(c => { umbrales[c.clave] = parseFloat(c.valor); });

    if (porcentaje <= umbrales.umbral_critico_porcentaje) {
      await supabaseAdmin.from('alertas').insert({
        surtidor_id, tipo_alerta: 'critico'
      }).select();
    } else if (porcentaje <= umbrales.umbral_bajo_porcentaje) {
      await supabaseAdmin.from('alertas').insert({
        surtidor_id, tipo_alerta: 'bajo'
      }).select();
    }

    res.status(201).json(venta);
  } catch (err) {
    console.error('Error registrando venta:', err.message);
    res.status(500).json({ error: 'Error al registrar venta' });
  }
});

// DELETE /api/ventas/:id (solo admin)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('ventas')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Venta eliminada' });
  } catch (err) {
    console.error('Error eliminando venta:', err.message);
    res.status(500).json({ error: 'Error al eliminar venta' });
  }
});

module.exports = router;
