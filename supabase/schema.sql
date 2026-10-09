-- ==============================================================================
-- CARTERA PROVEXPRESS S.A.S. - ESQUEMA DE BASE DE DATOS SUPABASE (POSTGRESQL)
-- ==============================================================================
-- Este script crea las tablas necesarias para:
-- 1. Bitácora de Gestiones de Cobranza (Llamadas, visitas, acuerdos)
-- 2. Compromisos de Pago (Fechas y montos prometidos por clientes)
-- 3. Snapshots / Fotos Históricas Diarias de Cartera
-- ==============================================================================

-- 1. TABLA: cartera_gestiones (Bitácora de cobro por factura)
CREATE TABLE IF NOT EXISTS public.cartera_gestiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_numero VARCHAR(64) NOT NULL,           -- Ej: "FVE-12345"
    prefijo VARCHAR(16) DEFAULT '',
    numero BIGINT NOT NULL,
    nit_cliente VARCHAR(32) NOT NULL,
    empresa_cliente VARCHAR(255) NOT NULL,
    tipo_gestion VARCHAR(50) NOT NULL,            -- 'Llamada', 'Correo', 'Compromiso de Pago', 'Visita', 'Cobro Jurídico', etc.
    observacion TEXT NOT NULL,
    fecha_compromiso DATE,                        -- Fecha prometida de pago (si aplica)
    monto_compromiso NUMERIC(16, 2),              -- Monto prometido (si aplica)
    estado_compromiso VARCHAR(30) DEFAULT 'Pendiente', -- 'Pendiente', 'Cumplido', 'Incumplido', 'Cancelado'
    autor_nombre VARCHAR(120) NOT NULL,           -- Nombre del asesor o director que gestionó
    autor_email VARCHAR(120),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para consultas ultra rápidas (< 1ms)
CREATE INDEX IF NOT EXISTS idx_cartera_gestiones_factura ON public.cartera_gestiones (factura_numero);
CREATE INDEX IF NOT EXISTS idx_cartera_gestiones_nit ON public.cartera_gestiones (nit_cliente);
CREATE INDEX IF NOT EXISTS idx_cartera_gestiones_fecha_compromiso ON public.cartera_gestiones (fecha_compromiso);

-- 2. TABLA: cartera_snapshots (Fotos históricas diarias de la cartera para evolución en el tiempo)
CREATE TABLE IF NOT EXISTS public.cartera_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_corte DATE NOT NULL UNIQUE,             -- Una foto por día (YYYY-MM-DD)
    total_saldo NUMERIC(18, 2) NOT NULL,
    total_corriente NUMERIC(18, 2) NOT NULL,
    total_vencido NUMERIC(18, 2) NOT NULL,
    porcentaje_vencido NUMERIC(5, 2) NOT NULL,
    documentos_count INTEGER NOT NULL,
    clientes_count INTEGER NOT NULL,
    resumen_edades JSONB DEFAULT '{}'::jsonb,     -- Distribución de saldo por rango de edad
    resumen_directores JSONB DEFAULT '{}'::jsonb, -- Distribución por Miller, Óscar, Rafael, Angélica, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cartera_snapshots_fecha ON public.cartera_snapshots (fecha_corte DESC);

-- 3. HABILITAR SEGURIDAD POR FILAS (Row Level Security - RLS)
ALTER TABLE public.cartera_gestiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartera_snapshots ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura/escritura pública con Anon Key (puedes restringirlas por usuario autenticado)
CREATE POLICY "Permitir lectura de gestiones a usuarios autorizados"
    ON public.cartera_gestiones FOR SELECT
    USING (true);

CREATE POLICY "Permitir inserción de gestiones a usuarios autorizados"
    ON public.cartera_gestiones FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Permitir actualización de gestiones a usuarios autorizados"
    ON public.cartera_gestiones FOR UPDATE
    USING (true);

CREATE POLICY "Permitir lectura de snapshots históricos"
    ON public.cartera_snapshots FOR SELECT
    USING (true);

CREATE POLICY "Permitir inserción de snapshots históricos"
    ON public.cartera_snapshots FOR INSERT
    WITH CHECK (true);

-- 4. HABILITAR TIEMPO REAL (Supabase Realtime) para actualizaciones en vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.cartera_gestiones;
