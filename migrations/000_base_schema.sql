--
-- PostgreSQL database dump
--

-- \restrict QZy5q19LDixIdhsgutvv19cVwO0pAfZaLRKj49xZby7OF1GKpRjLHyAaPjEIkFU

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: material_request_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.material_request_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: stock_dispatch_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stock_dispatch_status_enum AS ENUM (
    'CREATED',
    'DISPATCHED'
);


--
-- Name: stock_reservation_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stock_reservation_status_enum AS ENUM (
    'BLOCKED',
    'CONFIRMED',
    'RELEASED',
    'CONSUMED',
    'EXPIRED'
);


--
-- Name: audit_material_request_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_material_request_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_actor uuid;
BEGIN

    -- Solo auditar si cambia el estado
    IF OLD.status IS DISTINCT FROM NEW.status THEN

        -- Determinar actor
        IF NEW.status = 'APPROVED'::material_request_status_enum THEN
            v_actor := NEW.approved_by;
        ELSIF NEW.status = 'REJECTED'::material_request_status_enum THEN
            v_actor := NEW.rejected_by;
        ELSE
            v_actor := NEW.requested_by;
        END IF;

        INSERT INTO audit_log (
            id,
            entity,
            entity_id,
            action,
            performed_by,
            created_at
        )
        VALUES (
            gen_random_uuid(),
            'material_requests',
            NEW.id,
            'STATUS_CHANGE',
            v_actor,
            NOW()
        );

    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: auto_reject_expired_material_requests(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_reject_expired_material_requests() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE material_requests
  SET
    status = 'REJECTED',
    approved_at = NOW()
  WHERE
    status = 'PENDING'
    AND sla_due_at < NOW();
END;
$$;


--
-- Name: block_expired_material_requests(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_expired_material_requests() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.status = 'PENDING'
       AND OLD.sla_due_at < NOW()
       AND NEW.status IN ('APPROVED', 'REJECTED') THEN
        RAISE EXCEPTION
            'No se puede decidir una solicitud vencida (SLA expirado)';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: check_material_request_approved(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_material_request_approved() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'APPROVED' THEN
    IF NEW.approved_by IS NULL OR NEW.approved_at IS NULL THEN
      RAISE EXCEPTION 'APPROVED requiere approved_by y approved_at';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: check_material_request_pending(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_material_request_pending() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'PENDING' THEN
    IF NEW.approved_by IS NOT NULL OR NEW.rejected_by IS NOT NULL THEN
      RAISE EXCEPTION 'PENDING no puede tener approved_by ni rejected_by';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: check_material_request_rejected(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_material_request_rejected() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'REJECTED' THEN
    IF NEW.rejected_by IS NULL OR NEW.rejected_at IS NULL THEN
      RAISE EXCEPTION 'REJECTED requiere rejected_by y rejected_at';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_material_request_transitions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_material_request_transitions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN

    -- No se puede decidir algo vencido
    IF OLD.status = 'PENDING'::material_request_status_enum
       AND OLD.sla_due_at < NOW()
    THEN
        RAISE EXCEPTION 'No se puede decidir una solicitud con SLA vencido';
    END IF;

    -- Solo permitir transición PENDING → APPROVED o REJECTED
    IF OLD.status = 'PENDING'::material_request_status_enum
       AND NEW.status NOT IN (
           'APPROVED'::material_request_status_enum,
           'REJECTED'::material_request_status_enum
       )
    THEN
        RAISE EXCEPTION 'Transición de estado no permitida';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


--
-- Name: validate_reservation_request_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_reservation_request_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    request_status TEXT;
BEGIN
    IF NEW.material_request_id IS NOT NULL THEN

        SELECT status INTO request_status
        FROM material_requests
        WHERE id = NEW.material_request_id;

        IF request_status IS NULL THEN
            RAISE EXCEPTION 'Solicitud no existe';
        END IF;

        IF request_status <> 'APPROVED' THEN
            RAISE EXCEPTION 'Solo se puede reservar contra solicitudes APPROVED';
        END IF;

    END IF;

    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: aprobaciones_gerencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aprobaciones_gerencia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo character varying(30) NOT NULL,
    referencia_id uuid NOT NULL,
    titulo character varying(200) NOT NULL,
    descripcion text NOT NULL,
    monto numeric(12,2),
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    solicitado_por uuid NOT NULL,
    notas_gerencia text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: apu_baul_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apu_baul_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    baul_id uuid NOT NULL,
    tipo_recurso text NOT NULL,
    material_id uuid,
    recurso_mo_id uuid,
    descripcion text NOT NULL,
    unidad text DEFAULT 'UND'::text NOT NULL,
    cantidad_base numeric(12,4) DEFAULT 1 NOT NULL,
    precio_unitario numeric(12,2) DEFAULT 0,
    orden integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: apu_baules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apu_baules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    categoria text DEFAULT 'general'::text,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    username text,
    action text NOT NULL,
    endpoint text NOT NULL,
    module text NOT NULL,
    payload jsonb,
    ip_address text,
    created_at timestamp without time zone DEFAULT now(),
    roles text[],
    entity text,
    entity_id uuid,
    old_data jsonb,
    new_data jsonb,
    status text DEFAULT 'SUCCESS'::text,
    error_message text,
    user_agent text,
    method text DEFAULT 'UNKNOWN'::text
);


--
-- Name: branding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branding (
    id integer DEFAULT 1 NOT NULL,
    nombre_producto text,
    eslogan text,
    logo_incluye_nombre boolean DEFAULT true,
    color_primario text,
    color_acento text,
    color_accion text,
    logo_claro_path text,
    logo_oscuro_path text,
    isotipo_path text,
    favicon_path text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT branding_singleton CHECK ((id = 1))
);


--
-- Name: calibration_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calibration_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    calibrated_at date NOT NULL,
    expires_at date NOT NULL,
    certificate_url text,
    technician character varying(200),
    notes text,
    created_by text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: canal_mensajes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canal_mensajes (
    id integer NOT NULL,
    solicitud_id integer NOT NULL,
    user_id uuid,
    mensaje text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: canal_mensajes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.canal_mensajes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: canal_mensajes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.canal_mensajes_id_seq OWNED BY public.canal_mensajes.id;


--
-- Name: canal_solicitudes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canal_solicitudes (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    from_module character varying(50) NOT NULL,
    to_module character varying(50) NOT NULL,
    subject character varying(200) NOT NULL,
    description text,
    priority character varying(20) DEFAULT 'NORMAL'::character varying NOT NULL,
    status character varying(30) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved_at timestamp without time zone,
    assigned_to uuid
);


--
-- Name: canal_solicitudes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.canal_solicitudes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: canal_solicitudes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.canal_solicitudes_id_seq OWNED BY public.canal_solicitudes.id;


--
-- Name: categorias_costo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias_costo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(100) NOT NULL,
    es_directo boolean DEFAULT true NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    color_hex character varying(7) DEFAULT '#4F7C82'::character varying,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: cliente_contactos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_contactos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    nombre character varying(255) NOT NULL,
    cargo character varying(255),
    telefono character varying(255),
    email character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(20) NOT NULL,
    razon_social character varying(200) NOT NULL,
    ruc character varying(15),
    direccion text,
    telefono character varying(50),
    email character varying(200),
    contacto character varying(150),
    cargo_contacto character varying(100),
    activo boolean DEFAULT true NOT NULL,
    notas text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: material_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    alias_name character varying(150) NOT NULL
);


--
-- Name: material_group_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_group_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    material_id uuid NOT NULL,
    quantity numeric(12,4) DEFAULT 1 NOT NULL,
    wear_percentage numeric(5,2) DEFAULT 100 NOT NULL,
    notes text
);


--
-- Name: material_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    category character varying(100) DEFAULT 'General'::character varying NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: material_proveedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_proveedores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    proveedor_id uuid NOT NULL,
    precio_unitario numeric(12,4) NOT NULL,
    moneda character varying(10) DEFAULT 'PEN'::character varying NOT NULL,
    tiempo_entrega_dias integer DEFAULT 1 NOT NULL,
    es_principal boolean DEFAULT false NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: material_request_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_request_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_request_id uuid NOT NULL,
    action text NOT NULL,
    old_status text,
    new_status text,
    actor_id uuid,
    source text DEFAULT 'API'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: material_request_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_request_items (
    id uuid NOT NULL,
    request_id uuid,
    material_id uuid,
    quantity numeric NOT NULL
);


--
-- Name: material_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_requests (
    id uuid NOT NULL,
    requested_by uuid,
    project_id uuid,
    status public.material_request_status_enum,
    priority text,
    needed_by date,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    source character varying(30) DEFAULT 'MANUAL'::character varying NOT NULL,
    related_material_id uuid,
    related_warehouse_id uuid,
    approved_by uuid,
    approved_at timestamp without time zone,
    rejected_by uuid,
    rejected_at timestamp without time zone,
    sla_due_at timestamp without time zone NOT NULL,
    quantity numeric(12,2) NOT NULL,
    reason text NOT NULL,
    project_plan_id uuid,
    CONSTRAINT material_requests_approval_consistency_check CHECK ((((status = 'PENDING'::public.material_request_status_enum) AND (approved_by IS NULL) AND (approved_at IS NULL)) OR ((status = ANY (ARRAY['APPROVED'::public.material_request_status_enum, 'REJECTED'::public.material_request_status_enum])) AND (approved_by IS NOT NULL) AND (approved_at IS NOT NULL)))),
    CONSTRAINT material_requests_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    unit text DEFAULT 'UND'::text,
    created_at timestamp without time zone DEFAULT now(),
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    min_stock numeric(12,2) DEFAULT 0,
    category character varying(50),
    brand character varying(120),
    model character varying(120),
    serial_number character varying(120),
    supplier_name character varying(200),
    supplier_contact character varying(200),
    useful_life_years smallint,
    warranty_expires date,
    purchase_date date,
    validation_status character varying(20) DEFAULT 'VALIDATED'::character varying NOT NULL,
    proposed_by uuid,
    proposed_at timestamp without time zone,
    validated_by uuid,
    validated_at timestamp without time zone,
    logistics_notes text,
    calibration_required boolean DEFAULT false,
    calibration_interval_days integer,
    calibration_cert_url text,
    max_stock numeric(12,2) DEFAULT 0,
    reorder_point numeric(12,2) DEFAULT 0,
    weighted_avg_cost numeric(12,4) DEFAULT 0,
    lot_tracking boolean DEFAULT false,
    qr_code text,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    precio_referencia numeric(12,2),
    propuesto_desde character varying(30),
    cotizacion_origen_id uuid,
    proveedor_referencia text
);


--
-- Name: ordenes_compra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_compra (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    proveedor_id uuid NOT NULL,
    plan_id uuid,
    status character varying(30) DEFAULT 'BORRADOR'::character varying NOT NULL,
    solicitado_por uuid,
    aprobado_por uuid,
    almacen_destino uuid,
    fecha_solicitud timestamp without time zone DEFAULT now() NOT NULL,
    fecha_entrega_est timestamp without time zone,
    fecha_recepcion timestamp without time zone,
    notas text,
    total_estimado numeric(14,2),
    total_real numeric(14,2),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    ot_origen_id uuid
);


--
-- Name: ordenes_compra_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_compra_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    oc_id uuid NOT NULL,
    material_id uuid NOT NULL,
    cantidad_pedida numeric(12,4) NOT NULL,
    precio_unitario numeric(12,4) NOT NULL,
    cantidad_recibida numeric(12,4) DEFAULT 0 NOT NULL,
    stock_movement_id uuid,
    notas text
);


--
-- Name: ordenes_trabajo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_trabajo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    plan_id uuid,
    partida_id uuid,
    titulo character varying(300) NOT NULL,
    descripcion text,
    tipo character varying(50) DEFAULT 'CORRECTIVO'::character varying NOT NULL,
    prioridad character varying(20) DEFAULT 'NORMAL'::character varying NOT NULL,
    status character varying(30) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    asignado_a uuid,
    creado_por uuid,
    fecha_inicio_plan timestamp without time zone,
    fecha_fin_plan timestamp without time zone,
    fecha_inicio_real timestamp without time zone,
    fecha_fin_real timestamp without time zone,
    horas_estimadas numeric(8,2),
    horas_reales numeric(8,2),
    lugar_trabajo character varying(300),
    observaciones text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ot_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ot_checklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ot_id uuid NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    descripcion character varying(300) NOT NULL,
    completado boolean DEFAULT false NOT NULL,
    completado_por uuid,
    completado_at timestamp without time zone,
    notas text
);


--
-- Name: ot_materiales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ot_materiales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ot_id uuid NOT NULL,
    material_id uuid NOT NULL,
    almacen_id uuid,
    cantidad_plan numeric(12,4),
    cantidad_real numeric(12,4) DEFAULT 0 NOT NULL,
    registrado_por uuid,
    stock_movement_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    oc_id uuid
);


--
-- Name: ot_tiempos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ot_tiempos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ot_id uuid NOT NULL,
    tecnico_id uuid,
    inicio timestamp without time zone NOT NULL,
    fin timestamp without time zone,
    horas numeric(6,2),
    notas text
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    code text NOT NULL,
    description text
);


--
-- Name: physical_inventories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.physical_inventories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inv_number character varying(30),
    warehouse_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    status character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    notes text,
    created_by uuid,
    approved_by uuid,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    closed_at timestamp without time zone,
    approved_at timestamp without time zone
);


--
-- Name: physical_inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.physical_inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_id uuid NOT NULL,
    material_id uuid NOT NULL,
    system_quantity numeric(12,2),
    counted_quantity numeric(12,2),
    unit_cost numeric(12,4) DEFAULT 0,
    location_detail text,
    adjusted boolean DEFAULT false,
    notes text,
    counted_by uuid,
    counted_at timestamp without time zone
);


--
-- Name: physical_inventory_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.physical_inventory_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: planificacion_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planificacion_historial (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actividad_id uuid NOT NULL,
    snapshot jsonb NOT NULL,
    guardado_por character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: planificacion_semanal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planificacion_semanal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prioridad character varying(20),
    tarea character varying(500) NOT NULL,
    cliente character varying(200),
    contacto text,
    fecha_solicitud date,
    responsable_id uuid,
    etapa character varying(100),
    estado character varying(50) DEFAULT 'En Progreso'::character varying NOT NULL,
    fecha_limite date,
    seguimiento_id uuid,
    notas text,
    progreso_pct numeric(5,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    responsables_ids text,
    seguimientos_ids text,
    contactos_ids text
);


--
-- Name: planificacion_subtareas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planificacion_subtareas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actividad_id uuid NOT NULL,
    descripcion character varying(500) NOT NULL,
    culminado boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    responsable_id uuid
);


--
-- Name: presupuesto_apu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presupuesto_apu_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partida_id uuid NOT NULL,
    tipo_recurso character varying(20) NOT NULL,
    material_id uuid,
    recurso_mo_id uuid,
    descripcion character varying(200),
    unidad character varying(30),
    cantidad numeric(12,4) DEFAULT 1 NOT NULL,
    precio_unitario numeric(12,4) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: presupuesto_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presupuesto_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    gastos_generales_pct numeric(5,2) DEFAULT 12.00 NOT NULL,
    utilidad_pct numeric(5,2) DEFAULT 10.00 NOT NULL,
    igv_pct numeric(5,2) DEFAULT 18.00 NOT NULL,
    moneda character varying(10) DEFAULT 'PEN'::character varying NOT NULL,
    cliente_nombre character varying(200),
    cliente_ruc character varying(20),
    lugar_trabajo character varying(300),
    plazo_dias integer,
    validez_dias integer DEFAULT 30 NOT NULL,
    notas text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    cliente_id uuid,
    numero_cotizacion character varying(20),
    status character varying(20) DEFAULT 'BORRADOR'::character varying NOT NULL,
    fecha_envio timestamp without time zone,
    fecha_respuesta timestamp without time zone,
    notas_comerciales text,
    contacto_id uuid
);


--
-- Name: presupuesto_partidas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presupuesto_partidas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    codigo character varying(30) NOT NULL,
    descripcion character varying(300) NOT NULL,
    unidad character varying(30) DEFAULT 'GLB'::character varying NOT NULL,
    cantidad numeric(12,3) DEFAULT 1 NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    es_capitulo boolean DEFAULT false NOT NULL,
    parent_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_plan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_plan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    material_id uuid NOT NULL,
    quantity numeric(12,3) DEFAULT 1 NOT NULL,
    wear_percentage numeric(5,2) DEFAULT 100.0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    submission_status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL
);


--
-- Name: project_plan_submission_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_plan_submission_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    plan_item_id uuid NOT NULL,
    material_id uuid NOT NULL,
    material_name character varying(200) NOT NULL,
    material_code character varying(50),
    category character varying(100),
    quantity numeric(12,3) NOT NULL,
    unit_cost numeric(12,2),
    wear_percentage numeric(5,2) DEFAULT 100 NOT NULL,
    stock_available numeric(12,3) DEFAULT 0,
    logistics_status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    approved_quantity numeric(12,3),
    logistics_notes text,
    reviewed_at timestamp without time zone
);


--
-- Name: project_plan_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_plan_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    submission_number integer NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    reason text,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp without time zone,
    reviewed_by uuid,
    logistics_notes text
);


--
-- Name: project_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    engineer_id uuid NOT NULL,
    title character varying(200),
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    custom_project_name character varying(200),
    project_code character varying(50)
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    code character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(200) NOT NULL,
    ruc character varying(15),
    direccion text,
    telefono character varying(50),
    email character varying(200),
    contacto character varying(150),
    tipo character varying(50) DEFAULT 'PROVEEDOR'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid,
    material_name_free text,
    qty_needed numeric DEFAULT 1 NOT NULL,
    unit text,
    project_id uuid,
    source character varying(50) DEFAULT 'MANUAL'::character varying,
    reason text,
    priority character varying(20) DEFAULT 'NORMAL'::character varying,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    supplier_notes text,
    created_by text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: recursos_mo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recursos_mo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(20) NOT NULL,
    descripcion character varying(200) NOT NULL,
    categoria character varying(100) DEFAULT 'Operario'::character varying NOT NULL,
    tarifa_hora numeric(10,2) DEFAULT 0 NOT NULL,
    unidad character varying(20) DEFAULT 'HH'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    issued_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    revoked_at timestamp without time zone,
    replaced_by uuid,
    CONSTRAINT refresh_token_expiration_check CHECK ((expires_at > issued_at))
);


--
-- Name: registro_productividad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registro_productividad (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    actividad character varying(500) NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone,
    duracion_minutos integer,
    estado character varying(10) DEFAULT 'F'::character varying NOT NULL,
    actividad_semanal_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_code text NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL
);


--
-- Name: servicio_requerimiento_costos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio_requerimiento_costos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requerimiento_id uuid NOT NULL,
    categoria character varying(100) NOT NULL,
    descripcion text NOT NULL,
    costo_unitario numeric(12,2) DEFAULT 0.00 NOT NULL,
    cantidad numeric(12,2) DEFAULT 1.00 NOT NULL,
    total numeric(12,2) GENERATED ALWAYS AS ((costo_unitario * cantidad)) STORED,
    detalles jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: servicio_requerimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio_requerimientos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    nombre_servicio character varying(255) NOT NULL,
    descripcion text,
    fecha_inicio date,
    fecha_fin date,
    estado character varying(50) DEFAULT 'Cotizado'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_dispatch_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_dispatch_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dispatch_id uuid NOT NULL,
    material_id uuid NOT NULL,
    item_name text NOT NULL,
    category text NOT NULL,
    quantity numeric NOT NULL,
    unit text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_dispatch_items_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: stock_dispatches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_dispatches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    project_id uuid NOT NULL,
    dispatched_by uuid NOT NULL,
    received_by text NOT NULL,
    dispatched_at timestamp without time zone DEFAULT now() NOT NULL,
    status text NOT NULL,
    file_path text,
    notes text,
    cancelled_at timestamp without time zone,
    cancelled_by uuid,
    cancel_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    recipient_user_id uuid,
    request_id uuid,
    delivered_at timestamp without time zone,
    receipt_notes text,
    recipient_name character varying(200),
    CONSTRAINT stock_dispatches_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'READY'::text, 'IN_TRANSIT'::text, 'DELIVERED'::text, 'CANCELLED'::text])))
);


--
-- Name: stock_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    rack text NOT NULL,
    level text NOT NULL,
    box text NOT NULL,
    "position" text,
    quantity numeric(12,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT check_stock_non_negative CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT stock_locations_quantity_check CHECK ((quantity >= (0)::numeric))
);


--
-- Name: stock_lot_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_lot_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lot_id uuid NOT NULL,
    movement_id uuid,
    quantity numeric(12,2) NOT NULL,
    movement_type text NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_lots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    lot_number character varying(100) NOT NULL,
    warehouse_id uuid,
    quantity numeric(12,2) DEFAULT 0 NOT NULL,
    remaining_quantity numeric(12,2) DEFAULT 0 NOT NULL,
    unit_cost numeric(12,4) DEFAULT 0 NOT NULL,
    expiry_date date,
    manufacture_date date,
    supplier_name character varying(200),
    notes text,
    qr_code text,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    movement_type text NOT NULL,
    quantity numeric(12,2) NOT NULL,
    from_warehouse uuid,
    to_warehouse uuid,
    reference text,
    notes text,
    created_by text,
    created_at timestamp without time zone DEFAULT now(),
    project_id uuid,
    unit_cost numeric(12,4) DEFAULT 0,
    lot_id uuid,
    CONSTRAINT stock_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['IN'::text, 'OUT'::text, 'TRANSFER'::text, 'RETURN'::text, 'ADJUST'::text]))),
    CONSTRAINT stock_movements_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: stock_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid,
    warehouse_id uuid,
    project_id uuid,
    quantity numeric NOT NULL,
    reserved_by uuid,
    status public.stock_reservation_status_enum DEFAULT 'BLOCKED'::public.stock_reservation_status_enum,
    created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone,
    extension_count integer DEFAULT 0 NOT NULL,
    request_id uuid,
    released_at timestamp without time zone,
    material_request_id uuid,
    CONSTRAINT check_reservation_quantity_positive CHECK ((quantity > (0)::numeric)),
    CONSTRAINT chk_stock_reservation_expiration CHECK ((expires_at > created_at))
);


--
-- Name: tarifas_personal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tarifas_personal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rol character varying(100) NOT NULL,
    contexto character varying(30) NOT NULL,
    ubicacion character varying(30) NOT NULL,
    modalidad character varying(10) NOT NULL,
    horas_por_dia integer DEFAULT 8,
    tarifa numeric(10,2) NOT NULL,
    tarifa_hora_extra numeric(10,2),
    moneda character varying(5) DEFAULT 'PEN'::character varying NOT NULL,
    incluye_epp boolean DEFAULT false NOT NULL,
    incluye_herramientas boolean DEFAULT false NOT NULL,
    notas text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tool_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    project_id uuid NOT NULL,
    assigned_to character varying(100),
    assigned_at timestamp without time zone DEFAULT now(),
    expected_return date,
    returned_at timestamp without time zone,
    status character varying(20) DEFAULT 'IN_USE'::character varying,
    condition_out character varying(50),
    condition_in character varying(50),
    return_notes text
);


--
-- Name: tool_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    maintenance_type character varying(50) NOT NULL,
    last_maintenance date NOT NULL,
    next_due date NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    hashed_password text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    username text,
    preferencias jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: visitas_tecnicas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitas_tecnicas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    motivo character varying(500) NOT NULL,
    destino character varying(300) NOT NULL,
    costo_estimado numeric(12,2) DEFAULT 0.00 NOT NULL,
    estado character varying(30) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    creado_por uuid,
    fecha_visita date,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: vw_kpi_material_requests_by_approver; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_kpi_material_requests_by_approver AS
 SELECT approved_by AS approver_id,
    count(*) AS total_decisions,
    count(*) FILTER (WHERE (status = 'APPROVED'::public.material_request_status_enum)) AS approved_count,
    count(*) FILTER (WHERE (status = 'REJECTED'::public.material_request_status_enum)) AS rejected_count,
    round(((100.0 * (count(*) FILTER (WHERE ((status = 'APPROVED'::public.material_request_status_enum) AND ((approved_at <= sla_due_at) OR (sla_due_at IS NULL)))))::numeric) / (NULLIF(count(*), 0))::numeric), 2) AS sla_compliance_rate,
    round(COALESCE(avg((EXTRACT(epoch FROM (COALESCE(approved_at, rejected_at) - created_at)) / (3600)::numeric)), (0)::numeric), 2) AS avg_decision_time_hours
   FROM public.material_requests
  WHERE (approved_by IS NOT NULL)
  GROUP BY approved_by;


--
-- Name: vw_kpi_material_requests_lead_time; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_kpi_material_requests_lead_time AS
 WITH lead AS (
         SELECT (EXTRACT(epoch FROM (COALESCE(material_requests.approved_at, material_requests.rejected_at) - material_requests.created_at)) / (3600)::numeric) AS lead_hours
           FROM public.material_requests
          WHERE ((material_requests.status = ANY (ARRAY['APPROVED'::public.material_request_status_enum, 'REJECTED'::public.material_request_status_enum])) AND (COALESCE(material_requests.approved_at, material_requests.rejected_at) IS NOT NULL))
        )
 SELECT round(COALESCE(avg(lead_hours), (0)::numeric), 2) AS avg_lead_time_hours,
    round(COALESCE(min(lead_hours), (0)::numeric), 2) AS min_lead_time_hours,
    round(COALESCE(max(lead_hours), (0)::numeric), 2) AS max_lead_time_hours,
    round((COALESCE(percentile_cont((0.95)::double precision) WITHIN GROUP (ORDER BY ((lead_hours)::double precision)), (0)::double precision))::numeric, 2) AS p95_lead_time_hours
   FROM lead;


--
-- Name: vw_kpi_material_requests_monthly; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_kpi_material_requests_monthly AS
 SELECT date_trunc('month'::text, created_at) AS month,
    count(*) AS total_requests,
    count(*) FILTER (WHERE (status = 'APPROVED'::public.material_request_status_enum)) AS approved_requests,
    count(*) FILTER (WHERE (status = 'REJECTED'::public.material_request_status_enum)) AS rejected_requests,
    count(*) FILTER (WHERE (status = 'PENDING'::public.material_request_status_enum)) AS pending_requests,
    count(*) FILTER (WHERE ((status = 'PENDING'::public.material_request_status_enum) AND (sla_due_at <= now()))) AS overdue_requests,
    round(((100.0 * (count(*) FILTER (WHERE ((status = ANY (ARRAY['APPROVED'::public.material_request_status_enum, 'REJECTED'::public.material_request_status_enum])) AND (COALESCE(approved_at, rejected_at) <= sla_due_at))))::numeric) / (NULLIF(count(*) FILTER (WHERE (status = ANY (ARRAY['APPROVED'::public.material_request_status_enum, 'REJECTED'::public.material_request_status_enum]))), 0))::numeric), 2) AS sla_compliance_rate
   FROM public.material_requests
  GROUP BY (date_trunc('month'::text, created_at));


--
-- Name: vw_kpi_material_requests_sla; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_kpi_material_requests_sla AS
 WITH decided AS (
         SELECT material_requests.id,
            COALESCE(material_requests.approved_at, material_requests.rejected_at) AS decided_at,
            material_requests.sla_due_at,
            (EXTRACT(epoch FROM (COALESCE(material_requests.approved_at, material_requests.rejected_at) - material_requests.created_at)) / (3600)::numeric) AS decision_hours
           FROM public.material_requests
          WHERE ((material_requests.status = ANY (ARRAY['APPROVED'::public.material_request_status_enum, 'REJECTED'::public.material_request_status_enum])) AND (COALESCE(material_requests.approved_at, material_requests.rejected_at) IS NOT NULL))
        )
 SELECT count(*) AS total_decided_requests,
    count(*) FILTER (WHERE ((decided_at <= sla_due_at) OR (sla_due_at IS NULL))) AS within_sla,
    count(*) FILTER (WHERE (decided_at > sla_due_at)) AS overdue,
    round(((100.0 * (count(*) FILTER (WHERE ((decided_at <= sla_due_at) OR (sla_due_at IS NULL))))::numeric) / (NULLIF(count(*), 0))::numeric), 2) AS sla_compliance_rate,
    round(COALESCE(avg(decision_hours), (0)::numeric), 2) AS avg_decision_time_hours
   FROM decided;


--
-- Name: vw_kpi_material_requests_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_kpi_material_requests_summary AS
 SELECT count(*) AS total_requests,
    count(*) FILTER (WHERE (status = 'PENDING'::public.material_request_status_enum)) AS pending_requests,
    count(*) FILTER (WHERE (status = 'APPROVED'::public.material_request_status_enum)) AS approved_requests,
    count(*) FILTER (WHERE (status = 'REJECTED'::public.material_request_status_enum)) AS rejected_requests,
    count(*) FILTER (WHERE ((status = 'PENDING'::public.material_request_status_enum) AND (sla_due_at <= now()))) AS overdue_requests
   FROM public.material_requests;


--
-- Name: vw_material_requests_operational; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_material_requests_operational AS
 SELECT id,
    requested_by,
    related_material_id,
    quantity,
    reason,
    status,
    priority,
        CASE
            WHEN (((status)::text = 'PENDING'::text) AND (sla_due_at <= now())) THEN 'VENCIDO'::text
            WHEN (((status)::text = 'PENDING'::text) AND ((EXTRACT(epoch FROM ((sla_due_at)::timestamp with time zone - now())) / (3600)::numeric) < (24)::numeric)) THEN 'URGENTE'::text
            WHEN ((status)::text = 'PENDING'::text) THEN 'NORMAL'::text
            ELSE (status)::text
        END AS operational_status,
        CASE
            WHEN (sla_due_at IS NOT NULL) THEN (EXTRACT(epoch FROM ((sla_due_at)::timestamp with time zone - now())) / (3600)::numeric)
            ELSE NULL::numeric
        END AS hours_to_sla,
    created_at,
    sla_due_at
   FROM public.material_requests mr;


--
-- Name: vw_requests_kpi_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_requests_kpi_summary AS
 SELECT count(mr.id) AS total_requests,
    count(mr.id) FILTER (WHERE (mr.status = 'PENDING'::public.material_request_status_enum)) AS pending_requests,
    count(mr.id) FILTER (WHERE (mr.status = 'APPROVED'::public.material_request_status_enum)) AS approved_requests,
    count(mr.id) FILTER (WHERE (mr.status = 'REJECTED'::public.material_request_status_enum)) AS rejected_requests,
    count(DISTINCT sr.material_request_id) AS requests_with_reservation,
    (count(mr.id) - count(DISTINCT sr.material_request_id)) AS requests_without_reservation
   FROM (public.material_requests mr
     LEFT JOIN public.stock_reservations sr ON (((sr.material_request_id = mr.id) AND (sr.status <> ALL (ARRAY['RELEASED'::public.stock_reservation_status_enum, 'EXPIRED'::public.stock_reservation_status_enum])))));


--
-- Name: vw_stock_availability; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_stock_availability AS
 WITH movements AS (
         SELECT stock_movements.material_id,
            stock_movements.to_warehouse AS warehouse_id,
            stock_movements.quantity AS delta
           FROM public.stock_movements
          WHERE ((stock_movements.movement_type = 'IN'::text) AND (stock_movements.to_warehouse IS NOT NULL))
        UNION ALL
         SELECT stock_movements.material_id,
            stock_movements.to_warehouse AS warehouse_id,
            stock_movements.quantity AS delta
           FROM public.stock_movements
          WHERE ((stock_movements.movement_type = 'RETURN'::text) AND (stock_movements.to_warehouse IS NOT NULL))
        UNION ALL
         SELECT stock_movements.material_id,
            stock_movements.from_warehouse AS warehouse_id,
            (- stock_movements.quantity) AS delta
           FROM public.stock_movements
          WHERE ((stock_movements.movement_type = 'OUT'::text) AND (stock_movements.from_warehouse IS NOT NULL))
        UNION ALL
         SELECT stock_movements.material_id,
            stock_movements.from_warehouse AS warehouse_id,
            (- stock_movements.quantity) AS delta
           FROM public.stock_movements
          WHERE ((stock_movements.movement_type = 'TRANSFER'::text) AND (stock_movements.from_warehouse IS NOT NULL))
        UNION ALL
         SELECT stock_movements.material_id,
            stock_movements.to_warehouse AS warehouse_id,
            stock_movements.quantity AS delta
           FROM public.stock_movements
          WHERE ((stock_movements.movement_type = 'TRANSFER'::text) AND (stock_movements.to_warehouse IS NOT NULL))
        UNION ALL
         SELECT stock_movements.material_id,
            stock_movements.to_warehouse AS warehouse_id,
            stock_movements.quantity AS delta
           FROM public.stock_movements
          WHERE ((stock_movements.movement_type = 'ADJUST'::text) AND (stock_movements.to_warehouse IS NOT NULL))
        UNION ALL
         SELECT stock_movements.material_id,
            stock_movements.from_warehouse AS warehouse_id,
            (- stock_movements.quantity) AS delta
           FROM public.stock_movements
          WHERE ((stock_movements.movement_type = 'ADJUST'::text) AND (stock_movements.from_warehouse IS NOT NULL) AND (stock_movements.to_warehouse IS NULL))
        ), physical AS (
         SELECT movements.material_id,
            movements.warehouse_id,
            sum(movements.delta) AS physical_qty
           FROM movements
          GROUP BY movements.material_id, movements.warehouse_id
        ), reserved AS (
         SELECT stock_reservations.material_id,
            stock_reservations.warehouse_id,
            sum(stock_reservations.quantity) AS reserved_qty
           FROM public.stock_reservations
          WHERE (stock_reservations.status = ANY (ARRAY['BLOCKED'::public.stock_reservation_status_enum, 'CONFIRMED'::public.stock_reservation_status_enum]))
          GROUP BY stock_reservations.material_id, stock_reservations.warehouse_id
        )
 SELECT p.material_id,
    p.warehouse_id,
    GREATEST((0)::numeric, (p.physical_qty - COALESCE(r.reserved_qty, (0)::numeric))) AS stock_available
   FROM (physical p
     LEFT JOIN reserved r ON (((r.material_id = p.material_id) AND (r.warehouse_id = p.warehouse_id))));


--
-- Name: warehouse_transfer_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_transfer_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transfer_id uuid NOT NULL,
    material_id uuid NOT NULL,
    quantity_requested numeric(12,2) NOT NULL,
    quantity_sent numeric(12,2),
    quantity_received numeric(12,2),
    unit_cost numeric(12,4) DEFAULT 0,
    notes text
);


--
-- Name: warehouse_transfer_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehouse_transfer_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warehouse_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transfer_number character varying(30),
    from_warehouse_id uuid NOT NULL,
    to_warehouse_id uuid NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    notes text,
    requested_by uuid,
    approved_by uuid,
    received_by uuid,
    requested_at timestamp without time zone DEFAULT now() NOT NULL,
    approved_at timestamp without time zone,
    received_at timestamp without time zone,
    CONSTRAINT warehouse_transfers_check CHECK ((from_warehouse_id <> to_warehouse_id))
);


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text,
    created_at timestamp without time zone DEFAULT now(),
    code character varying(50)
);


--
-- Name: canal_mensajes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canal_mensajes ALTER COLUMN id SET DEFAULT nextval('public.canal_mensajes_id_seq'::regclass);


--
-- Name: canal_solicitudes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canal_solicitudes ALTER COLUMN id SET DEFAULT nextval('public.canal_solicitudes_id_seq'::regclass);


--
-- Name: aprobaciones_gerencia aprobaciones_gerencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aprobaciones_gerencia
    ADD CONSTRAINT aprobaciones_gerencia_pkey PRIMARY KEY (id);


--
-- Name: apu_baul_items apu_baul_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apu_baul_items
    ADD CONSTRAINT apu_baul_items_pkey PRIMARY KEY (id);


--
-- Name: apu_baules apu_baules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apu_baules
    ADD CONSTRAINT apu_baules_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: branding branding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branding
    ADD CONSTRAINT branding_pkey PRIMARY KEY (id);


--
-- Name: calibration_records calibration_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calibration_records
    ADD CONSTRAINT calibration_records_pkey PRIMARY KEY (id);


--
-- Name: canal_mensajes canal_mensajes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canal_mensajes
    ADD CONSTRAINT canal_mensajes_pkey PRIMARY KEY (id);


--
-- Name: canal_solicitudes canal_solicitudes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canal_solicitudes
    ADD CONSTRAINT canal_solicitudes_code_key UNIQUE (code);


--
-- Name: canal_solicitudes canal_solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canal_solicitudes
    ADD CONSTRAINT canal_solicitudes_pkey PRIMARY KEY (id);


--
-- Name: categorias_costo categorias_costo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_costo
    ADD CONSTRAINT categorias_costo_codigo_key UNIQUE (codigo);


--
-- Name: categorias_costo categorias_costo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_costo
    ADD CONSTRAINT categorias_costo_pkey PRIMARY KEY (id);


--
-- Name: cliente_contactos cliente_contactos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_contactos
    ADD CONSTRAINT cliente_contactos_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_codigo_key UNIQUE (codigo);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: material_aliases material_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_aliases
    ADD CONSTRAINT material_aliases_pkey PRIMARY KEY (id);


--
-- Name: material_group_items material_group_items_group_id_material_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_group_items
    ADD CONSTRAINT material_group_items_group_id_material_id_key UNIQUE (group_id, material_id);


--
-- Name: material_group_items material_group_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_group_items
    ADD CONSTRAINT material_group_items_pkey PRIMARY KEY (id);


--
-- Name: material_groups material_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_groups
    ADD CONSTRAINT material_groups_pkey PRIMARY KEY (id);


--
-- Name: material_proveedores material_proveedores_material_id_proveedor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_proveedores
    ADD CONSTRAINT material_proveedores_material_id_proveedor_id_key UNIQUE (material_id, proveedor_id);


--
-- Name: material_proveedores material_proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_proveedores
    ADD CONSTRAINT material_proveedores_pkey PRIMARY KEY (id);


--
-- Name: material_request_audit material_request_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_audit
    ADD CONSTRAINT material_request_audit_pkey PRIMARY KEY (id);


--
-- Name: material_request_items material_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_items
    ADD CONSTRAINT material_request_items_pkey PRIMARY KEY (id);


--
-- Name: material_requests material_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_pkey PRIMARY KEY (id);


--
-- Name: materials materials_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_code_key UNIQUE (code);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: ordenes_compra ordenes_compra_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_code_key UNIQUE (code);


--
-- Name: ordenes_compra_items ordenes_compra_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra_items
    ADD CONSTRAINT ordenes_compra_items_pkey PRIMARY KEY (id);


--
-- Name: ordenes_compra ordenes_compra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_pkey PRIMARY KEY (id);


--
-- Name: ordenes_trabajo ordenes_trabajo_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_code_key UNIQUE (code);


--
-- Name: ordenes_trabajo ordenes_trabajo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_pkey PRIMARY KEY (id);


--
-- Name: ot_checklist ot_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_checklist
    ADD CONSTRAINT ot_checklist_pkey PRIMARY KEY (id);


--
-- Name: ot_materiales ot_materiales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_materiales
    ADD CONSTRAINT ot_materiales_pkey PRIMARY KEY (id);


--
-- Name: ot_tiempos ot_tiempos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_tiempos
    ADD CONSTRAINT ot_tiempos_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (code);


--
-- Name: physical_inventories physical_inventories_inv_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.physical_inventories
    ADD CONSTRAINT physical_inventories_inv_number_key UNIQUE (inv_number);


--
-- Name: physical_inventories physical_inventories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.physical_inventories
    ADD CONSTRAINT physical_inventories_pkey PRIMARY KEY (id);


--
-- Name: physical_inventory_items physical_inventory_items_inventory_id_material_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.physical_inventory_items
    ADD CONSTRAINT physical_inventory_items_inventory_id_material_id_key UNIQUE (inventory_id, material_id);


--
-- Name: physical_inventory_items physical_inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.physical_inventory_items
    ADD CONSTRAINT physical_inventory_items_pkey PRIMARY KEY (id);


--
-- Name: planificacion_historial planificacion_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_historial
    ADD CONSTRAINT planificacion_historial_pkey PRIMARY KEY (id);


--
-- Name: planificacion_semanal planificacion_semanal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_semanal
    ADD CONSTRAINT planificacion_semanal_pkey PRIMARY KEY (id);


--
-- Name: planificacion_subtareas planificacion_subtareas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_subtareas
    ADD CONSTRAINT planificacion_subtareas_pkey PRIMARY KEY (id);


--
-- Name: presupuesto_apu_items presupuesto_apu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_apu_items
    ADD CONSTRAINT presupuesto_apu_items_pkey PRIMARY KEY (id);


--
-- Name: presupuesto_config presupuesto_config_numero_cotizacion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_config
    ADD CONSTRAINT presupuesto_config_numero_cotizacion_key UNIQUE (numero_cotizacion);


--
-- Name: presupuesto_config presupuesto_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_config
    ADD CONSTRAINT presupuesto_config_pkey PRIMARY KEY (id);


--
-- Name: presupuesto_config presupuesto_config_plan_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_config
    ADD CONSTRAINT presupuesto_config_plan_id_key UNIQUE (plan_id);


--
-- Name: presupuesto_partidas presupuesto_partidas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_partidas
    ADD CONSTRAINT presupuesto_partidas_pkey PRIMARY KEY (id);


--
-- Name: project_plan_items project_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plan_items
    ADD CONSTRAINT project_plan_items_pkey PRIMARY KEY (id);


--
-- Name: project_plan_items project_plan_items_plan_id_material_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plan_items
    ADD CONSTRAINT project_plan_items_plan_id_material_id_key UNIQUE (plan_id, material_id);


--
-- Name: project_plan_submission_items project_plan_submission_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plan_submission_items
    ADD CONSTRAINT project_plan_submission_items_pkey PRIMARY KEY (id);


--
-- Name: project_plan_submissions project_plan_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plan_submissions
    ADD CONSTRAINT project_plan_submissions_pkey PRIMARY KEY (id);


--
-- Name: project_plan_submissions project_plan_submissions_plan_id_submission_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plan_submissions
    ADD CONSTRAINT project_plan_submissions_plan_id_submission_number_key UNIQUE (plan_id, submission_number);


--
-- Name: project_plans project_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plans
    ADD CONSTRAINT project_plans_pkey PRIMARY KEY (id);


--
-- Name: projects projects_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_code_key UNIQUE (code);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: proveedores proveedores_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_codigo_key UNIQUE (codigo);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: proveedores proveedores_ruc_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_ruc_key UNIQUE (ruc);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: recursos_mo recursos_mo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recursos_mo
    ADD CONSTRAINT recursos_mo_codigo_key UNIQUE (codigo);


--
-- Name: recursos_mo recursos_mo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recursos_mo
    ADD CONSTRAINT recursos_mo_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: registro_productividad registro_productividad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_productividad
    ADD CONSTRAINT registro_productividad_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_code);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: servicio_requerimiento_costos servicio_requerimiento_costos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_requerimiento_costos
    ADD CONSTRAINT servicio_requerimiento_costos_pkey PRIMARY KEY (id);


--
-- Name: servicio_requerimientos servicio_requerimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_requerimientos
    ADD CONSTRAINT servicio_requerimientos_pkey PRIMARY KEY (id);


--
-- Name: stock_dispatch_items stock_dispatch_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_dispatch_items
    ADD CONSTRAINT stock_dispatch_items_pkey PRIMARY KEY (id);


--
-- Name: stock_dispatches stock_dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_dispatches
    ADD CONSTRAINT stock_dispatches_pkey PRIMARY KEY (id);


--
-- Name: stock_locations stock_locations_material_id_warehouse_id_rack_level_box_pos_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_locations
    ADD CONSTRAINT stock_locations_material_id_warehouse_id_rack_level_box_pos_key UNIQUE (material_id, warehouse_id, rack, level, box, "position");


--
-- Name: stock_locations stock_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_locations
    ADD CONSTRAINT stock_locations_pkey PRIMARY KEY (id);


--
-- Name: stock_lot_movements stock_lot_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_lot_movements
    ADD CONSTRAINT stock_lot_movements_pkey PRIMARY KEY (id);


--
-- Name: stock_lots stock_lots_material_id_lot_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_lots
    ADD CONSTRAINT stock_lots_material_id_lot_number_key UNIQUE (material_id, lot_number);


--
-- Name: stock_lots stock_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_lots
    ADD CONSTRAINT stock_lots_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock_reservations stock_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_pkey PRIMARY KEY (id);


--
-- Name: tarifas_personal tarifas_personal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarifas_personal
    ADD CONSTRAINT tarifas_personal_pkey PRIMARY KEY (id);


--
-- Name: tool_assignments tool_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_assignments
    ADD CONSTRAINT tool_assignments_pkey PRIMARY KEY (id);


--
-- Name: tool_maintenance tool_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_maintenance
    ADD CONSTRAINT tool_maintenance_pkey PRIMARY KEY (id);


--
-- Name: stock_dispatches uq_dispatch_reservation; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_dispatches
    ADD CONSTRAINT uq_dispatch_reservation UNIQUE (reservation_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: visitas_tecnicas visitas_tecnicas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas_tecnicas
    ADD CONSTRAINT visitas_tecnicas_pkey PRIMARY KEY (id);


--
-- Name: warehouse_transfer_items warehouse_transfer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfer_items
    ADD CONSTRAINT warehouse_transfer_items_pkey PRIMARY KEY (id);


--
-- Name: warehouse_transfers warehouse_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfers
    ADD CONSTRAINT warehouse_transfers_pkey PRIMARY KEY (id);


--
-- Name: warehouse_transfers warehouse_transfers_transfer_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfers
    ADD CONSTRAINT warehouse_transfers_transfer_number_key UNIQUE (transfer_number);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: idx_aprobaciones_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aprobaciones_estado ON public.aprobaciones_gerencia USING btree (estado);


--
-- Name: idx_aprobaciones_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aprobaciones_ref ON public.aprobaciones_gerencia USING btree (referencia_id);


--
-- Name: idx_aprobaciones_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aprobaciones_tipo ON public.aprobaciones_gerencia USING btree (tipo);


--
-- Name: idx_apu_partida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apu_partida ON public.presupuesto_apu_items USING btree (partida_id);


--
-- Name: idx_apu_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apu_tipo ON public.presupuesto_apu_items USING btree (tipo_recurso);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity, entity_id);


--
-- Name: idx_audit_logs_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_module ON public.audit_logs USING btree (module);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_calibration_records_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calibration_records_expires ON public.calibration_records USING btree (expires_at);


--
-- Name: idx_calibration_records_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calibration_records_material ON public.calibration_records USING btree (material_id);


--
-- Name: idx_canal_msg_sol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canal_msg_sol ON public.canal_mensajes USING btree (solicitud_id);


--
-- Name: idx_canal_sol_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canal_sol_from ON public.canal_solicitudes USING btree (from_module);


--
-- Name: idx_canal_sol_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canal_sol_status ON public.canal_solicitudes USING btree (status);


--
-- Name: idx_canal_sol_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canal_sol_to ON public.canal_solicitudes USING btree (to_module);


--
-- Name: idx_clientes_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_activo ON public.clientes USING btree (activo);


--
-- Name: idx_clientes_ruc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_ruc ON public.clientes USING btree (ruc);


--
-- Name: idx_lot_movements_lot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lot_movements_lot ON public.stock_lot_movements USING btree (lot_id);


--
-- Name: idx_mat_prov_mat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mat_prov_mat ON public.material_proveedores USING btree (material_id);


--
-- Name: idx_mat_prov_prov; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mat_prov_prov ON public.material_proveedores USING btree (proveedor_id);


--
-- Name: idx_material_group_items_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_group_items_group ON public.material_group_items USING btree (group_id);


--
-- Name: idx_material_groups_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_groups_category ON public.material_groups USING btree (category);


--
-- Name: idx_material_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_requests_created_at ON public.material_requests USING btree (created_at);


--
-- Name: idx_material_requests_sla_due_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_requests_sla_due_at ON public.material_requests USING btree (sla_due_at);


--
-- Name: idx_material_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_requests_status ON public.material_requests USING btree (status);


--
-- Name: idx_material_requests_status_sla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_requests_status_sla ON public.material_requests USING btree (status, sla_due_at);


--
-- Name: idx_materials_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_estado ON public.materials USING btree (estado);


--
-- Name: idx_oc_items_oc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oc_items_oc ON public.ordenes_compra_items USING btree (oc_id);


--
-- Name: idx_oc_ot_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oc_ot_origen ON public.ordenes_compra USING btree (ot_origen_id) WHERE (ot_origen_id IS NOT NULL);


--
-- Name: idx_oc_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oc_plan ON public.ordenes_compra USING btree (plan_id);


--
-- Name: idx_oc_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oc_proveedor ON public.ordenes_compra USING btree (proveedor_id);


--
-- Name: idx_oc_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oc_status ON public.ordenes_compra USING btree (status);


--
-- Name: idx_ot_asignado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_asignado ON public.ordenes_trabajo USING btree (asignado_a);


--
-- Name: idx_ot_check_ot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_check_ot ON public.ot_checklist USING btree (ot_id);


--
-- Name: idx_ot_mat_oc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_mat_oc ON public.ot_materiales USING btree (oc_id) WHERE (oc_id IS NOT NULL);


--
-- Name: idx_ot_mat_ot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_mat_ot ON public.ot_materiales USING btree (ot_id);


--
-- Name: idx_ot_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_plan ON public.ordenes_trabajo USING btree (plan_id);


--
-- Name: idx_ot_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_status ON public.ordenes_trabajo USING btree (status);


--
-- Name: idx_ot_time_ot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_time_ot ON public.ot_tiempos USING btree (ot_id);


--
-- Name: idx_partidas_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partidas_parent ON public.presupuesto_partidas USING btree (parent_id);


--
-- Name: idx_partidas_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partidas_plan ON public.presupuesto_partidas USING btree (plan_id);


--
-- Name: idx_phys_inv_items; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_phys_inv_items ON public.physical_inventory_items USING btree (inventory_id);


--
-- Name: idx_phys_inv_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_phys_inv_warehouse ON public.physical_inventories USING btree (warehouse_id);


--
-- Name: idx_plan_historial_actividad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_historial_actividad ON public.planificacion_historial USING btree (actividad_id);


--
-- Name: idx_plan_items_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_items_material ON public.project_plan_items USING btree (material_id);


--
-- Name: idx_plan_items_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_items_plan ON public.project_plan_items USING btree (plan_id);


--
-- Name: idx_plan_sem_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_sem_estado ON public.planificacion_semanal USING btree (estado);


--
-- Name: idx_plan_sem_fecha_lim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_sem_fecha_lim ON public.planificacion_semanal USING btree (fecha_limite);


--
-- Name: idx_plan_sem_responsable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_sem_responsable ON public.planificacion_semanal USING btree (responsable_id);


--
-- Name: idx_plan_sub_actividad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_sub_actividad ON public.planificacion_subtareas USING btree (actividad_id);


--
-- Name: idx_presupuesto_config_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presupuesto_config_cliente ON public.presupuesto_config USING btree (cliente_id);


--
-- Name: idx_presupuesto_config_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presupuesto_config_status ON public.presupuesto_config USING btree (status);


--
-- Name: idx_prod_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prod_fecha ON public.registro_productividad USING btree (fecha);


--
-- Name: idx_prod_user_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prod_user_fecha ON public.registro_productividad USING btree (user_id, fecha);


--
-- Name: idx_project_plans_engineer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_plans_engineer ON public.project_plans USING btree (engineer_id);


--
-- Name: idx_project_plans_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_plans_project ON public.project_plans USING btree (project_id);


--
-- Name: idx_project_plans_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_plans_status ON public.project_plans USING btree (status);


--
-- Name: idx_purchase_items_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_material ON public.purchase_items USING btree (material_id);


--
-- Name: idx_purchase_items_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_project ON public.purchase_items USING btree (project_id);


--
-- Name: idx_purchase_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_status ON public.purchase_items USING btree (status);


--
-- Name: idx_recursos_mo_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recursos_mo_activo ON public.recursos_mo USING btree (activo);


--
-- Name: idx_recursos_mo_cod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recursos_mo_cod ON public.recursos_mo USING btree (codigo);


--
-- Name: idx_refresh_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_expires ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_servicio_requerimiento_costos_req; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_requerimiento_costos_req ON public.servicio_requerimiento_costos USING btree (requerimiento_id);


--
-- Name: idx_servicio_requerimientos_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_requerimientos_cliente ON public.servicio_requerimientos USING btree (cliente_id);


--
-- Name: idx_stock_dispatches_reservation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_dispatches_reservation ON public.stock_dispatches USING btree (reservation_id);


--
-- Name: idx_stock_locations_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_locations_material ON public.stock_locations USING btree (material_id);


--
-- Name: idx_stock_lots_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_lots_material ON public.stock_lots USING btree (material_id);


--
-- Name: idx_stock_lots_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_lots_status ON public.stock_lots USING btree (status);


--
-- Name: idx_stock_lots_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_lots_warehouse ON public.stock_lots USING btree (warehouse_id);


--
-- Name: idx_stock_movements_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_material ON public.stock_movements USING btree (material_id);


--
-- Name: idx_stock_reservations_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_reservations_expires ON public.stock_reservations USING btree (expires_at) WHERE (status = 'BLOCKED'::public.stock_reservation_status_enum);


--
-- Name: idx_stock_reservations_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_reservations_request ON public.stock_reservations USING btree (request_id);


--
-- Name: idx_stock_reservations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_reservations_status ON public.stock_reservations USING btree (status);


--
-- Name: idx_tarifas_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarifas_activo ON public.tarifas_personal USING btree (activo);


--
-- Name: idx_tarifas_contexto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarifas_contexto ON public.tarifas_personal USING btree (contexto);


--
-- Name: idx_tarifas_rol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarifas_rol ON public.tarifas_personal USING btree (rol);


--
-- Name: idx_tarifas_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tarifas_unico ON public.tarifas_personal USING btree (rol, contexto, ubicacion, modalidad) WHERE (activo = true);


--
-- Name: idx_transfers_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfers_from ON public.warehouse_transfers USING btree (from_warehouse_id);


--
-- Name: idx_transfers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfers_status ON public.warehouse_transfers USING btree (status);


--
-- Name: idx_transfers_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfers_to ON public.warehouse_transfers USING btree (to_warehouse_id);


--
-- Name: idx_visitas_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitas_estado ON public.visitas_tecnicas USING btree (estado);


--
-- Name: idx_visitas_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitas_plan ON public.visitas_tecnicas USING btree (plan_id);


--
-- Name: uq_active_reservation_per_request; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_active_reservation_per_request ON public.stock_reservations USING btree (material_request_id) WHERE (status = ANY (ARRAY['BLOCKED'::public.stock_reservation_status_enum, 'CONFIRMED'::public.stock_reservation_status_enum]));


--
-- Name: material_requests trg_block_expired_material_requests; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_block_expired_material_requests BEFORE UPDATE ON public.material_requests FOR EACH ROW EXECUTE FUNCTION public.block_expired_material_requests();


--
-- Name: material_requests trg_material_request_transitions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_material_request_transitions BEFORE UPDATE ON public.material_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_material_request_transitions();


--
-- Name: material_requests trg_material_requests_approved; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_material_requests_approved BEFORE UPDATE ON public.material_requests FOR EACH ROW EXECUTE FUNCTION public.check_material_request_approved();


--
-- Name: material_requests trg_material_requests_pending; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_material_requests_pending BEFORE UPDATE ON public.material_requests FOR EACH ROW EXECUTE FUNCTION public.check_material_request_pending();


--
-- Name: material_requests trg_material_requests_rejected; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_material_requests_rejected BEFORE UPDATE ON public.material_requests FOR EACH ROW EXECUTE FUNCTION public.check_material_request_rejected();


--
-- Name: stock_locations trg_update_stock_locations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_stock_locations BEFORE UPDATE ON public.stock_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: stock_reservations trg_validate_reservation_request; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_reservation_request BEFORE INSERT ON public.stock_reservations FOR EACH ROW EXECUTE FUNCTION public.validate_reservation_request_status();


--
-- Name: aprobaciones_gerencia aprobaciones_gerencia_solicitado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aprobaciones_gerencia
    ADD CONSTRAINT aprobaciones_gerencia_solicitado_por_fkey FOREIGN KEY (solicitado_por) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: apu_baul_items apu_baul_items_baul_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apu_baul_items
    ADD CONSTRAINT apu_baul_items_baul_id_fkey FOREIGN KEY (baul_id) REFERENCES public.apu_baules(id) ON DELETE CASCADE;


--
-- Name: apu_baul_items apu_baul_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apu_baul_items
    ADD CONSTRAINT apu_baul_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE SET NULL;


--
-- Name: apu_baul_items apu_baul_items_recurso_mo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apu_baul_items
    ADD CONSTRAINT apu_baul_items_recurso_mo_id_fkey FOREIGN KEY (recurso_mo_id) REFERENCES public.recursos_mo(id) ON DELETE SET NULL;


--
-- Name: calibration_records calibration_records_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calibration_records
    ADD CONSTRAINT calibration_records_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- Name: canal_mensajes canal_mensajes_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canal_mensajes
    ADD CONSTRAINT canal_mensajes_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.canal_solicitudes(id) ON DELETE CASCADE;


--
-- Name: canal_mensajes canal_mensajes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canal_mensajes
    ADD CONSTRAINT canal_mensajes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: canal_solicitudes canal_solicitudes_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canal_solicitudes
    ADD CONSTRAINT canal_solicitudes_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: canal_solicitudes canal_solicitudes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canal_solicitudes
    ADD CONSTRAINT canal_solicitudes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cliente_contactos cliente_contactos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_contactos
    ADD CONSTRAINT cliente_contactos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- Name: material_request_audit fk_material_request_audit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_audit
    ADD CONSTRAINT fk_material_request_audit FOREIGN KEY (material_request_id) REFERENCES public.material_requests(id) ON DELETE CASCADE;


--
-- Name: stock_reservations fk_reservation_material_request; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT fk_reservation_material_request FOREIGN KEY (material_request_id) REFERENCES public.material_requests(id) ON DELETE RESTRICT;


--
-- Name: stock_movements fk_stock_movements_lot; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk_stock_movements_lot FOREIGN KEY (lot_id) REFERENCES public.stock_lots(id);


--
-- Name: stock_movements fk_stock_movements_project; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk_stock_movements_project FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: stock_reservations fk_stock_reservations_request; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT fk_stock_reservations_request FOREIGN KEY (request_id) REFERENCES public.material_requests(id);


--
-- Name: material_aliases material_aliases_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_aliases
    ADD CONSTRAINT material_aliases_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- Name: material_group_items material_group_items_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_group_items
    ADD CONSTRAINT material_group_items_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.material_groups(id) ON DELETE CASCADE;


--
-- Name: material_group_items material_group_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_group_items
    ADD CONSTRAINT material_group_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- Name: material_groups material_groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_groups
    ADD CONSTRAINT material_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: material_proveedores material_proveedores_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_proveedores
    ADD CONSTRAINT material_proveedores_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- Name: material_proveedores material_proveedores_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_proveedores
    ADD CONSTRAINT material_proveedores_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE CASCADE;


--
-- Name: material_request_items material_request_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_items
    ADD CONSTRAINT material_request_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: material_request_items material_request_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_items
    ADD CONSTRAINT material_request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.material_requests(id);


--
-- Name: material_requests material_requests_project_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_project_plan_id_fkey FOREIGN KEY (project_plan_id) REFERENCES public.project_plans(id);


--
-- Name: material_requests material_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: materials materials_proposed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES public.users(id);


--
-- Name: materials materials_validated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.users(id);


--
-- Name: ordenes_compra ordenes_compra_almacen_destino_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_almacen_destino_fkey FOREIGN KEY (almacen_destino) REFERENCES public.warehouses(id);


--
-- Name: ordenes_compra ordenes_compra_aprobado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES public.users(id);


--
-- Name: ordenes_compra_items ordenes_compra_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra_items
    ADD CONSTRAINT ordenes_compra_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: ordenes_compra_items ordenes_compra_items_oc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra_items
    ADD CONSTRAINT ordenes_compra_items_oc_id_fkey FOREIGN KEY (oc_id) REFERENCES public.ordenes_compra(id) ON DELETE CASCADE;


--
-- Name: ordenes_compra ordenes_compra_ot_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_ot_origen_id_fkey FOREIGN KEY (ot_origen_id) REFERENCES public.ordenes_trabajo(id);


--
-- Name: ordenes_compra ordenes_compra_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.project_plans(id);


--
-- Name: ordenes_compra ordenes_compra_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: ordenes_compra ordenes_compra_solicitado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_solicitado_por_fkey FOREIGN KEY (solicitado_por) REFERENCES public.users(id);


--
-- Name: ordenes_trabajo ordenes_trabajo_asignado_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_asignado_a_fkey FOREIGN KEY (asignado_a) REFERENCES public.users(id);


--
-- Name: ordenes_trabajo ordenes_trabajo_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.users(id);


--
-- Name: ordenes_trabajo ordenes_trabajo_partida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_partida_id_fkey FOREIGN KEY (partida_id) REFERENCES public.presupuesto_partidas(id);


--
-- Name: ordenes_trabajo ordenes_trabajo_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.project_plans(id);


--
-- Name: ot_checklist ot_checklist_completado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_checklist
    ADD CONSTRAINT ot_checklist_completado_por_fkey FOREIGN KEY (completado_por) REFERENCES public.users(id);


--
-- Name: ot_checklist ot_checklist_ot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_checklist
    ADD CONSTRAINT ot_checklist_ot_id_fkey FOREIGN KEY (ot_id) REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE;


--
-- Name: ot_materiales ot_materiales_almacen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_materiales
    ADD CONSTRAINT ot_materiales_almacen_id_fkey FOREIGN KEY (almacen_id) REFERENCES public.warehouses(id);


--
-- Name: ot_materiales ot_materiales_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_materiales
    ADD CONSTRAINT ot_materiales_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: ot_materiales ot_materiales_oc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_materiales
    ADD CONSTRAINT ot_materiales_oc_id_fkey FOREIGN KEY (oc_id) REFERENCES public.ordenes_compra(id);


--
-- Name: ot_materiales ot_materiales_ot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_materiales
    ADD CONSTRAINT ot_materiales_ot_id_fkey FOREIGN KEY (ot_id) REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE;


--
-- Name: ot_materiales ot_materiales_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_materiales
    ADD CONSTRAINT ot_materiales_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.users(id);


--
-- Name: ot_tiempos ot_tiempos_ot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_tiempos
    ADD CONSTRAINT ot_tiempos_ot_id_fkey FOREIGN KEY (ot_id) REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE;


--
-- Name: ot_tiempos ot_tiempos_tecnico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_tiempos
    ADD CONSTRAINT ot_tiempos_tecnico_id_fkey FOREIGN KEY (tecnico_id) REFERENCES public.users(id);


--
-- Name: physical_inventories physical_inventories_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.physical_inventories
    ADD CONSTRAINT physical_inventories_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: physical_inventories physical_inventories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.physical_inventories
    ADD CONSTRAINT physical_inventories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: physical_inventories physical_inventories_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.physical_inventories
    ADD CONSTRAINT physical_inventories_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: physical_inventory_items physical_inventory_items_counted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.physical_inventory_items
    ADD CONSTRAINT physical_inventory_items_counted_by_fkey FOREIGN KEY (counted_by) REFERENCES public.users(id);


--
-- Name: physical_inventory_items physical_inventory_items_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.physical_inventory_items
    ADD CONSTRAINT physical_inventory_items_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.physical_inventories(id) ON DELETE CASCADE;


--
-- Name: physical_inventory_items physical_inventory_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.physical_inventory_items
    ADD CONSTRAINT physical_inventory_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: planificacion_historial planificacion_historial_actividad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_historial
    ADD CONSTRAINT planificacion_historial_actividad_id_fkey FOREIGN KEY (actividad_id) REFERENCES public.planificacion_semanal(id) ON DELETE CASCADE;


--
-- Name: planificacion_semanal planificacion_semanal_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_semanal
    ADD CONSTRAINT planificacion_semanal_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: planificacion_semanal planificacion_semanal_seguimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_semanal
    ADD CONSTRAINT planificacion_semanal_seguimiento_id_fkey FOREIGN KEY (seguimiento_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: planificacion_subtareas planificacion_subtareas_actividad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_subtareas
    ADD CONSTRAINT planificacion_subtareas_actividad_id_fkey FOREIGN KEY (actividad_id) REFERENCES public.planificacion_semanal(id) ON DELETE CASCADE;


--
-- Name: planificacion_subtareas planificacion_subtareas_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_subtareas
    ADD CONSTRAINT planificacion_subtareas_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: presupuesto_apu_items presupuesto_apu_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_apu_items
    ADD CONSTRAINT presupuesto_apu_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: presupuesto_apu_items presupuesto_apu_items_partida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_apu_items
    ADD CONSTRAINT presupuesto_apu_items_partida_id_fkey FOREIGN KEY (partida_id) REFERENCES public.presupuesto_partidas(id) ON DELETE CASCADE;


--
-- Name: presupuesto_apu_items presupuesto_apu_items_recurso_mo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_apu_items
    ADD CONSTRAINT presupuesto_apu_items_recurso_mo_id_fkey FOREIGN KEY (recurso_mo_id) REFERENCES public.recursos_mo(id);


--
-- Name: presupuesto_config presupuesto_config_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_config
    ADD CONSTRAINT presupuesto_config_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: presupuesto_config presupuesto_config_contacto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_config
    ADD CONSTRAINT presupuesto_config_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES public.cliente_contactos(id) ON DELETE SET NULL;


--
-- Name: presupuesto_config presupuesto_config_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_config
    ADD CONSTRAINT presupuesto_config_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.project_plans(id) ON DELETE CASCADE;


--
-- Name: presupuesto_partidas presupuesto_partidas_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_partidas
    ADD CONSTRAINT presupuesto_partidas_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.presupuesto_partidas(id);


--
-- Name: presupuesto_partidas presupuesto_partidas_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuesto_partidas
    ADD CONSTRAINT presupuesto_partidas_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.project_plans(id) ON DELETE CASCADE;


--
-- Name: project_plan_items project_plan_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plan_items
    ADD CONSTRAINT project_plan_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: project_plan_items project_plan_items_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plan_items
    ADD CONSTRAINT project_plan_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.project_plans(id) ON DELETE CASCADE;


--
-- Name: project_plan_submission_items project_plan_submission_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plan_submission_items
    ADD CONSTRAINT project_plan_submission_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: project_plan_submission_items project_plan_submission_items_plan_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plan_submission_items
    ADD CONSTRAINT project_plan_submission_items_plan_item_id_fkey FOREIGN KEY (plan_item_id) REFERENCES public.project_plan_items(id);


--
-- Name: project_plan_submission_items project_plan_submission_items_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plan_submission_items
    ADD CONSTRAINT project_plan_submission_items_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.project_plan_submissions(id) ON DELETE CASCADE;


--
-- Name: project_plan_submissions project_plan_submissions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plan_submissions
    ADD CONSTRAINT project_plan_submissions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.project_plans(id) ON DELETE CASCADE;


--
-- Name: project_plan_submissions project_plan_submissions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plan_submissions
    ADD CONSTRAINT project_plan_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: project_plans project_plans_engineer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plans
    ADD CONSTRAINT project_plans_engineer_id_fkey FOREIGN KEY (engineer_id) REFERENCES public.users(id);


--
-- Name: project_plans project_plans_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plans
    ADD CONSTRAINT project_plans_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: purchase_items purchase_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: purchase_items purchase_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: registro_productividad registro_productividad_actividad_semanal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_productividad
    ADD CONSTRAINT registro_productividad_actividad_semanal_id_fkey FOREIGN KEY (actividad_semanal_id) REFERENCES public.planificacion_semanal(id) ON DELETE SET NULL;


--
-- Name: registro_productividad registro_productividad_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_productividad
    ADD CONSTRAINT registro_productividad_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_code_fkey FOREIGN KEY (permission_code) REFERENCES public.permissions(code);


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: servicio_requerimiento_costos servicio_requerimiento_costos_requerimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_requerimiento_costos
    ADD CONSTRAINT servicio_requerimiento_costos_requerimiento_id_fkey FOREIGN KEY (requerimiento_id) REFERENCES public.servicio_requerimientos(id) ON DELETE CASCADE;


--
-- Name: servicio_requerimientos servicio_requerimientos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_requerimientos
    ADD CONSTRAINT servicio_requerimientos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- Name: stock_dispatch_items stock_dispatch_items_dispatch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_dispatch_items
    ADD CONSTRAINT stock_dispatch_items_dispatch_id_fkey FOREIGN KEY (dispatch_id) REFERENCES public.stock_dispatches(id) ON DELETE CASCADE;


--
-- Name: stock_dispatch_items stock_dispatch_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_dispatch_items
    ADD CONSTRAINT stock_dispatch_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: stock_dispatches stock_dispatches_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_dispatches
    ADD CONSTRAINT stock_dispatches_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id);


--
-- Name: stock_dispatches stock_dispatches_dispatched_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_dispatches
    ADD CONSTRAINT stock_dispatches_dispatched_by_fkey FOREIGN KEY (dispatched_by) REFERENCES public.users(id);


--
-- Name: stock_dispatches stock_dispatches_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_dispatches
    ADD CONSTRAINT stock_dispatches_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: stock_dispatches stock_dispatches_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_dispatches
    ADD CONSTRAINT stock_dispatches_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id);


--
-- Name: stock_dispatches stock_dispatches_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_dispatches
    ADD CONSTRAINT stock_dispatches_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.material_requests(id);


--
-- Name: stock_dispatches stock_dispatches_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_dispatches
    ADD CONSTRAINT stock_dispatches_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.stock_reservations(id);


--
-- Name: stock_dispatches stock_dispatches_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_dispatches
    ADD CONSTRAINT stock_dispatches_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: stock_locations stock_locations_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_locations
    ADD CONSTRAINT stock_locations_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- Name: stock_locations stock_locations_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_locations
    ADD CONSTRAINT stock_locations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: stock_lot_movements stock_lot_movements_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_lot_movements
    ADD CONSTRAINT stock_lot_movements_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.stock_lots(id) ON DELETE CASCADE;


--
-- Name: stock_lot_movements stock_lot_movements_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_lot_movements
    ADD CONSTRAINT stock_lot_movements_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.stock_movements(id);


--
-- Name: stock_lots stock_lots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_lots
    ADD CONSTRAINT stock_lots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_lots stock_lots_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_lots
    ADD CONSTRAINT stock_lots_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- Name: stock_lots stock_lots_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_lots
    ADD CONSTRAINT stock_lots_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: stock_movements stock_movements_from_warehouse_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_from_warehouse_fkey FOREIGN KEY (from_warehouse) REFERENCES public.warehouses(id);


--
-- Name: stock_movements stock_movements_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: stock_movements stock_movements_to_warehouse_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_to_warehouse_fkey FOREIGN KEY (to_warehouse) REFERENCES public.warehouses(id);


--
-- Name: stock_reservations stock_reservations_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: stock_reservations stock_reservations_reserved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_reserved_by_fkey FOREIGN KEY (reserved_by) REFERENCES public.users(id);


--
-- Name: stock_reservations stock_reservations_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: visitas_tecnicas visitas_tecnicas_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas_tecnicas
    ADD CONSTRAINT visitas_tecnicas_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: visitas_tecnicas visitas_tecnicas_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas_tecnicas
    ADD CONSTRAINT visitas_tecnicas_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.project_plans(id) ON DELETE CASCADE;


--
-- Name: warehouse_transfer_items warehouse_transfer_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfer_items
    ADD CONSTRAINT warehouse_transfer_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: warehouse_transfer_items warehouse_transfer_items_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfer_items
    ADD CONSTRAINT warehouse_transfer_items_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.warehouse_transfers(id) ON DELETE CASCADE;


--
-- Name: warehouse_transfers warehouse_transfers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfers
    ADD CONSTRAINT warehouse_transfers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: warehouse_transfers warehouse_transfers_from_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfers
    ADD CONSTRAINT warehouse_transfers_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: warehouse_transfers warehouse_transfers_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfers
    ADD CONSTRAINT warehouse_transfers_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: warehouse_transfers warehouse_transfers_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfers
    ADD CONSTRAINT warehouse_transfers_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: warehouse_transfers warehouse_transfers_to_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_transfers
    ADD CONSTRAINT warehouse_transfers_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES public.warehouses(id);


--
-- PostgreSQL database dump complete
--

-- \unrestrict QZy5q19LDixIdhsgutvv19cVwO0pAfZaLRKj49xZby7OF1GKpRjLHyAaPjEIkFU

