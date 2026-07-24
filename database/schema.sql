-- ============================================================
-- EXTENSIÓN Y TABLAS PRINCIPALES (orden correcto para FK)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Roles de usuario
CREATE TABLE public.roles (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE CHECK (nombre IN ('administrador', 'despachador')),
    descripcion TEXT
);

INSERT INTO public.roles (nombre, descripcion) VALUES
('administrador', 'Acceso total al sistema'),
('despachador', 'Registro de ventas y consulta de inventario');

-- 2. Usuarios (perfil extendido vinculado a auth.users de Supabase)
CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_completo TEXT NOT NULL,
    rol_id INT NOT NULL REFERENCES public.roles(id),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Vehículos
CREATE TABLE public.vehiculos (
    id SERIAL PRIMARY KEY,
    placa TEXT UNIQUE NOT NULL,
    marca TEXT,
    modelo TEXT,
    color TEXT,
    activo BOOLEAN NOT NULL DEFAULT true
);

-- 4. Clientes
CREATE TABLE public.clientes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo_documento TEXT NOT NULL CHECK (tipo_documento IN ('DNI', 'RUC', 'Pasaporte', 'Otro')),
    numero_documento TEXT UNIQUE NOT NULL,
    telefono TEXT,
    activo BOOLEAN NOT NULL DEFAULT true
);

-- 5. Tipos de combustible
CREATE TABLE public.tipos_combustible (
    id SERIAL PRIMARY KEY,
    codigo_binario CHAR(2) UNIQUE NOT NULL CHECK (codigo_binario IN ('00','01','10','11')),
    nombre TEXT NOT NULL,
    precio_por_litro NUMERIC(10,2) NOT NULL CHECK (precio_por_litro > 0),
    activo BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.tipos_combustible (codigo_binario, nombre, precio_por_litro) VALUES
('00', 'Gasolina Especial', 3.74),
('01', 'Gasolina Premium', 4.10),
('10', 'Diésel', 3.50),
('11', 'GNV', 1.80);

-- 6. Surtidores
CREATE TABLE public.surtidores (
    id SERIAL PRIMARY KEY,
    numero INTEGER UNIQUE NOT NULL CHECK (numero > 0),
    tipo_combustible_id INT NOT NULL REFERENCES public.tipos_combustible(id),
    capacidad_total NUMERIC(10,2) NOT NULL CHECK (capacidad_total > 0),
    nivel_actual NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (nivel_actual >= 0),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Ventas
CREATE TABLE public.ventas (
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
);

-- 8. Registro de alertas
CREATE TABLE public.alertas (
    id SERIAL PRIMARY KEY,
    surtidor_id INT NOT NULL REFERENCES public.surtidores(id),
    tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN ('bajo', 'critico')),
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atendida BOOLEAN NOT NULL DEFAULT false,
    usuario_atendio UUID REFERENCES public.usuarios(id)
);

-- 9. Configuración (umbrales)
CREATE TABLE public.configuracion (
    id SERIAL PRIMARY KEY,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL
);

INSERT INTO public.configuracion (clave, valor) VALUES
('umbral_bajo_porcentaje', '25'),
('umbral_critico_porcentaje', '5');

-- ============================================================
-- FUNCIÓN AUXILIAR PARA RLS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT r.nombre
  FROM public.usuarios u
  JOIN public.roles r ON u.rol_id = r.id
  WHERE u.auth_user_id = auth.uid();
$$;

-- ============================================================
-- HABILITAR RLS
-- ============================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_combustible ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surtidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS POR TABLA
-- ============================================================

-- roles
CREATE POLICY "roles_select" ON public.roles FOR SELECT TO authenticated USING (true);

-- usuarios
CREATE POLICY "usuarios_select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'administrador' OR auth_user_id = auth.uid());

CREATE POLICY "usuarios_admin_insert" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'administrador');

CREATE POLICY "usuarios_admin_update" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'administrador')
  WITH CHECK (public.get_my_role() = 'administrador');

CREATE POLICY "usuarios_admin_delete" ON public.usuarios
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'administrador');

-- vehiculos
CREATE POLICY "vehiculos_select" ON public.vehiculos
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('administrador','despachador'));

CREATE POLICY "vehiculos_insert" ON public.vehiculos
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() IN ('administrador','despachador'));

CREATE POLICY "vehiculos_admin_update" ON public.vehiculos
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'administrador')
  WITH CHECK (public.get_my_role() = 'administrador');

CREATE POLICY "vehiculos_admin_delete" ON public.vehiculos
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'administrador');

-- clientes
CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('administrador','despachador'));

CREATE POLICY "clientes_insert" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() IN ('administrador','despachador'));

CREATE POLICY "clientes_admin_update" ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'administrador')
  WITH CHECK (public.get_my_role() = 'administrador');

CREATE POLICY "clientes_admin_delete" ON public.clientes
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'administrador');

-- tipos_combustible
CREATE POLICY "tipos_comb_select" ON public.tipos_combustible
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('administrador','despachador'));

CREATE POLICY "tipos_comb_admin_insert" ON public.tipos_combustible
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'administrador');

CREATE POLICY "tipos_comb_admin_update" ON public.tipos_combustible
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'administrador')
  WITH CHECK (public.get_my_role() = 'administrador');

CREATE POLICY "tipos_comb_admin_delete" ON public.tipos_combustible
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'administrador');

-- surtidores
CREATE POLICY "surtidores_select" ON public.surtidores
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('administrador','despachador'));

CREATE POLICY "surtidores_admin_insert" ON public.surtidores
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'administrador');

CREATE POLICY "surtidores_admin_update" ON public.surtidores
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'administrador')
  WITH CHECK (public.get_my_role() = 'administrador');

CREATE POLICY "surtidores_admin_delete" ON public.surtidores
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'administrador');

-- ventas
CREATE POLICY "ventas_select" ON public.ventas
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('administrador','despachador'));

CREATE POLICY "ventas_insert" ON public.ventas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() IN ('administrador','despachador')
  );

CREATE POLICY "ventas_admin_update" ON public.ventas
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'administrador')
  WITH CHECK (public.get_my_role() = 'administrador');

CREATE POLICY "ventas_admin_delete" ON public.ventas
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'administrador');

-- alertas
CREATE POLICY "alertas_select" ON public.alertas
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('administrador','despachador'));

CREATE POLICY "alertas_admin_insert" ON public.alertas
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'administrador');

CREATE POLICY "alertas_update" ON public.alertas
  FOR UPDATE TO authenticated
  USING (public.get_my_role() IN ('administrador','despachador'));

CREATE POLICY "alertas_admin_delete" ON public.alertas
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'administrador');

-- configuracion
CREATE POLICY "config_select" ON public.configuracion
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('administrador','despachador'));

CREATE POLICY "config_admin_insert" ON public.configuracion
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'administrador');

CREATE POLICY "config_admin_update" ON public.configuracion
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'administrador')
  WITH CHECK (public.get_my_role() = 'administrador');

CREATE POLICY "config_admin_delete" ON public.configuracion
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'administrador');
