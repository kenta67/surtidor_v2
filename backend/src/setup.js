/**
 * Script de configuración inicial:
 * 1. Ejecuta el schema SQL en la base de datos
 * 2. Crea usuarios de prueba en Supabase Auth
 * 3. Crea perfiles en la tabla usuarios
 */

require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Conexión directa a PostgreSQL
const pool = new Pool({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.evlpamktwjhxenctxxrd',
  password: '0ds7OImddGcJ8ZEA',
  ssl: { rejectUnauthorized: false }
});

// SQL dividido en sentencias individuales para ejecutar secuencialmente
const sqlStatements = [
  // Extensión
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,

  // 1. Roles
  `CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE CHECK (nombre IN ('administrador', 'despachador')),
    descripcion TEXT
  )`,

  `INSERT INTO public.roles (nombre, descripcion) VALUES
  ('administrador', 'Acceso total al sistema'),
  ('despachador', 'Registro de ventas y consulta de inventario')
  ON CONFLICT (nombre) DO NOTHING`,

  // 2. Usuarios
  `CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_completo TEXT NOT NULL,
    rol_id INT NOT NULL REFERENCES public.roles(id),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 3. Vehículos
  `CREATE TABLE IF NOT EXISTS public.vehiculos (
    id SERIAL PRIMARY KEY,
    placa TEXT UNIQUE NOT NULL,
    marca TEXT,
    modelo TEXT,
    color TEXT,
    activo BOOLEAN NOT NULL DEFAULT true
  )`,

  // 4. Clientes
  `CREATE TABLE IF NOT EXISTS public.clientes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo_documento TEXT NOT NULL CHECK (tipo_documento IN ('DNI', 'RUC', 'Pasaporte', 'Otro')),
    numero_documento TEXT UNIQUE NOT NULL,
    telefono TEXT,
    activo BOOLEAN NOT NULL DEFAULT true
  )`,

  // 5. Tipos de combustible
  `CREATE TABLE IF NOT EXISTS public.tipos_combustible (
    id SERIAL PRIMARY KEY,
    codigo_binario CHAR(2) UNIQUE NOT NULL CHECK (codigo_binario IN ('00','01','10','11')),
    nombre TEXT NOT NULL,
    precio_por_litro NUMERIC(10,2) NOT NULL CHECK (precio_por_litro > 0),
    activo BOOLEAN NOT NULL DEFAULT true
  )`,

  `INSERT INTO public.tipos_combustible (codigo_binario, nombre, precio_por_litro) VALUES
  ('00', 'Gasolina Especial', 3.74),
  ('01', 'Gasolina Premium', 4.10),
  ('10', 'Diésel', 3.50),
  ('11', 'GNV', 1.80)
  ON CONFLICT (codigo_binario) DO NOTHING`,

  // 6. Surtidores
  `CREATE TABLE IF NOT EXISTS public.surtidores (
    id SERIAL PRIMARY KEY,
    numero INTEGER UNIQUE NOT NULL CHECK (numero > 0),
    tipo_combustible_id INT NOT NULL REFERENCES public.tipos_combustible(id),
    capacidad_total NUMERIC(10,2) NOT NULL CHECK (capacidad_total > 0),
    nivel_actual NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (nivel_actual >= 0),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 7. Ventas
  `CREATE TABLE IF NOT EXISTS public.ventas (
    id SERIAL PRIMARY KEY,
    surtidor_id INT NOT NULL REFERENCES public.surtidores(id),
    tipo_combustible_id INT NOT NULL REFERENCES public.tipos_combustible(id),
    vehiculo_id INT NOT NULL REFERENCES public.vehiculos(id),
    cliente_id INT NOT NULL REFERENCES public.clientes(id),
    litros NUMERIC(10,2) NOT NULL CHECK (litros > 0),
    precio_por_litro NUMERIC(10,2) NOT NULL CHECK (precio_por_litro > 0),
    total NUMERIC(10,2) GENERATED ALWAYS AS (litros * precio_por_litro) STORED,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id),
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 8. Alertas
  `CREATE TABLE IF NOT EXISTS public.alertas (
    id SERIAL PRIMARY KEY,
    surtidor_id INT NOT NULL REFERENCES public.surtidores(id),
    tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN ('bajo', 'critico')),
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atendida BOOLEAN NOT NULL DEFAULT false,
    usuario_atendio UUID REFERENCES public.usuarios(id)
  )`,

  // 9. Configuración
  `CREATE TABLE IF NOT EXISTS public.configuracion (
    id SERIAL PRIMARY KEY,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL
  )`,

  `INSERT INTO public.configuracion (clave, valor) VALUES
  ('umbral_bajo_porcentaje', '25'),
  ('umbral_critico_porcentaje', '5')
  ON CONFLICT (clave) DO NOTHING`,

  // Función RLS
  `CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $$
    SELECT r.nombre
    FROM public.usuarios u
    JOIN public.roles r ON u.rol_id = r.id
    WHERE u.auth_user_id = auth.uid();
  $$`,

  // Habilitar RLS
  `ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.tipos_combustible ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.surtidores ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY`,
];

// Políticas RLS (creadas con DROP IF EXISTS + CREATE para idempotencia)
const rlsPolicies = [
  // roles
  `DROP POLICY IF EXISTS "roles_select" ON public.roles`,
  `CREATE POLICY "roles_select" ON public.roles FOR SELECT TO authenticated USING (true)`,

  // usuarios
  `DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios`,
  `CREATE POLICY "usuarios_select" ON public.usuarios FOR SELECT TO authenticated USING (public.get_my_role() = 'administrador' OR auth_user_id = auth.uid())`,
  `DROP POLICY IF EXISTS "usuarios_admin_insert" ON public.usuarios`,
  `CREATE POLICY "usuarios_admin_insert" ON public.usuarios FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'administrador')`,
  `DROP POLICY IF EXISTS "usuarios_admin_update" ON public.usuarios`,
  `CREATE POLICY "usuarios_admin_update" ON public.usuarios FOR UPDATE TO authenticated USING (public.get_my_role() = 'administrador') WITH CHECK (public.get_my_role() = 'administrador')`,
  `DROP POLICY IF EXISTS "usuarios_admin_delete" ON public.usuarios`,
  `CREATE POLICY "usuarios_admin_delete" ON public.usuarios FOR DELETE TO authenticated USING (public.get_my_role() = 'administrador')`,

  // vehiculos
  `DROP POLICY IF EXISTS "vehiculos_select" ON public.vehiculos`,
  `CREATE POLICY "vehiculos_select" ON public.vehiculos FOR SELECT TO authenticated USING (public.get_my_role() IN ('administrador','despachador'))`,
  `DROP POLICY IF EXISTS "vehiculos_insert" ON public.vehiculos`,
  `CREATE POLICY "vehiculos_insert" ON public.vehiculos FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('administrador','despachador'))`,
  `DROP POLICY IF EXISTS "vehiculos_admin_update" ON public.vehiculos`,
  `CREATE POLICY "vehiculos_admin_update" ON public.vehiculos FOR UPDATE TO authenticated USING (public.get_my_role() = 'administrador') WITH CHECK (public.get_my_role() = 'administrador')`,
  `DROP POLICY IF EXISTS "vehiculos_admin_delete" ON public.vehiculos`,
  `CREATE POLICY "vehiculos_admin_delete" ON public.vehiculos FOR DELETE TO authenticated USING (public.get_my_role() = 'administrador')`,

  // clientes
  `DROP POLICY IF EXISTS "clientes_select" ON public.clientes`,
  `CREATE POLICY "clientes_select" ON public.clientes FOR SELECT TO authenticated USING (public.get_my_role() IN ('administrador','despachador'))`,
  `DROP POLICY IF EXISTS "clientes_insert" ON public.clientes`,
  `CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('administrador','despachador'))`,
  `DROP POLICY IF EXISTS "clientes_admin_update" ON public.clientes`,
  `CREATE POLICY "clientes_admin_update" ON public.clientes FOR UPDATE TO authenticated USING (public.get_my_role() = 'administrador') WITH CHECK (public.get_my_role() = 'administrador')`,
  `DROP POLICY IF EXISTS "clientes_admin_delete" ON public.clientes`,
  `CREATE POLICY "clientes_admin_delete" ON public.clientes FOR DELETE TO authenticated USING (public.get_my_role() = 'administrador')`,

  // tipos_combustible
  `DROP POLICY IF EXISTS "tipos_comb_select" ON public.tipos_combustible`,
  `CREATE POLICY "tipos_comb_select" ON public.tipos_combustible FOR SELECT TO authenticated USING (public.get_my_role() IN ('administrador','despachador'))`,
  `DROP POLICY IF EXISTS "tipos_comb_admin_insert" ON public.tipos_combustible`,
  `CREATE POLICY "tipos_comb_admin_insert" ON public.tipos_combustible FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'administrador')`,
  `DROP POLICY IF EXISTS "tipos_comb_admin_update" ON public.tipos_combustible`,
  `CREATE POLICY "tipos_comb_admin_update" ON public.tipos_combustible FOR UPDATE TO authenticated USING (public.get_my_role() = 'administrador') WITH CHECK (public.get_my_role() = 'administrador')`,
  `DROP POLICY IF EXISTS "tipos_comb_admin_delete" ON public.tipos_combustible`,
  `CREATE POLICY "tipos_comb_admin_delete" ON public.tipos_combustible FOR DELETE TO authenticated USING (public.get_my_role() = 'administrador')`,

  // surtidores
  `DROP POLICY IF EXISTS "surtidores_select" ON public.surtidores`,
  `CREATE POLICY "surtidores_select" ON public.surtidores FOR SELECT TO authenticated USING (public.get_my_role() IN ('administrador','despachador'))`,
  `DROP POLICY IF EXISTS "surtidores_admin_insert" ON public.surtidores`,
  `CREATE POLICY "surtidores_admin_insert" ON public.surtidores FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'administrador')`,
  `DROP POLICY IF EXISTS "surtidores_admin_update" ON public.surtidores`,
  `CREATE POLICY "surtidores_admin_update" ON public.surtidores FOR UPDATE TO authenticated USING (public.get_my_role() = 'administrador') WITH CHECK (public.get_my_role() = 'administrador')`,
  `DROP POLICY IF EXISTS "surtidores_admin_delete" ON public.surtidores`,
  `CREATE POLICY "surtidores_admin_delete" ON public.surtidores FOR DELETE TO authenticated USING (public.get_my_role() = 'administrador')`,

  // ventas
  `DROP POLICY IF EXISTS "ventas_select" ON public.ventas`,
  `CREATE POLICY "ventas_select" ON public.ventas FOR SELECT TO authenticated USING (public.get_my_role() IN ('administrador','despachador'))`,
  `DROP POLICY IF EXISTS "ventas_insert" ON public.ventas`,
  `CREATE POLICY "ventas_insert" ON public.ventas FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('administrador','despachador'))`,
  `DROP POLICY IF EXISTS "ventas_admin_update" ON public.ventas`,
  `CREATE POLICY "ventas_admin_update" ON public.ventas FOR UPDATE TO authenticated USING (public.get_my_role() = 'administrador') WITH CHECK (public.get_my_role() = 'administrador')`,
  `DROP POLICY IF EXISTS "ventas_admin_delete" ON public.ventas`,
  `CREATE POLICY "ventas_admin_delete" ON public.ventas FOR DELETE TO authenticated USING (public.get_my_role() = 'administrador')`,

  // alertas
  `DROP POLICY IF EXISTS "alertas_select" ON public.alertas`,
  `CREATE POLICY "alertas_select" ON public.alertas FOR SELECT TO authenticated USING (public.get_my_role() IN ('administrador','despachador'))`,
  `DROP POLICY IF EXISTS "alertas_insert" ON public.alertas`,
  `CREATE POLICY "alertas_insert" ON public.alertas FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('administrador','despachador'))`,
  `DROP POLICY IF EXISTS "alertas_update" ON public.alertas`,
  `CREATE POLICY "alertas_update" ON public.alertas FOR UPDATE TO authenticated USING (public.get_my_role() IN ('administrador','despachador'))`,
  `DROP POLICY IF EXISTS "alertas_admin_delete" ON public.alertas`,
  `CREATE POLICY "alertas_admin_delete" ON public.alertas FOR DELETE TO authenticated USING (public.get_my_role() = 'administrador')`,

  // configuracion
  `DROP POLICY IF EXISTS "config_select" ON public.configuracion`,
  `CREATE POLICY "config_select" ON public.configuracion FOR SELECT TO authenticated USING (public.get_my_role() IN ('administrador','despachador'))`,
  `DROP POLICY IF EXISTS "config_admin_insert" ON public.configuracion`,
  `CREATE POLICY "config_admin_insert" ON public.configuracion FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'administrador')`,
  `DROP POLICY IF EXISTS "config_admin_update" ON public.configuracion`,
  `CREATE POLICY "config_admin_update" ON public.configuracion FOR UPDATE TO authenticated USING (public.get_my_role() = 'administrador') WITH CHECK (public.get_my_role() = 'administrador')`,
  `DROP POLICY IF EXISTS "config_admin_delete" ON public.configuracion`,
  `CREATE POLICY "config_admin_delete" ON public.configuracion FOR DELETE TO authenticated USING (public.get_my_role() = 'administrador')`,
];

// Usuarios a crear
const usersToCreate = [
  { email: 'admin@surtidor.com', password: 'Admin123!', nombre: 'Administrador Principal', rol_id: 1 },
  { email: 'despachador1@surtidor.com', password: 'Despacho123!', nombre: 'Carlos Mendoza', rol_id: 2 },
  { email: 'despachador2@surtidor.com', password: 'Despacho123!', nombre: 'María López', rol_id: 2 },
];

// Datos de ejemplo
const sampleData = [
  // Surtidores
  { table: 'surtidores', data: { numero: 1, tipo_combustible_id: 1, capacidad_total: 5000, nivel_actual: 3750 } },
  { table: 'surtidores', data: { numero: 2, tipo_combustible_id: 2, capacidad_total: 5000, nivel_actual: 2500 } },
  { table: 'surtidores', data: { numero: 3, tipo_combustible_id: 3, capacidad_total: 8000, nivel_actual: 1200 } },
  { table: 'surtidores', data: { numero: 4, tipo_combustible_id: 4, capacidad_total: 3000, nivel_actual: 150 } },
  // Clientes
  { table: 'clientes', data: { nombre: 'Juan Pérez', tipo_documento: 'DNI', numero_documento: '12345678', telefono: '+591 71234567' } },
  { table: 'clientes', data: { nombre: 'Empresa Transportes S.A.', tipo_documento: 'RUC', numero_documento: '20123456789', telefono: '+591 44567890' } },
  { table: 'clientes', data: { nombre: 'Ana García', tipo_documento: 'DNI', numero_documento: '87654321', telefono: '+591 76543210' } },
  // Vehículos
  { table: 'vehiculos', data: { placa: 'ABC-1234', marca: 'Toyota', modelo: 'Hilux', color: 'Blanco' } },
  { table: 'vehiculos', data: { placa: 'XYZ-5678', marca: 'Nissan', modelo: 'Frontier', color: 'Negro' } },
  { table: 'vehiculos', data: { placa: 'DEF-9012', marca: 'Hyundai', modelo: 'Tucson', color: 'Gris' } },
];

async function main() {
  const client = await pool.connect();
  
  try {
    // ==========================================
    // PASO 1: Ejecutar schema SQL
    // ==========================================
    console.log('\n=== PASO 1: Creando tablas ===\n');
    
    for (let i = 0; i < sqlStatements.length; i++) {
      const sql = sqlStatements[i];
      const preview = sql.trim().substring(0, 80).replace(/\n/g, ' ');
      try {
        await client.query(sql);
        console.log(`  ✓ [${i + 1}/${sqlStatements.length}] ${preview}...`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`  ~ [${i + 1}/${sqlStatements.length}] Ya existe: ${preview}...`);
        } else {
          console.error(`  ✗ [${i + 1}/${sqlStatements.length}] Error: ${err.message}`);
          console.error(`    SQL: ${preview}...`);
        }
      }
    }

    // ==========================================
    // PASO 2: Crear políticas RLS
    // ==========================================
    console.log('\n=== PASO 2: Configurando políticas RLS ===\n');
    
    for (let i = 0; i < rlsPolicies.length; i++) {
      const sql = rlsPolicies[i];
      const preview = sql.trim().substring(0, 80).replace(/\n/g, ' ');
      try {
        await client.query(sql);
        if (sql.startsWith('CREATE')) {
          console.log(`  ✓ ${preview}...`);
        }
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`  ~ Ya existe: ${preview}...`);
        } else {
          console.error(`  ✗ Error: ${err.message} -> ${preview}...`);
        }
      }
    }

    client.release();

    // ==========================================
    // PASO 3: Crear usuarios en Supabase Auth
    // ==========================================
    console.log('\n=== PASO 3: Creando usuarios ===\n');
    
    for (const user of usersToCreate) {
      try {
        // Crear en auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true
        });

        if (authError) {
          if (authError.message.includes('already been registered')) {
            console.log(`  ~ Usuario ya existe: ${user.email}`);
            // Obtener el usuario existente
            const { data: { users } } = await supabase.auth.admin.listUsers();
            const existing = users.find(u => u.email === user.email);
            if (existing) {
              // Verificar si tiene perfil
              const { data: perfil } = await supabase
                .from('usuarios')
                .select('id')
                .eq('auth_user_id', existing.id)
                .single();
              
              if (!perfil) {
                const { error: insertError } = await supabase
                  .from('usuarios')
                  .insert({
                    auth_user_id: existing.id,
                    nombre_completo: user.nombre,
                    rol_id: user.rol_id
                  });
                if (!insertError) {
                  console.log(`    ✓ Perfil creado para: ${user.email}`);
                }
              } else {
                console.log(`    ~ Perfil ya existe para: ${user.email}`);
              }
            }
            continue;
          }
          throw authError;
        }

        // Crear perfil en tabla usuarios
        const { error: perfilError } = await supabase
          .from('usuarios')
          .insert({
            auth_user_id: authData.user.id,
            nombre_completo: user.nombre,
            rol_id: user.rol_id
          });

        if (perfilError) {
          console.error(`  ✗ Error creando perfil para ${user.email}: ${perfilError.message}`);
        } else {
          const rol = user.rol_id === 1 ? 'Administrador' : 'Despachador';
          console.log(`  ✓ ${user.email} (${rol}) - Contraseña: ${user.password}`);
        }
      } catch (err) {
        console.error(`  ✗ Error con ${user.email}: ${err.message}`);
      }
    }

    // ==========================================
    // PASO 4: Datos de ejemplo
    // ==========================================
    console.log('\n=== PASO 4: Insertando datos de ejemplo ===\n');
    
    for (const item of sampleData) {
      try {
        const { error } = await supabase.from(item.table).insert(item.data);
        if (error) {
          if (error.message.includes('duplicate') || error.message.includes('unique')) {
            console.log(`  ~ Ya existe en ${item.table}: ${JSON.stringify(item.data).substring(0, 60)}`);
          } else {
            console.error(`  ✗ Error en ${item.table}: ${error.message}`);
          }
        } else {
          console.log(`  ✓ ${item.table}: ${JSON.stringify(item.data).substring(0, 60)}`);
        }
      } catch (err) {
        console.error(`  ✗ Error en ${item.table}: ${err.message}`);
      }
    }

    console.log('\n========================================');
    console.log('  SETUP COMPLETADO');
    console.log('========================================');
    console.log('\n  Credenciales de acceso:');
    console.log('  ─────────────────────────────────');
    console.log('  Admin:');
    console.log('    Email: admin@surtidor.com');
    console.log('    Pass:  Admin123!');
    console.log('  ─────────────────────────────────');
    console.log('  Despachador 1:');
    console.log('    Email: despachador1@surtidor.com');
    console.log('    Pass:  Despacho123!');
    console.log('  ─────────────────────────────────');
    console.log('  Despachador 2:');
    console.log('    Email: despachador2@surtidor.com');
    console.log('    Pass:  Despacho123!');
    console.log('  ─────────────────────────────────\n');

  } catch (err) {
    console.error('Error fatal:', err);
    client.release();
  }

  await pool.end();
  process.exit(0);
}

main();
