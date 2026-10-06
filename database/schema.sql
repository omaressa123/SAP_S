--
-- PostgreSQL database dump
--

\restrict PkWZWZEGYUu2ptJey1PL14GToX9r9mx3UvDTNzkKjkiODOcI6XS5EgkMAjyS5h7

-- Dumped from database version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: airline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.airline (
    airline_id integer NOT NULL,
    name character varying,
    iata_code character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: airline_airline_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.airline_airline_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: airline_airline_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.airline_airline_id_seq OWNED BY public.airline.airline_id;


--
-- Name: airport; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.airport (
    airport_id integer NOT NULL,
    iata_code character varying,
    city character varying,
    country_code character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: airport_airport_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.airport_airport_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: airport_airport_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.airport_airport_id_seq OWNED BY public.airport.airport_id;


--
-- Name: auditlog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditlog (
    audit_id integer NOT NULL,
    user_account_id integer,
    action character varying,
    entity_type character varying,
    entity_id integer,
    ip_address character varying,
    "timestamp" timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: auditlog_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditlog_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditlog_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditlog_audit_id_seq OWNED BY public.auditlog.audit_id;


--
-- Name: bag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bag (
    bag_id integer NOT NULL,
    booking_id integer,
    passenger_id integer,
    checkin_id integer,
    rfid_tag character varying,
    qr_code character varying,
    weight_kg numeric(5,2),
    length_cm___width_cm___height_cm numeric(5,2),
    excess_charge numeric(8,2),
    current_status character varying,
    current_location character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: bag_bag_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bag_bag_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bag_bag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bag_bag_id_seq OWNED BY public.bag.bag_id;


--
-- Name: bagcheckpointlog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bagcheckpointlog (
    checkpoint_log_id integer NOT NULL,
    bag_id integer,
    checkpoint_type character varying,
    equipment_id integer,
    location character varying,
    "timestamp" timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: bagcheckpointlog_checkpoint_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bagcheckpointlog_checkpoint_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bagcheckpointlog_checkpoint_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bagcheckpointlog_checkpoint_log_id_seq OWNED BY public.bagcheckpointlog.checkpoint_log_id;


--
-- Name: baggageinspection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.baggageinspection (
    inspection_id integer NOT NULL,
    bag_id integer,
    equipment_id integer,
    scan_time timestamp without time zone,
    ai_model_version character varying,
    result character varying,
    reviewed_by_staff_id integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: baggageinspection_inspection_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.baggageinspection_inspection_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: baggageinspection_inspection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.baggageinspection_inspection_id_seq OWNED BY public.baggageinspection.inspection_id;


--
-- Name: boardinggate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boardinggate (
    boarding_gate_id integer NOT NULL,
    gate_number character varying,
    zone_id integer,
    equipment_id integer,
    status character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: boardinggate_boarding_gate_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.boardinggate_boarding_gate_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: boardinggate_boarding_gate_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.boardinggate_boarding_gate_id_seq OWNED BY public.boardinggate.boarding_gate_id;


--
-- Name: boardinglog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boardinglog (
    boarding_id integer NOT NULL,
    passenger_id integer,
    flight_id integer,
    boarding_gate_id integer,
    verification_id integer,
    boarding_status character varying,
    "timestamp" timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: boardinglog_boarding_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.boardinglog_boarding_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: boardinglog_boarding_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.boardinglog_boarding_id_seq OWNED BY public.boardinglog.boarding_id;


--
-- Name: booking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking (
    booking_id integer NOT NULL,
    passenger_id integer,
    flight_id integer,
    booking_reference character varying,
    seat_number character varying,
    booking_class character varying,
    booking_status character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: booking_booking_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.booking_booking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: booking_booking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.booking_booking_id_seq OWNED BY public.booking.booking_id;


--
-- Name: camera; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.camera (
    camera_id integer NOT NULL,
    location character varying,
    zone_id integer,
    camera_type character varying,
    equipment_id integer,
    status character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: camera_camera_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.camera_camera_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: camera_camera_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.camera_camera_id_seq OWNED BY public.camera.camera_id;


--
-- Name: checkinrecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkinrecord (
    checkin_id integer NOT NULL,
    booking_id integer,
    passenger_id integer,
    equipment_id integer,
    checkin_time timestamp without time zone,
    updated_at timestamp without time zone,
    created_at timestamp without time zone
);


--
-- Name: checkinrecord_checkin_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checkinrecord_checkin_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: checkinrecord_checkin_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checkinrecord_checkin_id_seq OWNED BY public.checkinrecord.checkin_id;


--
-- Name: country; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country (
    country_code character varying NOT NULL,
    country_name character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department (
    department_id integer NOT NULL,
    department_name character varying,
    description character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: department_department_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.department_department_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: department_department_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.department_department_id_seq OWNED BY public.department.department_id;


--
-- Name: detecteditem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detecteditem (
    item_id integer NOT NULL,
    inspection_id integer,
    item_type character varying,
    confidence_score numeric(5,2),
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: detecteditem_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.detecteditem_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detecteditem_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.detecteditem_item_id_seq OWNED BY public.detecteditem.item_id;


--
-- Name: digitaltwinposition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.digitaltwinposition (
    position_id integer NOT NULL,
    entity_type character varying,
    entity_id integer,
    x_coord numeric(8,2),
    y_coord numeric(8,2),
    z_coord numeric(8,2),
    "timestamp" timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: digitaltwinposition_position_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.digitaltwinposition_position_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: digitaltwinposition_position_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.digitaltwinposition_position_id_seq OWNED BY public.digitaltwinposition.position_id;


--
-- Name: emergencyevent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergencyevent (
    event_id integer NOT NULL,
    event_type character varying,
    zone_id integer,
    notified_staff_id integer,
    status character varying,
    detected_time timestamp without time zone,
    resolved_time timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: emergencyevent_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emergencyevent_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emergencyevent_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emergencyevent_event_id_seq OWNED BY public.emergencyevent.event_id;


--
-- Name: energyconsumptionlog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.energyconsumptionlog (
    log_id integer NOT NULL,
    zone_id integer,
    equipment_id integer,
    source_id integer,
    "timestamp" timestamp without time zone,
    kwh_consumed numeric(8,3),
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: energyconsumptionlog_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.energyconsumptionlog_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: energyconsumptionlog_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.energyconsumptionlog_log_id_seq OWNED BY public.energyconsumptionlog.log_id;


--
-- Name: energygenerationlog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.energygenerationlog (
    log_id integer NOT NULL,
    installation_id integer,
    "timestamp" timestamp without time zone,
    kwh_generated numeric(8,3),
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: energygenerationlog_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.energygenerationlog_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: energygenerationlog_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.energygenerationlog_log_id_seq OWNED BY public.energygenerationlog.log_id;


--
-- Name: energystorage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.energystorage (
    battery_id integer NOT NULL,
    installation_id integer,
    capacity_kwh numeric(8,2),
    current_charge_pct numeric(5,2),
    status character varying,
    last_updated timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: energystorage_battery_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.energystorage_battery_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: energystorage_battery_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.energystorage_battery_id_seq OWNED BY public.energystorage.battery_id;


--
-- Name: equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment (
    equipment_id integer NOT NULL,
    equipment_type character varying,
    label character varying,
    serial_number character varying,
    model character varying,
    zone_id integer,
    install_date date,
    firmware_version character varying,
    status character varying,
    last_health_check timestamp without time zone,
    updated_at timestamp without time zone,
    created_at timestamp without time zone
);


--
-- Name: equipment_equipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipment_equipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_equipment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipment_equipment_id_seq OWNED BY public.equipment.equipment_id;


--
-- Name: equipmenthealthcheck; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipmenthealthcheck (
    check_id integer NOT NULL,
    equipment_id integer,
    check_time timestamp without time zone,
    metric_type character varying,
    value numeric(8,2),
    status_result character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: equipmenthealthcheck_check_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipmenthealthcheck_check_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipmenthealthcheck_check_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipmenthealthcheck_check_id_seq OWNED BY public.equipmenthealthcheck.check_id;


--
-- Name: faceenrollment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faceenrollment (
    enrollment_id integer NOT NULL,
    passenger_id integer,
    document_id integer,
    equipment_id integer,
    face_embedding_ref character varying,
    embedding_model character varying,
    enrollment_time timestamp without time zone,
    status character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: faceenrollment_enrollment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.faceenrollment_enrollment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: faceenrollment_enrollment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.faceenrollment_enrollment_id_seq OWNED BY public.faceenrollment.enrollment_id;


--
-- Name: faceverificationlog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faceverificationlog (
    verification_id integer NOT NULL,
    passenger_id integer,
    enrollment_id integer,
    equipment_id integer,
    checkpoint_type character varying,
    cosine_similarity numeric(6,4),
    match_threshold numeric(6,4),
    verification_status character varying,
    "timestamp" timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: faceverificationlog_verification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.faceverificationlog_verification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: faceverificationlog_verification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.faceverificationlog_verification_id_seq OWNED BY public.faceverificationlog.verification_id;


--
-- Name: flight; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flight (
    flight_id integer NOT NULL,
    flight_number character varying,
    airline_id integer,
    origin_airport_id integer,
    destination_airport_id integer,
    scheduled_departure timestamp without time zone,
    actual_departure timestamp without time zone,
    boarding_gate_id integer,
    status character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: flight_flight_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.flight_flight_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flight_flight_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.flight_flight_id_seq OWNED BY public.flight.flight_id;


--
-- Name: k9unit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.k9unit (
    k9_id integer NOT NULL,
    dog_name character varying,
    breed character varying,
    specialty character varying,
    handler_staff_id integer,
    status character varying,
    certification_expiry date,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: k9unit_k9_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.k9unit_k9_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: k9unit_k9_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.k9unit_k9_id_seq OWNED BY public.k9unit.k9_id;


--
-- Name: mapedge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mapedge (
    edge_id integer NOT NULL,
    from_node_id integer,
    to_node_id integer,
    distance_m numeric(6,2),
    walk_time_sec integer,
    is_accessible boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: mapedge_edge_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mapedge_edge_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mapedge_edge_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mapedge_edge_id_seq OWNED BY public.mapedge.edge_id;


--
-- Name: mapnode; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mapnode (
    node_id integer NOT NULL,
    zone_id integer,
    node_type character varying,
    label character varying,
    x_coord numeric(8,2),
    y_coord numeric(8,2),
    linked_entity_type character varying,
    linked_entity_id integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: mapnode_node_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mapnode_node_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mapnode_node_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mapnode_node_id_seq OWNED BY public.mapnode.node_id;


--
-- Name: monitoringalert; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monitoringalert (
    alert_id integer NOT NULL,
    camera_id integer,
    zone_id integer,
    behavior_type character varying,
    severity character varying,
    status character varying,
    linked_emergency_event_id integer,
    resolved_by_staff_id integer,
    "timestamp" timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: monitoringalert_alert_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.monitoringalert_alert_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: monitoringalert_alert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.monitoringalert_alert_id_seq OWNED BY public.monitoringalert.alert_id;


--
-- Name: notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification (
    notification_id integer NOT NULL,
    passenger_id integer,
    staff_id integer,
    channel character varying,
    notification_type character varying,
    content character varying,
    related_entity_type character varying,
    related_entity_id integer,
    sent_at timestamp without time zone,
    read_at timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: notification_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_notification_id_seq OWNED BY public.notification.notification_id;


--
-- Name: passenger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passenger (
    passenger_id integer NOT NULL,
    full_name character varying,
    date_of_birth date,
    nationality_country_code character varying,
    phone character varying,
    email character varying,
    password_hash character varying NOT NULL,
    biometric_consent boolean,
    consent_date timestamp without time zone,
    is_active boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: passenger_passenger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.passenger_passenger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: passenger_passenger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.passenger_passenger_id_seq OWNED BY public.passenger.passenger_id;


--
-- Name: passengerdevice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passengerdevice (
    device_id integer NOT NULL,
    passenger_id integer,
    device_type character varying,
    push_token character varying,
    app_version character varying,
    last_active timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: passengerdevice_device_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.passengerdevice_device_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: passengerdevice_device_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.passengerdevice_device_id_seq OWNED BY public.passengerdevice.device_id;


--
-- Name: permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission (
    permission_id integer NOT NULL,
    permission_code character varying,
    category character varying,
    description character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: permission_permission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_permission_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_permission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_permission_id_seq OWNED BY public.permission.permission_id;


--
-- Name: powersource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.powersource (
    source_id integer NOT NULL,
    source_type character varying,
    zone_id integer,
    description character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: powersource_source_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.powersource_source_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: powersource_source_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.powersource_source_id_seq OWNED BY public.powersource.source_id;


--
-- Name: role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role (
    role_id integer NOT NULL,
    role_name character varying,
    description character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: role_role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_role_id_seq OWNED BY public.role.role_id;


--
-- Name: rolepermission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rolepermission (
    id integer NOT NULL,
    role_id integer,
    permission_id integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: rolepermission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rolepermission_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rolepermission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rolepermission_id_seq OWNED BY public.rolepermission.id;


--
-- Name: securitygate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.securitygate (
    gate_id integer NOT NULL,
    location character varying,
    zone_id integer,
    equipment_id integer,
    status character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: securitygate_gate_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.securitygate_gate_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: securitygate_gate_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.securitygate_gate_id_seq OWNED BY public.securitygate.gate_id;


--
-- Name: securitygatelog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.securitygatelog (
    gate_log_id integer NOT NULL,
    passenger_id integer,
    gate_id integer,
    verification_id integer,
    authorization_result character varying,
    gate_opened boolean,
    "timestamp" timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: securitygatelog_gate_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.securitygatelog_gate_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: securitygatelog_gate_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.securitygatelog_gate_log_id_seq OWNED BY public.securitygatelog.gate_log_id;


--
-- Name: solarinstallation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solarinstallation (
    installation_id integer NOT NULL,
    zone_id integer,
    equipment_id integer,
    capacity_kw numeric(8,2),
    panel_count integer,
    installed_date date,
    status character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: solarinstallation_installation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solarinstallation_installation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solarinstallation_installation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solarinstallation_installation_id_seq OWNED BY public.solarinstallation.installation_id;


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    staff_id integer NOT NULL,
    full_name character varying,
    department_id integer,
    job_title character varying,
    employment_type character varying,
    shift character varying,
    contact character varying,
    hire_date date,
    is_active boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: staff_staff_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_staff_id_seq OWNED BY public.staff.staff_id;


--
-- Name: staffrole; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staffrole (
    id integer NOT NULL,
    staff_id integer,
    role_id integer,
    assigned_date date,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: staffrole_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staffrole_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staffrole_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staffrole_id_seq OWNED BY public.staffrole.id;


--
-- Name: traveldocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.traveldocument (
    document_id integer NOT NULL,
    passenger_id integer,
    document_type character varying,
    document_number character varying,
    issuing_country_code character varying,
    expiry_date date,
    mrz_hash character varying,
    is_primary boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: traveldocument_document_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.traveldocument_document_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: traveldocument_document_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.traveldocument_document_id_seq OWNED BY public.traveldocument.document_id;


--
-- Name: useraccount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.useraccount (
    user_account_id integer NOT NULL,
    username character varying,
    email character varying,
    password_hash character varying,
    linked_person_type character varying,
    linked_person_id integer,
    is_active boolean,
    last_login timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: useraccount_user_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.useraccount_user_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: useraccount_user_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.useraccount_user_account_id_seq OWNED BY public.useraccount.user_account_id;


--
-- Name: zone; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zone (
    zone_id integer NOT NULL,
    zone_name character varying,
    terminal character varying,
    floor_level integer,
    capacity integer,
    current_occupancy integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: zone_zone_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.zone_zone_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zone_zone_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.zone_zone_id_seq OWNED BY public.zone.zone_id;


--
-- Name: airline airline_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.airline ALTER COLUMN airline_id SET DEFAULT nextval('public.airline_airline_id_seq'::regclass);


--
-- Name: airport airport_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.airport ALTER COLUMN airport_id SET DEFAULT nextval('public.airport_airport_id_seq'::regclass);


--
-- Name: auditlog audit_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditlog ALTER COLUMN audit_id SET DEFAULT nextval('public.auditlog_audit_id_seq'::regclass);


--
-- Name: bag bag_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bag ALTER COLUMN bag_id SET DEFAULT nextval('public.bag_bag_id_seq'::regclass);


--
-- Name: bagcheckpointlog checkpoint_log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bagcheckpointlog ALTER COLUMN checkpoint_log_id SET DEFAULT nextval('public.bagcheckpointlog_checkpoint_log_id_seq'::regclass);


--
-- Name: baggageinspection inspection_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baggageinspection ALTER COLUMN inspection_id SET DEFAULT nextval('public.baggageinspection_inspection_id_seq'::regclass);


--
-- Name: boardinggate boarding_gate_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boardinggate ALTER COLUMN boarding_gate_id SET DEFAULT nextval('public.boardinggate_boarding_gate_id_seq'::regclass);


--
-- Name: boardinglog boarding_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boardinglog ALTER COLUMN boarding_id SET DEFAULT nextval('public.boardinglog_boarding_id_seq'::regclass);


--
-- Name: booking booking_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking ALTER COLUMN booking_id SET DEFAULT nextval('public.booking_booking_id_seq'::regclass);


--
-- Name: camera camera_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camera ALTER COLUMN camera_id SET DEFAULT nextval('public.camera_camera_id_seq'::regclass);


--
-- Name: checkinrecord checkin_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkinrecord ALTER COLUMN checkin_id SET DEFAULT nextval('public.checkinrecord_checkin_id_seq'::regclass);


--
-- Name: department department_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department ALTER COLUMN department_id SET DEFAULT nextval('public.department_department_id_seq'::regclass);


--
-- Name: detecteditem item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detecteditem ALTER COLUMN item_id SET DEFAULT nextval('public.detecteditem_item_id_seq'::regclass);


--
-- Name: digitaltwinposition position_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digitaltwinposition ALTER COLUMN position_id SET DEFAULT nextval('public.digitaltwinposition_position_id_seq'::regclass);


--
-- Name: emergencyevent event_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencyevent ALTER COLUMN event_id SET DEFAULT nextval('public.emergencyevent_event_id_seq'::regclass);


--
-- Name: energyconsumptionlog log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energyconsumptionlog ALTER COLUMN log_id SET DEFAULT nextval('public.energyconsumptionlog_log_id_seq'::regclass);


--
-- Name: energygenerationlog log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energygenerationlog ALTER COLUMN log_id SET DEFAULT nextval('public.energygenerationlog_log_id_seq'::regclass);


--
-- Name: energystorage battery_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energystorage ALTER COLUMN battery_id SET DEFAULT nextval('public.energystorage_battery_id_seq'::regclass);


--
-- Name: equipment equipment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment ALTER COLUMN equipment_id SET DEFAULT nextval('public.equipment_equipment_id_seq'::regclass);


--
-- Name: equipmenthealthcheck check_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipmenthealthcheck ALTER COLUMN check_id SET DEFAULT nextval('public.equipmenthealthcheck_check_id_seq'::regclass);


--
-- Name: faceenrollment enrollment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faceenrollment ALTER COLUMN enrollment_id SET DEFAULT nextval('public.faceenrollment_enrollment_id_seq'::regclass);


--
-- Name: faceverificationlog verification_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faceverificationlog ALTER COLUMN verification_id SET DEFAULT nextval('public.faceverificationlog_verification_id_seq'::regclass);


--
-- Name: flight flight_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight ALTER COLUMN flight_id SET DEFAULT nextval('public.flight_flight_id_seq'::regclass);


--
-- Name: k9unit k9_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.k9unit ALTER COLUMN k9_id SET DEFAULT nextval('public.k9unit_k9_id_seq'::regclass);


--
-- Name: mapedge edge_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapedge ALTER COLUMN edge_id SET DEFAULT nextval('public.mapedge_edge_id_seq'::regclass);


--
-- Name: mapnode node_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapnode ALTER COLUMN node_id SET DEFAULT nextval('public.mapnode_node_id_seq'::regclass);


--
-- Name: monitoringalert alert_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitoringalert ALTER COLUMN alert_id SET DEFAULT nextval('public.monitoringalert_alert_id_seq'::regclass);


--
-- Name: notification notification_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification ALTER COLUMN notification_id SET DEFAULT nextval('public.notification_notification_id_seq'::regclass);


--
-- Name: passenger passenger_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passenger ALTER COLUMN passenger_id SET DEFAULT nextval('public.passenger_passenger_id_seq'::regclass);


--
-- Name: passengerdevice device_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passengerdevice ALTER COLUMN device_id SET DEFAULT nextval('public.passengerdevice_device_id_seq'::regclass);


--
-- Name: permission permission_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission ALTER COLUMN permission_id SET DEFAULT nextval('public.permission_permission_id_seq'::regclass);


--
-- Name: powersource source_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.powersource ALTER COLUMN source_id SET DEFAULT nextval('public.powersource_source_id_seq'::regclass);


--
-- Name: role role_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role ALTER COLUMN role_id SET DEFAULT nextval('public.role_role_id_seq'::regclass);


--
-- Name: rolepermission id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolepermission ALTER COLUMN id SET DEFAULT nextval('public.rolepermission_id_seq'::regclass);


--
-- Name: securitygate gate_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securitygate ALTER COLUMN gate_id SET DEFAULT nextval('public.securitygate_gate_id_seq'::regclass);


--
-- Name: securitygatelog gate_log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securitygatelog ALTER COLUMN gate_log_id SET DEFAULT nextval('public.securitygatelog_gate_log_id_seq'::regclass);


--
-- Name: solarinstallation installation_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solarinstallation ALTER COLUMN installation_id SET DEFAULT nextval('public.solarinstallation_installation_id_seq'::regclass);


--
-- Name: staff staff_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff ALTER COLUMN staff_id SET DEFAULT nextval('public.staff_staff_id_seq'::regclass);


--
-- Name: staffrole id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffrole ALTER COLUMN id SET DEFAULT nextval('public.staffrole_id_seq'::regclass);


--
-- Name: traveldocument document_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.traveldocument ALTER COLUMN document_id SET DEFAULT nextval('public.traveldocument_document_id_seq'::regclass);


--
-- Name: useraccount user_account_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.useraccount ALTER COLUMN user_account_id SET DEFAULT nextval('public.useraccount_user_account_id_seq'::regclass);


--
-- Name: zone zone_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone ALTER COLUMN zone_id SET DEFAULT nextval('public.zone_zone_id_seq'::regclass);


--
-- Name: airline airline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.airline
    ADD CONSTRAINT airline_pkey PRIMARY KEY (airline_id);


--
-- Name: airport airport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.airport
    ADD CONSTRAINT airport_pkey PRIMARY KEY (airport_id);


--
-- Name: auditlog auditlog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditlog
    ADD CONSTRAINT auditlog_pkey PRIMARY KEY (audit_id);


--
-- Name: bag bag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bag
    ADD CONSTRAINT bag_pkey PRIMARY KEY (bag_id);


--
-- Name: bagcheckpointlog bagcheckpointlog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bagcheckpointlog
    ADD CONSTRAINT bagcheckpointlog_pkey PRIMARY KEY (checkpoint_log_id);


--
-- Name: baggageinspection baggageinspection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baggageinspection
    ADD CONSTRAINT baggageinspection_pkey PRIMARY KEY (inspection_id);


--
-- Name: boardinggate boardinggate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boardinggate
    ADD CONSTRAINT boardinggate_pkey PRIMARY KEY (boarding_gate_id);


--
-- Name: boardinglog boardinglog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boardinglog
    ADD CONSTRAINT boardinglog_pkey PRIMARY KEY (boarding_id);


--
-- Name: booking booking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT booking_pkey PRIMARY KEY (booking_id);


--
-- Name: camera camera_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camera
    ADD CONSTRAINT camera_pkey PRIMARY KEY (camera_id);


--
-- Name: checkinrecord checkinrecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkinrecord
    ADD CONSTRAINT checkinrecord_pkey PRIMARY KEY (checkin_id);


--
-- Name: country country_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country
    ADD CONSTRAINT country_pkey PRIMARY KEY (country_code);


--
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (department_id);


--
-- Name: detecteditem detecteditem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detecteditem
    ADD CONSTRAINT detecteditem_pkey PRIMARY KEY (item_id);


--
-- Name: digitaltwinposition digitaltwinposition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digitaltwinposition
    ADD CONSTRAINT digitaltwinposition_pkey PRIMARY KEY (position_id);


--
-- Name: emergencyevent emergencyevent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencyevent
    ADD CONSTRAINT emergencyevent_pkey PRIMARY KEY (event_id);


--
-- Name: energyconsumptionlog energyconsumptionlog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energyconsumptionlog
    ADD CONSTRAINT energyconsumptionlog_pkey PRIMARY KEY (log_id);


--
-- Name: energygenerationlog energygenerationlog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energygenerationlog
    ADD CONSTRAINT energygenerationlog_pkey PRIMARY KEY (log_id);


--
-- Name: energystorage energystorage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energystorage
    ADD CONSTRAINT energystorage_pkey PRIMARY KEY (battery_id);


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (equipment_id);


--
-- Name: equipmenthealthcheck equipmenthealthcheck_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipmenthealthcheck
    ADD CONSTRAINT equipmenthealthcheck_pkey PRIMARY KEY (check_id);


--
-- Name: faceenrollment faceenrollment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faceenrollment
    ADD CONSTRAINT faceenrollment_pkey PRIMARY KEY (enrollment_id);


--
-- Name: faceverificationlog faceverificationlog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faceverificationlog
    ADD CONSTRAINT faceverificationlog_pkey PRIMARY KEY (verification_id);


--
-- Name: flight flight_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight
    ADD CONSTRAINT flight_pkey PRIMARY KEY (flight_id);


--
-- Name: k9unit k9unit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.k9unit
    ADD CONSTRAINT k9unit_pkey PRIMARY KEY (k9_id);


--
-- Name: mapedge mapedge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapedge
    ADD CONSTRAINT mapedge_pkey PRIMARY KEY (edge_id);


--
-- Name: mapnode mapnode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapnode
    ADD CONSTRAINT mapnode_pkey PRIMARY KEY (node_id);


--
-- Name: monitoringalert monitoringalert_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitoringalert
    ADD CONSTRAINT monitoringalert_pkey PRIMARY KEY (alert_id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (notification_id);


--
-- Name: passenger passenger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passenger
    ADD CONSTRAINT passenger_pkey PRIMARY KEY (passenger_id);


--
-- Name: passengerdevice passengerdevice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passengerdevice
    ADD CONSTRAINT passengerdevice_pkey PRIMARY KEY (device_id);


--
-- Name: permission permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission
    ADD CONSTRAINT permission_pkey PRIMARY KEY (permission_id);


--
-- Name: powersource powersource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.powersource
    ADD CONSTRAINT powersource_pkey PRIMARY KEY (source_id);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (role_id);


--
-- Name: rolepermission rolepermission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolepermission
    ADD CONSTRAINT rolepermission_pkey PRIMARY KEY (id);


--
-- Name: securitygate securitygate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securitygate
    ADD CONSTRAINT securitygate_pkey PRIMARY KEY (gate_id);


--
-- Name: securitygatelog securitygatelog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securitygatelog
    ADD CONSTRAINT securitygatelog_pkey PRIMARY KEY (gate_log_id);


--
-- Name: solarinstallation solarinstallation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solarinstallation
    ADD CONSTRAINT solarinstallation_pkey PRIMARY KEY (installation_id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (staff_id);


--
-- Name: staffrole staffrole_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffrole
    ADD CONSTRAINT staffrole_pkey PRIMARY KEY (id);


--
-- Name: traveldocument traveldocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.traveldocument
    ADD CONSTRAINT traveldocument_pkey PRIMARY KEY (document_id);


--
-- Name: useraccount useraccount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.useraccount
    ADD CONSTRAINT useraccount_pkey PRIMARY KEY (user_account_id);


--
-- Name: zone zone_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone
    ADD CONSTRAINT zone_pkey PRIMARY KEY (zone_id);


--
-- Name: ix_airline_airline_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_airline_airline_id ON public.airline USING btree (airline_id);


--
-- Name: ix_airline_iata_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_airline_iata_code ON public.airline USING btree (iata_code);


--
-- Name: ix_airport_airport_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_airport_airport_id ON public.airport USING btree (airport_id);


--
-- Name: ix_airport_country_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_airport_country_code ON public.airport USING btree (country_code);


--
-- Name: ix_airport_iata_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_airport_iata_code ON public.airport USING btree (iata_code);


--
-- Name: ix_auditlog_audit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auditlog_audit_id ON public.auditlog USING btree (audit_id);


--
-- Name: ix_auditlog_user_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auditlog_user_account_id ON public.auditlog USING btree (user_account_id);


--
-- Name: ix_bag_bag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bag_bag_id ON public.bag USING btree (bag_id);


--
-- Name: ix_bag_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bag_booking_id ON public.bag USING btree (booking_id);


--
-- Name: ix_bag_checkin_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bag_checkin_id ON public.bag USING btree (checkin_id);


--
-- Name: ix_bag_passenger_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bag_passenger_id ON public.bag USING btree (passenger_id);


--
-- Name: ix_bag_qr_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_bag_qr_code ON public.bag USING btree (qr_code);


--
-- Name: ix_bag_rfid_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_bag_rfid_tag ON public.bag USING btree (rfid_tag);


--
-- Name: ix_bagcheckpointlog_bag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bagcheckpointlog_bag_id ON public.bagcheckpointlog USING btree (bag_id);


--
-- Name: ix_bagcheckpointlog_checkpoint_log_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bagcheckpointlog_checkpoint_log_id ON public.bagcheckpointlog USING btree (checkpoint_log_id);


--
-- Name: ix_bagcheckpointlog_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bagcheckpointlog_equipment_id ON public.bagcheckpointlog USING btree (equipment_id);


--
-- Name: ix_baggageinspection_bag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_baggageinspection_bag_id ON public.baggageinspection USING btree (bag_id);


--
-- Name: ix_baggageinspection_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_baggageinspection_equipment_id ON public.baggageinspection USING btree (equipment_id);


--
-- Name: ix_baggageinspection_inspection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_baggageinspection_inspection_id ON public.baggageinspection USING btree (inspection_id);


--
-- Name: ix_baggageinspection_reviewed_by_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_baggageinspection_reviewed_by_staff_id ON public.baggageinspection USING btree (reviewed_by_staff_id);


--
-- Name: ix_boardinggate_boarding_gate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_boardinggate_boarding_gate_id ON public.boardinggate USING btree (boarding_gate_id);


--
-- Name: ix_boardinggate_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_boardinggate_equipment_id ON public.boardinggate USING btree (equipment_id);


--
-- Name: ix_boardinggate_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_boardinggate_zone_id ON public.boardinggate USING btree (zone_id);


--
-- Name: ix_boardinglog_boarding_gate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_boardinglog_boarding_gate_id ON public.boardinglog USING btree (boarding_gate_id);


--
-- Name: ix_boardinglog_boarding_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_boardinglog_boarding_id ON public.boardinglog USING btree (boarding_id);


--
-- Name: ix_boardinglog_flight_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_boardinglog_flight_id ON public.boardinglog USING btree (flight_id);


--
-- Name: ix_boardinglog_passenger_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_boardinglog_passenger_id ON public.boardinglog USING btree (passenger_id);


--
-- Name: ix_boardinglog_verification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_boardinglog_verification_id ON public.boardinglog USING btree (verification_id);


--
-- Name: ix_booking_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_booking_booking_id ON public.booking USING btree (booking_id);


--
-- Name: ix_booking_booking_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_booking_booking_reference ON public.booking USING btree (booking_reference);


--
-- Name: ix_booking_flight_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_booking_flight_id ON public.booking USING btree (flight_id);


--
-- Name: ix_booking_passenger_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_booking_passenger_id ON public.booking USING btree (passenger_id);


--
-- Name: ix_camera_camera_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_camera_camera_id ON public.camera USING btree (camera_id);


--
-- Name: ix_camera_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_camera_equipment_id ON public.camera USING btree (equipment_id);


--
-- Name: ix_camera_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_camera_zone_id ON public.camera USING btree (zone_id);


--
-- Name: ix_checkinrecord_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_checkinrecord_booking_id ON public.checkinrecord USING btree (booking_id);


--
-- Name: ix_checkinrecord_checkin_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_checkinrecord_checkin_id ON public.checkinrecord USING btree (checkin_id);


--
-- Name: ix_checkinrecord_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_checkinrecord_equipment_id ON public.checkinrecord USING btree (equipment_id);


--
-- Name: ix_checkinrecord_passenger_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_checkinrecord_passenger_id ON public.checkinrecord USING btree (passenger_id);


--
-- Name: ix_country_country_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_country_country_code ON public.country USING btree (country_code);


--
-- Name: ix_department_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_department_department_id ON public.department USING btree (department_id);


--
-- Name: ix_department_department_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_department_department_name ON public.department USING btree (department_name);


--
-- Name: ix_detecteditem_inspection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_detecteditem_inspection_id ON public.detecteditem USING btree (inspection_id);


--
-- Name: ix_detecteditem_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_detecteditem_item_id ON public.detecteditem USING btree (item_id);


--
-- Name: ix_digitaltwinposition_position_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_digitaltwinposition_position_id ON public.digitaltwinposition USING btree (position_id);


--
-- Name: ix_emergencyevent_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_emergencyevent_event_id ON public.emergencyevent USING btree (event_id);


--
-- Name: ix_emergencyevent_notified_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_emergencyevent_notified_staff_id ON public.emergencyevent USING btree (notified_staff_id);


--
-- Name: ix_emergencyevent_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_emergencyevent_zone_id ON public.emergencyevent USING btree (zone_id);


--
-- Name: ix_energyconsumptionlog_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_energyconsumptionlog_equipment_id ON public.energyconsumptionlog USING btree (equipment_id);


--
-- Name: ix_energyconsumptionlog_log_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_energyconsumptionlog_log_id ON public.energyconsumptionlog USING btree (log_id);


--
-- Name: ix_energyconsumptionlog_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_energyconsumptionlog_source_id ON public.energyconsumptionlog USING btree (source_id);


--
-- Name: ix_energyconsumptionlog_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_energyconsumptionlog_zone_id ON public.energyconsumptionlog USING btree (zone_id);


--
-- Name: ix_energygenerationlog_installation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_energygenerationlog_installation_id ON public.energygenerationlog USING btree (installation_id);


--
-- Name: ix_energygenerationlog_log_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_energygenerationlog_log_id ON public.energygenerationlog USING btree (log_id);


--
-- Name: ix_energystorage_battery_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_energystorage_battery_id ON public.energystorage USING btree (battery_id);


--
-- Name: ix_energystorage_installation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_energystorage_installation_id ON public.energystorage USING btree (installation_id);


--
-- Name: ix_equipment_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_equipment_equipment_id ON public.equipment USING btree (equipment_id);


--
-- Name: ix_equipment_serial_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_equipment_serial_number ON public.equipment USING btree (serial_number);


--
-- Name: ix_equipment_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_equipment_zone_id ON public.equipment USING btree (zone_id);


--
-- Name: ix_equipmenthealthcheck_check_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_equipmenthealthcheck_check_id ON public.equipmenthealthcheck USING btree (check_id);


--
-- Name: ix_equipmenthealthcheck_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_equipmenthealthcheck_equipment_id ON public.equipmenthealthcheck USING btree (equipment_id);


--
-- Name: ix_faceenrollment_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_faceenrollment_document_id ON public.faceenrollment USING btree (document_id);


--
-- Name: ix_faceenrollment_enrollment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_faceenrollment_enrollment_id ON public.faceenrollment USING btree (enrollment_id);


--
-- Name: ix_faceenrollment_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_faceenrollment_equipment_id ON public.faceenrollment USING btree (equipment_id);


--
-- Name: ix_faceenrollment_passenger_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_faceenrollment_passenger_id ON public.faceenrollment USING btree (passenger_id);


--
-- Name: ix_faceverificationlog_enrollment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_faceverificationlog_enrollment_id ON public.faceverificationlog USING btree (enrollment_id);


--
-- Name: ix_faceverificationlog_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_faceverificationlog_equipment_id ON public.faceverificationlog USING btree (equipment_id);


--
-- Name: ix_faceverificationlog_passenger_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_faceverificationlog_passenger_id ON public.faceverificationlog USING btree (passenger_id);


--
-- Name: ix_faceverificationlog_verification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_faceverificationlog_verification_id ON public.faceverificationlog USING btree (verification_id);


--
-- Name: ix_flight_airline_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_flight_airline_id ON public.flight USING btree (airline_id);


--
-- Name: ix_flight_boarding_gate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_flight_boarding_gate_id ON public.flight USING btree (boarding_gate_id);


--
-- Name: ix_flight_destination_airport_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_flight_destination_airport_id ON public.flight USING btree (destination_airport_id);


--
-- Name: ix_flight_flight_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_flight_flight_id ON public.flight USING btree (flight_id);


--
-- Name: ix_flight_origin_airport_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_flight_origin_airport_id ON public.flight USING btree (origin_airport_id);


--
-- Name: ix_k9unit_handler_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_k9unit_handler_staff_id ON public.k9unit USING btree (handler_staff_id);


--
-- Name: ix_k9unit_k9_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_k9unit_k9_id ON public.k9unit USING btree (k9_id);


--
-- Name: ix_mapedge_edge_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mapedge_edge_id ON public.mapedge USING btree (edge_id);


--
-- Name: ix_mapedge_from_node_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mapedge_from_node_id ON public.mapedge USING btree (from_node_id);


--
-- Name: ix_mapedge_to_node_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mapedge_to_node_id ON public.mapedge USING btree (to_node_id);


--
-- Name: ix_mapnode_node_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mapnode_node_id ON public.mapnode USING btree (node_id);


--
-- Name: ix_mapnode_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mapnode_zone_id ON public.mapnode USING btree (zone_id);


--
-- Name: ix_monitoringalert_alert_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_monitoringalert_alert_id ON public.monitoringalert USING btree (alert_id);


--
-- Name: ix_monitoringalert_camera_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_monitoringalert_camera_id ON public.monitoringalert USING btree (camera_id);


--
-- Name: ix_monitoringalert_linked_emergency_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_monitoringalert_linked_emergency_event_id ON public.monitoringalert USING btree (linked_emergency_event_id);


--
-- Name: ix_monitoringalert_resolved_by_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_monitoringalert_resolved_by_staff_id ON public.monitoringalert USING btree (resolved_by_staff_id);


--
-- Name: ix_monitoringalert_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_monitoringalert_zone_id ON public.monitoringalert USING btree (zone_id);


--
-- Name: ix_notification_notification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notification_notification_id ON public.notification USING btree (notification_id);


--
-- Name: ix_notification_passenger_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notification_passenger_id ON public.notification USING btree (passenger_id);


--
-- Name: ix_notification_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notification_staff_id ON public.notification USING btree (staff_id);


--
-- Name: ix_passenger_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_passenger_email ON public.passenger USING btree (email);


--
-- Name: ix_passenger_nationality_country_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_passenger_nationality_country_code ON public.passenger USING btree (nationality_country_code);


--
-- Name: ix_passenger_passenger_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_passenger_passenger_id ON public.passenger USING btree (passenger_id);


--
-- Name: ix_passengerdevice_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_passengerdevice_device_id ON public.passengerdevice USING btree (device_id);


--
-- Name: ix_passengerdevice_passenger_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_passengerdevice_passenger_id ON public.passengerdevice USING btree (passenger_id);


--
-- Name: ix_permission_permission_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_permission_permission_code ON public.permission USING btree (permission_code);


--
-- Name: ix_permission_permission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_permission_permission_id ON public.permission USING btree (permission_id);


--
-- Name: ix_powersource_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_powersource_source_id ON public.powersource USING btree (source_id);


--
-- Name: ix_powersource_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_powersource_zone_id ON public.powersource USING btree (zone_id);


--
-- Name: ix_role_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_role_role_id ON public.role USING btree (role_id);


--
-- Name: ix_role_role_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_role_role_name ON public.role USING btree (role_name);


--
-- Name: ix_securitygate_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_securitygate_equipment_id ON public.securitygate USING btree (equipment_id);


--
-- Name: ix_securitygate_gate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_securitygate_gate_id ON public.securitygate USING btree (gate_id);


--
-- Name: ix_securitygate_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_securitygate_zone_id ON public.securitygate USING btree (zone_id);


--
-- Name: ix_securitygatelog_gate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_securitygatelog_gate_id ON public.securitygatelog USING btree (gate_id);


--
-- Name: ix_securitygatelog_gate_log_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_securitygatelog_gate_log_id ON public.securitygatelog USING btree (gate_log_id);


--
-- Name: ix_securitygatelog_passenger_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_securitygatelog_passenger_id ON public.securitygatelog USING btree (passenger_id);


--
-- Name: ix_securitygatelog_verification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_securitygatelog_verification_id ON public.securitygatelog USING btree (verification_id);


--
-- Name: ix_solarinstallation_equipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_solarinstallation_equipment_id ON public.solarinstallation USING btree (equipment_id);


--
-- Name: ix_solarinstallation_installation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_solarinstallation_installation_id ON public.solarinstallation USING btree (installation_id);


--
-- Name: ix_solarinstallation_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_solarinstallation_zone_id ON public.solarinstallation USING btree (zone_id);


--
-- Name: ix_staff_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_staff_department_id ON public.staff USING btree (department_id);


--
-- Name: ix_staff_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_staff_staff_id ON public.staff USING btree (staff_id);


--
-- Name: ix_traveldocument_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_traveldocument_document_id ON public.traveldocument USING btree (document_id);


--
-- Name: ix_traveldocument_document_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_traveldocument_document_number ON public.traveldocument USING btree (document_number);


--
-- Name: ix_traveldocument_issuing_country_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_traveldocument_issuing_country_code ON public.traveldocument USING btree (issuing_country_code);


--
-- Name: ix_traveldocument_passenger_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_traveldocument_passenger_id ON public.traveldocument USING btree (passenger_id);


--
-- Name: ix_useraccount_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_useraccount_email ON public.useraccount USING btree (email);


--
-- Name: ix_useraccount_user_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_useraccount_user_account_id ON public.useraccount USING btree (user_account_id);


--
-- Name: ix_useraccount_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_useraccount_username ON public.useraccount USING btree (username);


--
-- Name: ix_zone_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_zone_zone_id ON public.zone USING btree (zone_id);


--
-- Name: airport airport_country_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.airport
    ADD CONSTRAINT airport_country_code_fkey FOREIGN KEY (country_code) REFERENCES public.country(country_code);


--
-- Name: auditlog auditlog_user_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditlog
    ADD CONSTRAINT auditlog_user_account_id_fkey FOREIGN KEY (user_account_id) REFERENCES public.useraccount(user_account_id);


--
-- Name: bag bag_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bag
    ADD CONSTRAINT bag_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.booking(booking_id);


--
-- Name: bag bag_checkin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bag
    ADD CONSTRAINT bag_checkin_id_fkey FOREIGN KEY (checkin_id) REFERENCES public.checkinrecord(checkin_id);


--
-- Name: bag bag_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bag
    ADD CONSTRAINT bag_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.passenger(passenger_id);


--
-- Name: bagcheckpointlog bagcheckpointlog_bag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bagcheckpointlog
    ADD CONSTRAINT bagcheckpointlog_bag_id_fkey FOREIGN KEY (bag_id) REFERENCES public.bag(bag_id);


--
-- Name: bagcheckpointlog bagcheckpointlog_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bagcheckpointlog
    ADD CONSTRAINT bagcheckpointlog_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(equipment_id);


--
-- Name: baggageinspection baggageinspection_bag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baggageinspection
    ADD CONSTRAINT baggageinspection_bag_id_fkey FOREIGN KEY (bag_id) REFERENCES public.bag(bag_id);


--
-- Name: baggageinspection baggageinspection_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baggageinspection
    ADD CONSTRAINT baggageinspection_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(equipment_id);


--
-- Name: baggageinspection baggageinspection_reviewed_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baggageinspection
    ADD CONSTRAINT baggageinspection_reviewed_by_staff_id_fkey FOREIGN KEY (reviewed_by_staff_id) REFERENCES public.staff(staff_id);


--
-- Name: boardinggate boardinggate_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boardinggate
    ADD CONSTRAINT boardinggate_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(equipment_id);


--
-- Name: boardinggate boardinggate_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boardinggate
    ADD CONSTRAINT boardinggate_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id);


--
-- Name: boardinglog boardinglog_boarding_gate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boardinglog
    ADD CONSTRAINT boardinglog_boarding_gate_id_fkey FOREIGN KEY (boarding_gate_id) REFERENCES public.boardinggate(boarding_gate_id);


--
-- Name: boardinglog boardinglog_flight_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boardinglog
    ADD CONSTRAINT boardinglog_flight_id_fkey FOREIGN KEY (flight_id) REFERENCES public.flight(flight_id);


--
-- Name: boardinglog boardinglog_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boardinglog
    ADD CONSTRAINT boardinglog_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.passenger(passenger_id);


--
-- Name: boardinglog boardinglog_verification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boardinglog
    ADD CONSTRAINT boardinglog_verification_id_fkey FOREIGN KEY (verification_id) REFERENCES public.faceverificationlog(verification_id);


--
-- Name: booking booking_flight_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT booking_flight_id_fkey FOREIGN KEY (flight_id) REFERENCES public.flight(flight_id);


--
-- Name: booking booking_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT booking_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.passenger(passenger_id);


--
-- Name: camera camera_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camera
    ADD CONSTRAINT camera_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(equipment_id);


--
-- Name: camera camera_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camera
    ADD CONSTRAINT camera_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id);


--
-- Name: checkinrecord checkinrecord_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkinrecord
    ADD CONSTRAINT checkinrecord_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.booking(booking_id);


--
-- Name: checkinrecord checkinrecord_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkinrecord
    ADD CONSTRAINT checkinrecord_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(equipment_id);


--
-- Name: checkinrecord checkinrecord_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkinrecord
    ADD CONSTRAINT checkinrecord_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.passenger(passenger_id);


--
-- Name: detecteditem detecteditem_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detecteditem
    ADD CONSTRAINT detecteditem_inspection_id_fkey FOREIGN KEY (inspection_id) REFERENCES public.baggageinspection(inspection_id);


--
-- Name: emergencyevent emergencyevent_notified_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencyevent
    ADD CONSTRAINT emergencyevent_notified_staff_id_fkey FOREIGN KEY (notified_staff_id) REFERENCES public.staff(staff_id);


--
-- Name: emergencyevent emergencyevent_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencyevent
    ADD CONSTRAINT emergencyevent_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id);


--
-- Name: energyconsumptionlog energyconsumptionlog_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energyconsumptionlog
    ADD CONSTRAINT energyconsumptionlog_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(equipment_id);


--
-- Name: energyconsumptionlog energyconsumptionlog_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energyconsumptionlog
    ADD CONSTRAINT energyconsumptionlog_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.powersource(source_id);


--
-- Name: energyconsumptionlog energyconsumptionlog_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energyconsumptionlog
    ADD CONSTRAINT energyconsumptionlog_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id);


--
-- Name: energygenerationlog energygenerationlog_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energygenerationlog
    ADD CONSTRAINT energygenerationlog_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.solarinstallation(installation_id);


--
-- Name: energystorage energystorage_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energystorage
    ADD CONSTRAINT energystorage_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.solarinstallation(installation_id);


--
-- Name: equipment equipment_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id);


--
-- Name: equipmenthealthcheck equipmenthealthcheck_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipmenthealthcheck
    ADD CONSTRAINT equipmenthealthcheck_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(equipment_id);


--
-- Name: faceenrollment faceenrollment_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faceenrollment
    ADD CONSTRAINT faceenrollment_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.traveldocument(document_id);


--
-- Name: faceenrollment faceenrollment_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faceenrollment
    ADD CONSTRAINT faceenrollment_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(equipment_id);


--
-- Name: faceenrollment faceenrollment_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faceenrollment
    ADD CONSTRAINT faceenrollment_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.passenger(passenger_id);


--
-- Name: faceverificationlog faceverificationlog_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faceverificationlog
    ADD CONSTRAINT faceverificationlog_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.faceenrollment(enrollment_id);


--
-- Name: faceverificationlog faceverificationlog_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faceverificationlog
    ADD CONSTRAINT faceverificationlog_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(equipment_id);


--
-- Name: faceverificationlog faceverificationlog_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faceverificationlog
    ADD CONSTRAINT faceverificationlog_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.passenger(passenger_id);


--
-- Name: flight flight_airline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight
    ADD CONSTRAINT flight_airline_id_fkey FOREIGN KEY (airline_id) REFERENCES public.airline(airline_id);


--
-- Name: flight flight_boarding_gate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight
    ADD CONSTRAINT flight_boarding_gate_id_fkey FOREIGN KEY (boarding_gate_id) REFERENCES public.boardinggate(boarding_gate_id);


--
-- Name: flight flight_destination_airport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight
    ADD CONSTRAINT flight_destination_airport_id_fkey FOREIGN KEY (destination_airport_id) REFERENCES public.airport(airport_id);


--
-- Name: flight flight_origin_airport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight
    ADD CONSTRAINT flight_origin_airport_id_fkey FOREIGN KEY (origin_airport_id) REFERENCES public.airport(airport_id);


--
-- Name: k9unit k9unit_handler_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.k9unit
    ADD CONSTRAINT k9unit_handler_staff_id_fkey FOREIGN KEY (handler_staff_id) REFERENCES public.staff(staff_id);


--
-- Name: mapedge mapedge_from_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapedge
    ADD CONSTRAINT mapedge_from_node_id_fkey FOREIGN KEY (from_node_id) REFERENCES public.mapnode(node_id);


--
-- Name: mapedge mapedge_to_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapedge
    ADD CONSTRAINT mapedge_to_node_id_fkey FOREIGN KEY (to_node_id) REFERENCES public.mapnode(node_id);


--
-- Name: mapnode mapnode_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapnode
    ADD CONSTRAINT mapnode_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id);


--
-- Name: monitoringalert monitoringalert_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitoringalert
    ADD CONSTRAINT monitoringalert_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.camera(camera_id);


--
-- Name: monitoringalert monitoringalert_linked_emergency_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitoringalert
    ADD CONSTRAINT monitoringalert_linked_emergency_event_id_fkey FOREIGN KEY (linked_emergency_event_id) REFERENCES public.emergencyevent(event_id);


--
-- Name: monitoringalert monitoringalert_resolved_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitoringalert
    ADD CONSTRAINT monitoringalert_resolved_by_staff_id_fkey FOREIGN KEY (resolved_by_staff_id) REFERENCES public.staff(staff_id);


--
-- Name: monitoringalert monitoringalert_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitoringalert
    ADD CONSTRAINT monitoringalert_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id);


--
-- Name: notification notification_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.passenger(passenger_id);


--
-- Name: notification notification_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(staff_id);


--
-- Name: passenger passenger_nationality_country_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passenger
    ADD CONSTRAINT passenger_nationality_country_code_fkey FOREIGN KEY (nationality_country_code) REFERENCES public.country(country_code);


--
-- Name: passengerdevice passengerdevice_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passengerdevice
    ADD CONSTRAINT passengerdevice_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.passenger(passenger_id);


--
-- Name: powersource powersource_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.powersource
    ADD CONSTRAINT powersource_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id);


--
-- Name: rolepermission rolepermission_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolepermission
    ADD CONSTRAINT rolepermission_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permission(permission_id);


--
-- Name: rolepermission rolepermission_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolepermission
    ADD CONSTRAINT rolepermission_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(role_id);


--
-- Name: securitygate securitygate_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securitygate
    ADD CONSTRAINT securitygate_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(equipment_id);


--
-- Name: securitygate securitygate_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securitygate
    ADD CONSTRAINT securitygate_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id);


--
-- Name: securitygatelog securitygatelog_gate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securitygatelog
    ADD CONSTRAINT securitygatelog_gate_id_fkey FOREIGN KEY (gate_id) REFERENCES public.securitygate(gate_id);


--
-- Name: securitygatelog securitygatelog_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securitygatelog
    ADD CONSTRAINT securitygatelog_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.passenger(passenger_id);


--
-- Name: securitygatelog securitygatelog_verification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securitygatelog
    ADD CONSTRAINT securitygatelog_verification_id_fkey FOREIGN KEY (verification_id) REFERENCES public.faceverificationlog(verification_id);


--
-- Name: solarinstallation solarinstallation_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solarinstallation
    ADD CONSTRAINT solarinstallation_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(equipment_id);


--
-- Name: solarinstallation solarinstallation_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solarinstallation
    ADD CONSTRAINT solarinstallation_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id);


--
-- Name: staff staff_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(department_id);


--
-- Name: staffrole staffrole_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffrole
    ADD CONSTRAINT staffrole_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(role_id);


--
-- Name: staffrole staffrole_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffrole
    ADD CONSTRAINT staffrole_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(staff_id);


--
-- Name: traveldocument traveldocument_issuing_country_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.traveldocument
    ADD CONSTRAINT traveldocument_issuing_country_code_fkey FOREIGN KEY (issuing_country_code) REFERENCES public.country(country_code);


--
-- Name: traveldocument traveldocument_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.traveldocument
    ADD CONSTRAINT traveldocument_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.passenger(passenger_id);


--
-- PostgreSQL database dump complete
--

\unrestrict PkWZWZEGYUu2ptJey1PL14GToX9r9mx3UvDTNzkKjkiODOcI6XS5EgkMAjyS5h7

