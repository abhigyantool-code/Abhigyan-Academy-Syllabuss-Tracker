--
-- PostgreSQL database dump
--

\restrict IflDf7AJt2qRHPlZwxx2sYuHEJkrPxXHflbG7cz8HnCWoRl6odXPtAlXcZNgiuZ

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
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
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_label text NOT NULL,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id text,
    before jsonb,
    after jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_log OWNER TO postgres;

--
-- Name: class_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.class_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    batch text,
    class_date date NOT NULL,
    code text NOT NULL,
    valid_from timestamp with time zone NOT NULL,
    valid_until timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.class_codes OWNER TO postgres;

--
-- Name: course_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.course_settings (
    course_id uuid NOT NULL,
    confirmation_threshold integer DEFAULT 5 NOT NULL,
    daily_entry_cap integer DEFAULT 6 NOT NULL,
    code_ttl_minutes integer DEFAULT 60 NOT NULL,
    require_class_code boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.course_settings OWNER TO postgres;

--
-- Name: courses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.courses OWNER TO postgres;

--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.enrollments (
    student_id uuid NOT NULL,
    course_id uuid NOT NULL,
    batch text
);


ALTER TABLE public.enrollments OWNER TO postgres;

--
-- Name: entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    student_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    topic_id uuid NOT NULL,
    class_date date NOT NULL,
    status text NOT NULL,
    remarks text,
    class_code_id uuid,
    device_id text NOT NULL,
    flags jsonb DEFAULT '[]'::jsonb NOT NULL,
    review_status text DEFAULT 'auto'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entries_review_status_check CHECK ((review_status = ANY (ARRAY['auto'::text, 'pending'::text, 'approved'::text, 'rejected'::text, 'CLEARED'::text, 'VIOLATION'::text, 'FLAGGED'::text, 'cleared'::text, 'violation'::text, 'flagged'::text]))),
    CONSTRAINT entries_status_check CHECK ((status = ANY (ARRAY['covered'::text, 'partial'::text, 'revision'::text])))
);


ALTER TABLE public.entries OWNER TO postgres;

--
-- Name: students; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    roll_no text NOT NULL,
    name text NOT NULL,
    pin_hash text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pin text DEFAULT '1234'::text NOT NULL
);


ALTER TABLE public.students OWNER TO postgres;

--
-- Name: subjects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.subjects OWNER TO postgres;

--
-- Name: topics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_id uuid NOT NULL,
    name text NOT NULL,
    seq_no integer DEFAULT 1 NOT NULL,
    target_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.topics OWNER TO postgres;

--
-- Name: topic_progress; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.topic_progress AS
 WITH student_counts AS (
         SELECT e.course_id,
            count(DISTINCT e.student_id) AS enrolled_students
           FROM (public.enrollments e
             JOIN public.students s_1 ON (((s_1.id = e.student_id) AND (s_1.active = true))))
          GROUP BY e.course_id
        ), topic_stats AS (
         SELECT e.topic_id,
            count(DISTINCT
                CASE
                    WHEN ((e.status = 'covered'::text) AND (e.review_status = ANY (ARRAY['auto'::text, 'approved'::text]))) THEN e.student_id
                    ELSE NULL::uuid
                END) AS covered_confirmations,
            count(DISTINCT
                CASE
                    WHEN ((e.status = 'partial'::text) AND (e.review_status = ANY (ARRAY['auto'::text, 'approved'::text]))) THEN e.student_id
                    ELSE NULL::uuid
                END) AS partial_confirmations,
            min(e.class_date) AS first_date_taught,
            max(e.class_date) AS last_date_taught,
            bool_or(((e.review_status = 'approved'::text) AND (e.status = 'covered'::text))) AS has_admin_approval
           FROM public.entries e
          GROUP BY e.topic_id
        )
 SELECT t.id AS topic_id,
    t.subject_id,
    s.course_id,
    s.name AS subject_name,
    c.name AS course_name,
    t.name AS topic_name,
    t.seq_no,
    t.target_date,
    COALESCE(ts.covered_confirmations, (0)::bigint) AS covered_confirmations,
    COALESCE(ts.partial_confirmations, (0)::bigint) AS partial_confirmations,
    ts.first_date_taught,
    ts.last_date_taught,
    LEAST((COALESCE(cs.confirmation_threshold, 5))::numeric, GREATEST((1)::numeric, round((0.20 * (COALESCE(sc.enrolled_students, (10)::bigint))::numeric)))) AS effective_threshold,
        CASE
            WHEN (COALESCE(ts.has_admin_approval, false) = true) THEN 'covered'::text
            WHEN ((COALESCE(ts.covered_confirmations, (0)::bigint))::numeric >= LEAST((COALESCE(cs.confirmation_threshold, 5))::numeric, GREATEST((1)::numeric, round((0.20 * (COALESCE(sc.enrolled_students, (10)::bigint))::numeric))))) THEN 'covered'::text
            WHEN (COALESCE(ts.covered_confirmations, (0)::bigint) > 0) THEN 'unverified'::text
            WHEN (COALESCE(ts.partial_confirmations, (0)::bigint) > 0) THEN 'in_progress'::text
            WHEN ((t.target_date IS NOT NULL) AND (t.target_date < ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text))::date)) THEN 'overdue'::text
            ELSE 'not_started'::text
        END AS status
   FROM (((((public.topics t
     JOIN public.subjects s ON ((s.id = t.subject_id)))
     JOIN public.courses c ON ((c.id = s.course_id)))
     LEFT JOIN public.course_settings cs ON ((cs.course_id = c.id)))
     LEFT JOIN student_counts sc ON ((sc.course_id = c.id)))
     LEFT JOIN topic_stats ts ON ((ts.topic_id = t.id)));


ALTER VIEW public.topic_progress OWNER TO postgres;

--
-- Name: subject_progress; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.subject_progress AS
 SELECT s.id AS subject_id,
    s.course_id,
    s.name AS subject_name,
    count(t.id) AS total_topics,
    count(
        CASE
            WHEN ((t.target_date IS NOT NULL) AND (t.target_date <= ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text))::date)) THEN 1
            ELSE NULL::integer
        END) AS planned_topics,
    count(
        CASE
            WHEN (tp.status = 'covered'::text) THEN 1
            ELSE NULL::integer
        END) AS covered_topics,
    round(COALESCE((((count(
        CASE
            WHEN ((t.target_date IS NOT NULL) AND (t.target_date <= ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text))::date)) THEN 1
            ELSE NULL::integer
        END))::numeric / (NULLIF(count(t.id), 0))::numeric) * (100)::numeric), (0)::numeric), 1) AS planned_pct,
    round(COALESCE((((count(
        CASE
            WHEN (tp.status = 'covered'::text) THEN 1
            ELSE NULL::integer
        END))::numeric / (NULLIF(count(t.id), 0))::numeric) * (100)::numeric), (0)::numeric), 1) AS actual_pct,
    round(COALESCE(((((count(
        CASE
            WHEN (tp.status = 'covered'::text) THEN 1
            ELSE NULL::integer
        END))::numeric - (count(
        CASE
            WHEN ((t.target_date IS NOT NULL) AND (t.target_date <= ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text))::date)) THEN 1
            ELSE NULL::integer
        END))::numeric) / (NULLIF(count(t.id), 0))::numeric) * (100)::numeric), (0)::numeric), 1) AS variance_pct
   FROM ((public.subjects s
     LEFT JOIN public.topics t ON ((t.subject_id = s.id)))
     LEFT JOIN public.topic_progress tp ON ((tp.topic_id = t.id)))
  GROUP BY s.id, s.course_id, s.name;


ALTER VIEW public.subject_progress OWNER TO postgres;

--
-- Name: teachers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teachers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pin text DEFAULT '1234'::text NOT NULL
);


ALTER TABLE public.teachers OWNER TO postgres;

--
-- Name: teacher_scorecard; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.teacher_scorecard AS
 SELECT tea.id AS teacher_id,
    tea.name AS teacher_name,
    count(DISTINCT
        CASE
            WHEN (tp.status = 'covered'::text) THEN tp.topic_id
            ELSE NULL::uuid
        END) AS topics_covered,
    round(COALESCE(avg(
        CASE
            WHEN ((tp.status = 'covered'::text) AND (t.target_date IS NOT NULL)) THEN (tp.first_date_taught - t.target_date)
            ELSE NULL::integer
        END), (0)::numeric), 1) AS avg_lag_days,
    max(e.class_date) AS last_class_logged,
    count(DISTINCT e.id) FILTER (WHERE (date_trunc('month'::text, (e.class_date)::timestamp with time zone) = date_trunc('month'::text, (((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text))::date)::timestamp with time zone))) AS classes_logged_this_month
   FROM (((public.teachers tea
     LEFT JOIN public.entries e ON (((e.teacher_id = tea.id) AND (e.review_status = ANY (ARRAY['auto'::text, 'approved'::text])))))
     LEFT JOIN public.topics t ON ((t.id = e.topic_id)))
     LEFT JOIN public.topic_progress tp ON ((tp.topic_id = t.id)))
  GROUP BY tea.id, tea.name;


ALTER VIEW public.teacher_scorecard OWNER TO postgres;

--
-- Name: teacher_subjects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teacher_subjects (
    teacher_id uuid NOT NULL,
    subject_id uuid NOT NULL
);


ALTER TABLE public.teacher_subjects OWNER TO postgres;

--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_log (id, actor_label, action, entity, entity_id, before, after, created_at) FROM stdin;
0fbd0d71-c576-440e-9a40-ba124b058757	System Initializer	SEED_DATABASE	system	\N	\N	{"date": "2026-10-24", "courses": 4, "students": 10, "teachers": 3}	2026-10-24 08:20:45.289536+00
fe317635-abbf-4683-b716-dfac243e53db	Admin (Phase 1)	APPROVE_FLAGGED_ENTRY	entries	8a2c7f12-9f2d-46ae-82c2-7bf09a23f4e2	{"id": "8a2c7f12-9f2d-46ae-82c2-7bf09a23f4e2", "flags": ["FLAG_SEQUENCE_JUMP"], "status": "covered", "remarks": null, "topic_id": "63b6ab70-faa2-48d1-87a6-9262a29eedae", "course_id": "f552f044-2ec4-4939-b955-6ffacd22099a", "device_id": "dev_6fpfpofbei_1793084184556", "class_date": "2026-11-05T18:30:00.000Z", "created_at": "2026-11-06T05:53:55.451Z", "student_id": "6548419b-22ac-4bea-b492-58f517876317", "subject_id": "46125bfc-662e-4cdb-a0ec-2f6f764809fe", "teacher_id": "e6acf08f-e058-486e-bcf0-2aa9fe86f75f", "class_code_id": null, "review_status": "pending"}	{"id": "8a2c7f12-9f2d-46ae-82c2-7bf09a23f4e2", "flags": ["FLAG_SEQUENCE_JUMP"], "status": "covered", "remarks": null, "topic_id": "63b6ab70-faa2-48d1-87a6-9262a29eedae", "course_id": "f552f044-2ec4-4939-b955-6ffacd22099a", "device_id": "dev_6fpfpofbei_1793084184556", "class_date": "2026-11-05T18:30:00.000Z", "created_at": "2026-11-06T05:53:55.451Z", "student_id": "6548419b-22ac-4bea-b492-58f517876317", "subject_id": "46125bfc-662e-4cdb-a0ec-2f6f764809fe", "teacher_id": "e6acf08f-e058-486e-bcf0-2aa9fe86f75f", "class_code_id": null, "review_status": "approved"}	2026-11-06 06:04:19.675793+00
8d6b12f4-d624-4fa4-9a83-f5219977b036	Admin (Phase 1)	AUTO_GENERATE_DAILY_CODES	class_codes	\N	\N	{"date": "2026-11-06", "count": 7}	2026-11-06 06:20:15.848307+00
40de6418-fd81-42c0-94c5-9776eab201f7	Admin (Phase 1)	TEACHER_LOGIN	teachers	15f74ec0-1b09-405e-ac2f-eef709a9c4aa	\N	{"name": "Ashish Sir", "loggedInAt": "2026-11-06T08:04:03.002Z"}	2026-11-06 08:04:03.003292+00
dace3110-5c29-41bf-be25-07678de3d768	Admin (Phase 1)	TEACHER_ENDORSE_TOPIC	topics	b28f0f70-00ff-4379-8062-777c9ec114a3	\N	{"date": "2026-11-06", "courseId": "f552f044-2ec4-4939-b955-6ffacd22099a", "subjectId": "0a175665-379e-40a1-b68b-765e2583eb65", "teacherId": "15f74ec0-1b09-405e-ac2f-eef709a9c4aa"}	2026-11-06 08:04:10.764541+00
5be70645-6395-4c81-a829-090b5d85ea76	Admin (Phase 1)	LOGOUT	faculty	15f74ec0-1b09-405e-ac2f-eef709a9c4aa	\N	\N	2026-11-06 08:04:59.824038+00
d4ec42ea-d9a9-44b4-a5fc-3d18e1ac0cc2	Admin (Phase 1)	TEACHER_LOGIN	teachers	4049b788-103c-4f13-8851-81b812883a72	\N	{"name": "Neelav Sir", "loggedInAt": "2026-11-06T08:05:13.116Z"}	2026-11-06 08:05:13.119585+00
39416770-b831-45dd-b9fd-0a2a505a6bc7	Admin (Phase 1)	TEACHER_ENDORSE_TOPIC	topics	f0217e6a-db17-4bfa-abf6-4d8fa1ffefc8	\N	{"date": "2026-11-06", "courseId": "76457759-048f-4513-be10-cb9b16a62410", "subjectId": "e69cfb91-797f-4878-b976-edcf6ed552d9", "teacherId": "4049b788-103c-4f13-8851-81b812883a72"}	2026-11-06 08:05:45.13574+00
3c736452-7d75-4799-8cd4-38ec3c5c3207	Admin (Phase 1)	LOGOUT	faculty	4049b788-103c-4f13-8851-81b812883a72	\N	\N	2026-11-07 06:02:26.952219+00
2a5e68b9-f01c-4979-a358-a7683ff4b998	Admin (Phase 1)	TEACHER_LOGIN	teachers	3600c149-fc58-495b-a924-c63c990bb9b3	\N	{"name": "Epsha Ma'am", "loggedInAt": "2026-11-07T06:02:40.124Z"}	2026-11-07 06:02:40.125051+00
\.


--
-- Data for Name: class_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.class_codes (id, course_id, batch, class_date, code, valid_from, valid_until, created_at) FROM stdin;
1bc3bb7c-a5bf-4ece-81d9-9ccf292bbc28	f552f044-2ec4-4939-b955-6ffacd22099a	AutoDaily	2026-11-06	NDA-243	2026-11-06 06:15:15.818+00	2026-11-07 06:20:15.818+00	2026-11-06 06:20:15.819811+00
6a0101c3-47f1-499f-aa8b-ba0e0f14bd6e	1c7c7590-4326-40da-8db2-b1709d1c2474	AutoDaily	2026-11-06	CDS-672	2026-11-06 06:15:15.828+00	2026-11-07 06:20:15.828+00	2026-11-06 06:20:15.82902+00
d3f4cd41-0e7c-4109-b04a-6b23850b75ce	76457759-048f-4513-be10-cb9b16a62410	AutoDaily	2026-11-06	AFCAT-704	2026-11-06 06:15:15.83+00	2026-11-07 06:20:15.83+00	2026-11-06 06:20:15.831199+00
b871caa0-c15b-4f96-aa67-1c9821cd1ae2	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	AutoDaily	2026-11-06	SSBGD-330	2026-11-06 06:15:15.832+00	2026-11-07 06:20:15.832+00	2026-11-06 06:20:15.833665+00
1d316b54-df6d-4651-84b4-f49b99c9296a	f738e1d7-b5a1-42c3-bd1d-b61bae772039	AutoDaily	2026-11-06	SSCGD-570	2026-11-06 06:15:15.835+00	2026-11-07 06:20:15.835+00	2026-11-06 06:20:15.835903+00
307b5067-1f9e-4faa-8e89-97f24a6c7aa9	34852013-ff65-40a0-b9c9-335240430ae3	AutoDaily	2026-11-06	AGNIVEER-886	2026-11-06 06:15:15.837+00	2026-11-07 06:20:15.837+00	2026-11-06 06:20:15.840461+00
a50fc953-f091-405f-b007-602ff21a9a16	ba158506-9e4d-4f29-8d2c-7096c92f6db4	AutoDaily	2026-11-06	MERCHANT_NAVY-599	2026-11-06 06:15:15.844+00	2026-11-07 06:20:15.844+00	2026-11-06 06:20:15.845452+00
\.


--
-- Data for Name: course_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.course_settings (course_id, confirmation_threshold, daily_entry_cap, code_ttl_minutes, require_class_code, updated_at) FROM stdin;
f552f044-2ec4-4939-b955-6ffacd22099a	5	6	120	f	2026-10-24 08:20:44.974645+00
1c7c7590-4326-40da-8db2-b1709d1c2474	4	6	120	f	2026-10-24 08:20:44.988924+00
76457759-048f-4513-be10-cb9b16a62410	4	6	120	f	2026-10-24 11:10:07.048146+00
0dc2b890-1715-468f-8aed-7f6fe4c2b82a	4	6	120	f	2026-10-24 11:10:07.048146+00
f738e1d7-b5a1-42c3-bd1d-b61bae772039	4	6	120	f	2026-10-24 11:10:07.048146+00
34852013-ff65-40a0-b9c9-335240430ae3	4	6	120	f	2026-10-24 11:10:07.048146+00
ba158506-9e4d-4f29-8d2c-7096c92f6db4	4	6	120	f	2026-10-24 11:10:07.048146+00
\.


--
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.courses (id, name, code, sort_order, active, created_at) FROM stdin;
f552f044-2ec4-4939-b955-6ffacd22099a	National Defence Academy	NDA	1	t	2026-10-24 08:20:44.966144+00
1c7c7590-4326-40da-8db2-b1709d1c2474	Combined Defence Services	CDS	2	t	2026-10-24 08:20:44.980878+00
76457759-048f-4513-be10-cb9b16a62410	Air Force Common Admission Test	AFCAT	3	t	2026-10-24 11:10:07.048146+00
0dc2b890-1715-468f-8aed-7f6fe4c2b82a	Services Selection Board & GD	SSBGD	4	t	2026-10-24 11:10:07.048146+00
f738e1d7-b5a1-42c3-bd1d-b61bae772039	Staff Selection Commission (GD)	SSCGD	5	t	2026-10-24 11:10:07.048146+00
34852013-ff65-40a0-b9c9-335240430ae3	Agniveer (Army / Navy / IAF)	AGNIVEER	6	t	2026-10-24 11:10:07.048146+00
ba158506-9e4d-4f29-8d2c-7096c92f6db4	Merchant Navy Entrance	MERCHANT_NAVY	7	t	2026-10-24 11:10:07.048146+00
\.


--
-- Data for Name: enrollments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.enrollments (student_id, course_id, batch) FROM stdin;
93837f7d-7500-4172-bc93-adae5f1d8007	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
8adfdbf8-3304-4642-9985-c4be16167a87	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
6548419b-22ac-4bea-b492-58f517876317	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
507b6883-6111-4a86-aef1-bee80ccdedc8	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
35fd2859-7f6a-4a19-87f4-7a0149fae805	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
90daa973-152a-4ce5-b620-b1e3eece2ffc	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
a7c3401b-5c51-443e-84b1-be465318e809	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
2b9e29e1-5731-4c65-9c8b-5eb9119f3ddd	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
d56707c4-d8fe-4510-8fc9-8a20ab71f07d	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
285c67bd-b064-4c53-85b9-462f67bf54d8	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
ddafdd5a-4afc-448d-8518-2874563f6c46	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
71aea452-a2aa-4112-aa37-a964712e50ea	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
99741e6d-d8fe-4497-9a1e-853ace103b6f	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
fce68ff1-3279-445d-8bbe-d7cda886f463	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
b010d05b-4311-442e-8ab5-d441804ae438	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
749839a3-9d3a-4f45-aa1b-15476376b3a0	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
13452a48-3d75-4f7c-9434-9f551e94d1b2	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
560647b3-54a4-404a-b521-523c771fe4ad	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
3a65d5e5-e0b6-4020-b0a9-96f3f12e0ff8	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
7d86a35e-06a0-41e3-a2f8-b9586889e249	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
c5e31099-f0b1-4dd6-b0f4-b26555e7a6f0	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
c085c9f4-ca32-4aa0-8245-d2ee060d5b35	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
fa5f9167-10f1-4300-a12d-209336cad4cf	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
ab908972-0996-48a6-b81a-2e06552b009b	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
39324b96-6973-4e38-b185-9015d25dd9a1	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
028644c4-3b1e-4e9f-ab94-d44a21e753fd	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
b48dd7bd-ec01-4636-8143-a8ff9fa1be7c	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
422e101f-a1af-40a2-9321-c4f41d6d3b8f	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
0a9fcbad-456d-42e1-b9ee-c10bb8cd4360	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
43d30a0a-e70a-40ea-bdfc-1b9cbefaf322	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
f838d1cf-ae97-45a0-9f93-98c275cfa1a4	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
dd265184-8224-41bb-8a6f-9869642fa567	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
f36255a1-59f9-4dfe-82b3-57790d1bdb7b	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
4ff32a5c-536a-416e-8cf3-1cccbbfcdd9b	f552f044-2ec4-4939-b955-6ffacd22099a	Batch-1
4dc89bdd-c9f1-46d9-95fb-21663cc67038	ba158506-9e4d-4f29-8d2c-7096c92f6db4	Batch-1
a9ea7b44-bfd3-4b3c-b649-f5a8a82637fa	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Batch-1
6b3b9ed3-595b-46a6-9c0b-7fb7811681d5	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Batch-1
cb2ef24f-98b1-43d4-959f-073cf5aa75a0	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Batch-1
baa31a74-48f8-4853-b5a4-8a2d064e7d18	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Batch-1
b939fec7-51ac-4589-ae17-93660e88c9e3	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Batch-1
eb4564c9-bd43-4ae4-b976-a24bc63d956f	34852013-ff65-40a0-b9c9-335240430ae3	Batch-1
e91d93bb-a1a1-49d9-bb0e-8150dc84e610	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
fc494dd9-6999-4afe-beee-75bbca4fa1ef	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
09cbb6f3-5b7f-4567-9b88-f34292cec7d9	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
a0c43b21-a572-432d-8351-fa808bb5d7d8	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
f05327f1-1ffc-4760-9ada-dd1570d9a648	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
848003b5-9f2d-4ad5-9a67-0d7c55650e1e	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
f76a50f0-fa54-4731-b22c-e2c4e31ddd4e	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
95e4b50c-a210-4ab9-9179-3eae1a268198	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
e11d08ee-e605-4d3f-b2ca-83cb1f28b1fa	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
c6a7e3d3-8ab6-442f-8348-9bc54d6d4090	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
dddcfc8b-469f-4b5f-bf8f-37436dcbc82d	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
5f1c71ed-876e-49e6-a60d-5a606982a2f8	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
cdc904f7-c8c5-4515-9a32-3616c242021f	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
dad7289b-f971-4b41-ac12-afdf81c1ef34	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
63e072fb-9b7f-4caf-a3fe-568a5507c676	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
1c0283ca-9eba-4d34-9810-fad6240489d3	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
a5f57446-5e4d-4d9f-824a-e862e2f3f082	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
d1e1a36b-974d-4500-b8de-374af9160925	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
7f331f0f-8312-4eb7-b9f5-2c4a06779ca5	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
7f4e8aa2-f788-4a0b-bf24-f6feac0a0160	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
f0acd37c-ae2c-4320-8763-5009b0bf2dad	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
9fd808c8-ab9e-469e-861d-6713ed844ccb	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
9656030e-2b8b-4640-8778-f55c8dd43c36	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
37a62bcb-41e2-476e-93c7-f21c3c821706	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
9fa3398d-7235-4a0f-b8e1-7bfee234e80a	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
92de2523-662b-415d-b8ef-535a674b1abf	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
07690bdc-f669-4c22-b0f1-6c1fae040898	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
a9a4ba58-1a2a-4054-b2ae-4c9105f3aa1d	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
ab1a89dc-18b3-4cc1-8099-1958c6b39cf7	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
e8855d09-1cf5-406c-9a27-70283be38f4b	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
38a14221-f256-4cd2-8d9a-1aad5d23e370	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
c1ca9ee0-ee56-4070-9783-cb7cda5730ce	1c7c7590-4326-40da-8db2-b1709d1c2474	Batch-1
325535fb-e89a-4cf1-9493-58550d9589cf	76457759-048f-4513-be10-cb9b16a62410	Batch-1
8129f71e-8625-414a-acc3-887fb9eea7d8	76457759-048f-4513-be10-cb9b16a62410	Batch-1
\.


--
-- Data for Name: entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.entries (id, course_id, student_id, teacher_id, subject_id, topic_id, class_date, status, remarks, class_code_id, device_id, flags, review_status, created_at) FROM stdin;
82220eb6-7b30-4fed-a026-d47cc59f1563	f552f044-2ec4-4939-b955-6ffacd22099a	d56707c4-d8fe-4510-8fc9-8a20ab71f07d	3600c149-fc58-495b-a924-c63c990bb9b3	b55b807d-47e3-457e-9c40-f7430918b8a9	d197aa93-8c7a-49f2-b26f-27ad44f01e33	2026-11-07	revision	\N	\N	dev_6fpfpofbei_1793084184556	["FLAG_SEQUENCE_JUMP"]	pending	2026-11-07 06:02:04.67671+00
baa64170-c105-40e3-967e-fef720f754b9	f552f044-2ec4-4939-b955-6ffacd22099a	6548419b-22ac-4bea-b492-58f517876317	4049b788-103c-4f13-8851-81b812883a72	379e4f08-e771-4f70-af62-c88f9f41ee14	5583e847-4499-4888-ac22-89e3a53beb82	2026-11-06	covered	solar sytem was covered	\N	dev_6fpfpofbei_1793084184556	[]	auto	2026-11-06 10:56:53.3008+00
903b6128-f7e5-4a86-8101-56a47c4a953c	f552f044-2ec4-4939-b955-6ffacd22099a	93837f7d-7500-4172-bc93-adae5f1d8007	15f74ec0-1b09-405e-ac2f-eef709a9c4aa	0a175665-379e-40a1-b68b-765e2583eb65	b28f0f70-00ff-4379-8062-777c9ec114a3	2026-11-06	covered	[Faculty Endorsed directly from Teacher Portal]	\N	teacher-portal-endorse	[]	approved	2026-11-06 08:04:10.756463+00
fd1bfdfc-f391-46b8-9c59-042a36f8676b	76457759-048f-4513-be10-cb9b16a62410	325535fb-e89a-4cf1-9493-58550d9589cf	4049b788-103c-4f13-8851-81b812883a72	e69cfb91-797f-4878-b976-edcf6ed552d9	f0217e6a-db17-4bfa-abf6-4d8fa1ffefc8	2026-11-06	covered	[Faculty Endorsed directly from Teacher Portal]	\N	teacher-portal-endorse	[]	approved	2026-11-06 08:05:45.129579+00
\.


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.students (id, roll_no, name, pin_hash, active, created_at, pin) FROM stdin;
93837f7d-7500-4172-bc93-adae5f1d8007	NDA-01	Mafruza Rahman	\N	t	2026-10-29 08:11:41.296781+00	1234
8adfdbf8-3304-4642-9985-c4be16167a87	NDA-02	Sangey Lhamunamsa	\N	t	2026-10-29 08:11:41.296781+00	1234
6548419b-22ac-4bea-b492-58f517876317	NDA-03	Jitaljit Meitei	\N	t	2026-10-29 08:11:41.296781+00	1234
507b6883-6111-4a86-aef1-bee80ccdedc8	NDA-04	Udpana Sinha Ray	\N	t	2026-10-29 08:11:41.296781+00	1234
35fd2859-7f6a-4a19-87f4-7a0149fae805	NDA-05	Shristi Talukdar	\N	t	2026-10-29 08:11:41.296781+00	1234
90daa973-152a-4ce5-b620-b1e3eece2ffc	NDA-06	Sagar Nath	\N	t	2026-10-29 08:11:41.296781+00	1234
a7c3401b-5c51-443e-84b1-be465318e809	NDA-07	Nazifa Khan	\N	t	2026-10-29 08:11:41.296781+00	1234
2b9e29e1-5731-4c65-9c8b-5eb9119f3ddd	NDA-08	Bishakha Goswami	\N	t	2026-10-29 08:11:41.296781+00	1234
d56707c4-d8fe-4510-8fc9-8a20ab71f07d	NDA-09	Manzeer B Sameer	\N	t	2026-10-29 08:11:41.296781+00	1234
285c67bd-b064-4c53-85b9-462f67bf54d8	NDA-10	Shoriful Islam	\N	t	2026-10-29 08:11:41.296781+00	1234
ddafdd5a-4afc-448d-8518-2874563f6c46	NDA-11	Manash Pratim Das	\N	t	2026-10-29 08:11:41.296781+00	1234
71aea452-a2aa-4112-aa37-a964712e50ea	NDA-12	Ashutosh Singh	\N	t	2026-10-29 08:11:41.296781+00	1234
99741e6d-d8fe-4497-9a1e-853ace103b6f	NDA-13	Monali Singha	\N	t	2026-10-29 08:11:41.296781+00	1234
fce68ff1-3279-445d-8bbe-d7cda886f463	NDA-14	Dipayan Paul	\N	t	2026-10-29 08:11:41.296781+00	1234
b010d05b-4311-442e-8ab5-d441804ae438	NDA-15	Hirakjyoti Rabha	\N	t	2026-10-29 08:11:41.296781+00	1234
749839a3-9d3a-4f45-aa1b-15476376b3a0	NDA-16	Henthoiba Singha	\N	t	2026-10-29 08:11:41.296781+00	1234
13452a48-3d75-4f7c-9434-9f551e94d1b2	NDA-17	Tsering Dargey Khum	\N	t	2026-10-29 08:11:41.296781+00	1234
560647b3-54a4-404a-b521-523c771fe4ad	NDA-18	Elzerial D Arengh	\N	t	2026-10-29 08:11:41.296781+00	1234
3a65d5e5-e0b6-4020-b0a9-96f3f12e0ff8	NDA-19	Jolima Khatun	\N	t	2026-10-29 08:11:41.296781+00	1234
7d86a35e-06a0-41e3-a2f8-b9586889e249	NDA-20	Prince Rawat	\N	t	2026-10-29 08:11:41.296781+00	1234
c5e31099-f0b1-4dd6-b0f4-b26555e7a6f0	NDA-21	Pukhrambam Denish	\N	t	2026-10-29 08:11:41.296781+00	1234
c085c9f4-ca32-4aa0-8245-d2ee060d5b35	NDA-22	Mehboob Alom	\N	t	2026-10-29 08:11:41.296781+00	1234
fa5f9167-10f1-4300-a12d-209336cad4cf	NDA-23	Saranga Raj Kashyap	\N	t	2026-10-29 08:11:41.296781+00	1234
ab908972-0996-48a6-b81a-2e06552b009b	NDA-24	Navraj Hamal	\N	t	2026-10-29 08:11:41.296781+00	1234
39324b96-6973-4e38-b185-9015d25dd9a1	NDA-25	Parul Sonwal	\N	t	2026-10-29 08:11:41.296781+00	1234
028644c4-3b1e-4e9f-ab94-d44a21e753fd	NDA-26	Anushka Dey	\N	t	2026-10-29 08:11:41.296781+00	1234
b48dd7bd-ec01-4636-8143-a8ff9fa1be7c	NDA-27	Abigail Thoirei	\N	t	2026-10-29 08:11:41.296781+00	1234
422e101f-a1af-40a2-9321-c4f41d6d3b8f	NDA-28	Aman Dahal	\N	t	2026-10-29 08:11:41.296781+00	1234
0a9fcbad-456d-42e1-b9ee-c10bb8cd4360	NDA-29	Laishram Shidhal Singh	\N	t	2026-10-29 08:11:41.296781+00	1234
43d30a0a-e70a-40ea-bdfc-1b9cbefaf322	NDA-30	Y. Chandra Sekhar	\N	t	2026-10-29 08:11:41.296781+00	1234
f838d1cf-ae97-45a0-9f93-98c275cfa1a4	NDA-31	T. N. Haveingao	\N	t	2026-10-29 08:11:41.296781+00	1234
dd265184-8224-41bb-8a6f-9869642fa567	NDA-32	Tanu Rai	\N	t	2026-10-29 08:11:41.296781+00	1234
f36255a1-59f9-4dfe-82b3-57790d1bdb7b	NDA-33	MD Zakariya	\N	t	2026-10-29 08:11:41.296781+00	1234
4ff32a5c-536a-416e-8cf3-1cccbbfcdd9b	NDA-34	Shiva Brahma	\N	t	2026-10-29 08:11:41.296781+00	1234
4dc89bdd-c9f1-46d9-95fb-21663cc67038	MERCHANT_NAVY-01	MD Faizan	\N	t	2026-10-29 08:11:41.296781+00	1234
a9ea7b44-bfd3-4b3c-b649-f5a8a82637fa	SSCGD-01	Tridikha Das	\N	t	2026-10-29 08:11:41.296781+00	1234
6b3b9ed3-595b-46a6-9c0b-7fb7811681d5	SSCGD-02	Pukhrambam Max Singh	\N	t	2026-10-29 08:11:41.296781+00	1234
cb2ef24f-98b1-43d4-959f-073cf5aa75a0	SSCGD-03	Bini Path	\N	t	2026-10-29 08:11:41.296781+00	1234
baa31a74-48f8-4853-b5a4-8a2d064e7d18	SSCGD-04	Pooja Sharma	\N	t	2026-10-29 08:11:41.296781+00	1234
b939fec7-51ac-4589-ae17-93660e88c9e3	SSCGD-05	Bishnu Sonar	\N	t	2026-10-29 08:11:41.296781+00	1234
eb4564c9-bd43-4ae4-b976-a24bc63d956f	AGNIVEER-01	Simran Begum	\N	t	2026-10-29 08:11:41.296781+00	1234
e91d93bb-a1a1-49d9-bb0e-8150dc84e610	CDS-01	Lashram Sadhana Devi	\N	t	2026-10-29 08:11:41.296781+00	1234
fc494dd9-6999-4afe-beee-75bbca4fa1ef	CDS-02	Bhagyashree Kakati	\N	t	2026-10-29 08:11:41.296781+00	1234
09cbb6f3-5b7f-4567-9b88-f34292cec7d9	CDS-03	Nilomyoti Das	\N	t	2026-10-29 08:11:41.296781+00	1234
a0c43b21-a572-432d-8351-fa808bb5d7d8	CDS-04	Polijyoti Das	\N	t	2026-10-29 08:11:41.296781+00	1234
f05327f1-1ffc-4760-9ada-dd1570d9a648	CDS-05	Bandana Rai	\N	t	2026-10-29 08:11:41.296781+00	1234
848003b5-9f2d-4ad5-9a67-0d7c55650e1e	CDS-06	Sadakanibiang Nongsiej	\N	t	2026-10-29 08:11:41.296781+00	1234
f76a50f0-fa54-4731-b22c-e2c4e31ddd4e	CDS-07	Bidisha Basumatary	\N	t	2026-10-29 08:11:41.296781+00	1234
95e4b50c-a210-4ab9-9179-3eae1a268198	CDS-08	Ankita Thapa	\N	t	2026-10-29 08:11:41.296781+00	1234
e11d08ee-e605-4d3f-b2ca-83cb1f28b1fa	CDS-09	Khoroang Felina	\N	t	2026-10-29 08:11:41.296781+00	1234
c6a7e3d3-8ab6-442f-8348-9bc54d6d4090	CDS-10	Imkonglemba Jamir	\N	t	2026-10-29 08:11:41.296781+00	1234
dddcfc8b-469f-4b5f-bf8f-37436dcbc82d	CDS-11	Reshap Gurung	\N	t	2026-10-29 08:11:41.296781+00	1234
5f1c71ed-876e-49e6-a60d-5a606982a2f8	CDS-12	Thaangminlun Singson	\N	t	2026-10-29 08:11:41.296781+00	1234
cdc904f7-c8c5-4515-9a32-3616c242021f	CDS-13	Nuvekhulu Dozo	\N	t	2026-10-29 08:11:41.296781+00	1234
dad7289b-f971-4b41-ac12-afdf81c1ef34	CDS-14	Zhopokholu Nyekha	\N	t	2026-10-29 08:11:41.296781+00	1234
63e072fb-9b7f-4caf-a3fe-568a5507c676	CDS-15	Rabbica Sangma	\N	t	2026-10-29 08:11:41.296781+00	1234
1c0283ca-9eba-4d34-9810-fad6240489d3	CDS-16	Pavane Lohrii	\N	t	2026-10-29 08:11:41.296781+00	1234
a5f57446-5e4d-4d9f-824a-e862e2f3f082	CDS-17	Angkuman Nath	\N	t	2026-10-29 08:11:41.296781+00	1234
d1e1a36b-974d-4500-b8de-374af9160925	CDS-18	Toshiren Longchari	\N	t	2026-10-29 08:11:41.296781+00	1234
7f331f0f-8312-4eb7-b9f5-2c4a06779ca5	CDS-19	Asmil Payenj	\N	t	2026-10-29 08:11:41.296781+00	1234
7f4e8aa2-f788-4a0b-bf24-f6feac0a0160	CDS-20	Bipradeep Bhattacharjee	\N	t	2026-10-29 08:11:41.296781+00	1234
f0acd37c-ae2c-4320-8763-5009b0bf2dad	CDS-21	Raybiamo Kri	\N	t	2026-10-29 08:11:41.296781+00	1234
9fd808c8-ab9e-469e-861d-6713ed844ccb	CDS-22	Kapommi Luiyai	\N	t	2026-10-29 08:11:41.296781+00	1234
9656030e-2b8b-4640-8778-f55c8dd43c36	CDS-23	Vanemi Saka Raikhan	\N	t	2026-10-29 08:11:41.296781+00	1234
37a62bcb-41e2-476e-93c7-f21c3c821706	CDS-24	Sizzio Dominic	\N	t	2026-10-29 08:11:41.296781+00	1234
9fa3398d-7235-4a0f-b8e1-7bfee234e80a	CDS-25	Khuvi Ahro	\N	t	2026-10-29 08:11:41.296781+00	1234
92de2523-662b-415d-b8ef-535a674b1abf	CDS-26	Ayush Choudhury	\N	t	2026-10-29 08:11:41.296781+00	1234
07690bdc-f669-4c22-b0f1-6c1fae040898	CDS-27	H. Hrangalou	\N	t	2026-10-29 08:11:41.296781+00	1234
a9a4ba58-1a2a-4054-b2ae-4c9105f3aa1d	CDS-28	Samson Topogag	\N	t	2026-10-29 08:11:41.296781+00	1234
ab1a89dc-18b3-4cc1-8099-1958c6b39cf7	CDS-29	Teilang Jyrwa	\N	t	2026-10-29 08:11:41.296781+00	1234
e8855d09-1cf5-406c-9a27-70283be38f4b	CDS-30	Uzhozo Dozo	\N	t	2026-10-29 08:11:41.296781+00	1234
38a14221-f256-4cd2-8d9a-1aad5d23e370	CDS-31	Palchan Kumawat	\N	t	2026-10-29 08:11:41.296781+00	1234
c1ca9ee0-ee56-4070-9783-cb7cda5730ce	CDS-32	Rudrapratap Singh	\N	t	2026-10-29 08:11:41.296781+00	1234
325535fb-e89a-4cf1-9493-58550d9589cf	AFCAT-01	Plucky Sinha	\N	t	2026-10-29 08:11:41.296781+00	1234
8129f71e-8625-414a-acc3-887fb9eea7d8	AFCAT-02	Khayingsing Kasar	\N	t	2026-10-29 08:11:41.296781+00	1234
\.


--
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subjects (id, course_id, name, sort_order, created_at) FROM stdin;
0a175665-379e-40a1-b68b-765e2583eb65	f552f044-2ec4-4939-b955-6ffacd22099a	Physics	2	2026-10-24 11:10:07.048146+00
6bd29f85-f263-4404-beaa-f0d68519092d	f552f044-2ec4-4939-b955-6ffacd22099a	Mathematics	1	2026-10-24 08:20:45.011359+00
b55b807d-47e3-457e-9c40-f7430918b8a9	f552f044-2ec4-4939-b955-6ffacd22099a	English	4	2026-10-24 11:10:07.048146+00
0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	f552f044-2ec4-4939-b955-6ffacd22099a	SSB Sessions	10	2026-11-04 09:20:02.400038+00
0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	ba158506-9e4d-4f29-8d2c-7096c92f6db4	Physics	2	2026-11-04 10:40:08.924969+00
27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	ba158506-9e4d-4f29-8d2c-7096c92f6db4	Chemistry	3	2026-11-04 10:40:08.924969+00
607b7030-b40c-4679-beb7-2e75e9d23dcc	ba158506-9e4d-4f29-8d2c-7096c92f6db4	Biology	4	2026-11-04 10:40:08.924969+00
2c31c03e-133b-4893-b7ad-23958391635c	ba158506-9e4d-4f29-8d2c-7096c92f6db4	English	4	2026-11-04 10:40:08.924969+00
ca821a00-b270-4f44-bb14-906d795b1f47	ba158506-9e4d-4f29-8d2c-7096c92f6db4	Reasoning	6	2026-11-04 10:40:08.924969+00
ee3d6099-911f-4697-a1c2-a2b18fe2dbe5	ba158506-9e4d-4f29-8d2c-7096c92f6db4	Current Affairs	7	2026-11-04 10:40:08.924969+00
d2e7b350-4ecf-4607-acd5-0626fcf5192c	ba158506-9e4d-4f29-8d2c-7096c92f6db4	History	8	2026-11-04 10:40:08.924969+00
33e66595-9958-4f01-acd4-4e74c90494af	ba158506-9e4d-4f29-8d2c-7096c92f6db4	Polity	9	2026-11-04 10:40:08.924969+00
11c78503-6e03-440a-9533-0c8314dd82c2	ba158506-9e4d-4f29-8d2c-7096c92f6db4	SSB Sessions	10	2026-11-04 10:40:08.924969+00
fb7009ce-347d-4ab5-a91d-c824e8b6a011	ba158506-9e4d-4f29-8d2c-7096c92f6db4	Economics	10	2026-11-04 10:40:08.924969+00
751ab330-68b6-4d4e-8c0b-87a9440d0119	ba158506-9e4d-4f29-8d2c-7096c92f6db4	Geography	11	2026-11-04 10:40:08.924969+00
56c7b3a0-63ba-44b2-8299-b8fd1937408f	f552f044-2ec4-4939-b955-6ffacd22099a	Chemistry	3	2026-10-24 11:48:02.586718+00
46125bfc-662e-4cdb-a0ec-2f6f764809fe	f552f044-2ec4-4939-b955-6ffacd22099a	Biology	4	2026-10-24 11:48:02.586718+00
4e322df8-635d-4eab-8706-467d5370c735	f552f044-2ec4-4939-b955-6ffacd22099a	Reasoning	6	2026-10-24 11:48:02.586718+00
70ebeeb9-b739-403a-92b1-79d79fb54cde	f552f044-2ec4-4939-b955-6ffacd22099a	Current Affairs	7	2026-10-24 11:48:02.586718+00
9786e12d-8dd0-4c39-a9d9-ca3bdd196885	f552f044-2ec4-4939-b955-6ffacd22099a	History	8	2026-10-24 11:48:02.586718+00
27cf93c2-66d5-4e9c-bce4-53273ff67de8	f552f044-2ec4-4939-b955-6ffacd22099a	Polity	9	2026-10-24 11:48:02.586718+00
36d6788d-b94c-4b5b-a645-f19698c3c82d	f552f044-2ec4-4939-b955-6ffacd22099a	Economics	10	2026-10-24 11:48:02.586718+00
379e4f08-e771-4f70-af62-c88f9f41ee14	f552f044-2ec4-4939-b955-6ffacd22099a	Geography	11	2026-10-24 11:48:02.586718+00
7ed51c0f-bd27-4225-afaa-fb065936770a	1c7c7590-4326-40da-8db2-b1709d1c2474	Mathematics	1	2026-11-04 10:40:08.924969+00
a14f61d5-77cb-4157-9958-ffa1cc868287	1c7c7590-4326-40da-8db2-b1709d1c2474	Physics	2	2026-11-04 10:40:08.924969+00
8c8d5df5-c12e-46ff-93d3-aa86f6efd851	1c7c7590-4326-40da-8db2-b1709d1c2474	Chemistry	3	2026-11-04 10:40:08.924969+00
454faa19-553e-459f-b0d1-98934fcd305a	1c7c7590-4326-40da-8db2-b1709d1c2474	Biology	4	2026-11-04 10:40:08.924969+00
f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	1c7c7590-4326-40da-8db2-b1709d1c2474	English	4	2026-11-04 10:40:08.924969+00
4ca553d4-44be-4df8-81ac-e4f9ed85b6eb	1c7c7590-4326-40da-8db2-b1709d1c2474	Reasoning	6	2026-11-04 10:40:08.924969+00
d11f77e4-def7-48fe-85f1-18658601e639	1c7c7590-4326-40da-8db2-b1709d1c2474	Current Affairs	7	2026-11-04 10:40:08.924969+00
c1760ab0-e213-46f4-8aa1-e97975bcef0b	1c7c7590-4326-40da-8db2-b1709d1c2474	History	8	2026-11-04 10:40:08.924969+00
f8e28246-5be5-447b-893e-2ec8c8d83f51	1c7c7590-4326-40da-8db2-b1709d1c2474	Polity	9	2026-11-04 10:40:08.924969+00
14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	1c7c7590-4326-40da-8db2-b1709d1c2474	SSB Sessions	10	2026-11-04 10:40:08.924969+00
ca9a1488-6e39-4ff2-aa0b-7ccd4f31dcb0	1c7c7590-4326-40da-8db2-b1709d1c2474	Economics	10	2026-11-04 10:40:08.924969+00
fa3a4b2d-b04a-4843-8e49-80ee086b9de3	1c7c7590-4326-40da-8db2-b1709d1c2474	Geography	11	2026-11-04 10:40:08.924969+00
3f2f67ec-7c7d-4965-9438-3a2375f77585	76457759-048f-4513-be10-cb9b16a62410	Mathematics	1	2026-11-04 10:40:08.924969+00
18a334e3-0b30-4e75-8e56-110683e99be2	76457759-048f-4513-be10-cb9b16a62410	Physics	2	2026-11-04 10:40:08.924969+00
6d800e12-c6ce-4f6e-9562-5f67a882f71d	76457759-048f-4513-be10-cb9b16a62410	Chemistry	3	2026-11-04 10:40:08.924969+00
5a1c1abf-f2d9-4116-bc35-0cd597280da5	76457759-048f-4513-be10-cb9b16a62410	Biology	4	2026-11-04 10:40:08.924969+00
1034bb79-93c3-46e2-a41f-80513e4b7d0b	76457759-048f-4513-be10-cb9b16a62410	English	4	2026-11-04 10:40:08.924969+00
2c0e52d7-2f02-4c4e-9fff-09811a25d914	76457759-048f-4513-be10-cb9b16a62410	Reasoning	6	2026-11-04 10:40:08.924969+00
e69cfb91-797f-4878-b976-edcf6ed552d9	76457759-048f-4513-be10-cb9b16a62410	Current Affairs	7	2026-11-04 10:40:08.924969+00
c1e1a118-76d2-4403-9896-7a07b298657e	76457759-048f-4513-be10-cb9b16a62410	History	8	2026-11-04 10:40:08.924969+00
055a30e9-8235-413b-a1f9-4f1b5a39e40a	76457759-048f-4513-be10-cb9b16a62410	Polity	9	2026-11-04 10:40:08.924969+00
3ecae0ed-bc40-47e3-91d8-ba2903da30cb	76457759-048f-4513-be10-cb9b16a62410	SSB Sessions	10	2026-11-04 10:40:08.924969+00
1939c5a7-80f7-43bd-85ec-ebeabb4c2bbe	76457759-048f-4513-be10-cb9b16a62410	Economics	10	2026-11-04 10:40:08.924969+00
e799307c-1cfa-4cd7-b993-157804da2d79	76457759-048f-4513-be10-cb9b16a62410	Geography	11	2026-11-04 10:40:08.924969+00
3fc84c73-583f-41ec-861d-25eed9023d9b	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	Mathematics	1	2026-11-04 10:40:08.924969+00
386d9c59-fc3d-4b92-88a5-e0a6858faf1f	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	Physics	2	2026-11-04 10:40:08.924969+00
aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	Chemistry	3	2026-11-04 10:40:08.924969+00
13c77c85-d560-4775-9b37-d97143382cbe	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	Biology	4	2026-11-04 10:40:08.924969+00
75e8bf3e-be66-427c-95a0-8f9616f114c0	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	English	4	2026-11-04 10:40:08.924969+00
5295955c-42eb-4f3e-88d0-8d29b02f36b3	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	Reasoning	6	2026-11-04 10:40:08.924969+00
afcaa86f-6bea-4afd-ab95-05f072f8efc1	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	Current Affairs	7	2026-11-04 10:40:08.924969+00
b313dcd0-fbc7-40bc-bff3-5f1be197b358	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	History	8	2026-11-04 10:40:08.924969+00
5fb2334c-4151-48d5-ad85-5ec19069b359	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	Polity	9	2026-11-04 10:40:08.924969+00
3a24489c-d2a3-41a0-ba6d-0ab9809a8448	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	SSB Sessions	10	2026-11-04 10:40:08.924969+00
7f880931-a1f3-4806-aef5-61a115897dd6	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	Economics	10	2026-11-04 10:40:08.924969+00
c986e17f-fb12-4523-8fa6-1e5f219b749a	0dc2b890-1715-468f-8aed-7f6fe4c2b82a	Geography	11	2026-11-04 10:40:08.924969+00
3c2c2a3f-71aa-45d1-a3b2-cee48038e416	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Mathematics	1	2026-11-04 10:40:08.924969+00
a79d6e73-675c-4374-8007-e13d1dffa262	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Physics	2	2026-11-04 10:40:08.924969+00
9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Chemistry	3	2026-11-04 10:40:08.924969+00
83d5ed5e-7251-4f4b-8309-039871e01d9f	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Biology	4	2026-11-04 10:40:08.924969+00
73ecb8d5-fa4b-4e70-955e-5e49e559133f	f738e1d7-b5a1-42c3-bd1d-b61bae772039	English	4	2026-11-04 10:40:08.924969+00
4cd84255-50eb-4f48-ae77-fa47bd8f1b8c	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Reasoning	6	2026-11-04 10:40:08.924969+00
e8349e7a-e816-4144-a611-d7332bd9a0b8	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Current Affairs	7	2026-11-04 10:40:08.924969+00
2db504df-e864-45f7-b386-e17d20a724ca	f738e1d7-b5a1-42c3-bd1d-b61bae772039	History	8	2026-11-04 10:40:08.924969+00
c42d9384-2910-422f-9908-f80e448b0e0d	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Polity	9	2026-11-04 10:40:08.924969+00
c6f91768-6b5e-4b3a-b73f-35ad89b105f5	f738e1d7-b5a1-42c3-bd1d-b61bae772039	SSB Sessions	10	2026-11-04 10:40:08.924969+00
fdca98d5-8ae8-4242-9227-f2a8727f609d	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Economics	10	2026-11-04 10:40:08.924969+00
20ad20fd-416b-47c8-9679-dc0a54500312	f738e1d7-b5a1-42c3-bd1d-b61bae772039	Geography	11	2026-11-04 10:40:08.924969+00
94d3a789-d680-498d-aef5-05fb1af4d9ce	34852013-ff65-40a0-b9c9-335240430ae3	Mathematics	1	2026-11-04 10:40:08.924969+00
a43f195b-fd15-4155-8e77-fe80e4a9f766	34852013-ff65-40a0-b9c9-335240430ae3	Physics	2	2026-11-04 10:40:08.924969+00
636ee88b-da18-4eb6-9610-cfe648b8c624	34852013-ff65-40a0-b9c9-335240430ae3	Chemistry	3	2026-11-04 10:40:08.924969+00
48cf5b74-6a36-40ef-ab40-b43e4efcb72f	34852013-ff65-40a0-b9c9-335240430ae3	Biology	4	2026-11-04 10:40:08.924969+00
41f1a480-c709-40b9-a40b-737b095207ff	34852013-ff65-40a0-b9c9-335240430ae3	English	4	2026-11-04 10:40:08.924969+00
4370529a-0609-4661-a44e-643d9fc2b8ba	34852013-ff65-40a0-b9c9-335240430ae3	Reasoning	6	2026-11-04 10:40:08.924969+00
8acae6af-e1c2-44f2-ab26-d919f275423b	34852013-ff65-40a0-b9c9-335240430ae3	Current Affairs	7	2026-11-04 10:40:08.924969+00
ddf961f0-2251-445d-b324-41704eed0e43	34852013-ff65-40a0-b9c9-335240430ae3	History	8	2026-11-04 10:40:08.924969+00
d239b467-ac86-4b22-90d7-70684abb6c35	34852013-ff65-40a0-b9c9-335240430ae3	Polity	9	2026-11-04 10:40:08.924969+00
d5a6b073-c2d1-4fa2-8bce-84a108ce9875	34852013-ff65-40a0-b9c9-335240430ae3	SSB Sessions	10	2026-11-04 10:40:08.924969+00
4d1300b1-57b6-4b0c-ac41-7cb3198f8511	34852013-ff65-40a0-b9c9-335240430ae3	Economics	10	2026-11-04 10:40:08.924969+00
760a3b3e-2709-45c9-8705-1081f9ed6c01	34852013-ff65-40a0-b9c9-335240430ae3	Geography	11	2026-11-04 10:40:08.924969+00
b9e97456-8606-4841-a57a-6aae1bb13d8a	ba158506-9e4d-4f29-8d2c-7096c92f6db4	Mathematics	1	2026-11-04 10:40:08.924969+00
\.


--
-- Data for Name: teacher_subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.teacher_subjects (teacher_id, subject_id) FROM stdin;
4049b788-103c-4f13-8851-81b812883a72	70ebeeb9-b739-403a-92b1-79d79fb54cde
3600c149-fc58-495b-a924-c63c990bb9b3	b55b807d-47e3-457e-9c40-f7430918b8a9
4049b788-103c-4f13-8851-81b812883a72	379e4f08-e771-4f70-af62-c88f9f41ee14
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	0a175665-379e-40a1-b68b-765e2583eb65
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7
635ede62-1c14-4a0c-8479-c0663f92a675	56c7b3a0-63ba-44b2-8299-b8fd1937408f
e6acf08f-e058-486e-bcf0-2aa9fe86f75f	46125bfc-662e-4cdb-a0ec-2f6f764809fe
3600c149-fc58-495b-a924-c63c990bb9b3	70ebeeb9-b739-403a-92b1-79d79fb54cde
8309c6ec-d65a-49a6-b148-4011b5bc19e0	36d6788d-b94c-4b5b-a645-f19698c3c82d
8309c6ec-d65a-49a6-b148-4011b5bc19e0	70ebeeb9-b739-403a-92b1-79d79fb54cde
16850f0d-d1e6-4e8e-9e93-44e0559b288a	6bd29f85-f263-4404-beaa-f0d68519092d
16850f0d-d1e6-4e8e-9e93-44e0559b288a	7ed51c0f-bd27-4225-afaa-fb065936770a
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	a14f61d5-77cb-4157-9958-ffa1cc868287
635ede62-1c14-4a0c-8479-c0663f92a675	8c8d5df5-c12e-46ff-93d3-aa86f6efd851
e6acf08f-e058-486e-bcf0-2aa9fe86f75f	454faa19-553e-459f-b0d1-98934fcd305a
3600c149-fc58-495b-a924-c63c990bb9b3	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	4ca553d4-44be-4df8-81ac-e4f9ed85b6eb
4049b788-103c-4f13-8851-81b812883a72	d11f77e4-def7-48fe-85f1-18658601e639
3600c149-fc58-495b-a924-c63c990bb9b3	d11f77e4-def7-48fe-85f1-18658601e639
8309c6ec-d65a-49a6-b148-4011b5bc19e0	d11f77e4-def7-48fe-85f1-18658601e639
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	c1760ab0-e213-46f4-8aa1-e97975bcef0b
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	f8e28246-5be5-447b-893e-2ec8c8d83f51
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	9786e12d-8dd0-4c39-a9d9-ca3bdd196885
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	27cf93c2-66d5-4e9c-bce4-53273ff67de8
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	4e322df8-635d-4eab-8706-467d5370c735
8309c6ec-d65a-49a6-b148-4011b5bc19e0	ca9a1488-6e39-4ff2-aa0b-7ccd4f31dcb0
4049b788-103c-4f13-8851-81b812883a72	fa3a4b2d-b04a-4843-8e49-80ee086b9de3
16850f0d-d1e6-4e8e-9e93-44e0559b288a	3f2f67ec-7c7d-4965-9438-3a2375f77585
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	18a334e3-0b30-4e75-8e56-110683e99be2
635ede62-1c14-4a0c-8479-c0663f92a675	6d800e12-c6ce-4f6e-9562-5f67a882f71d
e6acf08f-e058-486e-bcf0-2aa9fe86f75f	5a1c1abf-f2d9-4116-bc35-0cd597280da5
3600c149-fc58-495b-a924-c63c990bb9b3	1034bb79-93c3-46e2-a41f-80513e4b7d0b
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	2c0e52d7-2f02-4c4e-9fff-09811a25d914
4049b788-103c-4f13-8851-81b812883a72	e69cfb91-797f-4878-b976-edcf6ed552d9
3600c149-fc58-495b-a924-c63c990bb9b3	e69cfb91-797f-4878-b976-edcf6ed552d9
8309c6ec-d65a-49a6-b148-4011b5bc19e0	e69cfb91-797f-4878-b976-edcf6ed552d9
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	c1e1a118-76d2-4403-9896-7a07b298657e
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	055a30e9-8235-413b-a1f9-4f1b5a39e40a
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	3ecae0ed-bc40-47e3-91d8-ba2903da30cb
8309c6ec-d65a-49a6-b148-4011b5bc19e0	1939c5a7-80f7-43bd-85ec-ebeabb4c2bbe
4049b788-103c-4f13-8851-81b812883a72	e799307c-1cfa-4cd7-b993-157804da2d79
16850f0d-d1e6-4e8e-9e93-44e0559b288a	3fc84c73-583f-41ec-861d-25eed9023d9b
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	386d9c59-fc3d-4b92-88a5-e0a6858faf1f
635ede62-1c14-4a0c-8479-c0663f92a675	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54
e6acf08f-e058-486e-bcf0-2aa9fe86f75f	13c77c85-d560-4775-9b37-d97143382cbe
3600c149-fc58-495b-a924-c63c990bb9b3	75e8bf3e-be66-427c-95a0-8f9616f114c0
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	5295955c-42eb-4f3e-88d0-8d29b02f36b3
4049b788-103c-4f13-8851-81b812883a72	afcaa86f-6bea-4afd-ab95-05f072f8efc1
3600c149-fc58-495b-a924-c63c990bb9b3	afcaa86f-6bea-4afd-ab95-05f072f8efc1
8309c6ec-d65a-49a6-b148-4011b5bc19e0	afcaa86f-6bea-4afd-ab95-05f072f8efc1
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	b313dcd0-fbc7-40bc-bff3-5f1be197b358
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	5fb2334c-4151-48d5-ad85-5ec19069b359
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	3a24489c-d2a3-41a0-ba6d-0ab9809a8448
8309c6ec-d65a-49a6-b148-4011b5bc19e0	7f880931-a1f3-4806-aef5-61a115897dd6
4049b788-103c-4f13-8851-81b812883a72	c986e17f-fb12-4523-8fa6-1e5f219b749a
16850f0d-d1e6-4e8e-9e93-44e0559b288a	3c2c2a3f-71aa-45d1-a3b2-cee48038e416
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	a79d6e73-675c-4374-8007-e13d1dffa262
635ede62-1c14-4a0c-8479-c0663f92a675	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc
e6acf08f-e058-486e-bcf0-2aa9fe86f75f	83d5ed5e-7251-4f4b-8309-039871e01d9f
3600c149-fc58-495b-a924-c63c990bb9b3	73ecb8d5-fa4b-4e70-955e-5e49e559133f
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	4cd84255-50eb-4f48-ae77-fa47bd8f1b8c
4049b788-103c-4f13-8851-81b812883a72	e8349e7a-e816-4144-a611-d7332bd9a0b8
3600c149-fc58-495b-a924-c63c990bb9b3	e8349e7a-e816-4144-a611-d7332bd9a0b8
8309c6ec-d65a-49a6-b148-4011b5bc19e0	e8349e7a-e816-4144-a611-d7332bd9a0b8
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	2db504df-e864-45f7-b386-e17d20a724ca
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	c42d9384-2910-422f-9908-f80e448b0e0d
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	c6f91768-6b5e-4b3a-b73f-35ad89b105f5
8309c6ec-d65a-49a6-b148-4011b5bc19e0	fdca98d5-8ae8-4242-9227-f2a8727f609d
4049b788-103c-4f13-8851-81b812883a72	20ad20fd-416b-47c8-9679-dc0a54500312
16850f0d-d1e6-4e8e-9e93-44e0559b288a	94d3a789-d680-498d-aef5-05fb1af4d9ce
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	a43f195b-fd15-4155-8e77-fe80e4a9f766
635ede62-1c14-4a0c-8479-c0663f92a675	636ee88b-da18-4eb6-9610-cfe648b8c624
e6acf08f-e058-486e-bcf0-2aa9fe86f75f	48cf5b74-6a36-40ef-ab40-b43e4efcb72f
3600c149-fc58-495b-a924-c63c990bb9b3	41f1a480-c709-40b9-a40b-737b095207ff
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	4370529a-0609-4661-a44e-643d9fc2b8ba
4049b788-103c-4f13-8851-81b812883a72	8acae6af-e1c2-44f2-ab26-d919f275423b
3600c149-fc58-495b-a924-c63c990bb9b3	8acae6af-e1c2-44f2-ab26-d919f275423b
8309c6ec-d65a-49a6-b148-4011b5bc19e0	8acae6af-e1c2-44f2-ab26-d919f275423b
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	ddf961f0-2251-445d-b324-41704eed0e43
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	d239b467-ac86-4b22-90d7-70684abb6c35
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	d5a6b073-c2d1-4fa2-8bce-84a108ce9875
8309c6ec-d65a-49a6-b148-4011b5bc19e0	4d1300b1-57b6-4b0c-ac41-7cb3198f8511
4049b788-103c-4f13-8851-81b812883a72	760a3b3e-2709-45c9-8705-1081f9ed6c01
16850f0d-d1e6-4e8e-9e93-44e0559b288a	b9e97456-8606-4841-a57a-6aae1bb13d8a
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827
635ede62-1c14-4a0c-8479-c0663f92a675	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf
e6acf08f-e058-486e-bcf0-2aa9fe86f75f	607b7030-b40c-4679-beb7-2e75e9d23dcc
3600c149-fc58-495b-a924-c63c990bb9b3	2c31c03e-133b-4893-b7ad-23958391635c
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	ca821a00-b270-4f44-bb14-906d795b1f47
4049b788-103c-4f13-8851-81b812883a72	ee3d6099-911f-4697-a1c2-a2b18fe2dbe5
3600c149-fc58-495b-a924-c63c990bb9b3	ee3d6099-911f-4697-a1c2-a2b18fe2dbe5
8309c6ec-d65a-49a6-b148-4011b5bc19e0	ee3d6099-911f-4697-a1c2-a2b18fe2dbe5
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	d2e7b350-4ecf-4607-acd5-0626fcf5192c
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	33e66595-9958-4f01-acd4-4e74c90494af
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	11c78503-6e03-440a-9533-0c8314dd82c2
8309c6ec-d65a-49a6-b148-4011b5bc19e0	fb7009ce-347d-4ab5-a91d-c824e8b6a011
4049b788-103c-4f13-8851-81b812883a72	751ab330-68b6-4d4e-8c0b-87a9440d0119
\.


--
-- Data for Name: teachers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.teachers (id, name, phone, active, created_at, pin) FROM stdin;
4049b788-103c-4f13-8851-81b812883a72	Neelav Sir	\N	t	2026-10-24 11:10:07.048146+00	1234
16850f0d-d1e6-4e8e-9e93-44e0559b288a	Dipyaman Sir	\N	t	2026-10-24 11:48:02.586718+00	1234
635ede62-1c14-4a0c-8479-c0663f92a675	Pallavi Ma'am	\N	t	2026-10-24 11:48:02.586718+00	1234
e6acf08f-e058-486e-bcf0-2aa9fe86f75f	Pallabi Bhuyan Ma'am	\N	t	2026-10-24 11:48:02.586718+00	1234
3600c149-fc58-495b-a924-c63c990bb9b3	Epsha Ma'am	\N	t	2026-10-24 11:48:02.586718+00	1234
8309c6ec-d65a-49a6-b148-4011b5bc19e0	Swapneel Sir	\N	t	2026-10-24 11:48:02.586718+00	1234
2b7bdd69-d56e-4ad8-8a44-62c37f1fa8ac	Salma Ma'am	\N	t	2026-10-24 11:48:02.586718+00	1234
15f74ec0-1b09-405e-ac2f-eef709a9c4aa	Ashish Sir	\N	t	2026-10-24 11:48:02.586718+00	1234
\.


--
-- Data for Name: topics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.topics (id, subject_id, name, seq_no, target_date, notes, created_at) FROM stdin;
f5e6a3c3-7418-4dd0-b674-664cc7ea4c8b	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Cell	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
2f09caeb-e193-4227-854d-de3d2f68b847	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Animal Tissues	2	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
aff500c2-0e47-4705-9428-3b70d9c443c4	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Plant Tissues	3	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
18d4760b-17a2-49cf-94ce-463e43cd6982	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Life Processes	4	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
4983d8ca-0507-46f7-b500-3878f35ffe3d	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Control and Coordination in Humans	5	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
9d4a17ad-e625-4d28-82ed-369876e84542	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Control and Coordination in Plants	6	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
7898c4c5-c12d-4929-a172-ebd293e6f16b	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Reproduction – Introduction	7	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
95d14a52-3a88-460d-8876-250838c6fd0a	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Sexual Reproduction in Flowering Plants	8	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f26018cd-c2fb-419e-a054-0d3e2d7602f7	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Human Reproduction	9	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
bf9d7ac1-a025-417b-895f-4586627c495c	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Diversity in Organisms	10	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
63b6ab70-faa2-48d1-87a6-9262a29eedae	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Human Health and Diseases	11	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
da92014b-834a-4db1-94cb-4a97c55a513b	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Important Vitamins and Minerals	12	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
73ca24c5-12c5-4fc2-a1c9-8d5afab396e9	46125bfc-662e-4cdb-a0ec-2f6f764809fe	Genetics	13	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
c6d11eaa-517e-49b3-a02a-44a2c703513a	56c7b3a0-63ba-44b2-8299-b8fd1937408f	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
b59c0220-bc26-4230-ab51-ff38b56cc094	56c7b3a0-63ba-44b2-8299-b8fd1937408f	Physical Classification of Matter	2	2026-11-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
36610d47-d5c1-453c-a06d-9b638341f0a4	56c7b3a0-63ba-44b2-8299-b8fd1937408f	Elements, Compounds and Mixtures	3	2026-11-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
3a8f85ac-6b71-459b-96e5-454f3c4834b8	56c7b3a0-63ba-44b2-8299-b8fd1937408f	Structure of Atom	4	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
7ad3a282-b64f-444d-8770-58fa889946ea	56c7b3a0-63ba-44b2-8299-b8fd1937408f	Electronic Configuration	5	2026-12-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
53fc222a-bed6-416f-8565-b54772e1a666	56c7b3a0-63ba-44b2-8299-b8fd1937408f	Periodic Table	6	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
27f467d7-51ff-410d-b3e1-3ba21353b0dd	56c7b3a0-63ba-44b2-8299-b8fd1937408f	Chemical Bonding	7	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
bce9f91d-7a20-4f75-b1b7-4becac5c3083	56c7b3a0-63ba-44b2-8299-b8fd1937408f	Acids, Bases and Salts	8	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
d58d14d6-3f44-4044-b2fb-125967bd4f33	56c7b3a0-63ba-44b2-8299-b8fd1937408f	Metals and Non-Metals	9	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f5a4b724-31bc-4952-87b9-3dd514890643	56c7b3a0-63ba-44b2-8299-b8fd1937408f	The Iso Species and Carbon	10	2027-02-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
92e4b0b9-ffdf-41a9-b71a-ac7a77da8d5e	56c7b3a0-63ba-44b2-8299-b8fd1937408f	IUPAC Nomenclature and Types of Reactions	11	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
d8af5d28-1415-430a-8c82-f4963080e66d	56c7b3a0-63ba-44b2-8299-b8fd1937408f	Important Industrial Preparations, Corrosion, Water and Types of Hardness	12	2027-03-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
9381cdfa-b2da-4788-9e24-35747d5f3db7	56c7b3a0-63ba-44b2-8299-b8fd1937408f	Mole Concept	13	2027-03-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
38b66ac6-71e8-4b31-aee7-27994ad1314e	56c7b3a0-63ba-44b2-8299-b8fd1937408f	Chemistry in Everyday Life	14	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
056c38cd-d4b5-46fd-919d-679c1dd93dfe	70ebeeb9-b739-403a-92b1-79d79fb54cde	September	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
0cff0ed2-a0e3-49af-96ff-bae15641cf19	70ebeeb9-b739-403a-92b1-79d79fb54cde	October	2	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
fd4601d6-ec0f-48e5-b4ad-59cb42d6ff49	70ebeeb9-b739-403a-92b1-79d79fb54cde	November	3	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
232f908b-2b1d-431e-8dd6-e7fe5f821fb5	70ebeeb9-b739-403a-92b1-79d79fb54cde	December	4	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
2d10f3f8-44c9-4446-8d64-2e5f716432bd	70ebeeb9-b739-403a-92b1-79d79fb54cde	January	5	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
41214ff5-c1e0-4d36-89db-16936191d8d1	36d6788d-b94c-4b5b-a645-f19698c3c82d	Basics of Economics	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
5afc0c6b-241d-4d9d-91de-ca73961392b5	36d6788d-b94c-4b5b-a645-f19698c3c82d	Types of Economy	2	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
db0506f7-668f-4903-a30c-90b52dd627b1	36d6788d-b94c-4b5b-a645-f19698c3c82d	Planning in India	3	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
02097f5a-8fdc-448a-af60-87d5ed9a37d6	36d6788d-b94c-4b5b-a645-f19698c3c82d	Five Year Plans	4	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
fd506fc8-8b2a-4b21-a38b-2c728f9e0317	36d6788d-b94c-4b5b-a645-f19698c3c82d	Money	5	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f226d62d-cd66-45f8-8009-5479cd2787b7	36d6788d-b94c-4b5b-a645-f19698c3c82d	Banking	6	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
1933e01c-7ff9-44bf-9bc8-608fe3757289	36d6788d-b94c-4b5b-a645-f19698c3c82d	Current Budget	7	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
b02bc42a-549c-446e-8f2c-1242a3b18770	36d6788d-b94c-4b5b-a645-f19698c3c82d	International Institutions	8	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
73a2216f-e04f-48ab-a3d3-31c7592ddbb9	b55b807d-47e3-457e-9c40-f7430918b8a9	All About NDA Exam	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
41c3d351-449d-48a3-bd3d-11ffb38782f6	b55b807d-47e3-457e-9c40-f7430918b8a9	Vocabulary	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
a33e9c1c-bdc9-48f6-afe1-aeedf9ac07df	b55b807d-47e3-457e-9c40-f7430918b8a9	Noun	3	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
050d069d-0785-46c1-bac3-be409b908f95	b55b807d-47e3-457e-9c40-f7430918b8a9	Pronoun	4	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
d38edbda-f0fd-4cc7-89b3-a6355d3de321	b55b807d-47e3-457e-9c40-f7430918b8a9	Idioms and Phrases	5	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
53e2f674-f929-4a3e-8816-22a30b646d54	b55b807d-47e3-457e-9c40-f7430918b8a9	Conjunction	6	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
b32c03f8-ab83-4a91-899d-890eb97b10c2	b55b807d-47e3-457e-9c40-f7430918b8a9	Adjective	7	2026-12-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
7a3f78fb-d243-426e-911f-47f15672239b	b55b807d-47e3-457e-9c40-f7430918b8a9	Adverb	8	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
d3a9ef4e-2e4f-4151-8e5f-278397220ead	b55b807d-47e3-457e-9c40-f7430918b8a9	Preposition	9	2026-12-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
d197aa93-8c7a-49f2-b26f-27ad44f01e33	b55b807d-47e3-457e-9c40-f7430918b8a9	Fixed Preposition	10	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
e5a67d17-7141-441f-804c-a6a9c62cf69e	b55b807d-47e3-457e-9c40-f7430918b8a9	Articles	11	2027-01-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
ccb4f4fd-9961-4c91-8437-8875ae56c925	b55b807d-47e3-457e-9c40-f7430918b8a9	Sentence Arrangement	12	2027-01-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
98eb4a1d-96a6-46bc-9b0a-2fd773987a24	b55b807d-47e3-457e-9c40-f7430918b8a9	Verb	13	2027-01-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
25231ad0-e64c-459e-896c-5b7063641905	b55b807d-47e3-457e-9c40-f7430918b8a9	Tense	14	2027-01-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
ed1efe34-4b1d-4bae-be5f-1d7e405ed15c	b55b807d-47e3-457e-9c40-f7430918b8a9	Conditional Sentences	15	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
8b4832d9-a718-4d0f-b3b0-6d9116e028f8	b55b807d-47e3-457e-9c40-f7430918b8a9	Question Tag	16	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
cc3fe3d0-e6e7-40e9-9607-4d27b2549833	b55b807d-47e3-457e-9c40-f7430918b8a9	Voice	17	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
78162cc9-4ba0-4da3-af4e-0ab8158c90cf	b55b807d-47e3-457e-9c40-f7430918b8a9	Narration	18	2027-02-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
943382e8-9b7f-408e-be10-75b16416e7f4	b55b807d-47e3-457e-9c40-f7430918b8a9	Modals	19	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
cd632fe7-b24c-4585-a380-dca30302aa19	b55b807d-47e3-457e-9c40-f7430918b8a9	Passage	20	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
7e8ac80e-e0cb-43e0-908f-c7afab5aa059	b55b807d-47e3-457e-9c40-f7430918b8a9	Cloze Test	21	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f805dccf-d8b1-46c6-b25c-9f612431dc4d	b55b807d-47e3-457e-9c40-f7430918b8a9	Previous Year Questions	22	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
c79f3c8b-8eb4-4d80-81ad-96d853966b12	b55b807d-47e3-457e-9c40-f7430918b8a9	Homophones	23	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
781adc41-afeb-44bf-b832-5cc53b039321	b55b807d-47e3-457e-9c40-f7430918b8a9	Important Miscellaneous Questions	24	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
1367c2e7-a98e-4af5-8422-54877ecfb1f3	379e4f08-e771-4f70-af62-c88f9f41ee14	Introduction of Geography & Syllabus	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
cbd60856-a002-4810-a5a6-6a13215c16e6	379e4f08-e771-4f70-af62-c88f9f41ee14	Universe and Cosmology	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
5583e847-4499-4888-ac22-89e3a53beb82	379e4f08-e771-4f70-af62-c88f9f41ee14	Solar System	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
7b0d0858-8e61-439e-aa13-cd38d5a7950c	379e4f08-e771-4f70-af62-c88f9f41ee14	Earth, Latitude & Longitude	4	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
fb4dd5ba-e882-403c-b5c8-4fb978634b16	379e4f08-e771-4f70-af62-c88f9f41ee14	Interior of the Earth	5	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
43fa4916-360c-4621-958f-3b4644d08a7a	379e4f08-e771-4f70-af62-c88f9f41ee14	Formation of the Continents & Rocks	6	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
97ba1433-b310-4d0e-ad41-38eb554558f6	379e4f08-e771-4f70-af62-c88f9f41ee14	Plate Tectonics	7	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
cd2ac7ad-a898-4d79-9b26-19298f1bf976	379e4f08-e771-4f70-af62-c88f9f41ee14	Geomorphic Process (Endogenetic & Exogenetic)	8	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
357c3bb8-61cd-4582-94bb-9890618bb39d	379e4f08-e771-4f70-af62-c88f9f41ee14	Formation of Mountains, Plateaus & Plains	9	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
97c9959e-65c2-4dbb-8da2-c5469b6099b3	379e4f08-e771-4f70-af62-c88f9f41ee14	Volcanos, Earthquake & Tsunami	10	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
6be7c67a-0b0e-464b-8655-508530d95ed0	379e4f08-e771-4f70-af62-c88f9f41ee14	Composition & Structure of Atmosphere	11	2026-12-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
a5a52fca-8a15-4d72-bdeb-c896cff4ba8f	379e4f08-e771-4f70-af62-c88f9f41ee14	Earth Temperature & Atmospheric Pressure	12	2026-12-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f1e7ff42-7849-4902-87db-715b52bcff4b	379e4f08-e771-4f70-af62-c88f9f41ee14	Temperature Zones, Pressure Belts & Winds	13	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
02023615-be8e-45ca-9fcc-3f7fe996e8f5	379e4f08-e771-4f70-af62-c88f9f41ee14	Climate & Weather	14	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
e3ef92cb-32b2-4aaf-9a95-591054f3632b	379e4f08-e771-4f70-af62-c88f9f41ee14	Precipitation, Cloud, Jet Stream & Cyclones	15	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
0b5ab361-671d-4f3b-9a52-61ddbe6900c3	379e4f08-e771-4f70-af62-c88f9f41ee14	Ocean & Ocean Relief Features	16	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
85f60018-2701-42b8-bb85-edcc1abbc8d9	379e4f08-e771-4f70-af62-c88f9f41ee14	Ocean Water Properties, Waves, Current & Tides	17	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
68bab00f-0c02-4670-9592-b1d7c25ada56	379e4f08-e771-4f70-af62-c88f9f41ee14	Other Water Bodies & Formations	18	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f83dd537-188f-47ba-b6cd-c599e71d76ad	379e4f08-e771-4f70-af62-c88f9f41ee14	World Facts About Continents	19	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
776fa0b5-9869-4516-99fa-acd31cb95e73	379e4f08-e771-4f70-af62-c88f9f41ee14	Soil, Natural Vegetation & Types	20	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
60865282-82a8-4a33-932f-638f85389ed1	379e4f08-e771-4f70-af62-c88f9f41ee14	Physiography of India	21	2027-02-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
2dce5f73-8ed4-4b7b-9ff4-c75bf1ae71db	379e4f08-e771-4f70-af62-c88f9f41ee14	Indian Mountains	22	2027-02-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
438e48fb-4553-4a17-a458-cd140b71ef6d	379e4f08-e771-4f70-af62-c88f9f41ee14	Indian Plateau & Coastal Regions (Ghats)	23	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
a73106aa-8bc0-4065-97e4-72938b2f14ee	379e4f08-e771-4f70-af62-c88f9f41ee14	Plainland, Desert & Islands	24	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
9e2fef78-b395-42bc-ae42-4be27994d306	379e4f08-e771-4f70-af62-c88f9f41ee14	Drainage System (Northern)	25	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
e93d30e0-200c-4053-8bcc-7cd6131ad42f	379e4f08-e771-4f70-af62-c88f9f41ee14	Drainage System (Peninsula)	26	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
fb3826fd-f77f-4929-838e-f486a0871c27	379e4f08-e771-4f70-af62-c88f9f41ee14	Indian Climate & Monsoon	27	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
9f8b94ec-6b15-42de-a206-52e8549e1f32	379e4f08-e771-4f70-af62-c88f9f41ee14	Vegetation & Forest	28	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
576e9031-653a-4ebd-9c1b-83ce67a4002e	379e4f08-e771-4f70-af62-c88f9f41ee14	India Soil & Agriculture (Crops)	29	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
e33ffd5f-e394-4c3b-a1e7-4e53dd90a4aa	379e4f08-e771-4f70-af62-c88f9f41ee14	Minerals, Energy & Industry	30	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
3a7c1e26-a094-4930-8cf0-7d5af4436ab0	379e4f08-e771-4f70-af62-c88f9f41ee14	Transportation	31	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
fc0250d9-b6bf-4c67-8301-5e3bd53298cc	379e4f08-e771-4f70-af62-c88f9f41ee14	Practice Session	32	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
38fc8f51-04f5-49ee-a995-336fda035ec4	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
eacf5280-fad6-4a2b-93cd-806e1eeaf25e	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Origin of Human	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
d93bd971-13ff-4c6a-a5fb-d9894c190e08	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Indus Valley Civilization	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
52ad44c5-ea09-4eed-b504-a78478abe694	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Vedic Civilization	4	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
1b0cf2ea-2dec-464b-a3aa-283b889d5e71	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Religious Movement	5	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
c2831ca4-b084-498b-8edd-e407c10c61d6	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Mahajanapadas / Foreign Invasions	6	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
4eb0e962-ca19-4c55-9142-969273650984	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Mauryan Empire	7	2026-12-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
84c5e4c7-bc9a-478e-ba39-a1b8811e163b	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Post Mauryan Age	8	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
5c88f25a-e513-4a85-ad7f-183c9daaac15	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Sangam Era	9	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
c581c8a9-1df5-4c6e-bb00-4aedd2def6e7	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Gupta Empire	10	2026-12-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f89cfb55-e6ad-4d69-8119-3f1bb0a34d01	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Post Gupta Age	11	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
31c0ac7d-8e57-4e6d-b33d-382bf78b9a52	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Rajput Period	12	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
9f09b03e-0293-4db1-bac1-34a48e188437	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Chola Empire	13	2026-12-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
cdf474da-0013-4f72-b935-31491aae352e	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Delhi Sultanate	14	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
70cb49db-8fd5-4d63-a11b-4cd87ba0a57a	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Vijaynagar Empire	15	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
78c067c4-4752-4b68-91f7-619c9cecc867	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Bahamani Empire	16	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
cda7d761-2297-486f-a976-fce33d0708bb	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Bhakti Movement	17	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
3734f861-e7b3-43e1-91c3-ed4b69bf77b0	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Sufi Movement	18	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
45cb1ed3-162e-4131-9135-ef38e03e350e	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Rise of Mughals	19	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
ed83ee31-a0b9-4fa7-8711-ad3fba385976	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Expansion of Mughal Empire	20	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
db1939da-26a4-4757-b8c1-cf090354f092	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Aurangzeb and Decline of Mughals	21	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
a14003af-9fb1-433e-8d23-bb3b49874c55	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Later Mughals	22	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
79291aed-7ba0-4334-b400-8614e3bcd489	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	The Rise of Maratha Empire under Shivaji	23	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
dcdbaf55-1ad1-465d-aaea-38e458d669c0	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Peshwa and Third Battle of Panipat	24	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
762f9a54-0542-4dc3-99b5-09596622a60a	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Arrival of Europeans in India	25	2027-02-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
88444174-1280-461f-84e9-58815d8da215	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	British Conquest in India	26	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
1d1b4b4c-e961-4691-ac00-cba2b2fb744a	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Early Revolts Against British Rule	27	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
50036a47-f635-4293-8539-9874e6d23528	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Indian Renaissance	28	2027-03-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
05d01765-17b2-4b20-94de-cc24dae64338	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Rise of British Rule	29	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
6afc9f2e-503b-47c3-a0f1-fb1c1d6d71c2	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	British Rule	30	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
32b72624-d354-4f2c-b05d-3a906e5e8d48	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	The Revolt of 1857	31	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
0fef8d35-1010-4669-b7e0-51ccf21b3eb4	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	Crown Rule	32	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
6370e602-1f0c-45a6-bf91-64d18df463cb	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	National Movement	33	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
24e17eeb-3ff2-46c4-b200-8e295ddab7bc	9786e12d-8dd0-4c39-a9d9-ca3bdd196885	World History	34	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
b28f0f70-00ff-4379-8062-777c9ec114a3	0a175665-379e-40a1-b68b-765e2583eb65	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
ae69d8bc-1911-45df-807c-609828a943fd	0a175665-379e-40a1-b68b-765e2583eb65	Basic Mathematics	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
c65b0854-697b-4da9-b7a0-89bb70d031e3	0a175665-379e-40a1-b68b-765e2583eb65	Units & Measurements (Errors + Dimensions)	3	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
095a81fe-1704-4803-b2b8-55a3c45d49f4	0a175665-379e-40a1-b68b-765e2583eb65	Vector	4	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
803ae001-3d80-4326-83fe-26973df92335	0a175665-379e-40a1-b68b-765e2583eb65	Motion in Straight Line	5	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f6c1565b-b4c1-485f-873a-00602935ea55	0a175665-379e-40a1-b68b-765e2583eb65	Motion in Plane	6	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
462090fa-6a35-4f07-99a7-03a11897b4d8	0a175665-379e-40a1-b68b-765e2583eb65	Newton’s Laws of Motion (NLM)	7	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
af3ec5b7-41d4-44b4-9c15-c9a541475852	0a175665-379e-40a1-b68b-765e2583eb65	Friction	8	2026-12-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
6c84dc35-c4c6-45b9-8841-365b831281d7	0a175665-379e-40a1-b68b-765e2583eb65	Work, Power & Energy (WPE)	9	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
3878f0d7-5ee1-4628-a98c-7fa166b54ad8	0a175665-379e-40a1-b68b-765e2583eb65	Gravitation	10	2026-12-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
9c151deb-bee9-437b-a389-184e00d4bf95	0a175665-379e-40a1-b68b-765e2583eb65	Rotation (Basics)	11	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
07003e3a-2b6d-42eb-a1bf-1cc29cd61eda	0a175665-379e-40a1-b68b-765e2583eb65	Mechanical Properties of Solids	12	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
9b782150-604f-45f0-b22e-57e7427b0d61	0a175665-379e-40a1-b68b-765e2583eb65	Mechanical Properties of Fluids	13	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
7293b5cc-72b7-47ac-bf67-cc33049271fe	0a175665-379e-40a1-b68b-765e2583eb65	Heat & Thermal Properties	14	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
a441ddbb-80bb-47da-bed3-2af11346ed5a	0a175665-379e-40a1-b68b-765e2583eb65	Thermodynamics + Kinetic Theory of Gases	15	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
4d8e56b0-1821-404d-9439-e63a8a4e97b9	0a175665-379e-40a1-b68b-765e2583eb65	Simple Harmonic Motion (SHM)	16	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
b50bfa27-31bd-44c3-b0f0-2629f3c66a8d	0a175665-379e-40a1-b68b-765e2583eb65	Waves & Sound	17	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
d0a40a01-072c-4a56-9d48-7b66c42a2e20	0a175665-379e-40a1-b68b-765e2583eb65	Electrostatics	18	2027-02-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
cc8dabc4-8568-4eb6-8294-0e3eb0636fef	0a175665-379e-40a1-b68b-765e2583eb65	Current Electricity	19	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
efdcc2af-3224-4182-97d3-506367a27be3	0a175665-379e-40a1-b68b-765e2583eb65	Magnetism & Moving Charges	20	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
edcef0bb-69f6-42cd-9b51-28e89da15968	0a175665-379e-40a1-b68b-765e2583eb65	Electromagnetic Induction (EMI) + AC	21	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
a307f4a7-0091-4375-871c-c5d7ed1fff06	0a175665-379e-40a1-b68b-765e2583eb65	Ray Optics + Wave Optics	22	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
c19464b3-a901-41fd-88b8-a486598efac2	0a175665-379e-40a1-b68b-765e2583eb65	Modern Physics	23	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
d8612449-5b9c-4fd7-870f-764df07cc050	0a175665-379e-40a1-b68b-765e2583eb65	Semiconductor Electronics	24	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
0117410b-9c51-4533-a654-ecb9e4e675d4	0a175665-379e-40a1-b68b-765e2583eb65	PYQ + Final Revision	25	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
50fb803f-cf9f-47df-b104-92a5d277635d	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
8a30daf6-24b8-4b0d-b551-4a3e7913706a	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Basics of Polity	2	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
38242da2-d753-463c-9aad-74b22a60bce5	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Constitutional Development	3	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
3682624d-69e0-4513-ac47-4d145d2ddb41	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Making of Constitution	4	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
d19392c5-1be4-4683-9e04-7cc716ef2cbb	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Features and Preamble of Constitution	5	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
8978ef6b-5b37-436e-aeff-cf6fa5f16cb9	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Union and Its Territories	6	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
3cd661b2-5094-45fd-a9d0-913169ac8410	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Citizenship	7	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
54dde67d-3129-4b1c-bb0e-bd85873d2849	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Fundamental Rights	8	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
ea19289c-c89f-4c66-8b12-17f0ed49b5d8	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Directive Principles of State Policy	9	2027-01-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
45421eec-7edf-4f55-aeeb-35fe22158ebe	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Fundamental Duties	10	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
d0c4df14-7cd6-40ea-a22d-bfbac312ee0f	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Parliament	11	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
736d2935-c770-4560-890f-7dde6c4c988e	27cf93c2-66d5-4e9c-bce4-53273ff67de8	President	12	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
ad7c9aae-3785-40fe-b4df-82dc121914d4	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Vice President	13	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
17d99d93-62a0-420b-8113-72a5695da74a	27cf93c2-66d5-4e9c-bce4-53273ff67de8	State Legislature	14	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
0e8ab8db-d447-4553-977d-c96c1ccb2c8b	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Governor	15	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
6690f6c8-8ebc-47ce-a17c-48622ed31376	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Supreme Court	16	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
e925d97e-97ca-4290-b4a6-f771bcf957f3	27cf93c2-66d5-4e9c-bce4-53273ff67de8	High Court	17	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
33bd23e6-90cc-44d4-bba7-c3b7b010b2cd	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Emergency	18	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f348beed-6c2d-4939-bd6c-a0a94e5ac2d9	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Local Self Government	19	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
2b296294-170b-4c5e-b5a2-59bbf5fc9844	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Constitutional Bodies	20	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
3b074da7-33fe-4b7e-a06b-269b860b1464	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Important Amendments	21	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
6b8a3415-5f79-4fe4-863e-01845fdbcc21	27cf93c2-66d5-4e9c-bce4-53273ff67de8	Miscellaneous	22	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
d0069705-0285-41c7-87a3-a133adccc4c8	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Introduction to SSB Process	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
a69d72a9-a9fe-413d-a13c-5ce21e1c3ed5	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	OIR Lectures	2	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
00045703-695b-4f78-904e-c6c50e7a0c81	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	PPDT: Story Writing	3	2026-11-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
3643ef34-516f-49fe-92fb-f3acfd34e918	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	PPDT: Narration & Group Discussion	4	2026-12-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
37fe107e-b66b-44ce-9205-db9632156f57	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Introduction to GTO & Its Importance	5	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
d4657dfc-27ea-4172-922c-aeae090ad72e	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Group Tasks: GD + GPE	6	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
30cc962e-7dcb-475f-a4c9-635bea86ee06	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Group Tasks: Individual Obstacles (IO) & Group Obstacle Race (GOR)	7	2027-01-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
be622d12-a545-47dc-bb2a-fbe2ee335935	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Group Tasks: PGT/HGT/CT/FGT	8	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
db03454a-f4e5-40ff-87b7-520323459567	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Introduction to Lecturette	9	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
e81f359e-a354-4b6a-ba43-f07f63841795	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Introduction to Psychological Tests	10	2027-02-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
bb314233-f5ec-4b96-9170-1fd279648dae	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Thematic Apperception Test	11	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
626460dd-074c-4174-bec2-5f35954ef6c7	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Word Association Test	12	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
a7e27fc7-bede-4f48-9d89-e3e03af80a61	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Situation Reaction Test	13	2027-03-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
85120b9a-0e94-4533-bbc5-923e565e02e0	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Self Description Test	14	2027-03-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
6e5c923d-70b6-43d8-89d1-6c67a5751057	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Introduction to Personal Interview & Understanding PIQ Form	15	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
70b1e4e5-3111-4fcc-9ba0-076d401c3a3c	0b3b9790-5bb7-4373-8b12-a7bb5f6770d7	Introduction to CPSS (AFSB)	16	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
11ac7472-14f0-4276-9009-c8595c2d6db4	6bd29f85-f263-4404-beaa-f0d68519092d	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
a9f39320-d803-450d-b39d-a93cca1502bc	6bd29f85-f263-4404-beaa-f0d68519092d	Basic Math – Basic Formulae, Indices	2	2026-11-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
3f93d52a-f0a8-4e9f-a1f5-c6bd84453be6	6bd29f85-f263-4404-beaa-f0d68519092d	Basic Math – Inequality	3	2026-11-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
1eae6ef2-857f-48de-ab0a-ed385d469494	6bd29f85-f263-4404-beaa-f0d68519092d	Basic Math – Modulus Basic	4	2026-11-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
7f962958-3ae4-49d7-a7cd-eb00079c772b	6bd29f85-f263-4404-beaa-f0d68519092d	Basic Math – Modulus Advanced	5	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
905ad0dd-9e7c-425b-86ce-7b7eb1aeb1ad	6bd29f85-f263-4404-beaa-f0d68519092d	Logarithms – Logarithms Properties	6	2026-11-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
6c25ae5c-6d18-4cbb-98a4-4194817096b3	6bd29f85-f263-4404-beaa-f0d68519092d	Logarithms – Logarithms and Exponential Function	7	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
2a24912b-ebb0-444d-ab82-54970983af59	6bd29f85-f263-4404-beaa-f0d68519092d	Logarithms – PYQs and Doubts	8	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
c05083d9-de93-461a-9135-dff29e8151a0	6bd29f85-f263-4404-beaa-f0d68519092d	Sets – Sets and Their Representations	9	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
a9d5f993-dcd1-43a9-b536-9a00cba53c35	6bd29f85-f263-4404-beaa-f0d68519092d	Sets – Types of Set	10	2026-11-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
366d513c-925f-4370-b4a3-fd256cd63f67	6bd29f85-f263-4404-beaa-f0d68519092d	Sets – Venn Diagram	11	2026-11-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
92a109b4-2b7f-4813-8142-d6af0fbc34cf	6bd29f85-f263-4404-beaa-f0d68519092d	Sets – Operation on Sets (Union, Intersection, Difference of Sets)	12	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
82a8f0e2-ffcd-4395-9c97-b31a372c4e57	6bd29f85-f263-4404-beaa-f0d68519092d	Sets – PYQs and Doubts	13	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
1fbc8f3a-e727-46d7-8364-43ca71c6f217	6bd29f85-f263-4404-beaa-f0d68519092d	Quadratic Equations – Basics of Roots, Solution and Nature of Roots	14	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
99529eb3-1f25-41ab-98f3-80edb3dc4017	6bd29f85-f263-4404-beaa-f0d68519092d	Quadratic Equations – Properties of Roots	15	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
7cad9c26-d90a-495f-8376-12fa50e50960	6bd29f85-f263-4404-beaa-f0d68519092d	Quadratic Equations – Graph and Location of Roots	16	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
17d8f0de-e496-4150-b4a6-e5c9a85a14d2	6bd29f85-f263-4404-beaa-f0d68519092d	Quadratic Equations – PYQs and Doubts	17	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
2dc2eb73-35f1-480e-9ba6-2b3f68555077	6bd29f85-f263-4404-beaa-f0d68519092d	Sequence and Series – Basics of Progression and Series	18	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
2f46990a-1ab1-4b76-aa59-ed7bf4ae2e85	6bd29f85-f263-4404-beaa-f0d68519092d	Sequence and Series – Arithmetic Progression	19	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
8f797269-a5ad-4f98-a0d7-eb136c0f7a1a	6bd29f85-f263-4404-beaa-f0d68519092d	Sequence and Series – Arithmetic and Harmonic Progression	20	2026-12-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
41c1d0fb-11e1-42a2-ad9a-b682d0eae3c3	6bd29f85-f263-4404-beaa-f0d68519092d	Sequence and Series – Geometric Progression	21	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
b61719c1-29ff-4f85-90a9-a9a5cd28fb6c	6bd29f85-f263-4404-beaa-f0d68519092d	Sequence and Series – Relation Between AM and GM	22	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
9b7906b5-fd56-44cb-b80b-5520a1608edc	6bd29f85-f263-4404-beaa-f0d68519092d	Sequence and Series – PYQs and Doubts	23	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f1d45080-7ae9-4598-83be-f3b6f5a1c5a0	6bd29f85-f263-4404-beaa-f0d68519092d	Relations and Functions – Cartesian Products of Sets	24	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
54a7a34d-e947-4e40-9ac3-e87354de8d4a	6bd29f85-f263-4404-beaa-f0d68519092d	Relations and Functions – Relations	25	2026-12-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
ab5bf30e-b349-41cf-857a-6797f22280a9	6bd29f85-f263-4404-beaa-f0d68519092d	Relations and Functions – Functions	26	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
68643233-07e0-4958-9f69-60cc114d49f5	6bd29f85-f263-4404-beaa-f0d68519092d	Relations and Functions – Some Functions and Their Graphs	27	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
51dd05ff-c18d-4c03-99b3-e46f9825805f	6bd29f85-f263-4404-beaa-f0d68519092d	Relations and Functions – Domain and Range	28	2026-12-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
729cb2e1-9d9f-4d6d-a1ac-0137e4982524	6bd29f85-f263-4404-beaa-f0d68519092d	Relations and Functions – PYQs and Doubts	29	2026-12-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
47f66f05-284f-458d-907b-fb477acb5a90	6bd29f85-f263-4404-beaa-f0d68519092d	Trigonometry – Introduction to Trigonometry & Identities, Quadrants and Conversion of Angle	30	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 09:20:02.400038+00
4e5dd1d2-cdc7-46fc-8248-ef8d68c4f3eb	6bd29f85-f263-4404-beaa-f0d68519092d	Trigonometry – Compound Angle and Transformation of Angles	31	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 09:20:02.400038+00
1f41b69c-486f-49aa-96e2-486b5c94794b	6bd29f85-f263-4404-beaa-f0d68519092d	Trigonometry – Multiple Angle Formulas	32	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 09:20:02.400038+00
5f71b1fe-0d6d-4c77-890b-4246a6afacb2	6bd29f85-f263-4404-beaa-f0d68519092d	Trigonometry – PYQs and Doubts	33	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 09:20:02.400038+00
8e96e0b9-b0b4-4beb-8e03-6caffc808721	6bd29f85-f263-4404-beaa-f0d68519092d	Trigonometric Equations – General Solutions of Trigonometric Equations	34	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 09:20:02.400038+00
5aa84291-b5e3-4c4f-bba6-39f851f5c151	6bd29f85-f263-4404-beaa-f0d68519092d	Trigonometric Equations – PYQs and Doubts	35	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 09:20:02.400038+00
7aa5051e-b998-4cf7-9478-b974333f2ace	6bd29f85-f263-4404-beaa-f0d68519092d	Applications of Trigonometry – Heights and Distances	36	2027-01-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f6cd1add-008a-4c3d-9e02-8e5c6ea883a4	6bd29f85-f263-4404-beaa-f0d68519092d	Applications of Trigonometry – Properties of Triangle	37	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
743e4165-ae92-406c-9a70-98bbf0e5a310	6bd29f85-f263-4404-beaa-f0d68519092d	Applications of Trigonometry – PYQs and Doubts	38	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
6d55f2b9-0e43-4fd2-87ad-97850b3cdd80	6bd29f85-f263-4404-beaa-f0d68519092d	Complex Numbers – Imaginary Number, Power of Iota, Basics of Complex	39	2027-01-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
7655452f-ce59-4803-984d-a9de1432bfd6	6bd29f85-f263-4404-beaa-f0d68519092d	Complex Numbers – Conjugate and Modulus, Amplitude, Polar Form	40	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
09aaf5e8-60b7-4e4d-a4aa-d40d7d4e3345	6bd29f85-f263-4404-beaa-f0d68519092d	Complex Numbers – Eulerian Form, Square Root, Cube Root of Unity	41	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
bcab6dcc-dc35-44d7-ae0f-c886e550da12	6bd29f85-f263-4404-beaa-f0d68519092d	Complex Numbers – Maximum, Minimum	42	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
31c81e2e-11b3-4b6f-a423-688301eb3596	6bd29f85-f263-4404-beaa-f0d68519092d	Permutations & Combinations – Permutations	43	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
58ffb59e-4120-4e82-a2e9-5e953f379045	6bd29f85-f263-4404-beaa-f0d68519092d	Permutations & Combinations – Combinations	44	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
ac6d098e-ceb2-492e-b189-b02bc8cf4160	6bd29f85-f263-4404-beaa-f0d68519092d	Permutations & Combinations – Mixed Problems	45	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
999ba115-8e90-4f63-a4ed-93b5793d280e	6bd29f85-f263-4404-beaa-f0d68519092d	Permutations & Combinations – PYQs and Doubts	46	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
ddc06c9e-0951-4de7-a003-941b7056e18b	6bd29f85-f263-4404-beaa-f0d68519092d	Binomial Theorem – Number of Terms, General Term	47	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
8cff42e4-1c30-4a36-9c7a-26401ff94bcf	6bd29f85-f263-4404-beaa-f0d68519092d	Binomial Theorem – Coefficient of Terms, Middle Term, Greatest Term	48	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
1c8b4589-2770-4f68-ba35-3f17c76173c0	6bd29f85-f263-4404-beaa-f0d68519092d	Binomial Theorem – NGT and Special Formula	49	2027-01-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
5d46ceb5-f754-449e-88a8-fe765791efcc	6bd29f85-f263-4404-beaa-f0d68519092d	Binomial Theorem – PYQs and Doubts	50	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
8e3840d4-be7a-4a3c-9bd4-77d1201bee5d	6bd29f85-f263-4404-beaa-f0d68519092d	Probability – Random Experiments, Outcomes and Sample Space, Event, Occurrence of an Event	51	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
1facf120-01a4-4396-ad78-a8b56cf542eb	6bd29f85-f263-4404-beaa-f0d68519092d	Probability – Types of Events, Algebra of Events	52	2027-02-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
b957b1ec-0b00-42cb-ad00-e1f5ff307054	6bd29f85-f263-4404-beaa-f0d68519092d	Probability – Axiomatic Approach to Probability	53	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
8c0cadb4-8892-4a82-85c2-318cfa5b7996	6bd29f85-f263-4404-beaa-f0d68519092d	Probability – Probability (Advanced)	54	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
cecb958d-35ea-4e3e-aa26-2b2abc61e549	6bd29f85-f263-4404-beaa-f0d68519092d	Probability – Conditional Probability	55	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
883a0c1b-0c6a-4a15-85c3-5d3bf0c1f2b4	6bd29f85-f263-4404-beaa-f0d68519092d	Probability – Total Probability Theorem	56	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
e07bc30f-f38a-4232-bae1-3c58cbe5dcbd	6bd29f85-f263-4404-beaa-f0d68519092d	Probability – Bayes’ Theorem	57	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
12c5d67d-9bfd-49ea-b67f-ebdbfe2e1d27	6bd29f85-f263-4404-beaa-f0d68519092d	Probability – Probability Distribution	58	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
58987eb2-755b-49df-9b9b-cd23a5541ee9	6bd29f85-f263-4404-beaa-f0d68519092d	Probability – PYQs and Doubts	59	2027-02-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
21e4cf07-beb8-48a7-be4f-68b717cb04f0	6bd29f85-f263-4404-beaa-f0d68519092d	Co-ordinate Geometry – Cartesian Coordinate System and Section Formula	60	2027-02-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
9b8dce1a-9743-447c-b2f1-54459ab38a0d	6bd29f85-f263-4404-beaa-f0d68519092d	Co-ordinate Geometry – Slope, Equation of Line, Angle Between Two Lines	61	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
973b8491-b737-45a1-8ad9-dd5b907f4e0a	6bd29f85-f263-4404-beaa-f0d68519092d	Co-ordinate Geometry – Various Forms of the Equation of a Line	62	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
6df416e4-1610-4b12-958a-69e0645934c8	6bd29f85-f263-4404-beaa-f0d68519092d	Co-ordinate Geometry – Distance of a Point From a Line	63	2027-02-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
321351ac-fb63-46ad-850b-e863f5238e27	6bd29f85-f263-4404-beaa-f0d68519092d	Co-ordinate Geometry – Pairs of Straight Line and Miscellaneous	64	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
907ef8d6-514c-4280-8026-823fbde87e9a	6bd29f85-f263-4404-beaa-f0d68519092d	Co-ordinate Geometry – Term Related to Triangles	65	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
e0e02d00-225d-4c1d-9341-6dbb072cc0e7	6bd29f85-f263-4404-beaa-f0d68519092d	Co-ordinate Geometry – PYQs and Doubts	66	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
3eb2571f-6922-42f8-ae62-3b27f163fcf0	6bd29f85-f263-4404-beaa-f0d68519092d	Conic Section – Basics of Circles	67	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f0b46d22-5a6e-4eab-8494-250efbd3ae9a	6bd29f85-f263-4404-beaa-f0d68519092d	Conic Section – Intersections of Circle and Parametric Form of Circle	68	2027-03-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
344f09be-5def-4e96-81c3-72700f8b4cf2	6bd29f85-f263-4404-beaa-f0d68519092d	Conic Section – Tangent and Normal of Circles	69	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
74c2f26c-ef6a-409f-872a-9f1a8a4bacef	6bd29f85-f263-4404-beaa-f0d68519092d	Conic Section – Introduction to Parabola and Standard Form	70	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
901a3018-1516-4273-af5c-9655f3bf3d3f	6bd29f85-f263-4404-beaa-f0d68519092d	Conic Section – Shifting of Parabola	71	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
a7cd6df6-9e93-422f-8f8c-3bbbe768f0a2	6bd29f85-f263-4404-beaa-f0d68519092d	Conic Section – Ellipse	72	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
77d6846c-44ab-48d2-acf8-04943ac69f58	6bd29f85-f263-4404-beaa-f0d68519092d	Conic Section – Hyperbola	73	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
315f579c-839e-43e8-ba9b-94e6f0256c70	6bd29f85-f263-4404-beaa-f0d68519092d	Conic Section – PYQs and Doubts	74	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
405d82e7-63c7-476f-b339-46cb17cc1829	6bd29f85-f263-4404-beaa-f0d68519092d	Three Dimensional Geometry – Basics of Three Dimensional Geometry	75	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
3a022d96-5e58-41e5-92e1-05655c941eec	6bd29f85-f263-4404-beaa-f0d68519092d	Limits and Derivatives – Basics of Limits	76	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
e28ca0cc-b6a5-448e-b923-9aa7729daab9	6bd29f85-f263-4404-beaa-f0d68519092d	Limits and Derivatives – Existence of Limits	77	2027-03-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f4c6f968-6e2b-4618-8eb3-da2f6b7201b0	6bd29f85-f263-4404-beaa-f0d68519092d	Limits and Derivatives – Limits and Evaluation of Limits	78	2027-03-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
4b084d62-8082-43f0-bf36-3cde66dfdc69	6bd29f85-f263-4404-beaa-f0d68519092d	Limits and Derivatives – Derivatives	79	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
343c5359-136f-44c7-97f6-48bb6d20756c	6bd29f85-f263-4404-beaa-f0d68519092d	Limits and Derivatives – L’Hôpital Rule of Limit	80	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f00bb75f-b60a-4c55-af80-b582aaac98f1	6bd29f85-f263-4404-beaa-f0d68519092d	Limits and Derivatives – First Principle of Differentiation	81	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
902d9cdb-5b8b-433a-bd26-0a448030ee39	6bd29f85-f263-4404-beaa-f0d68519092d	Limits and Derivatives – Chain Rule of Derivative	82	2027-03-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
e4c77c85-ef74-401e-bcd8-17570e4f007b	6bd29f85-f263-4404-beaa-f0d68519092d	Limits and Derivatives – Algebra of Derivative (Product and Division Rule)	83	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f6f4b0f5-0ecd-4c68-b67f-962c2b322490	6bd29f85-f263-4404-beaa-f0d68519092d	Limits and Derivatives – Parametric Form of Derivative	84	2027-03-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
f9a7a814-a51a-42db-bd63-65287c56c68c	6bd29f85-f263-4404-beaa-f0d68519092d	Limits and Derivatives – Logarithmic & Implicit Differentiation	85	2027-04-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
5f08678a-32ee-47d0-aece-f7acdd299150	6bd29f85-f263-4404-beaa-f0d68519092d	Statistics	86	2027-04-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
4ac27d65-6f63-44dc-b823-7d32d6c3e499	6bd29f85-f263-4404-beaa-f0d68519092d	Binary Numbers	87	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 09:20:02.400038+00
21985639-4271-420a-ab83-56e3c22dbacd	7ed51c0f-bd27-4225-afaa-fb065936770a	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6ed16380-5181-4c08-864c-94c2d9d67d48	7ed51c0f-bd27-4225-afaa-fb065936770a	Basic Math – Basic Formulae, Indices	2	2026-11-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
699dad15-b248-428d-9704-9d496377118e	7ed51c0f-bd27-4225-afaa-fb065936770a	Basic Math – Inequality	3	2026-11-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7fcb3461-e16c-42be-8a06-9dc2711f5cae	7ed51c0f-bd27-4225-afaa-fb065936770a	Basic Math – Modulus Basic	4	2026-11-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
19959a14-b9e2-4373-9987-52b9b703dd94	7ed51c0f-bd27-4225-afaa-fb065936770a	Basic Math – Modulus Advanced	5	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e48e0677-f2b1-44ed-b2ec-960c39b58f97	7ed51c0f-bd27-4225-afaa-fb065936770a	Logarithms – Logarithms Properties	6	2026-11-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5d4678f4-1c1d-4995-a376-2f728951dda9	7ed51c0f-bd27-4225-afaa-fb065936770a	Logarithms – Logarithms and Exponential Function	7	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1c5ee7ea-2989-4830-ae79-0e2beac5278b	7ed51c0f-bd27-4225-afaa-fb065936770a	Logarithms – PYQs and Doubts	8	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2a409f9f-fb40-4a57-b296-757a5452bfa9	7ed51c0f-bd27-4225-afaa-fb065936770a	Sets – Sets and Their Representations	9	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a20a7597-6d5d-43ff-82f8-ce7c204f152b	7ed51c0f-bd27-4225-afaa-fb065936770a	Sets – Types of Set	10	2026-11-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cd55f1d9-222e-45fb-bd6e-dbc5c47c05a1	7ed51c0f-bd27-4225-afaa-fb065936770a	Sets – Venn Diagram	11	2026-11-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3cb5f11c-0785-495c-ad9e-d1848081be8e	7ed51c0f-bd27-4225-afaa-fb065936770a	Sets – Operation on Sets (Union, Intersection, Difference of Sets)	12	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cabd681a-2cfd-4ae1-8f6e-253e9e3efc51	7ed51c0f-bd27-4225-afaa-fb065936770a	Sets – PYQs and Doubts	13	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
450f464a-ee1d-4207-9404-47cfd3cacda1	7ed51c0f-bd27-4225-afaa-fb065936770a	Quadratic Equations – Basics of Roots, Solution and Nature of Roots	14	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
690d6579-7332-4582-aa65-017852519600	7ed51c0f-bd27-4225-afaa-fb065936770a	Quadratic Equations – Properties of Roots	15	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d7d3a9f4-b61b-4612-9d11-56aafef5c801	7ed51c0f-bd27-4225-afaa-fb065936770a	Quadratic Equations – Graph and Location of Roots	16	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
977401a6-6395-43ab-baef-17fb6a20353d	7ed51c0f-bd27-4225-afaa-fb065936770a	Quadratic Equations – PYQs and Doubts	17	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
21cb1da7-efd2-40f4-9fcc-8077479bcb69	7ed51c0f-bd27-4225-afaa-fb065936770a	Sequence and Series – Basics of Progression and Series	18	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5f84206a-57db-48de-88ef-60cc6158f76d	7ed51c0f-bd27-4225-afaa-fb065936770a	Sequence and Series – Arithmetic Progression	19	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9e6eb4c9-b20b-40b0-a8c3-d3c6a34b5143	7ed51c0f-bd27-4225-afaa-fb065936770a	Sequence and Series – Arithmetic and Harmonic Progression	20	2026-12-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8f5d78da-5da2-45a9-9890-f1b3185136a8	7ed51c0f-bd27-4225-afaa-fb065936770a	Sequence and Series – Geometric Progression	21	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e2d4a815-26d3-4f91-bd4e-43ac47fd6eb5	7ed51c0f-bd27-4225-afaa-fb065936770a	Sequence and Series – Relation Between AM and GM	22	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d25ec002-b9db-42ce-9b21-2a06daaf08ad	7ed51c0f-bd27-4225-afaa-fb065936770a	Sequence and Series – PYQs and Doubts	23	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
71569d9a-3a50-4831-b0ec-74ad4103e3cf	7ed51c0f-bd27-4225-afaa-fb065936770a	Relations and Functions – Cartesian Products of Sets	24	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4d84a0a0-331f-4b31-b4f8-71524bf0ba7d	7ed51c0f-bd27-4225-afaa-fb065936770a	Relations and Functions – Relations	25	2026-12-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9ccce49e-99b0-410e-8fa7-7b77c183efc9	7ed51c0f-bd27-4225-afaa-fb065936770a	Relations and Functions – Functions	26	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0a870b75-3103-4a25-ab21-4b0022bd5a6b	7ed51c0f-bd27-4225-afaa-fb065936770a	Relations and Functions – Some Functions and Their Graphs	27	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ba8a922c-ebe1-4256-af0d-8963c88e6fde	7ed51c0f-bd27-4225-afaa-fb065936770a	Relations and Functions – Domain and Range	28	2026-12-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
16764cf6-48d5-4a06-9444-41e717684f99	7ed51c0f-bd27-4225-afaa-fb065936770a	Relations and Functions – PYQs and Doubts	29	2026-12-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7c606274-880d-4e79-a1ab-b284f5409f77	7ed51c0f-bd27-4225-afaa-fb065936770a	Trigonometry – Introduction to Trigonometry & Identities, Quadrants and Conversion of Angle	30	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
88aee600-e55b-4808-a2f4-f749cfa342fc	7ed51c0f-bd27-4225-afaa-fb065936770a	Trigonometry – Compound Angle and Transformation of Angles	31	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
dfeef7dc-6ad9-45de-8ea1-74647316dce0	7ed51c0f-bd27-4225-afaa-fb065936770a	Trigonometry – Multiple Angle Formulas	32	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
21d8f042-d89a-44d9-a689-084b3056f411	7ed51c0f-bd27-4225-afaa-fb065936770a	Trigonometry – PYQs and Doubts	33	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
c8d58774-82a1-4245-804a-72d007a78eff	7ed51c0f-bd27-4225-afaa-fb065936770a	Trigonometric Equations – General Solutions of Trigonometric Equations	34	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
303a310e-b110-48af-a153-6475e2c954a2	7ed51c0f-bd27-4225-afaa-fb065936770a	Trigonometric Equations – PYQs and Doubts	35	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
c257dd72-7d19-42d7-9cb4-ee3da35d9ed6	7ed51c0f-bd27-4225-afaa-fb065936770a	Applications of Trigonometry – Heights and Distances	36	2027-01-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c038d23c-dd7c-4738-bcc7-06e12be05cee	7ed51c0f-bd27-4225-afaa-fb065936770a	Applications of Trigonometry – Properties of Triangle	37	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a17ddb2f-9460-4b6d-b05b-4faabd65e2e6	7ed51c0f-bd27-4225-afaa-fb065936770a	Applications of Trigonometry – PYQs and Doubts	38	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
32eb581a-fba9-4619-86a7-68bf49b03500	7ed51c0f-bd27-4225-afaa-fb065936770a	Complex Numbers – Imaginary Number, Power of Iota, Basics of Complex	39	2027-01-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5f10f3bb-7f1a-48b3-ba90-960b65ca91c3	7ed51c0f-bd27-4225-afaa-fb065936770a	Complex Numbers – Conjugate and Modulus, Amplitude, Polar Form	40	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2634d1fc-6781-45c4-84a7-c385e7b7f0d3	7ed51c0f-bd27-4225-afaa-fb065936770a	Complex Numbers – Eulerian Form, Square Root, Cube Root of Unity	41	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a6ef2a28-4eb5-429f-ac99-0d0a9753abc5	7ed51c0f-bd27-4225-afaa-fb065936770a	Complex Numbers – Maximum, Minimum	42	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a8361bcd-056c-47a0-b087-24f44e40cac8	7ed51c0f-bd27-4225-afaa-fb065936770a	Permutations & Combinations – Permutations	43	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5b90aa0b-0f0b-4a44-91a2-78b6bb008f55	7ed51c0f-bd27-4225-afaa-fb065936770a	Permutations & Combinations – Combinations	44	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
83004569-e0bd-4374-9808-3ae642dcc1fa	7ed51c0f-bd27-4225-afaa-fb065936770a	Permutations & Combinations – Mixed Problems	45	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
819d26e1-8537-47c9-8794-b690ab1d2450	7ed51c0f-bd27-4225-afaa-fb065936770a	Permutations & Combinations – PYQs and Doubts	46	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
60cd8a18-f368-4388-b98c-6c047d4ad1d7	7ed51c0f-bd27-4225-afaa-fb065936770a	Binomial Theorem – Number of Terms, General Term	47	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a8cc5de8-fe57-410d-9a00-cf9cd79bb466	7ed51c0f-bd27-4225-afaa-fb065936770a	Binomial Theorem – Coefficient of Terms, Middle Term, Greatest Term	48	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
80c56e89-157e-489e-a0a5-48bc50213550	7ed51c0f-bd27-4225-afaa-fb065936770a	Binomial Theorem – NGT and Special Formula	49	2027-01-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5cbf1308-e9d1-4bbe-bbec-e6011a99082a	7ed51c0f-bd27-4225-afaa-fb065936770a	Binomial Theorem – PYQs and Doubts	50	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d7b6aebe-c833-4084-a681-8f1623813bb6	7ed51c0f-bd27-4225-afaa-fb065936770a	Probability – Random Experiments, Outcomes and Sample Space, Event, Occurrence of an Event	51	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
db5aeafd-6598-4661-9faa-034412723700	7ed51c0f-bd27-4225-afaa-fb065936770a	Probability – Types of Events, Algebra of Events	52	2027-02-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d05dd4a4-ee0d-4917-ae28-718befb1fe89	7ed51c0f-bd27-4225-afaa-fb065936770a	Probability – Axiomatic Approach to Probability	53	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e44fae96-5593-4ca1-9215-26e9a6508e48	7ed51c0f-bd27-4225-afaa-fb065936770a	Probability – Probability (Advanced)	54	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3f0930f8-11f6-4aaa-88af-32f5c37b2601	7ed51c0f-bd27-4225-afaa-fb065936770a	Probability – Conditional Probability	55	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d1d94ccb-f078-4667-a881-7ed4d64a4700	7ed51c0f-bd27-4225-afaa-fb065936770a	Probability – Total Probability Theorem	56	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b166cf3b-e88f-44d1-8030-a46391cc33db	7ed51c0f-bd27-4225-afaa-fb065936770a	Probability – Bayes’ Theorem	57	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
91407ec8-d4f1-4c8e-8901-6b99b7582d3f	7ed51c0f-bd27-4225-afaa-fb065936770a	Probability – Probability Distribution	58	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
df51440d-ea93-4550-8a2c-697693b7b8ae	7ed51c0f-bd27-4225-afaa-fb065936770a	Probability – PYQs and Doubts	59	2027-02-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6e4db4ba-385c-4b63-9430-a84389b66f5b	7ed51c0f-bd27-4225-afaa-fb065936770a	Co-ordinate Geometry – Cartesian Coordinate System and Section Formula	60	2027-02-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
56e23824-ad58-457a-a6a6-5cdea44720cb	7ed51c0f-bd27-4225-afaa-fb065936770a	Co-ordinate Geometry – Slope, Equation of Line, Angle Between Two Lines	61	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c7f7cbec-0e65-4286-b9fc-cd80ea56e45c	7ed51c0f-bd27-4225-afaa-fb065936770a	Co-ordinate Geometry – Various Forms of the Equation of a Line	62	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c9f612cf-1475-4599-ac68-9cd37f27a054	7ed51c0f-bd27-4225-afaa-fb065936770a	Co-ordinate Geometry – Distance of a Point From a Line	63	2027-02-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
04f22f31-90df-4b33-8c5e-509fefa08875	7ed51c0f-bd27-4225-afaa-fb065936770a	Co-ordinate Geometry – Pairs of Straight Line and Miscellaneous	64	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f814297a-6c7a-4e7a-a8de-5d9e2b149928	7ed51c0f-bd27-4225-afaa-fb065936770a	Co-ordinate Geometry – Term Related to Triangles	65	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
71ce5d25-60f3-4ae6-8aba-076de26b6862	7ed51c0f-bd27-4225-afaa-fb065936770a	Co-ordinate Geometry – PYQs and Doubts	66	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
60eb355f-e839-4abb-a994-baf98f39495a	7ed51c0f-bd27-4225-afaa-fb065936770a	Conic Section – Basics of Circles	67	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e4ed96f7-d8df-4bfa-819e-2812c7f8624b	7ed51c0f-bd27-4225-afaa-fb065936770a	Conic Section – Intersections of Circle and Parametric Form of Circle	68	2027-03-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
44e4efaf-2fa3-42d5-b5e7-891e04cb0e48	7ed51c0f-bd27-4225-afaa-fb065936770a	Conic Section – Tangent and Normal of Circles	69	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2892c281-0117-4a29-bbf5-5c2b5b085d36	7ed51c0f-bd27-4225-afaa-fb065936770a	Conic Section – Introduction to Parabola and Standard Form	70	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7de36f8c-648d-48c3-bb5c-c33c82eafd83	7ed51c0f-bd27-4225-afaa-fb065936770a	Conic Section – Shifting of Parabola	71	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8a8d7292-1dec-41be-8d5a-2ca4d299b0ba	7ed51c0f-bd27-4225-afaa-fb065936770a	Conic Section – Ellipse	72	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c0c95e94-63ff-4051-b9f3-4cbe3fe605f6	7ed51c0f-bd27-4225-afaa-fb065936770a	Conic Section – Hyperbola	73	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ab6643c9-8089-4f4f-8ae4-ee90a370a0ff	7ed51c0f-bd27-4225-afaa-fb065936770a	Conic Section – PYQs and Doubts	74	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2b2c2052-f614-4b67-9ed7-0982814a054d	7ed51c0f-bd27-4225-afaa-fb065936770a	Three Dimensional Geometry – Basics of Three Dimensional Geometry	75	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a11aa728-97d1-4053-910e-0b8621fe7b65	7ed51c0f-bd27-4225-afaa-fb065936770a	Limits and Derivatives – Basics of Limits	76	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3ff15319-c537-4b71-9c99-cd33ae675d8c	7ed51c0f-bd27-4225-afaa-fb065936770a	Limits and Derivatives – Existence of Limits	77	2027-03-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
322cfeb5-a569-4fa2-8498-339b1227246f	7ed51c0f-bd27-4225-afaa-fb065936770a	Limits and Derivatives – Limits and Evaluation of Limits	78	2027-03-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
94620c46-b6aa-4137-8b67-62f7107c5d8b	7ed51c0f-bd27-4225-afaa-fb065936770a	Limits and Derivatives – Derivatives	79	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
42c6a944-5b2d-4e0e-a12e-405548e39097	7ed51c0f-bd27-4225-afaa-fb065936770a	Limits and Derivatives – L’Hôpital Rule of Limit	80	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7efdf9e2-8b9e-4297-8f46-02c7bb2588e5	7ed51c0f-bd27-4225-afaa-fb065936770a	Limits and Derivatives – First Principle of Differentiation	81	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3094c515-1966-45d1-9afd-09167d506af6	7ed51c0f-bd27-4225-afaa-fb065936770a	Limits and Derivatives – Chain Rule of Derivative	82	2027-03-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a74388a3-e973-45fd-8c38-6c5bd22b98f1	7ed51c0f-bd27-4225-afaa-fb065936770a	Limits and Derivatives – Algebra of Derivative (Product and Division Rule)	83	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2ef4eaab-1d2b-4d4d-8119-01a2218be474	7ed51c0f-bd27-4225-afaa-fb065936770a	Limits and Derivatives – Parametric Form of Derivative	84	2027-03-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
be4dddba-1425-4245-86fb-9dc8a3a573b1	7ed51c0f-bd27-4225-afaa-fb065936770a	Limits and Derivatives – Logarithmic & Implicit Differentiation	85	2027-04-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e1f233d3-fd4e-42a6-8ab0-fe6f1ec841ef	7ed51c0f-bd27-4225-afaa-fb065936770a	Statistics	86	2027-04-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1330177a-864e-45d2-99ca-11153413dc1e	7ed51c0f-bd27-4225-afaa-fb065936770a	Binary Numbers	87	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6aefefef-9c3a-4fd5-a58a-043d3091f859	a14f61d5-77cb-4157-9958-ffa1cc868287	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ece36c4e-0ee4-425d-87f2-de2db3e52bcd	a14f61d5-77cb-4157-9958-ffa1cc868287	Basic Mathematics	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7bf8a96d-5cb7-4c59-a462-e22577200555	a14f61d5-77cb-4157-9958-ffa1cc868287	Units & Measurements (Errors + Dimensions)	3	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0f14ec1d-1c73-49e4-b8bc-5edf70b3b567	a14f61d5-77cb-4157-9958-ffa1cc868287	Vector	4	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
50ee2c9b-c02f-48ac-895c-4205a026398b	a14f61d5-77cb-4157-9958-ffa1cc868287	Motion in Straight Line	5	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
82f40c47-0b87-4750-b907-e3df2127a028	a14f61d5-77cb-4157-9958-ffa1cc868287	Motion in Plane	6	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
eca3210e-26b7-41d0-8abf-d1695e4761fe	a14f61d5-77cb-4157-9958-ffa1cc868287	Newton’s Laws of Motion (NLM)	7	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3212f570-cee2-4103-9d6a-6f5bfb1011aa	a14f61d5-77cb-4157-9958-ffa1cc868287	Friction	8	2026-12-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
aac6d327-7627-4716-8c42-fc94cefa526a	a14f61d5-77cb-4157-9958-ffa1cc868287	Work, Power & Energy (WPE)	9	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
50e3316a-a216-4883-b1d6-052cdb50558e	a14f61d5-77cb-4157-9958-ffa1cc868287	Gravitation	10	2026-12-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a0e04cc5-6013-4286-af99-814ef73af9ed	a14f61d5-77cb-4157-9958-ffa1cc868287	Rotation (Basics)	11	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3eaecbe7-6090-4751-86ca-8e80519b7c5e	a14f61d5-77cb-4157-9958-ffa1cc868287	Mechanical Properties of Solids	12	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b994b606-096a-48ec-9b2d-43148f7ce2d6	a14f61d5-77cb-4157-9958-ffa1cc868287	Mechanical Properties of Fluids	13	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b87297fd-c88c-4443-8196-e2dbdd839152	a14f61d5-77cb-4157-9958-ffa1cc868287	Heat & Thermal Properties	14	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
912ea929-79d8-47d6-99cf-d23c2b8b5b60	a14f61d5-77cb-4157-9958-ffa1cc868287	Thermodynamics + Kinetic Theory of Gases	15	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dc346ee9-fa42-4133-8d5d-56d172cab4d5	a14f61d5-77cb-4157-9958-ffa1cc868287	Simple Harmonic Motion (SHM)	16	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
baddc270-bec1-4c82-a006-1a34d7569c5a	a14f61d5-77cb-4157-9958-ffa1cc868287	Waves & Sound	17	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
37f6bf79-cb7b-4350-a2dd-a7236b26bb8f	a14f61d5-77cb-4157-9958-ffa1cc868287	Electrostatics	18	2027-02-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f105d8eb-92d2-4a86-9213-232f94e05e9a	a14f61d5-77cb-4157-9958-ffa1cc868287	Current Electricity	19	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
101b458c-76f1-4297-badb-1146bf672fe3	a14f61d5-77cb-4157-9958-ffa1cc868287	Magnetism & Moving Charges	20	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
864b7b6d-174c-40db-9dd7-a94a2d55fbe3	a14f61d5-77cb-4157-9958-ffa1cc868287	Electromagnetic Induction (EMI) + AC	21	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d17b9427-3d71-4f32-9d86-e235d8fe264d	a14f61d5-77cb-4157-9958-ffa1cc868287	Ray Optics + Wave Optics	22	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
587a481b-7977-468a-8845-bbd35caa0fac	a14f61d5-77cb-4157-9958-ffa1cc868287	Modern Physics	23	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e6d0c5a8-5bc6-4dce-baa6-e94636c6254d	a14f61d5-77cb-4157-9958-ffa1cc868287	Semiconductor Electronics	24	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4178c0ef-41be-49fe-a10c-dc101c384058	a14f61d5-77cb-4157-9958-ffa1cc868287	PYQ + Final Revision	25	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bb20f000-1249-435f-b586-d610d646c36b	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9d9102e3-962c-494f-8a04-c71ed40bcb59	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	Physical Classification of Matter	2	2026-11-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e8ac703e-f3fb-4cef-afbf-88851ef66f1e	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	Elements, Compounds and Mixtures	3	2026-11-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6e886db3-4b96-4138-81af-0bbf686b13d2	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	Structure of Atom	4	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
22ff7cd5-83f1-4ed1-8dc9-0d61759f0bf8	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	Electronic Configuration	5	2026-12-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
147ee6e7-403c-4306-81f6-53d527d46581	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	Periodic Table	6	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7616ea0b-c9e7-4377-ac7c-3fa0f10ac111	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	Chemical Bonding	7	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5cbfadb8-fedb-4ad3-b2e7-3cb2210f1386	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	Acids, Bases and Salts	8	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1951f18a-0d68-4da4-a95b-7d67f9d0468a	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	Metals and Non-Metals	9	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8dd1c4a1-8143-47e1-9f34-6fe5c3b922c9	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	The Iso Species and Carbon	10	2027-02-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
246b2f59-07d6-4b54-ae44-c9d0e9a04a12	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	IUPAC Nomenclature and Types of Reactions	11	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
07f28dd9-0ac3-4dcc-8854-f9ad5da670a2	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	Important Industrial Preparations, Corrosion, Water and Types of Hardness	12	2027-03-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a285d74f-b7a7-45f2-884f-23fb64252333	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	Mole Concept	13	2027-03-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4c40559c-6a0f-4107-b5ff-1353e511586d	8c8d5df5-c12e-46ff-93d3-aa86f6efd851	Chemistry in Everyday Life	14	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
680e0db1-23b4-45cc-bddd-abab07f205f8	454faa19-553e-459f-b0d1-98934fcd305a	Cell	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0b13d34e-3a5b-474d-bdac-3bc85bcbaa88	454faa19-553e-459f-b0d1-98934fcd305a	Animal Tissues	2	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9f3368af-a389-4b2b-9a01-b1d22a1e748a	454faa19-553e-459f-b0d1-98934fcd305a	Plant Tissues	3	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
57bb7d11-df0e-48ce-9f82-01068d640175	454faa19-553e-459f-b0d1-98934fcd305a	Life Processes	4	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3de9b055-f52e-4092-b375-2f0f5cec4104	454faa19-553e-459f-b0d1-98934fcd305a	Control and Coordination in Humans	5	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
547198b6-2be3-44d2-9ac9-bf1019fd1363	454faa19-553e-459f-b0d1-98934fcd305a	Control and Coordination in Plants	6	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
72beee2f-69b9-40d5-b53a-7dd0f086a4eb	454faa19-553e-459f-b0d1-98934fcd305a	Reproduction – Introduction	7	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4932eb2c-98be-4deb-b7e0-4d098721be46	454faa19-553e-459f-b0d1-98934fcd305a	Sexual Reproduction in Flowering Plants	8	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
915aef85-2bb0-468b-805a-f8b0e95ebeb0	454faa19-553e-459f-b0d1-98934fcd305a	Human Reproduction	9	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f877a152-6ac1-49b8-a508-c872689a66b7	454faa19-553e-459f-b0d1-98934fcd305a	Diversity in Organisms	10	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ff6f8ea9-b13d-4bb3-8711-20b94e9247d7	454faa19-553e-459f-b0d1-98934fcd305a	Human Health and Diseases	11	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
33e67703-41ad-47f4-8a9a-edf3e464b749	454faa19-553e-459f-b0d1-98934fcd305a	Important Vitamins and Minerals	12	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c9409b73-aa3a-4f3a-b450-af76b60a4a9d	454faa19-553e-459f-b0d1-98934fcd305a	Genetics	13	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2c033403-656c-4431-a07f-11a53eefdab4	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	All About NDA Exam	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
78f78445-7046-4caf-8b9d-de377151cfa7	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Vocabulary	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7354585f-302e-4891-b43b-503cbaa75395	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Noun	3	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f893ca91-92c5-4be8-95f3-315a4982aec8	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Pronoun	4	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
da4c5676-6c98-461b-83fa-2859f634158e	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Idioms and Phrases	5	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
512c7eac-1e8d-4c4e-ac2a-759d5708b60e	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Conjunction	6	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
437a746b-524c-4adc-9e7e-c0d8ac3a97e0	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Adjective	7	2026-12-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
145273ec-1d29-47b9-9cb8-bfbb5a7f9fcd	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Adverb	8	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ad072dc0-b0b5-4914-93e0-cc544b46f45e	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Preposition	9	2026-12-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b2f4c04f-6279-43e5-85eb-ec4ae3e17774	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Fixed Preposition	10	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f16651a9-642e-4b91-b53a-e218338ab203	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Articles	11	2027-01-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d9260b01-497f-4e40-b65c-5813c71b2335	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Sentence Arrangement	12	2027-01-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7cdb7862-3a1f-4f9c-a148-11b0a5ba3ceb	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Verb	13	2027-01-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6ae20040-ca47-4d7e-a236-3351aab91123	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Tense	14	2027-01-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5c6b8a17-9fc9-4f9a-9d64-c646ca9a41ec	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Conditional Sentences	15	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2850c95c-4d98-41dd-9a86-8e107de879a2	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Question Tag	16	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
12a5a676-7df8-49f5-92ba-a23e2727f3f1	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Voice	17	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
485e4f5a-4548-4148-9a28-93bf64d76983	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Narration	18	2027-02-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a1d58eb2-16e3-4aa5-a7ff-02aacd15361c	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Modals	19	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8ed6d987-8956-4667-bf96-287df8c70a1b	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Passage	20	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b28484af-d936-4092-954b-93b2d8bf6757	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Cloze Test	21	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
af3baaf0-0807-4a23-8fbf-f694e9d60601	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Previous Year Questions	22	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e646cfab-4009-4bc1-b0f3-19fec650a489	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Homophones	23	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2360f950-812e-4701-b7ae-aafefbd9d84c	f317fb7f-e3f8-41ff-8ec5-27a5be46f8e1	Important Miscellaneous Questions	24	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4c3a6f86-c087-4bd3-a124-82b7a2791ce8	d11f77e4-def7-48fe-85f1-18658601e639	September	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6f72ca41-5958-499d-a53d-47f2c896df63	d11f77e4-def7-48fe-85f1-18658601e639	October	2	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8adf1779-7de2-4ef1-b30f-69f7c1d38870	d11f77e4-def7-48fe-85f1-18658601e639	November	3	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
04ac7eca-5b06-46af-ac9c-7a41b515eef8	d11f77e4-def7-48fe-85f1-18658601e639	December	4	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
354870b5-b99e-414d-b380-1b57b1544e28	d11f77e4-def7-48fe-85f1-18658601e639	January	5	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3e3d7fbe-af74-4553-a9d1-548e8630f6dc	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c019bcc0-5397-4001-a2f6-fc02b2d404ab	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Origin of Human	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c0233fba-d48a-47aa-a6cc-e8ad5e9cc78a	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Indus Valley Civilization	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c3776be8-27b9-42db-8302-a95ca14d8966	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Vedic Civilization	4	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0c0b1de4-b76a-451e-b9c1-b93803807b39	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Religious Movement	5	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f2d72e31-d267-4326-b880-a6e5373f9606	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Mahajanapadas / Foreign Invasions	6	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6c0b5fad-fe7a-4c4e-bdce-0ce7d0a24b56	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Mauryan Empire	7	2026-12-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9847a337-628d-49c3-9e1c-a882850dd223	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Post Mauryan Age	8	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a7ac5571-5a8a-47a6-b552-a016d95be633	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Sangam Era	9	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e5355dae-f81f-4649-b17c-1945db09ca57	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Gupta Empire	10	2026-12-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
60bc29e2-db24-4491-8e3e-2ee39ed81e92	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Post Gupta Age	11	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
530e9281-f689-44ad-9783-1d12e3457597	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Rajput Period	12	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4d9fbdf3-3626-4383-b088-e6ad0bc185b7	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Chola Empire	13	2026-12-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f1941750-3782-4fc2-a6fc-4b0e66586b31	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Delhi Sultanate	14	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4f8dd251-e476-4944-9830-0e32f676bb49	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Vijaynagar Empire	15	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
703e7dbc-2b9f-4373-ae15-e27c9f0bf1ae	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Bahamani Empire	16	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d3eaa7ac-1ee2-4248-8198-44f2224aa431	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Bhakti Movement	17	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1d222e32-af7d-457a-a9b0-b0ddcaee6b62	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Sufi Movement	18	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
eca45737-5113-442f-97d0-5202bc264333	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Rise of Mughals	19	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9f8a08ac-a950-4c7c-b32e-f366becbcd38	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Expansion of Mughal Empire	20	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
462f2ad1-7b8e-4842-828f-92eced6cdef1	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Aurangzeb and Decline of Mughals	21	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
60187b9d-6ff8-422d-8ce1-3c134cef7337	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Later Mughals	22	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3049a2c9-9026-4995-a7ca-ca5da938a278	c1760ab0-e213-46f4-8aa1-e97975bcef0b	The Rise of Maratha Empire under Shivaji	23	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9fa3fb07-4131-4ce5-99db-3c908deb4ff1	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Peshwa and Third Battle of Panipat	24	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bb397cbc-14ba-48c1-9571-cc8ee20fbf57	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Arrival of Europeans in India	25	2027-02-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9852af23-047e-42fa-afa8-516355f5defe	c1760ab0-e213-46f4-8aa1-e97975bcef0b	British Conquest in India	26	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cd69436d-4cff-4b73-83b6-0eec12df50e7	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Early Revolts Against British Rule	27	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d3181732-7af5-437a-ab31-fda34dbae9c6	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Indian Renaissance	28	2027-03-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bbda07b6-57cc-49b0-9209-85ee86e44c89	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Rise of British Rule	29	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e0830d9d-d12c-4bab-9223-11456c95164b	c1760ab0-e213-46f4-8aa1-e97975bcef0b	British Rule	30	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3af468ca-3f86-4eb4-bb33-2f5897457e87	c1760ab0-e213-46f4-8aa1-e97975bcef0b	The Revolt of 1857	31	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
003c1448-8a04-43fa-a470-493334757d73	c1760ab0-e213-46f4-8aa1-e97975bcef0b	Crown Rule	32	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
972b8775-891b-470b-ac7a-8f3b363a3c12	c1760ab0-e213-46f4-8aa1-e97975bcef0b	National Movement	33	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e50858e9-e04f-4308-baad-4619e61ceb74	c1760ab0-e213-46f4-8aa1-e97975bcef0b	World History	34	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
35c33173-873f-4774-b9fd-435d16e1f19a	f8e28246-5be5-447b-893e-2ec8c8d83f51	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6af60d73-5f5b-47e8-88d4-d184179f21a1	f8e28246-5be5-447b-893e-2ec8c8d83f51	Basics of Polity	2	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8c92ac58-22d3-4ece-a888-8df6b01368ba	f8e28246-5be5-447b-893e-2ec8c8d83f51	Constitutional Development	3	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5ad3c8db-80d6-4d3a-92c1-76ecb34c25a4	f8e28246-5be5-447b-893e-2ec8c8d83f51	Making of Constitution	4	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
05101f0e-37fd-41ab-b78e-0db6e45d54e9	f8e28246-5be5-447b-893e-2ec8c8d83f51	Features and Preamble of Constitution	5	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
894a4300-0ab9-4d52-9a46-225ff9f78f73	f8e28246-5be5-447b-893e-2ec8c8d83f51	Union and Its Territories	6	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
92d6c9f4-43ea-440d-a382-3aaa946e7dfa	f8e28246-5be5-447b-893e-2ec8c8d83f51	Citizenship	7	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ac3db010-7832-48bc-942a-85ddbecd3b9b	f8e28246-5be5-447b-893e-2ec8c8d83f51	Fundamental Rights	8	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f3528b85-0629-4b94-90bb-bc30785cf30e	f8e28246-5be5-447b-893e-2ec8c8d83f51	Directive Principles of State Policy	9	2027-01-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4221ae69-ef41-4afd-b93b-685dd1a9a3b5	f8e28246-5be5-447b-893e-2ec8c8d83f51	Fundamental Duties	10	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
16ecc66b-c853-48a4-906b-00b7f4714ae3	f8e28246-5be5-447b-893e-2ec8c8d83f51	Parliament	11	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
463abef2-474f-4a78-9cc5-267bc88f1c8f	f8e28246-5be5-447b-893e-2ec8c8d83f51	President	12	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2849e45a-fb02-492d-897a-02b85a91a3aa	f8e28246-5be5-447b-893e-2ec8c8d83f51	Vice President	13	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a988fac9-e950-4b6d-8b84-582bc86ce56e	f8e28246-5be5-447b-893e-2ec8c8d83f51	State Legislature	14	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
37e4a7ef-b3e4-4b21-ac92-83b5e3fbbee0	f8e28246-5be5-447b-893e-2ec8c8d83f51	Governor	15	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d7fbc5ed-2e72-4b08-8530-20257faffc77	f8e28246-5be5-447b-893e-2ec8c8d83f51	Supreme Court	16	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6bf4eec4-9081-409e-aa90-831133c78a3d	f8e28246-5be5-447b-893e-2ec8c8d83f51	High Court	17	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
292074d1-8890-465e-8ee7-bc0bdabb2de5	f8e28246-5be5-447b-893e-2ec8c8d83f51	Emergency	18	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d6353980-a4c2-45de-a52f-d434c6dcc981	f8e28246-5be5-447b-893e-2ec8c8d83f51	Local Self Government	19	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bbca89fd-b2e1-47f5-b2bc-4610f6beef88	f8e28246-5be5-447b-893e-2ec8c8d83f51	Constitutional Bodies	20	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fdc93d66-af2b-4b63-8ab4-060e18c319b5	f8e28246-5be5-447b-893e-2ec8c8d83f51	Important Amendments	21	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0939bd55-bf06-436f-9fac-e13537d8102b	f8e28246-5be5-447b-893e-2ec8c8d83f51	Miscellaneous	22	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9ad544bc-2a92-459f-ad5e-8ee51bd24142	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Introduction to SSB Process	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c03dd751-9109-44b7-a132-0986f725f1a2	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	OIR Lectures	2	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c75add62-0d9a-4f91-a13c-38e593038626	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	PPDT: Story Writing	3	2026-11-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7fa825cb-d48e-46da-9487-da696a62d7f0	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	PPDT: Narration & Group Discussion	4	2026-12-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2c051f9e-8c8c-4c4c-a3a4-a330cc4844b3	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Introduction to GTO & Its Importance	5	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
88bfeb10-cadc-4c5c-bdec-eb3e8655976a	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Group Tasks: GD + GPE	6	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
16cba914-656b-4bdf-861e-1d97c066df4d	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Group Tasks: Individual Obstacles (IO) & Group Obstacle Race (GOR)	7	2027-01-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3042e8d2-f6a8-45bd-9a41-0a90e59e074f	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Group Tasks: PGT/HGT/CT/FGT	8	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
503cdd98-9739-43a6-82ce-11cec0332a8c	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Introduction to Lecturette	9	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1a1af2e5-1dd5-40bc-8f82-f40f9a2e4fcd	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Introduction to Psychological Tests	10	2027-02-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9e3dfa94-d826-492c-904c-bb0b01997eb7	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Thematic Apperception Test	11	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
668dfde5-fb16-41ce-9b26-bec1e2df9a66	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Word Association Test	12	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0e2ce5ef-b25c-4433-8a8b-854fe87bb4c3	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Situation Reaction Test	13	2027-03-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ce506881-d87b-4b60-af89-633ae83cf8f4	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Self Description Test	14	2027-03-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4ae65183-ace5-48e3-b990-64c90c40a2d7	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Introduction to Personal Interview & Understanding PIQ Form	15	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
84713865-8954-4444-8759-5774aaaac6b2	14b59cf3-ab5c-4f5a-a7b9-31c5b4dc5e3f	Introduction to CPSS (AFSB)	16	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6e3699f0-f62b-408c-986a-6393957a22a8	ca9a1488-6e39-4ff2-aa0b-7ccd4f31dcb0	Basics of Economics	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
63ab8825-a7ce-47a0-add5-1da65c07be44	ca9a1488-6e39-4ff2-aa0b-7ccd4f31dcb0	Types of Economy	2	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
13eb5d41-a843-47fa-8f47-07773eea5bff	ca9a1488-6e39-4ff2-aa0b-7ccd4f31dcb0	Planning in India	3	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
52ac61cf-5ccb-4742-a8a9-3165da7f4cb9	ca9a1488-6e39-4ff2-aa0b-7ccd4f31dcb0	Five Year Plans	4	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
54968f91-0764-4c07-ad72-2f5b23edc11f	ca9a1488-6e39-4ff2-aa0b-7ccd4f31dcb0	Money	5	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b7220463-32a9-4f13-a726-5f91ee6dfd3c	ca9a1488-6e39-4ff2-aa0b-7ccd4f31dcb0	Banking	6	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3eac27b6-44e1-453d-84dd-e58b303b96f1	ca9a1488-6e39-4ff2-aa0b-7ccd4f31dcb0	Current Budget	7	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c7368c0d-de5b-4f3e-a73c-e6f4f4736b1c	ca9a1488-6e39-4ff2-aa0b-7ccd4f31dcb0	International Institutions	8	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9c1bc724-bdee-4ec5-bdd2-23af070c1c95	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Introduction of Geography & Syllabus	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e083a054-b0c0-4089-b5be-f722eef8ce1f	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Universe and Cosmology	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ea8f3cca-3ec7-4b8c-9b94-c0b8033598c1	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Solar System	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0c17cf45-8835-43e0-89ba-9c7ce010cfbf	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Earth, Latitude & Longitude	4	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d111b701-83d7-4950-8a87-fd895d654ca0	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Interior of the Earth	5	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6c29ca52-f29c-41a3-b1b6-b396708412ea	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Formation of the Continents & Rocks	6	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f6199f4c-c588-4058-9566-1212c53d0141	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Plate Tectonics	7	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
103a1024-08be-47c2-ac4c-fceeac581a87	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Geomorphic Process (Endogenetic & Exogenetic)	8	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
64eba78e-dcc8-4110-98e1-3837219f5923	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Formation of Mountains, Plateaus & Plains	9	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
606b5278-931d-47a3-97fe-c868ba98285a	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Volcanos, Earthquake & Tsunami	10	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4f75623d-5586-46f2-a70e-a62eb436e57c	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Composition & Structure of Atmosphere	11	2026-12-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7cec808e-9832-403a-a42b-b7e053015660	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Earth Temperature & Atmospheric Pressure	12	2026-12-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
442e1ded-29d5-47af-b7c8-bbb429de5f60	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Temperature Zones, Pressure Belts & Winds	13	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0dc8b899-e86e-4f29-a8f0-4c815e150b99	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Climate & Weather	14	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
513583f7-80ad-47cc-8178-1ae421ec4358	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Precipitation, Cloud, Jet Stream & Cyclones	15	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9098c8e5-e913-4e90-9367-d0d47661d05c	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Ocean & Ocean Relief Features	16	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4fb480da-eb4a-4c25-ba14-178c24c9f64f	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Ocean Water Properties, Waves, Current & Tides	17	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4ca9e752-d686-4c2f-8237-50e4f1e91a82	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Other Water Bodies & Formations	18	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1c8d5354-dbe5-4144-a398-e3d7c8c41427	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	World Facts About Continents	19	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c26ab78d-f5f5-4671-9a14-04d8b3cb5be0	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Soil, Natural Vegetation & Types	20	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6acfdb54-fcc6-47f6-a77e-c8c8b41a8e62	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Physiography of India	21	2027-02-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
090721dd-a954-440f-9c26-435003c5cbb8	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Indian Mountains	22	2027-02-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e3520e19-5de7-4ca4-84f7-59ec603072b3	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Indian Plateau & Coastal Regions (Ghats)	23	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
35a3dd35-cd6b-4506-9453-623f8b62ae57	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Plainland, Desert & Islands	24	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
66848460-6701-40af-b052-1166a42d01cb	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Drainage System (Northern)	25	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
df1dfd10-f18c-4538-a71e-479ca2a43d8d	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Drainage System (Peninsula)	26	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d4478a6f-48d4-4e26-af2c-0fc6ce667690	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Indian Climate & Monsoon	27	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5415b031-44a5-4999-a505-c97af5580dca	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Vegetation & Forest	28	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0ce9acc9-b542-49ab-a720-2101d86a2961	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	India Soil & Agriculture (Crops)	29	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
75736289-e30e-41a5-a700-f8d86bb69ac5	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Minerals, Energy & Industry	30	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bce299f6-2b5e-45b5-bc85-e08ea3239dbf	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Transportation	31	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
825fcfe4-3ec5-40fa-982c-33b9c7965f68	fa3a4b2d-b04a-4843-8e49-80ee086b9de3	Practice Session	32	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fa631ed8-5b23-4ec8-b29a-836c8b845e0a	3f2f67ec-7c7d-4965-9438-3a2375f77585	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d76dde11-48f8-4b74-bb44-0ab5f97026bb	3f2f67ec-7c7d-4965-9438-3a2375f77585	Basic Math – Basic Formulae, Indices	2	2026-11-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8bcab690-ee7c-4635-b69b-5995f72300e4	3f2f67ec-7c7d-4965-9438-3a2375f77585	Basic Math – Inequality	3	2026-11-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f69ec91b-befd-4a19-bec3-1d1926e89207	3f2f67ec-7c7d-4965-9438-3a2375f77585	Basic Math – Modulus Basic	4	2026-11-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4fee8eef-8af7-4774-85c9-8b2c46aec683	3f2f67ec-7c7d-4965-9438-3a2375f77585	Basic Math – Modulus Advanced	5	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8c364b8b-6ba3-44d1-9148-0eb453a9e55d	3f2f67ec-7c7d-4965-9438-3a2375f77585	Logarithms – Logarithms Properties	6	2026-11-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
19cfad65-7c02-41c5-ad34-8e1d37128663	3f2f67ec-7c7d-4965-9438-3a2375f77585	Logarithms – Logarithms and Exponential Function	7	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a533f7e6-7a11-4cc9-af3d-50b0a9156c39	3f2f67ec-7c7d-4965-9438-3a2375f77585	Logarithms – PYQs and Doubts	8	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
90abaf7a-d62e-4ab1-b58c-5639811238d2	3f2f67ec-7c7d-4965-9438-3a2375f77585	Sets – Sets and Their Representations	9	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2d48f93e-9b81-4a26-8a29-4cbc0f98c655	3f2f67ec-7c7d-4965-9438-3a2375f77585	Sets – Types of Set	10	2026-11-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
70e6813f-8cc9-47d7-939f-0ef26e0c9754	3f2f67ec-7c7d-4965-9438-3a2375f77585	Sets – Venn Diagram	11	2026-11-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3548a761-1a40-4631-8492-12d6fcbe9903	3f2f67ec-7c7d-4965-9438-3a2375f77585	Sets – Operation on Sets (Union, Intersection, Difference of Sets)	12	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9b9c352a-201a-4c8a-b76f-d59b14a0e90f	3f2f67ec-7c7d-4965-9438-3a2375f77585	Sets – PYQs and Doubts	13	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
719bdd0a-7d4f-41cc-a91b-4ada363fd5fa	3f2f67ec-7c7d-4965-9438-3a2375f77585	Quadratic Equations – Basics of Roots, Solution and Nature of Roots	14	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f72477b2-458c-41c7-a5b7-a25cfe7730af	3f2f67ec-7c7d-4965-9438-3a2375f77585	Quadratic Equations – Properties of Roots	15	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
17b55c6f-e47e-4800-ba89-91572d30e9ab	3f2f67ec-7c7d-4965-9438-3a2375f77585	Quadratic Equations – Graph and Location of Roots	16	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8bcc3270-3475-4dce-8849-0cf7b7d78ede	3f2f67ec-7c7d-4965-9438-3a2375f77585	Quadratic Equations – PYQs and Doubts	17	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a56a35b4-353f-4cbe-8d17-6ad58876369d	3f2f67ec-7c7d-4965-9438-3a2375f77585	Sequence and Series – Basics of Progression and Series	18	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bf67ac6a-5bb4-4ecd-b6c4-2128615bd3ae	3f2f67ec-7c7d-4965-9438-3a2375f77585	Sequence and Series – Arithmetic Progression	19	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4733d0b9-ea81-4c32-b826-b1a8a703d790	3f2f67ec-7c7d-4965-9438-3a2375f77585	Sequence and Series – Arithmetic and Harmonic Progression	20	2026-12-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ea414d66-5e10-47de-b1d0-75228a6eaa6c	3f2f67ec-7c7d-4965-9438-3a2375f77585	Sequence and Series – Geometric Progression	21	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b817d144-86a5-4374-bc73-cf929a248ea9	3f2f67ec-7c7d-4965-9438-3a2375f77585	Sequence and Series – Relation Between AM and GM	22	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
32ca1b41-5312-4900-9f1e-a16d88210eb3	3f2f67ec-7c7d-4965-9438-3a2375f77585	Sequence and Series – PYQs and Doubts	23	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e6130743-28ac-40c4-99cd-6e5305332f0f	3f2f67ec-7c7d-4965-9438-3a2375f77585	Relations and Functions – Cartesian Products of Sets	24	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fea3ab99-4adb-477a-8c30-a4ad2f43b0d5	3f2f67ec-7c7d-4965-9438-3a2375f77585	Relations and Functions – Relations	25	2026-12-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
37f93908-f6bf-4796-8a3c-634ce4c805fe	3f2f67ec-7c7d-4965-9438-3a2375f77585	Relations and Functions – Functions	26	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3036600c-c972-473a-b80e-e76759e4a39f	3f2f67ec-7c7d-4965-9438-3a2375f77585	Relations and Functions – Some Functions and Their Graphs	27	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5aac2903-b016-4d45-ae21-36042d6569de	3f2f67ec-7c7d-4965-9438-3a2375f77585	Relations and Functions – Domain and Range	28	2026-12-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
de7f14c4-1522-4732-a059-0b1dcaa133a4	3f2f67ec-7c7d-4965-9438-3a2375f77585	Relations and Functions – PYQs and Doubts	29	2026-12-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2341923c-c4bf-4cbd-8a8b-e74d9e613061	3f2f67ec-7c7d-4965-9438-3a2375f77585	Trigonometry – Introduction to Trigonometry & Identities, Quadrants and Conversion of Angle	30	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
d25da066-5cea-4e06-81eb-62a51af2722c	3f2f67ec-7c7d-4965-9438-3a2375f77585	Trigonometry – Compound Angle and Transformation of Angles	31	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
04287b68-578d-46e6-90f2-52ee55937cfe	3f2f67ec-7c7d-4965-9438-3a2375f77585	Trigonometry – Multiple Angle Formulas	32	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
e6136631-df97-46ce-aff9-2d5582c6c7ac	3f2f67ec-7c7d-4965-9438-3a2375f77585	Trigonometry – PYQs and Doubts	33	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
70b7fa6f-c914-4550-8616-b013451485d1	3f2f67ec-7c7d-4965-9438-3a2375f77585	Trigonometric Equations – General Solutions of Trigonometric Equations	34	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
f3c7ae77-70b6-4406-ac59-2dc70e385534	3f2f67ec-7c7d-4965-9438-3a2375f77585	Trigonometric Equations – PYQs and Doubts	35	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
50f9f8c1-0b18-41ee-b50a-53a2ecec7e82	3f2f67ec-7c7d-4965-9438-3a2375f77585	Applications of Trigonometry – Heights and Distances	36	2027-01-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
54dfc635-da0c-4076-905e-18edbf058a48	3f2f67ec-7c7d-4965-9438-3a2375f77585	Applications of Trigonometry – Properties of Triangle	37	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4b784961-e55d-41ed-972b-df71de301bf3	3f2f67ec-7c7d-4965-9438-3a2375f77585	Applications of Trigonometry – PYQs and Doubts	38	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
49817930-40a4-48ec-92c5-0cd19da0e53f	3f2f67ec-7c7d-4965-9438-3a2375f77585	Complex Numbers – Imaginary Number, Power of Iota, Basics of Complex	39	2027-01-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7be947e7-b2dd-4a20-922f-6128917702a7	3f2f67ec-7c7d-4965-9438-3a2375f77585	Complex Numbers – Conjugate and Modulus, Amplitude, Polar Form	40	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3a57e460-d086-44e6-844a-296628225492	3f2f67ec-7c7d-4965-9438-3a2375f77585	Complex Numbers – Eulerian Form, Square Root, Cube Root of Unity	41	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ab247cae-d987-4691-b01a-50a6fd07d32d	3f2f67ec-7c7d-4965-9438-3a2375f77585	Complex Numbers – Maximum, Minimum	42	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8fddf1b3-32c5-4d2e-99d5-4c33b8e46e15	3f2f67ec-7c7d-4965-9438-3a2375f77585	Permutations & Combinations – Permutations	43	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
683a680b-6d29-495a-9586-0ae819f0b551	3f2f67ec-7c7d-4965-9438-3a2375f77585	Permutations & Combinations – Combinations	44	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c683abb4-0a46-4b95-91f0-65cd25e5b0d1	3f2f67ec-7c7d-4965-9438-3a2375f77585	Permutations & Combinations – Mixed Problems	45	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ad0240f2-be59-4927-b933-be6e90ff3abd	3f2f67ec-7c7d-4965-9438-3a2375f77585	Permutations & Combinations – PYQs and Doubts	46	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5aca368a-6730-4f48-bc2c-8714af35c412	3f2f67ec-7c7d-4965-9438-3a2375f77585	Binomial Theorem – Number of Terms, General Term	47	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
faa63e6d-6110-4282-9e90-5d8ab98a52e1	3f2f67ec-7c7d-4965-9438-3a2375f77585	Binomial Theorem – Coefficient of Terms, Middle Term, Greatest Term	48	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4cfd4a72-384a-466a-9fd9-bb93b82dd765	3f2f67ec-7c7d-4965-9438-3a2375f77585	Binomial Theorem – NGT and Special Formula	49	2027-01-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
eef1895d-ef08-4a08-952b-771c028640e8	3f2f67ec-7c7d-4965-9438-3a2375f77585	Binomial Theorem – PYQs and Doubts	50	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bacf2fe7-1880-4f06-91b2-19bfbc1dfae2	3f2f67ec-7c7d-4965-9438-3a2375f77585	Probability – Random Experiments, Outcomes and Sample Space, Event, Occurrence of an Event	51	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
331e3f01-bad9-4ee2-a4ec-c6cdb62ea377	3f2f67ec-7c7d-4965-9438-3a2375f77585	Probability – Types of Events, Algebra of Events	52	2027-02-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
27a0447f-e306-41f7-8911-b6fa5d43f54e	3f2f67ec-7c7d-4965-9438-3a2375f77585	Probability – Axiomatic Approach to Probability	53	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ff5ee899-7a22-41a0-afeb-0e07c23e1fce	3f2f67ec-7c7d-4965-9438-3a2375f77585	Probability – Probability (Advanced)	54	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8dc521c5-b417-49aa-9718-3f264f5006d0	3f2f67ec-7c7d-4965-9438-3a2375f77585	Probability – Conditional Probability	55	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
87f7fa02-5d4b-4bc6-a662-ada44ce4ca20	3f2f67ec-7c7d-4965-9438-3a2375f77585	Probability – Total Probability Theorem	56	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2689b7bd-859b-4678-9400-46240d0cdab8	3f2f67ec-7c7d-4965-9438-3a2375f77585	Probability – Bayes’ Theorem	57	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9bc71d76-da44-438b-b060-3f988b99dcd7	3f2f67ec-7c7d-4965-9438-3a2375f77585	Probability – Probability Distribution	58	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f8e22549-67aa-4beb-a7dc-267c8e05b990	3f2f67ec-7c7d-4965-9438-3a2375f77585	Probability – PYQs and Doubts	59	2027-02-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1e4b88a5-cf8e-4a51-8eae-4755d0651614	3f2f67ec-7c7d-4965-9438-3a2375f77585	Co-ordinate Geometry – Cartesian Coordinate System and Section Formula	60	2027-02-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bf3dd786-56fa-4135-a471-065402e944b2	3f2f67ec-7c7d-4965-9438-3a2375f77585	Co-ordinate Geometry – Slope, Equation of Line, Angle Between Two Lines	61	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0f5cdfd7-994b-4d91-8cf2-0495df715687	3f2f67ec-7c7d-4965-9438-3a2375f77585	Co-ordinate Geometry – Various Forms of the Equation of a Line	62	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
59d3d6ec-f33b-4e09-83c7-4fa382485f98	3f2f67ec-7c7d-4965-9438-3a2375f77585	Co-ordinate Geometry – Distance of a Point From a Line	63	2027-02-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0f467fd1-aba8-4ee4-9ebe-0badcc52717a	3f2f67ec-7c7d-4965-9438-3a2375f77585	Co-ordinate Geometry – Pairs of Straight Line and Miscellaneous	64	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b1730fc2-492b-417b-ab9c-2dc2778d7349	3f2f67ec-7c7d-4965-9438-3a2375f77585	Co-ordinate Geometry – Term Related to Triangles	65	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6589c6de-9307-4db2-99e0-29e6669f4784	3f2f67ec-7c7d-4965-9438-3a2375f77585	Co-ordinate Geometry – PYQs and Doubts	66	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e2bf6df2-e346-46d5-94e4-29544689f4ad	3f2f67ec-7c7d-4965-9438-3a2375f77585	Conic Section – Basics of Circles	67	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
76800cf3-2c55-4b93-a6a1-3bffabb1cc80	3f2f67ec-7c7d-4965-9438-3a2375f77585	Conic Section – Intersections of Circle and Parametric Form of Circle	68	2027-03-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bdbd3908-f0eb-4150-9f0c-cf766e7ef235	3f2f67ec-7c7d-4965-9438-3a2375f77585	Conic Section – Tangent and Normal of Circles	69	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c93d87d3-03a8-47e7-8ade-ad5ef6ae2dff	75e8bf3e-be66-427c-95a0-8f9616f114c0	Passage	20	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1513702e-e6c6-4f71-b8b0-796b180efb4a	3f2f67ec-7c7d-4965-9438-3a2375f77585	Conic Section – Introduction to Parabola and Standard Form	70	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7f3128de-e987-4542-8573-5dc8a0c48241	3f2f67ec-7c7d-4965-9438-3a2375f77585	Conic Section – Shifting of Parabola	71	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c00d5b3e-d6b5-4eec-aa35-e2ac05dbe898	3f2f67ec-7c7d-4965-9438-3a2375f77585	Conic Section – Ellipse	72	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6184aae5-e053-481b-9565-13d304b6b6d0	3f2f67ec-7c7d-4965-9438-3a2375f77585	Conic Section – Hyperbola	73	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
460564c0-ef34-48f3-a4d1-a14f447c4cb4	3f2f67ec-7c7d-4965-9438-3a2375f77585	Conic Section – PYQs and Doubts	74	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
39e62036-8aca-4296-92e9-2396d8de4f19	3f2f67ec-7c7d-4965-9438-3a2375f77585	Three Dimensional Geometry – Basics of Three Dimensional Geometry	75	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
10cc4e22-aaa3-4b02-afe4-4fe31cc78804	3f2f67ec-7c7d-4965-9438-3a2375f77585	Limits and Derivatives – Basics of Limits	76	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
510714e6-b021-47cf-a566-16d0f55f49e6	3f2f67ec-7c7d-4965-9438-3a2375f77585	Limits and Derivatives – Existence of Limits	77	2027-03-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3c454efd-71c2-4ddf-bf41-06fc04d120a6	3f2f67ec-7c7d-4965-9438-3a2375f77585	Limits and Derivatives – Limits and Evaluation of Limits	78	2027-03-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
af6a8402-28f4-463a-a23d-7d541a6dbbe3	3f2f67ec-7c7d-4965-9438-3a2375f77585	Limits and Derivatives – Derivatives	79	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f55faa13-1a53-4fd7-85e7-08dbf1ebbbcb	3f2f67ec-7c7d-4965-9438-3a2375f77585	Limits and Derivatives – L’Hôpital Rule of Limit	80	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
786aa3b7-4734-4921-9e9e-a282efbf7cb5	3f2f67ec-7c7d-4965-9438-3a2375f77585	Limits and Derivatives – First Principle of Differentiation	81	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ed8de426-5bf5-47f2-b27a-a481cfb03dcd	3f2f67ec-7c7d-4965-9438-3a2375f77585	Limits and Derivatives – Chain Rule of Derivative	82	2027-03-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
57425cbb-c238-4751-9f72-49f866bbfd43	3f2f67ec-7c7d-4965-9438-3a2375f77585	Limits and Derivatives – Algebra of Derivative (Product and Division Rule)	83	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a78c26b3-a768-4b83-b4c3-bdb30cb815d0	3f2f67ec-7c7d-4965-9438-3a2375f77585	Limits and Derivatives – Parametric Form of Derivative	84	2027-03-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ae33649c-0335-4ba3-8f5b-24aea19541b2	3f2f67ec-7c7d-4965-9438-3a2375f77585	Limits and Derivatives – Logarithmic & Implicit Differentiation	85	2027-04-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
544689dc-f923-428b-ab8c-a7a8adfae7c8	3f2f67ec-7c7d-4965-9438-3a2375f77585	Statistics	86	2027-04-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
16c0bec2-64ae-4fff-8ff8-0f3b42e73583	3f2f67ec-7c7d-4965-9438-3a2375f77585	Binary Numbers	87	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ce7a3850-d319-4f75-8fe7-7aea64e5c006	18a334e3-0b30-4e75-8e56-110683e99be2	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7cdb7703-00a0-43c6-8cc9-a85af4b124f1	18a334e3-0b30-4e75-8e56-110683e99be2	Basic Mathematics	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
db5ba940-c0be-4601-8441-3b47527fbfab	18a334e3-0b30-4e75-8e56-110683e99be2	Units & Measurements (Errors + Dimensions)	3	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c2114840-78a7-4ee5-a569-853e3a1e9c03	18a334e3-0b30-4e75-8e56-110683e99be2	Vector	4	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1ca712dd-c27c-4a8a-b69a-a16810e3fe64	18a334e3-0b30-4e75-8e56-110683e99be2	Motion in Straight Line	5	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
86373ae5-ba96-4da0-8124-772141f12276	18a334e3-0b30-4e75-8e56-110683e99be2	Motion in Plane	6	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8a9563f9-b615-4962-ba90-466fc288dc72	18a334e3-0b30-4e75-8e56-110683e99be2	Newton’s Laws of Motion (NLM)	7	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
57cefa40-2910-4151-86f8-c662b533d4bc	18a334e3-0b30-4e75-8e56-110683e99be2	Friction	8	2026-12-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
91e35e48-8047-4206-ad8c-3df7f1142f54	18a334e3-0b30-4e75-8e56-110683e99be2	Work, Power & Energy (WPE)	9	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
42c88351-d2c7-4c40-b35b-58b6c8326209	18a334e3-0b30-4e75-8e56-110683e99be2	Gravitation	10	2026-12-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e55d72eb-d353-4f81-986a-229464ad33f1	18a334e3-0b30-4e75-8e56-110683e99be2	Rotation (Basics)	11	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ea539306-426b-4753-9d5c-1e859bf45f4a	18a334e3-0b30-4e75-8e56-110683e99be2	Mechanical Properties of Solids	12	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b148cc4f-6f54-4d75-aaa9-c76397d5e4a7	18a334e3-0b30-4e75-8e56-110683e99be2	Mechanical Properties of Fluids	13	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e46a73e1-88bd-4b2d-9747-7193a98ba1ab	18a334e3-0b30-4e75-8e56-110683e99be2	Heat & Thermal Properties	14	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3258bffc-7cb4-4fc7-a717-c39ec19a94b7	18a334e3-0b30-4e75-8e56-110683e99be2	Thermodynamics + Kinetic Theory of Gases	15	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1845359e-8768-4f84-a2e5-2e2d223ee871	18a334e3-0b30-4e75-8e56-110683e99be2	Simple Harmonic Motion (SHM)	16	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f2bc2e42-39c7-4f5a-9a5e-a52516555c2e	18a334e3-0b30-4e75-8e56-110683e99be2	Waves & Sound	17	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9d85c89a-2474-4a9f-bf88-a4fd32de036b	18a334e3-0b30-4e75-8e56-110683e99be2	Electrostatics	18	2027-02-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c04479df-7743-4c71-b958-897fff471d65	18a334e3-0b30-4e75-8e56-110683e99be2	Current Electricity	19	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
07e8f96a-7540-4990-a5d2-32b95624c1a9	18a334e3-0b30-4e75-8e56-110683e99be2	Magnetism & Moving Charges	20	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1f884277-5b79-4a22-ab49-9a4e80d7604e	18a334e3-0b30-4e75-8e56-110683e99be2	Electromagnetic Induction (EMI) + AC	21	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
514a2e03-f1f5-4258-921f-d708bae155e8	18a334e3-0b30-4e75-8e56-110683e99be2	Ray Optics + Wave Optics	22	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
75c510e0-16d7-48bb-b472-eefb3d5b7091	18a334e3-0b30-4e75-8e56-110683e99be2	Modern Physics	23	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f0e17b9a-d7d8-4f0f-9e5d-f8fb67e012fb	18a334e3-0b30-4e75-8e56-110683e99be2	Semiconductor Electronics	24	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
89ec5d89-701e-4aa8-8349-d941cdc3d409	18a334e3-0b30-4e75-8e56-110683e99be2	PYQ + Final Revision	25	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
330540e8-a9fe-4a27-bae2-8503b84b396d	6d800e12-c6ce-4f6e-9562-5f67a882f71d	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9a242a83-f384-40cc-a69c-d2c575109981	6d800e12-c6ce-4f6e-9562-5f67a882f71d	Physical Classification of Matter	2	2026-11-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
31f21468-cb42-40af-b76a-121a3b3237c8	6d800e12-c6ce-4f6e-9562-5f67a882f71d	Elements, Compounds and Mixtures	3	2026-11-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a453582b-9d83-4060-8a4d-0dbc55fbea6d	6d800e12-c6ce-4f6e-9562-5f67a882f71d	Structure of Atom	4	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1d6645bd-432d-486c-8056-2df49bd75626	6d800e12-c6ce-4f6e-9562-5f67a882f71d	Electronic Configuration	5	2026-12-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e0e4e90b-5734-49c4-b64a-805d5c62ca8d	6d800e12-c6ce-4f6e-9562-5f67a882f71d	Periodic Table	6	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
75acf459-d6e4-4a4c-b994-a5298516f225	6d800e12-c6ce-4f6e-9562-5f67a882f71d	Chemical Bonding	7	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d237e13c-0614-4823-aa24-2661f59894a9	6d800e12-c6ce-4f6e-9562-5f67a882f71d	Acids, Bases and Salts	8	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
795b2d9d-2335-4d5f-b34e-6a194b06c6df	6d800e12-c6ce-4f6e-9562-5f67a882f71d	Metals and Non-Metals	9	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cd728fc7-3a47-46e5-b207-0041141b99ff	6d800e12-c6ce-4f6e-9562-5f67a882f71d	The Iso Species and Carbon	10	2027-02-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8da345f8-7afd-454e-b282-a0ce85a714db	6d800e12-c6ce-4f6e-9562-5f67a882f71d	IUPAC Nomenclature and Types of Reactions	11	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1645447c-0d82-402f-b54d-610987d6e77a	6d800e12-c6ce-4f6e-9562-5f67a882f71d	Important Industrial Preparations, Corrosion, Water and Types of Hardness	12	2027-03-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4a8cbe30-4d92-497d-ab8e-76a278d90ddf	6d800e12-c6ce-4f6e-9562-5f67a882f71d	Mole Concept	13	2027-03-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
104ebf0e-34d3-42a3-97d1-c024233acee4	6d800e12-c6ce-4f6e-9562-5f67a882f71d	Chemistry in Everyday Life	14	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1e819e67-8697-4df2-b513-1180159479c4	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Cell	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d5d99c1e-187a-4981-9808-c74119254ada	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Animal Tissues	2	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
067e33e4-3c32-47bc-bcf1-9b858e770a32	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Plant Tissues	3	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
27dbc4ea-5841-4ed0-8e95-a6e2374a0a30	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Life Processes	4	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
48cce025-d4a0-4bc0-bc6b-6e5a7b009417	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Control and Coordination in Humans	5	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b3a173e1-5480-4c86-8ab0-28e49148c509	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Control and Coordination in Plants	6	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fb9f8f36-f4fb-4fb7-a22b-d997bcbe0418	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Reproduction – Introduction	7	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
86fc504e-9a7e-41a3-8e88-a528a4339853	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Sexual Reproduction in Flowering Plants	8	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8bba9579-3bb1-4aa5-b840-b91b6ba24ac9	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Human Reproduction	9	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6c7dc00d-e897-49eb-a819-61abc8f0f0d0	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Diversity in Organisms	10	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cb6d131b-50bb-40f4-8b0f-7d93ad9fbf77	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Human Health and Diseases	11	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
92360a2a-4444-449c-95db-00cd8db5b761	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Important Vitamins and Minerals	12	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
42b77ca9-448f-41b4-9e27-a3fe0d3b9b3f	5a1c1abf-f2d9-4116-bc35-0cd597280da5	Genetics	13	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
acc9d8d6-ea2b-4d92-bfd0-418ebc47914b	1034bb79-93c3-46e2-a41f-80513e4b7d0b	All About NDA Exam	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
79bddf16-0a28-4842-a56c-16ef21dc2dbe	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Vocabulary	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e7b0a6b2-074b-4e45-bdc3-2849cee2bfbf	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Noun	3	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1eec7db4-5272-42ed-b083-19465c0563b3	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Pronoun	4	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c9f80c39-363b-48d8-a372-f21f7fae67c1	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Idioms and Phrases	5	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0d9f1985-69bd-486c-b938-dc5207a539ed	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Conjunction	6	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6d0c87b3-967d-4e15-b763-565aae2c0e37	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Adjective	7	2026-12-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2e90993d-49e2-4caa-845e-0002621d8496	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Adverb	8	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
93639e9a-360a-49e3-a625-9458db37f266	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Preposition	9	2026-12-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1b31e3d2-ecb3-49b3-9013-3ad124f1457e	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Fixed Preposition	10	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c0d61930-793c-4c7b-802c-bc584965e396	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Articles	11	2027-01-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0fff0e54-8468-476d-b462-484edabfdf1e	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Sentence Arrangement	12	2027-01-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1cd5ac4e-4288-4ea8-8eb5-f6847bb1771d	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Verb	13	2027-01-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d1ac7738-3dcd-4296-8f57-0937413eb2ff	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Tense	14	2027-01-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
23b23eeb-86c3-4d88-8b93-bb919625ea5a	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Conditional Sentences	15	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
730ff3ac-5611-4b2d-b5dd-81383e3de030	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Question Tag	16	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
15295454-2682-4f3d-b122-b73153b94566	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Voice	17	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6441fb84-401f-4b9f-9849-1de44ecca582	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Narration	18	2027-02-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
551a01f0-5171-44a5-800c-2447ae1c7299	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Modals	19	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7925868d-22c9-4de1-9855-95ec7f9e5135	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Passage	20	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6fe3a2c2-eb1e-4da8-a350-288719d4ff64	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Cloze Test	21	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c533d027-7e7b-401c-ab6e-9e410a21b8ac	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Previous Year Questions	22	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f881161c-8b14-4d76-9d7b-f43085c5fcaa	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Homophones	23	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
07f4b202-eb16-4267-b4ad-d1fdbcbcb065	1034bb79-93c3-46e2-a41f-80513e4b7d0b	Important Miscellaneous Questions	24	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f0217e6a-db17-4bfa-abf6-4d8fa1ffefc8	e69cfb91-797f-4878-b976-edcf6ed552d9	September	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c16f8188-9ba9-4db9-a77b-2f9f1af0c6b1	e69cfb91-797f-4878-b976-edcf6ed552d9	October	2	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b47d32d5-c043-4359-9032-54fbb191a704	e69cfb91-797f-4878-b976-edcf6ed552d9	November	3	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
80d689e8-0c17-4309-97e9-35f6526ce3a1	e69cfb91-797f-4878-b976-edcf6ed552d9	December	4	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
317ad35a-0624-4031-929e-140ec541eaf2	e69cfb91-797f-4878-b976-edcf6ed552d9	January	5	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
391a3373-9ae4-452c-8a95-a7029940a053	c1e1a118-76d2-4403-9896-7a07b298657e	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
234ed111-431d-4b43-a9df-9cce09299395	c1e1a118-76d2-4403-9896-7a07b298657e	Origin of Human	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7afb4c15-9b24-44f9-94da-e03e874ef0c0	c1e1a118-76d2-4403-9896-7a07b298657e	Indus Valley Civilization	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1762391a-4aa9-4efb-97b5-de6f64e62c61	c1e1a118-76d2-4403-9896-7a07b298657e	Vedic Civilization	4	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b6bd83ec-ad36-4b54-8116-f767df4a5da9	c1e1a118-76d2-4403-9896-7a07b298657e	Religious Movement	5	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8a9a4eeb-93dd-4a9e-a8ea-8171613356dd	c1e1a118-76d2-4403-9896-7a07b298657e	Mahajanapadas / Foreign Invasions	6	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c2101419-905f-4d3a-aa7d-f4028dd8a4ba	c1e1a118-76d2-4403-9896-7a07b298657e	Mauryan Empire	7	2026-12-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3bd16bd6-e482-437b-af0f-526c20ca1dd5	c1e1a118-76d2-4403-9896-7a07b298657e	Post Mauryan Age	8	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3c30f84b-dc7d-4050-8bdd-c39251d7ee9c	c1e1a118-76d2-4403-9896-7a07b298657e	Sangam Era	9	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1027eb17-e311-4042-a86e-44b626a24b98	c1e1a118-76d2-4403-9896-7a07b298657e	Gupta Empire	10	2026-12-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
92e5a478-009f-4bc5-a9e9-533f22e4341b	c1e1a118-76d2-4403-9896-7a07b298657e	Post Gupta Age	11	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5bf85253-4f7f-491b-94a7-640a2a3337a9	c1e1a118-76d2-4403-9896-7a07b298657e	Rajput Period	12	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8b78e22e-4dcb-411d-b036-9e0628cff30f	c1e1a118-76d2-4403-9896-7a07b298657e	Chola Empire	13	2026-12-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ac51c2b4-8632-493e-b780-54353d348078	c1e1a118-76d2-4403-9896-7a07b298657e	Delhi Sultanate	14	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
756a2232-1342-4187-a166-50daf0b22542	c1e1a118-76d2-4403-9896-7a07b298657e	Vijaynagar Empire	15	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fc5cbc55-cc2b-4764-aabb-29f2af30a361	c1e1a118-76d2-4403-9896-7a07b298657e	Bahamani Empire	16	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
aedf5f62-1271-4baf-8530-922ce200b86d	c1e1a118-76d2-4403-9896-7a07b298657e	Bhakti Movement	17	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b03f30a1-7c0f-4edf-ba33-24b5c18ca07e	c1e1a118-76d2-4403-9896-7a07b298657e	Sufi Movement	18	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b70512fa-7b45-48c3-b56c-c14f07300ef1	c1e1a118-76d2-4403-9896-7a07b298657e	Rise of Mughals	19	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
69356ff9-21a3-4199-a5e4-48a5fa43d76f	c1e1a118-76d2-4403-9896-7a07b298657e	Expansion of Mughal Empire	20	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
783e31f3-5158-4e7a-b6a8-ff9a059a1b5b	c1e1a118-76d2-4403-9896-7a07b298657e	Aurangzeb and Decline of Mughals	21	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
349070e4-5011-4b0a-ba0a-1d2c890220fd	c1e1a118-76d2-4403-9896-7a07b298657e	Later Mughals	22	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
889a0884-7f72-430c-8949-54c3d0d51477	c1e1a118-76d2-4403-9896-7a07b298657e	The Rise of Maratha Empire under Shivaji	23	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
63225893-d152-48e5-8f88-22e159849a8b	c1e1a118-76d2-4403-9896-7a07b298657e	Peshwa and Third Battle of Panipat	24	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e5891301-2586-4c54-9aa6-41696d3c2c84	c1e1a118-76d2-4403-9896-7a07b298657e	Arrival of Europeans in India	25	2027-02-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cc4386e4-cbcf-40a1-9f26-3eb98c37aa38	c1e1a118-76d2-4403-9896-7a07b298657e	British Conquest in India	26	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
03abbc54-0a40-4cdd-93c1-f04d61c07825	c1e1a118-76d2-4403-9896-7a07b298657e	Early Revolts Against British Rule	27	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b7c6a31f-466c-4bae-acd0-ab371a62fe4d	c1e1a118-76d2-4403-9896-7a07b298657e	Indian Renaissance	28	2027-03-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
67219868-5683-493e-af1d-e442a3b113fa	c1e1a118-76d2-4403-9896-7a07b298657e	Rise of British Rule	29	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7b83e8d8-4638-41da-985d-2907092b2c5c	c1e1a118-76d2-4403-9896-7a07b298657e	British Rule	30	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
00e5298c-35de-4874-b8d8-e80c11a12d9d	c1e1a118-76d2-4403-9896-7a07b298657e	The Revolt of 1857	31	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
330b1325-71b7-4f00-b062-9947f8eaac71	c1e1a118-76d2-4403-9896-7a07b298657e	Crown Rule	32	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
057f94fe-5c0a-4c39-b0b6-175ce1e6b4c3	c1e1a118-76d2-4403-9896-7a07b298657e	National Movement	33	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cd27822c-1300-44c2-a9f4-fa494a18b432	c1e1a118-76d2-4403-9896-7a07b298657e	World History	34	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5417f696-0c11-43de-867f-5e5dc2392953	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3fdfaa7c-0798-4069-a017-ea828e423232	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Basics of Polity	2	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
278b4b0d-4625-4052-a7c6-1a0b01f28644	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Constitutional Development	3	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8e298d48-d615-49ea-9db9-052d286cbdd9	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Making of Constitution	4	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0642a010-8479-4c8a-ae8d-db550bac8410	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Features and Preamble of Constitution	5	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5b073031-3fc5-4503-b6ab-ed81fb8abf00	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Union and Its Territories	6	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a7040d77-53ce-484f-aeb7-6a65bdcbda88	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Citizenship	7	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ba924d1a-f341-4b59-97b6-916ddc59ae13	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Fundamental Rights	8	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
901b5f27-9f98-4629-81ca-6ee08f8d07bf	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Directive Principles of State Policy	9	2027-01-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0211dfa0-bbc4-4656-9bb7-27949c82e1da	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Fundamental Duties	10	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b25f7f3a-da50-46aa-9776-102eb8d31eb1	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Parliament	11	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d4ca12aa-d6b9-4d61-ba43-bcb41e5fafba	055a30e9-8235-413b-a1f9-4f1b5a39e40a	President	12	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1890f5c9-8e82-4bbd-8912-29ab67a61f99	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Vice President	13	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e8cb2f5b-5bac-4a6a-ab2e-a368516f7cff	055a30e9-8235-413b-a1f9-4f1b5a39e40a	State Legislature	14	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ce288e37-0c31-421b-8e82-819b86f3ab6e	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Governor	15	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
85c01f79-1d40-4048-b37c-d132a3a260a6	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Supreme Court	16	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a85c42f5-6b1a-40ba-99ba-6bb65b58ef30	055a30e9-8235-413b-a1f9-4f1b5a39e40a	High Court	17	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c53c2496-6e6a-42c0-a7f3-b0f9a625c426	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Emergency	18	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
70240b91-857e-4483-9762-ad887f92fa7e	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Local Self Government	19	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8f74a2bd-dda1-4e8a-89a6-c1e7846c91f2	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Constitutional Bodies	20	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1eb78c49-8b5c-462f-b07a-939c07e10c0f	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Important Amendments	21	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b4393e5c-bd67-4e3f-85d0-b61df8d6cbfd	055a30e9-8235-413b-a1f9-4f1b5a39e40a	Miscellaneous	22	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a6620a14-1458-448b-8707-d32a19da7d08	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Introduction to SSB Process	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cc167f16-d8af-4cf4-a195-2aea052c5351	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	OIR Lectures	2	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dad41220-3131-4547-acb7-5ecfff5c8bf6	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	PPDT: Story Writing	3	2026-11-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
381f1449-f7f2-4594-8e46-804c5fc0499f	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	PPDT: Narration & Group Discussion	4	2026-12-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d1521feb-0538-40aa-ae72-5ec94c7999c6	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Introduction to GTO & Its Importance	5	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e8a661d3-164f-41d8-923c-107cda44a6c2	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Group Tasks: GD + GPE	6	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
eefd6fc8-2a2d-4461-aefb-f6aefb86e557	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Group Tasks: Individual Obstacles (IO) & Group Obstacle Race (GOR)	7	2027-01-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
26bcf26a-a88c-48f5-a13e-4a6f6a89e514	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Group Tasks: PGT/HGT/CT/FGT	8	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9195e692-73e7-4b53-a247-d83dd62f2969	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Introduction to Lecturette	9	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2bab4dee-9cc0-4e20-8deb-656007297b5a	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Introduction to Psychological Tests	10	2027-02-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3f1a391c-b878-4037-9740-2ac391bb1051	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Thematic Apperception Test	11	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1415ffeb-88e3-4a8d-9809-177d04ebad60	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Word Association Test	12	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d3d9e2c6-221f-4478-b311-952cf6646448	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Situation Reaction Test	13	2027-03-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ec942251-78fb-4029-91a0-f21ab2f04958	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Self Description Test	14	2027-03-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
99b97a93-a323-4c34-b02b-68c9e4f0de01	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Introduction to Personal Interview & Understanding PIQ Form	15	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ca61f9a4-187e-454a-8340-6eda51e628d9	3ecae0ed-bc40-47e3-91d8-ba2903da30cb	Introduction to CPSS (AFSB)	16	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a5bc2ebc-4ec8-45ce-92e4-26c37359ea05	1939c5a7-80f7-43bd-85ec-ebeabb4c2bbe	Basics of Economics	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3eddbdde-8f21-4f29-9a7b-f2ab65c219b8	1939c5a7-80f7-43bd-85ec-ebeabb4c2bbe	Types of Economy	2	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
01f270c7-32ea-4d97-a10e-169de5168164	1939c5a7-80f7-43bd-85ec-ebeabb4c2bbe	Planning in India	3	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f0fd2b71-16a6-4ca9-a7c7-94454053ccb3	1939c5a7-80f7-43bd-85ec-ebeabb4c2bbe	Five Year Plans	4	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fe5fb326-d4a7-4e44-905c-0a084e4bd4b4	1939c5a7-80f7-43bd-85ec-ebeabb4c2bbe	Money	5	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2095a677-aa10-4db2-bdbf-92feb7e10ee9	1939c5a7-80f7-43bd-85ec-ebeabb4c2bbe	Banking	6	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cfb716de-1825-4553-acff-c9440aeff02f	1939c5a7-80f7-43bd-85ec-ebeabb4c2bbe	Current Budget	7	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2a866747-20f8-4309-906a-18a8c11a34b2	1939c5a7-80f7-43bd-85ec-ebeabb4c2bbe	International Institutions	8	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
88de1bad-3284-49f6-8db9-8b57931ab285	e799307c-1cfa-4cd7-b993-157804da2d79	Introduction of Geography & Syllabus	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f8434461-8227-4391-9baf-71374a4239c2	e799307c-1cfa-4cd7-b993-157804da2d79	Universe and Cosmology	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ed597834-5622-40b8-aada-84ecec5eb4a3	e799307c-1cfa-4cd7-b993-157804da2d79	Solar System	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b76ab090-0722-4d7b-b00a-5dec03cc2271	e799307c-1cfa-4cd7-b993-157804da2d79	Earth, Latitude & Longitude	4	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
83e1db15-178c-4795-92a9-c66df269cad3	e799307c-1cfa-4cd7-b993-157804da2d79	Interior of the Earth	5	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7c0c1f6d-8551-4304-9091-74c46a656256	e799307c-1cfa-4cd7-b993-157804da2d79	Formation of the Continents & Rocks	6	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e8f59186-c82d-44b0-901a-ae1a16c74b81	e799307c-1cfa-4cd7-b993-157804da2d79	Plate Tectonics	7	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7a55b7fa-1fe2-4b03-a2fe-d48c621be526	e799307c-1cfa-4cd7-b993-157804da2d79	Geomorphic Process (Endogenetic & Exogenetic)	8	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d301adf0-8bba-4d06-b91a-40bbc98d5aaf	e799307c-1cfa-4cd7-b993-157804da2d79	Formation of Mountains, Plateaus & Plains	9	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
30b33196-b420-4c7a-997c-2448d92f6d61	e799307c-1cfa-4cd7-b993-157804da2d79	Volcanos, Earthquake & Tsunami	10	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
abf1cba1-2624-4b83-96a1-3ca18d88ed4d	e799307c-1cfa-4cd7-b993-157804da2d79	Composition & Structure of Atmosphere	11	2026-12-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e97380e4-8350-48b7-bd65-30bf9e6993d0	e799307c-1cfa-4cd7-b993-157804da2d79	Earth Temperature & Atmospheric Pressure	12	2026-12-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d5271949-5c2b-41ae-a2b0-580f23456f47	e799307c-1cfa-4cd7-b993-157804da2d79	Temperature Zones, Pressure Belts & Winds	13	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d8e533bb-2647-4e14-aa0c-76ccfd85b56b	e799307c-1cfa-4cd7-b993-157804da2d79	Climate & Weather	14	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e5be5678-38d3-495d-8c06-8bf91e17d021	e799307c-1cfa-4cd7-b993-157804da2d79	Precipitation, Cloud, Jet Stream & Cyclones	15	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5febe017-07d5-4cca-8de3-5a071adc4381	e799307c-1cfa-4cd7-b993-157804da2d79	Ocean & Ocean Relief Features	16	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f21baae0-1631-46b3-a9c1-f979e296dccb	e799307c-1cfa-4cd7-b993-157804da2d79	Ocean Water Properties, Waves, Current & Tides	17	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9787d17b-ac6b-443e-b51b-2261bc0d6b08	e799307c-1cfa-4cd7-b993-157804da2d79	Other Water Bodies & Formations	18	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3bda2cd6-6355-4699-ac4c-0b1a99892ebc	e799307c-1cfa-4cd7-b993-157804da2d79	World Facts About Continents	19	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0a55f1c8-5932-41f0-99c7-fbc649586538	e799307c-1cfa-4cd7-b993-157804da2d79	Soil, Natural Vegetation & Types	20	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2d9cc666-8d97-4b71-bac0-cec42b8d0d5b	e799307c-1cfa-4cd7-b993-157804da2d79	Physiography of India	21	2027-02-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c34e7e33-3f6d-4186-aac3-9cb51b4c97d3	e799307c-1cfa-4cd7-b993-157804da2d79	Indian Mountains	22	2027-02-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d6f65e25-041a-4cd3-947e-2a82f52b58b6	e799307c-1cfa-4cd7-b993-157804da2d79	Indian Plateau & Coastal Regions (Ghats)	23	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
27587f44-3345-45d1-8e64-e7ebf56b112a	e799307c-1cfa-4cd7-b993-157804da2d79	Plainland, Desert & Islands	24	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
016880c3-6b6d-49d2-833f-8176fdddc837	e799307c-1cfa-4cd7-b993-157804da2d79	Drainage System (Northern)	25	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f64558d9-3df6-48f9-a28a-1fcb33e1f933	e799307c-1cfa-4cd7-b993-157804da2d79	Drainage System (Peninsula)	26	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dbf58454-0abd-499a-9a1b-60bfa8defd61	e799307c-1cfa-4cd7-b993-157804da2d79	Indian Climate & Monsoon	27	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
909708b2-73c8-41c0-999a-c9129d15da8c	e799307c-1cfa-4cd7-b993-157804da2d79	Vegetation & Forest	28	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
991e6351-e419-4596-ad9b-927b8e455e48	e799307c-1cfa-4cd7-b993-157804da2d79	India Soil & Agriculture (Crops)	29	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
db36099c-3999-452e-9afa-a12860f61a37	e799307c-1cfa-4cd7-b993-157804da2d79	Minerals, Energy & Industry	30	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4c5612a2-5c2d-4561-abe8-40e42794dbb7	e799307c-1cfa-4cd7-b993-157804da2d79	Transportation	31	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c9e3849f-4af5-4bfa-8270-502fd184659d	e799307c-1cfa-4cd7-b993-157804da2d79	Practice Session	32	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
07b4df00-b92d-4667-8593-c99880a0de4e	3fc84c73-583f-41ec-861d-25eed9023d9b	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
161ab385-61bb-4268-a879-9ed7c59c3b4b	3fc84c73-583f-41ec-861d-25eed9023d9b	Basic Math – Basic Formulae, Indices	2	2026-11-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ef518cb0-d8b1-4765-9293-0bf8ef6e506d	3fc84c73-583f-41ec-861d-25eed9023d9b	Basic Math – Inequality	3	2026-11-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c4cc5a71-c934-4219-b022-206a01c35436	3fc84c73-583f-41ec-861d-25eed9023d9b	Basic Math – Modulus Basic	4	2026-11-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
48f5c7ae-7552-4c98-84f7-88ab769dbcac	3fc84c73-583f-41ec-861d-25eed9023d9b	Basic Math – Modulus Advanced	5	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
685484c5-3d86-4ce9-af6a-fd8cc2c19b2a	3fc84c73-583f-41ec-861d-25eed9023d9b	Logarithms – Logarithms Properties	6	2026-11-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a8629f0f-5d0a-404a-97c8-ff966e0e5564	3fc84c73-583f-41ec-861d-25eed9023d9b	Logarithms – Logarithms and Exponential Function	7	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
15ce257a-814a-41b7-9af0-9a794f53d649	75e8bf3e-be66-427c-95a0-8f9616f114c0	Cloze Test	21	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f4a2e267-f63b-4f57-8825-a0b9dcbec5df	3fc84c73-583f-41ec-861d-25eed9023d9b	Logarithms – PYQs and Doubts	8	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d71499b0-3814-4809-9dfb-f4fdab98130f	3fc84c73-583f-41ec-861d-25eed9023d9b	Sets – Sets and Their Representations	9	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1f215551-17b6-4600-be62-7a43f5d10718	3fc84c73-583f-41ec-861d-25eed9023d9b	Sets – Types of Set	10	2026-11-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
05d6c8b1-13c1-4d36-b415-0d38ca3c5301	3fc84c73-583f-41ec-861d-25eed9023d9b	Sets – Venn Diagram	11	2026-11-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
28e0e27c-b5e8-4089-a7b7-81879cf22a2d	3fc84c73-583f-41ec-861d-25eed9023d9b	Sets – Operation on Sets (Union, Intersection, Difference of Sets)	12	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
648a48af-72cd-49ec-846d-583ffc7aebf3	3fc84c73-583f-41ec-861d-25eed9023d9b	Sets – PYQs and Doubts	13	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e4962002-1803-44dd-bad5-53ca2a91c887	3fc84c73-583f-41ec-861d-25eed9023d9b	Quadratic Equations – Basics of Roots, Solution and Nature of Roots	14	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b1879024-5175-4957-b085-21477d4e0c5b	3fc84c73-583f-41ec-861d-25eed9023d9b	Quadratic Equations – Properties of Roots	15	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5a03d44e-b4a5-4cb5-995e-dfe8ffbf608a	3fc84c73-583f-41ec-861d-25eed9023d9b	Quadratic Equations – Graph and Location of Roots	16	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
342da4b3-a28a-4007-bf97-f39cc2858afa	3fc84c73-583f-41ec-861d-25eed9023d9b	Quadratic Equations – PYQs and Doubts	17	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e39a9316-53cf-41ec-868e-18c0eae72a67	3fc84c73-583f-41ec-861d-25eed9023d9b	Sequence and Series – Basics of Progression and Series	18	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
02e47938-895f-4058-8896-3206db15d1cf	3fc84c73-583f-41ec-861d-25eed9023d9b	Sequence and Series – Arithmetic Progression	19	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a45707f7-1369-4091-82b5-f331ae7dbe2a	3fc84c73-583f-41ec-861d-25eed9023d9b	Sequence and Series – Arithmetic and Harmonic Progression	20	2026-12-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
30dc67a9-4287-4d29-a6e6-75c1e78527d1	3fc84c73-583f-41ec-861d-25eed9023d9b	Sequence and Series – Geometric Progression	21	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
54204e57-bd71-47c8-87fe-5808e3568a96	3fc84c73-583f-41ec-861d-25eed9023d9b	Sequence and Series – Relation Between AM and GM	22	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a2b420c2-8eca-469e-bc36-f20a48d5caa1	3fc84c73-583f-41ec-861d-25eed9023d9b	Sequence and Series – PYQs and Doubts	23	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
90cbe91f-66ee-4ef7-9ee6-4e36ab45d00c	3fc84c73-583f-41ec-861d-25eed9023d9b	Relations and Functions – Cartesian Products of Sets	24	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3fa343dc-423e-4a22-96fc-de324e8891ba	3fc84c73-583f-41ec-861d-25eed9023d9b	Relations and Functions – Relations	25	2026-12-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d57ecbe3-5bb7-472f-99a2-bf54b21ec8fd	3fc84c73-583f-41ec-861d-25eed9023d9b	Relations and Functions – Functions	26	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4fd926ea-8088-4220-bb89-d4d8883874bb	3fc84c73-583f-41ec-861d-25eed9023d9b	Relations and Functions – Some Functions and Their Graphs	27	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6debfa01-70cc-4ee0-b3fb-2505f032aa08	3fc84c73-583f-41ec-861d-25eed9023d9b	Relations and Functions – Domain and Range	28	2026-12-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
859e2b3b-2ec4-4b8a-96c2-3a8a6bbc9f0a	3fc84c73-583f-41ec-861d-25eed9023d9b	Relations and Functions – PYQs and Doubts	29	2026-12-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
10efd152-fa56-491f-8115-f2e1f43ae2b2	3fc84c73-583f-41ec-861d-25eed9023d9b	Trigonometry – Introduction to Trigonometry & Identities, Quadrants and Conversion of Angle	30	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
71af0c68-0b34-43e8-8408-2fe30802628d	3fc84c73-583f-41ec-861d-25eed9023d9b	Trigonometry – Compound Angle and Transformation of Angles	31	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
8014a5f1-2df3-442c-afd6-b3ffe44c08c1	3fc84c73-583f-41ec-861d-25eed9023d9b	Trigonometry – Multiple Angle Formulas	32	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
8b1b003b-edbe-4c59-96e5-7c7a9f6c7b8b	3fc84c73-583f-41ec-861d-25eed9023d9b	Trigonometry – PYQs and Doubts	33	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
1947fc47-1c37-484c-842f-3d7bef42f7eb	3fc84c73-583f-41ec-861d-25eed9023d9b	Trigonometric Equations – General Solutions of Trigonometric Equations	34	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
20f11759-6837-4ec1-aef8-2b4350c58ad2	3fc84c73-583f-41ec-861d-25eed9023d9b	Trigonometric Equations – PYQs and Doubts	35	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
a5becb78-2e23-4be9-8926-686a4009da78	3fc84c73-583f-41ec-861d-25eed9023d9b	Applications of Trigonometry – Heights and Distances	36	2027-01-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6d971c87-51c5-4e36-b813-63637e12c9a7	3fc84c73-583f-41ec-861d-25eed9023d9b	Applications of Trigonometry – Properties of Triangle	37	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fb1e41d9-1b3a-40c8-b4b0-71854f0d95ae	3fc84c73-583f-41ec-861d-25eed9023d9b	Applications of Trigonometry – PYQs and Doubts	38	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ef94d724-adb2-4cdf-b734-c67a38406997	3fc84c73-583f-41ec-861d-25eed9023d9b	Complex Numbers – Imaginary Number, Power of Iota, Basics of Complex	39	2027-01-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
57de9e38-03a7-4a21-9ada-aa6a6e64a189	3fc84c73-583f-41ec-861d-25eed9023d9b	Complex Numbers – Conjugate and Modulus, Amplitude, Polar Form	40	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
97033d0c-bc8a-4e83-81f3-a7f15289885d	3fc84c73-583f-41ec-861d-25eed9023d9b	Complex Numbers – Eulerian Form, Square Root, Cube Root of Unity	41	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
66f5c2d9-2dbf-4cd2-9d0c-9b851e26fc3a	3fc84c73-583f-41ec-861d-25eed9023d9b	Complex Numbers – Maximum, Minimum	42	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6abe7929-ebc5-4460-ac8f-1689379f3639	3fc84c73-583f-41ec-861d-25eed9023d9b	Permutations & Combinations – Permutations	43	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
46ce43c9-6c24-44e2-a93f-27257119baf1	3fc84c73-583f-41ec-861d-25eed9023d9b	Permutations & Combinations – Combinations	44	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7fb31f4e-fb79-484e-a879-57a4d79615ff	3fc84c73-583f-41ec-861d-25eed9023d9b	Permutations & Combinations – Mixed Problems	45	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9f36a8e1-e4ae-4d5a-b5eb-26d5c43631e4	3fc84c73-583f-41ec-861d-25eed9023d9b	Permutations & Combinations – PYQs and Doubts	46	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c6b27ee3-7183-45f9-9cb2-6eac688efa95	3fc84c73-583f-41ec-861d-25eed9023d9b	Binomial Theorem – Number of Terms, General Term	47	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3fa3724f-4def-4994-915d-863ae717f5ad	3fc84c73-583f-41ec-861d-25eed9023d9b	Binomial Theorem – Coefficient of Terms, Middle Term, Greatest Term	48	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
53ab9004-9104-484b-9dfb-a5b45d137e0b	3fc84c73-583f-41ec-861d-25eed9023d9b	Binomial Theorem – NGT and Special Formula	49	2027-01-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fe07f437-15db-49ae-944d-8e233c691f37	3fc84c73-583f-41ec-861d-25eed9023d9b	Binomial Theorem – PYQs and Doubts	50	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5bdfe435-b496-4217-9c7c-ec6164fd3ae2	3fc84c73-583f-41ec-861d-25eed9023d9b	Probability – Random Experiments, Outcomes and Sample Space, Event, Occurrence of an Event	51	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8e10aa61-ea25-46a3-963e-e66ffffdca63	3fc84c73-583f-41ec-861d-25eed9023d9b	Probability – Types of Events, Algebra of Events	52	2027-02-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e6ed66b8-ab41-461a-81c2-12f0e94a07c5	3fc84c73-583f-41ec-861d-25eed9023d9b	Probability – Axiomatic Approach to Probability	53	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f36949d8-2b74-47c6-9369-817d3ea8648d	3fc84c73-583f-41ec-861d-25eed9023d9b	Probability – Probability (Advanced)	54	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e7ed72f2-9ca7-4881-8fe7-7c85fa29a131	3fc84c73-583f-41ec-861d-25eed9023d9b	Probability – Conditional Probability	55	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bfac997e-4b20-4976-89ae-57da49ddbf3c	3fc84c73-583f-41ec-861d-25eed9023d9b	Probability – Total Probability Theorem	56	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9d5a6176-097c-4cc0-8d11-ee0c4038cb23	3fc84c73-583f-41ec-861d-25eed9023d9b	Probability – Bayes’ Theorem	57	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
771b9da6-08a4-40fe-9f88-17698ee8e94a	3fc84c73-583f-41ec-861d-25eed9023d9b	Probability – Probability Distribution	58	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
799dd7f7-372e-4a6e-b2f2-1c49a28aeae9	3fc84c73-583f-41ec-861d-25eed9023d9b	Probability – PYQs and Doubts	59	2027-02-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b13b3e31-18c2-492b-b5bc-d89763839d8e	3fc84c73-583f-41ec-861d-25eed9023d9b	Co-ordinate Geometry – Cartesian Coordinate System and Section Formula	60	2027-02-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c615fde6-31d6-4cff-bc40-4b3f9d5a3674	3fc84c73-583f-41ec-861d-25eed9023d9b	Co-ordinate Geometry – Slope, Equation of Line, Angle Between Two Lines	61	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
22a99551-b468-41b9-ae40-0ce2a71d0e39	3fc84c73-583f-41ec-861d-25eed9023d9b	Co-ordinate Geometry – Various Forms of the Equation of a Line	62	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
70c9a00d-3dad-4371-b040-63613c641a05	3fc84c73-583f-41ec-861d-25eed9023d9b	Co-ordinate Geometry – Distance of a Point From a Line	63	2027-02-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8169d8a7-b60a-48e3-a52a-b5e8ffd52c09	3fc84c73-583f-41ec-861d-25eed9023d9b	Co-ordinate Geometry – Pairs of Straight Line and Miscellaneous	64	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
72933c3d-7e62-43ed-a4be-4bab33a7d1c6	3fc84c73-583f-41ec-861d-25eed9023d9b	Co-ordinate Geometry – Term Related to Triangles	65	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a24add38-fff6-491a-a0b5-44c9e370d261	3fc84c73-583f-41ec-861d-25eed9023d9b	Co-ordinate Geometry – PYQs and Doubts	66	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7ef1511d-6e36-43f1-8d1a-6f00935bb523	3fc84c73-583f-41ec-861d-25eed9023d9b	Conic Section – Basics of Circles	67	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
504f351f-f58d-454b-85e6-9a9123c55fcd	3fc84c73-583f-41ec-861d-25eed9023d9b	Conic Section – Intersections of Circle and Parametric Form of Circle	68	2027-03-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2f782528-0cca-4a18-90a1-f571bf609480	3fc84c73-583f-41ec-861d-25eed9023d9b	Conic Section – Tangent and Normal of Circles	69	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2fe0ae80-cade-4659-8748-9c1a958f8ece	3fc84c73-583f-41ec-861d-25eed9023d9b	Conic Section – Introduction to Parabola and Standard Form	70	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9b5fa5ff-ac66-4c56-8e64-5a88535cf7cd	3fc84c73-583f-41ec-861d-25eed9023d9b	Conic Section – Shifting of Parabola	71	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0a912fe1-3a49-40e4-b591-b1441a61a56c	3fc84c73-583f-41ec-861d-25eed9023d9b	Conic Section – Ellipse	72	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cdeb9211-715f-4137-b6b6-458d0edca71e	3fc84c73-583f-41ec-861d-25eed9023d9b	Conic Section – Hyperbola	73	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3e1c3875-dd68-4098-9385-42d898f149e9	3fc84c73-583f-41ec-861d-25eed9023d9b	Conic Section – PYQs and Doubts	74	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f27a683b-34a7-4fa5-9d63-f7a3867bea5a	3fc84c73-583f-41ec-861d-25eed9023d9b	Three Dimensional Geometry – Basics of Three Dimensional Geometry	75	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
71488b0b-3a2d-483a-92d0-9c9e932f8c55	3fc84c73-583f-41ec-861d-25eed9023d9b	Limits and Derivatives – Basics of Limits	76	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a7e662f6-0787-4f4d-bda1-ba0bbcc85617	3fc84c73-583f-41ec-861d-25eed9023d9b	Limits and Derivatives – Existence of Limits	77	2027-03-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4fdf197f-64b3-4ca9-892c-943f6387c6ad	3fc84c73-583f-41ec-861d-25eed9023d9b	Limits and Derivatives – Limits and Evaluation of Limits	78	2027-03-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9e03da32-e0f7-49de-b478-ef5af8f2e6fe	3fc84c73-583f-41ec-861d-25eed9023d9b	Limits and Derivatives – Derivatives	79	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f273237c-9798-4a80-82a5-8893f5d946b5	3fc84c73-583f-41ec-861d-25eed9023d9b	Limits and Derivatives – L’Hôpital Rule of Limit	80	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
67fc052d-d32d-4332-b509-2b1a5104f9fd	3fc84c73-583f-41ec-861d-25eed9023d9b	Limits and Derivatives – First Principle of Differentiation	81	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
aba4ff87-d917-4301-8a4e-436a014ad4b6	3fc84c73-583f-41ec-861d-25eed9023d9b	Limits and Derivatives – Chain Rule of Derivative	82	2027-03-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2a8c9107-9699-4d03-94b6-d38269eb5dd9	3fc84c73-583f-41ec-861d-25eed9023d9b	Limits and Derivatives – Algebra of Derivative (Product and Division Rule)	83	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
eb72b6c9-3289-463b-94d4-84bf9adb8b25	3fc84c73-583f-41ec-861d-25eed9023d9b	Limits and Derivatives – Parametric Form of Derivative	84	2027-03-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2e6113e3-a54b-423f-9548-ab188c52a896	3fc84c73-583f-41ec-861d-25eed9023d9b	Limits and Derivatives – Logarithmic & Implicit Differentiation	85	2027-04-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3de46ad1-7ea8-4473-9b56-868aca5873b3	3fc84c73-583f-41ec-861d-25eed9023d9b	Statistics	86	2027-04-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1e161a8f-35af-4471-827d-9d752a453b82	3fc84c73-583f-41ec-861d-25eed9023d9b	Binary Numbers	87	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
09727d7d-7ca7-4b22-93a2-82d43571e61d	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c313d17c-dd7c-4295-a0e7-b27864351165	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Basic Mathematics	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2713f658-d711-4f2a-8054-6e31373c3a89	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Units & Measurements (Errors + Dimensions)	3	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b6e97f31-072b-4a92-883e-44c2303e8b73	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Vector	4	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
052e2c0e-e639-465f-9bb8-e7934ea104b7	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Motion in Straight Line	5	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dd78a224-ad71-4d1c-93f1-8faceb2a8dd9	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Motion in Plane	6	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c69858f8-e4c8-48b1-a954-165a1473e6a0	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Newton’s Laws of Motion (NLM)	7	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ba9268a3-e2de-47a5-b9bb-b3eaa9f7d0d9	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Friction	8	2026-12-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
073f5382-94a4-4934-b289-acb554cd874a	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Work, Power & Energy (WPE)	9	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dc1d074d-5ed8-4b7e-a3b0-2f6091607f76	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Gravitation	10	2026-12-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d7a33577-2733-47ae-929f-37164eeb5643	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Rotation (Basics)	11	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ec9cc0da-a5db-4edb-b97c-de070e9c0438	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Mechanical Properties of Solids	12	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d9084ba7-9f9b-4626-baf2-9c8365a28c25	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Mechanical Properties of Fluids	13	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e2048aea-2ead-4743-8a21-bb6b55da7326	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Heat & Thermal Properties	14	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ddd650b1-53f0-4dd9-9a1a-eb45418f8ddf	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Thermodynamics + Kinetic Theory of Gases	15	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4a10bf91-7c6e-452c-ab68-594f83e25b80	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Statistics	86	2027-04-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
597ed4ee-2aeb-4177-84d2-c09229b69ad0	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Simple Harmonic Motion (SHM)	16	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b75f4194-5779-410a-9c45-a8a5306eaa9f	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Waves & Sound	17	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
75828555-f902-479e-b583-a0376735bd59	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Electrostatics	18	2027-02-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9905dc28-3a77-4e62-be0a-2bbe90c79658	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Current Electricity	19	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
97e87c3b-9683-4af4-8abc-987ed7b508e8	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Magnetism & Moving Charges	20	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6ee7cf2d-547e-4157-86a7-271b25ec0cad	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Electromagnetic Induction (EMI) + AC	21	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
39568a67-19b8-4826-a9a2-a1d962c12d40	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Ray Optics + Wave Optics	22	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
481262eb-2bbd-4535-ae37-a2ba8e283076	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Modern Physics	23	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a1f1d028-5517-4451-80bd-395be5d5044e	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	Semiconductor Electronics	24	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c6dc7041-5830-4506-b59e-89dd93f11c03	386d9c59-fc3d-4b92-88a5-e0a6858faf1f	PYQ + Final Revision	25	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6ff9ac5c-996c-4e6b-8319-db16b5ab0bf1	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7a2f4a14-7e85-4a4b-9e29-39b4e3e745d2	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	Physical Classification of Matter	2	2026-11-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dd684304-e2e4-4f34-8826-e86d90dfdd0a	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	Elements, Compounds and Mixtures	3	2026-11-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
11c64d1c-4479-4f1f-9edf-13bee6cdacd9	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	Structure of Atom	4	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3d9ae25e-5be2-40db-80cf-56663990d049	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	Electronic Configuration	5	2026-12-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
73843939-d3e6-4141-8bc6-8627ecf39e8c	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	Periodic Table	6	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
008ce316-24e9-485f-a0ef-c77912c4ffad	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	Chemical Bonding	7	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
27054e7c-116d-4a2b-8713-40d75321cf66	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	Acids, Bases and Salts	8	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
33ea1e97-87ca-4a66-aba1-308608362a31	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	Metals and Non-Metals	9	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
eeac69a7-406b-41dc-8a50-cd037a0d0736	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	The Iso Species and Carbon	10	2027-02-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1aa365ab-7400-4fa2-ae6a-9f4d355a2821	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	IUPAC Nomenclature and Types of Reactions	11	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d4ddc3dd-cdb3-4629-997b-ccda3cd106da	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	Important Industrial Preparations, Corrosion, Water and Types of Hardness	12	2027-03-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2c642c0f-1884-4c82-85b6-0a036a37551d	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	Mole Concept	13	2027-03-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
faecbf97-443c-4b5f-ac0b-ecb3caa6e336	aa0ae3d7-e6bd-46d0-a4f4-a72111c66c54	Chemistry in Everyday Life	14	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bdc70b0e-2345-4d78-8c3a-296659cd5e42	13c77c85-d560-4775-9b37-d97143382cbe	Cell	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b296913e-e407-4e46-bfcd-57a818432238	13c77c85-d560-4775-9b37-d97143382cbe	Animal Tissues	2	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1ade3dea-6016-45ec-bc7f-1c2e197c5002	13c77c85-d560-4775-9b37-d97143382cbe	Plant Tissues	3	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a62fdb23-1074-4be2-a833-fa406a58644e	13c77c85-d560-4775-9b37-d97143382cbe	Life Processes	4	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f8c7a0f0-b021-48e8-8365-6eeedeb6866f	13c77c85-d560-4775-9b37-d97143382cbe	Control and Coordination in Humans	5	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4dcc5289-ea4f-4b85-8789-721944f1eeaf	13c77c85-d560-4775-9b37-d97143382cbe	Control and Coordination in Plants	6	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3050bc15-d52a-42a0-9a29-e15721dfe625	13c77c85-d560-4775-9b37-d97143382cbe	Reproduction – Introduction	7	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
89938160-09fa-4207-8ad4-5b75ec72eaa2	13c77c85-d560-4775-9b37-d97143382cbe	Sexual Reproduction in Flowering Plants	8	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9da777af-31d0-4bc4-ac69-8b88b082192e	13c77c85-d560-4775-9b37-d97143382cbe	Human Reproduction	9	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ebb4a4c3-0811-4350-a04b-c332dd61ccff	13c77c85-d560-4775-9b37-d97143382cbe	Diversity in Organisms	10	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8041f2b0-df6e-4ada-a7f3-47a6c7612d35	13c77c85-d560-4775-9b37-d97143382cbe	Human Health and Diseases	11	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
56dd8098-e1eb-4ba5-95aa-a19a7da87255	13c77c85-d560-4775-9b37-d97143382cbe	Important Vitamins and Minerals	12	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
360bfc35-6a86-4ac1-9df5-0e574d947475	13c77c85-d560-4775-9b37-d97143382cbe	Genetics	13	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e7c71108-0c57-4d47-8d90-016d944fffce	75e8bf3e-be66-427c-95a0-8f9616f114c0	All About NDA Exam	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8255879a-145e-4eb0-8582-3d0113061f7a	75e8bf3e-be66-427c-95a0-8f9616f114c0	Vocabulary	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0311c70b-5607-4aa3-9da1-548ca1870e4e	75e8bf3e-be66-427c-95a0-8f9616f114c0	Noun	3	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cd51549b-1dac-4cd7-9570-ebae56588ec6	75e8bf3e-be66-427c-95a0-8f9616f114c0	Pronoun	4	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e1248a6d-6258-4295-8a99-411da045c89a	75e8bf3e-be66-427c-95a0-8f9616f114c0	Idioms and Phrases	5	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a0f8457c-728d-4048-a267-3563bd7dae92	75e8bf3e-be66-427c-95a0-8f9616f114c0	Conjunction	6	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
42d2c9ab-6d6b-4c7c-8ec7-b0edc085b1f0	75e8bf3e-be66-427c-95a0-8f9616f114c0	Adjective	7	2026-12-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7a84fb3f-61e1-485a-b09b-22a1adcf5331	75e8bf3e-be66-427c-95a0-8f9616f114c0	Adverb	8	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
63e25d68-25af-43b3-a4fe-d7478a7b7e5e	75e8bf3e-be66-427c-95a0-8f9616f114c0	Preposition	9	2026-12-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
61ae804e-e6d2-490b-8376-6fbb99837bee	75e8bf3e-be66-427c-95a0-8f9616f114c0	Fixed Preposition	10	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
78b8dd7f-07b6-4e42-8732-1eabc8b31bc2	75e8bf3e-be66-427c-95a0-8f9616f114c0	Articles	11	2027-01-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
408fd884-963e-4634-88ed-68895457c9f7	75e8bf3e-be66-427c-95a0-8f9616f114c0	Sentence Arrangement	12	2027-01-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
554e5336-2d81-4961-8230-e4247c95592c	75e8bf3e-be66-427c-95a0-8f9616f114c0	Verb	13	2027-01-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
629c48c9-2832-4fb8-b299-1ba8de2739ab	75e8bf3e-be66-427c-95a0-8f9616f114c0	Tense	14	2027-01-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
90081a3f-27a2-4fb4-9ee8-8cb73baff88d	75e8bf3e-be66-427c-95a0-8f9616f114c0	Conditional Sentences	15	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
845939b0-0b25-4dd8-a04c-0bfb174631cc	75e8bf3e-be66-427c-95a0-8f9616f114c0	Question Tag	16	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8a15f4c0-f088-4095-9e93-3741ebe1fe4a	75e8bf3e-be66-427c-95a0-8f9616f114c0	Voice	17	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
be368f01-9707-4680-aa44-4174ab081d1e	75e8bf3e-be66-427c-95a0-8f9616f114c0	Narration	18	2027-02-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c41d2607-aa64-4470-a4a7-78a39327a410	75e8bf3e-be66-427c-95a0-8f9616f114c0	Modals	19	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5961439d-71e4-443c-8c38-c9e6a8867905	75e8bf3e-be66-427c-95a0-8f9616f114c0	Previous Year Questions	22	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
73ab7e0b-1d3e-4a55-b152-7157a5895866	75e8bf3e-be66-427c-95a0-8f9616f114c0	Homophones	23	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
af45faba-94a0-4474-92d6-aa8eebce5eac	75e8bf3e-be66-427c-95a0-8f9616f114c0	Important Miscellaneous Questions	24	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d0eb2b69-732d-4c76-bcca-aa4f3db688eb	afcaa86f-6bea-4afd-ab95-05f072f8efc1	September	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
46b34de6-c5a5-40ed-8997-0065791f1c65	afcaa86f-6bea-4afd-ab95-05f072f8efc1	October	2	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
408d0156-0061-4b55-a281-a56bf0ea8b3b	afcaa86f-6bea-4afd-ab95-05f072f8efc1	November	3	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
96112dec-96a4-49e7-a72b-8d8a42f2c335	afcaa86f-6bea-4afd-ab95-05f072f8efc1	December	4	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
808d1be1-30fb-4e9b-b2e8-ec740733ce11	afcaa86f-6bea-4afd-ab95-05f072f8efc1	January	5	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0804de07-607d-4eb1-bcea-4291f8388ea7	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
216e7c10-2e72-429f-acb8-9f56de66f2c7	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Origin of Human	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5ef9626e-caab-4ed5-ba7a-cdcc205015da	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Indus Valley Civilization	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
13b563aa-1649-4c3c-a0a9-a8b0363c43db	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Vedic Civilization	4	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c9625223-56d6-427a-9d7c-09e0943a2d13	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Religious Movement	5	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
03b0ea87-1093-4398-9775-c54212ebfcee	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Mahajanapadas / Foreign Invasions	6	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
51cdf6d4-f82c-4996-a1d8-22fcc51e2f07	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Mauryan Empire	7	2026-12-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dda6a05d-8f6c-4afd-99bb-9c5269f49d3a	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Post Mauryan Age	8	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
71811ceb-40cd-4cb3-adf9-328709425ed6	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Sangam Era	9	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7fa82669-49ac-4505-8780-45671f959ecc	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Gupta Empire	10	2026-12-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
60509f39-9204-4e07-90b1-c30bfc79b933	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Post Gupta Age	11	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3c9d404b-3d93-41f3-a43e-e18ac7e3512f	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Rajput Period	12	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c5be0cd8-8f17-4396-903d-1969a9e9dc85	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Chola Empire	13	2026-12-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bb98836c-9665-431d-aafa-97ce49c3ed6a	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Delhi Sultanate	14	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6b9052f1-1166-477e-9f1b-cf5d63e7c916	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Vijaynagar Empire	15	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2c710cca-f0a2-4f6e-a2d6-0836ea85c0b8	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Bahamani Empire	16	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
704c2373-c6ea-4aa3-b594-e9f5993474f9	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Bhakti Movement	17	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8121fcbe-c7ab-4ec6-931d-aad01c6c74e2	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Sufi Movement	18	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0e78ea62-c3ac-4a48-abf9-90fa3847d167	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Rise of Mughals	19	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4b66fc13-e34d-4e06-b46c-f617b52880b2	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Expansion of Mughal Empire	20	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6ee5405c-591b-458f-92ff-b1867306d0dc	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Aurangzeb and Decline of Mughals	21	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fc01a187-3abe-4b20-8a6e-51a1fe833ae6	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Later Mughals	22	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8eecca0d-c2db-4ac9-a4e1-2adb9b0325f2	b313dcd0-fbc7-40bc-bff3-5f1be197b358	The Rise of Maratha Empire under Shivaji	23	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7f01124c-1a7f-4432-8e81-a830f8162970	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Peshwa and Third Battle of Panipat	24	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b88922d2-de02-430e-aa62-48e0fa4d331d	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Arrival of Europeans in India	25	2027-02-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
53c08246-c1cc-40f3-948f-1fb6ac449cb8	b313dcd0-fbc7-40bc-bff3-5f1be197b358	British Conquest in India	26	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7233ef3c-1dde-4120-9366-c77ccf7ae142	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Early Revolts Against British Rule	27	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
92e532ff-1a1d-41d3-874c-7db112ff7231	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Indian Renaissance	28	2027-03-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1d19d764-f2b0-4ff4-924d-e5acf713f86a	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Rise of British Rule	29	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d84a199f-b154-424d-8617-439c427a6914	b313dcd0-fbc7-40bc-bff3-5f1be197b358	British Rule	30	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b5b051e2-458d-4d07-9657-7b3e491d8d3b	b313dcd0-fbc7-40bc-bff3-5f1be197b358	The Revolt of 1857	31	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2a83165d-e964-48f6-9f66-cb66e9285707	b313dcd0-fbc7-40bc-bff3-5f1be197b358	Crown Rule	32	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d65f3379-519e-4343-84e4-1439b738a765	b313dcd0-fbc7-40bc-bff3-5f1be197b358	National Movement	33	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1c08b7e6-9bb5-41f5-83e1-dc08b9aee4a2	b313dcd0-fbc7-40bc-bff3-5f1be197b358	World History	34	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7ab62026-84b8-4ea4-a847-fed546dd50ad	5fb2334c-4151-48d5-ad85-5ec19069b359	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8d1ff958-8bca-44c6-bebf-93ba559eb05f	5fb2334c-4151-48d5-ad85-5ec19069b359	Basics of Polity	2	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
613ec31b-afc8-4bce-ad12-205535b243d3	5fb2334c-4151-48d5-ad85-5ec19069b359	Constitutional Development	3	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
da47ed1d-cb2d-47da-9cab-76c1af57020b	5fb2334c-4151-48d5-ad85-5ec19069b359	Making of Constitution	4	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6142d7ca-4881-491c-95e1-07956bc0e616	5fb2334c-4151-48d5-ad85-5ec19069b359	Features and Preamble of Constitution	5	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d1c95831-f724-46ae-91cf-b00d92fefff1	5fb2334c-4151-48d5-ad85-5ec19069b359	Union and Its Territories	6	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e272264d-0507-4a62-a0a5-43fcc35aa4ee	5fb2334c-4151-48d5-ad85-5ec19069b359	Citizenship	7	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
469f347d-4b7d-4ea3-b723-ade1ed758c9c	5fb2334c-4151-48d5-ad85-5ec19069b359	Fundamental Rights	8	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
400f9fe9-c5a2-4a24-8454-3f6b65162c36	5fb2334c-4151-48d5-ad85-5ec19069b359	Directive Principles of State Policy	9	2027-01-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
70d3e44f-de01-43c2-bed4-a1084b9fbec2	5fb2334c-4151-48d5-ad85-5ec19069b359	Fundamental Duties	10	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5063692c-9d46-448a-a26e-1e0211bdb7ed	5fb2334c-4151-48d5-ad85-5ec19069b359	Parliament	11	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ef1881b3-b3b0-46ab-9c7f-f68765650f1e	5fb2334c-4151-48d5-ad85-5ec19069b359	President	12	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
05d22604-1d45-4533-a9c1-5c53fd57d4f7	5fb2334c-4151-48d5-ad85-5ec19069b359	Vice President	13	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
aad5a891-2e87-49ce-ad8b-18a7fd0e6ab5	5fb2334c-4151-48d5-ad85-5ec19069b359	State Legislature	14	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
21f2dd67-f777-4550-822c-aaf61f0fc879	5fb2334c-4151-48d5-ad85-5ec19069b359	Governor	15	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a336b38f-6165-476c-9c65-0e99bb4eb799	5fb2334c-4151-48d5-ad85-5ec19069b359	Supreme Court	16	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
86793753-47e8-4055-b32f-03c279957535	5fb2334c-4151-48d5-ad85-5ec19069b359	High Court	17	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d761abd8-bf58-416c-ae04-ab2536b9f706	5fb2334c-4151-48d5-ad85-5ec19069b359	Emergency	18	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f3aa5049-bfe7-4a0a-a467-b8bd870e252d	5fb2334c-4151-48d5-ad85-5ec19069b359	Local Self Government	19	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a3500372-3682-4a1e-b838-d2113d6c1f67	5fb2334c-4151-48d5-ad85-5ec19069b359	Constitutional Bodies	20	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c0c70350-4896-4d4d-9070-b01a95634fb7	5fb2334c-4151-48d5-ad85-5ec19069b359	Important Amendments	21	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
80a883c0-e4a2-4f6b-ba43-8324238c60d7	5fb2334c-4151-48d5-ad85-5ec19069b359	Miscellaneous	22	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c49d5844-a4a0-49bd-9845-c982c89978fd	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Introduction to SSB Process	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4b984dd0-66b1-4015-8ecf-c19dd08ef8b1	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	OIR Lectures	2	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1c84c6e4-945e-4b7d-bb91-92f070297070	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	PPDT: Story Writing	3	2026-11-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2c902eda-69df-4832-b874-2e062bedf30d	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	PPDT: Narration & Group Discussion	4	2026-12-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
076f8204-6e51-45b3-87ba-d6683aff31a9	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Introduction to GTO & Its Importance	5	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
27119066-553b-4c11-aa64-c52dd5b53995	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Group Tasks: GD + GPE	6	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
61d99ddc-d55d-4de0-88e3-ad182e3d4257	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Group Tasks: Individual Obstacles (IO) & Group Obstacle Race (GOR)	7	2027-01-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bfea8142-47d3-4e47-b3e8-73c53f87367c	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Group Tasks: PGT/HGT/CT/FGT	8	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c0f4800b-6def-4c1a-95f8-548766e1b8b7	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Introduction to Lecturette	9	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8ad0c66f-ed4e-45aa-97d7-5fcd236f2b53	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Introduction to Psychological Tests	10	2027-02-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4612a60a-b732-478c-820e-928c349e6b97	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Thematic Apperception Test	11	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f6892c2b-e857-42a6-a2a1-222f5cbc960c	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Word Association Test	12	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e3d234fe-9376-496b-99d2-0bafe0238993	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Situation Reaction Test	13	2027-03-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d3096dfb-8a5c-4b66-ae0b-b973f38908dd	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Self Description Test	14	2027-03-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b1311b5e-78ef-4031-9563-f278b3eea5ae	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Introduction to Personal Interview & Understanding PIQ Form	15	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d2840d71-8536-47e2-bffa-1d4aeb84a05a	3a24489c-d2a3-41a0-ba6d-0ab9809a8448	Introduction to CPSS (AFSB)	16	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
648c269c-f936-4b82-8562-9dc9eb266762	7f880931-a1f3-4806-aef5-61a115897dd6	Basics of Economics	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e9a5bb5f-13ee-46bd-a5a3-1b4e1b3d656f	7f880931-a1f3-4806-aef5-61a115897dd6	Types of Economy	2	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
221850e8-4b70-417a-9858-c322b3f0de97	7f880931-a1f3-4806-aef5-61a115897dd6	Planning in India	3	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
53a1570e-50cc-484a-acc5-4a1804e62474	7f880931-a1f3-4806-aef5-61a115897dd6	Five Year Plans	4	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
57b2b03f-11f8-475f-8071-2ae3c215485d	7f880931-a1f3-4806-aef5-61a115897dd6	Money	5	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
30dbb7b0-608f-49e0-86d9-838421cab704	7f880931-a1f3-4806-aef5-61a115897dd6	Banking	6	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cd0e68ac-8f49-4f6d-9fd3-bb36a92adb01	7f880931-a1f3-4806-aef5-61a115897dd6	Current Budget	7	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d6ed815b-d753-4adc-8f01-2d656cf0cd18	7f880931-a1f3-4806-aef5-61a115897dd6	International Institutions	8	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
79805b18-cb98-469d-8243-a52b186e08b5	c986e17f-fb12-4523-8fa6-1e5f219b749a	Introduction of Geography & Syllabus	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2c816f24-6af5-4ce8-aaba-e0a22128bc31	c986e17f-fb12-4523-8fa6-1e5f219b749a	Universe and Cosmology	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ef8c0a20-2d1d-45bc-a58f-d12a16cf50f4	c986e17f-fb12-4523-8fa6-1e5f219b749a	Solar System	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cb2dc372-d767-4306-88d4-52fe8f7ffde1	c986e17f-fb12-4523-8fa6-1e5f219b749a	Earth, Latitude & Longitude	4	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b230e3ae-3982-4ea2-977b-b83b7ec903e6	c986e17f-fb12-4523-8fa6-1e5f219b749a	Interior of the Earth	5	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
60292956-424d-4a73-9cde-03e5bd41ce73	c986e17f-fb12-4523-8fa6-1e5f219b749a	Formation of the Continents & Rocks	6	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1a0d2eaa-e770-4ab8-9618-1ea286ecd838	c986e17f-fb12-4523-8fa6-1e5f219b749a	Plate Tectonics	7	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
45edb722-b042-47c4-9a9b-7b0dc221e5d3	c986e17f-fb12-4523-8fa6-1e5f219b749a	Geomorphic Process (Endogenetic & Exogenetic)	8	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
beb93224-bff4-4b2c-8a37-94e895ce7192	c986e17f-fb12-4523-8fa6-1e5f219b749a	Formation of Mountains, Plateaus & Plains	9	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
aa12dedb-98c4-4901-b2c0-bfee83316754	c986e17f-fb12-4523-8fa6-1e5f219b749a	Volcanos, Earthquake & Tsunami	10	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a5ded687-9f3f-4db2-b4f9-219250f95f92	c986e17f-fb12-4523-8fa6-1e5f219b749a	Composition & Structure of Atmosphere	11	2026-12-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e31bf0fb-78a4-407a-ace8-016688081079	c986e17f-fb12-4523-8fa6-1e5f219b749a	Earth Temperature & Atmospheric Pressure	12	2026-12-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5c25bb43-6569-4f4d-ab7e-14eaf95445bd	c986e17f-fb12-4523-8fa6-1e5f219b749a	Temperature Zones, Pressure Belts & Winds	13	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2314eda5-106a-47df-8ac5-f075c869bb81	c986e17f-fb12-4523-8fa6-1e5f219b749a	Climate & Weather	14	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
75ab15af-6ca3-453c-b93e-92f96ad190fc	c986e17f-fb12-4523-8fa6-1e5f219b749a	Precipitation, Cloud, Jet Stream & Cyclones	15	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4c365e16-1a53-4e4d-8e42-6f06d8c4635c	c986e17f-fb12-4523-8fa6-1e5f219b749a	Ocean & Ocean Relief Features	16	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4ba3cdf6-a0de-407d-9f12-2954cc03564b	c986e17f-fb12-4523-8fa6-1e5f219b749a	Ocean Water Properties, Waves, Current & Tides	17	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
28daa34e-e11e-4a96-9c44-ec195ea9aaec	c986e17f-fb12-4523-8fa6-1e5f219b749a	Other Water Bodies & Formations	18	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cac83f64-2e31-4a6d-b6ad-e8112500f6fd	c986e17f-fb12-4523-8fa6-1e5f219b749a	World Facts About Continents	19	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
eb49e56d-fbc7-49bf-bc78-2e4905435294	c986e17f-fb12-4523-8fa6-1e5f219b749a	Soil, Natural Vegetation & Types	20	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8e8e93a2-2127-41d0-a139-f315d5195be9	c986e17f-fb12-4523-8fa6-1e5f219b749a	Physiography of India	21	2027-02-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
250e5e20-02f0-45cb-9146-b9b8189bfb0a	c986e17f-fb12-4523-8fa6-1e5f219b749a	Indian Mountains	22	2027-02-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d906a5b0-1919-4a13-b201-304b6033e30a	c986e17f-fb12-4523-8fa6-1e5f219b749a	Indian Plateau & Coastal Regions (Ghats)	23	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6c1cd974-9ad4-4f96-a32d-650bbeacf88b	c986e17f-fb12-4523-8fa6-1e5f219b749a	Plainland, Desert & Islands	24	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
02c3ddf2-54a2-421d-ac53-d213b9ee20c7	c986e17f-fb12-4523-8fa6-1e5f219b749a	Drainage System (Northern)	25	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
33fe09bd-e171-4292-a860-ae1be84bff7a	c986e17f-fb12-4523-8fa6-1e5f219b749a	Drainage System (Peninsula)	26	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b600805d-77e4-45be-aafb-3e370ea61c92	c986e17f-fb12-4523-8fa6-1e5f219b749a	Indian Climate & Monsoon	27	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a0b86080-8a23-4a33-9c3c-2a05766d02f1	c986e17f-fb12-4523-8fa6-1e5f219b749a	Vegetation & Forest	28	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c3fef004-13ee-48f2-a4f2-4976b4020e12	c986e17f-fb12-4523-8fa6-1e5f219b749a	India Soil & Agriculture (Crops)	29	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1aff88bd-96d9-4e78-a7d7-4dffc7abac2f	c986e17f-fb12-4523-8fa6-1e5f219b749a	Minerals, Energy & Industry	30	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1f7faa36-4842-4f21-a51b-a520f8a96c58	c986e17f-fb12-4523-8fa6-1e5f219b749a	Transportation	31	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
293f05ab-66fb-4601-8e34-e1788aafd093	c986e17f-fb12-4523-8fa6-1e5f219b749a	Practice Session	32	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
76bf8872-f5ea-4995-9b83-8ee11bb3d838	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3c37d214-316d-4da2-ad82-8dc49df77180	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Basic Math – Basic Formulae, Indices	2	2026-11-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6012db0f-f160-4a62-868f-0e95cde7c066	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Basic Math – Inequality	3	2026-11-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8af7e4a2-433e-4dc0-b5a4-93ed413daa5a	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Basic Math – Modulus Basic	4	2026-11-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3d431087-2f98-4a66-b342-66c779ddc030	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Basic Math – Modulus Advanced	5	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2e5258e2-f7f5-4283-8318-0ac5f5826788	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Logarithms – Logarithms Properties	6	2026-11-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
40232b30-2cf1-4124-9ea6-23bb32ffa9d8	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Logarithms – Logarithms and Exponential Function	7	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4caffc27-4352-4bc6-a05a-8cdbd47b798d	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Logarithms – PYQs and Doubts	8	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
484de96b-ee47-4a48-88fd-9ee15faaef21	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Sets – Sets and Their Representations	9	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
985919a1-7d4b-4232-9657-47140e101ec4	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Sets – Types of Set	10	2026-11-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1704d88d-ee2a-48fe-b242-23678c1e2f39	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Sets – Venn Diagram	11	2026-11-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a56e5849-a57e-4ea2-ac35-537ebe3f9000	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Sets – Operation on Sets (Union, Intersection, Difference of Sets)	12	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8f7c48a5-8d2e-4949-8a31-1bd12b3df583	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Sets – PYQs and Doubts	13	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6baf2cf0-4d56-4c8d-901f-4439600ec981	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Quadratic Equations – Basics of Roots, Solution and Nature of Roots	14	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dc07b7dc-9cb7-46e8-925d-7a770408e335	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Quadratic Equations – Properties of Roots	15	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e3f476b4-f761-4f10-a865-44ffceb12c34	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Quadratic Equations – Graph and Location of Roots	16	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f5ea5d14-0f53-44af-b85f-e54083a85924	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Quadratic Equations – PYQs and Doubts	17	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
942477d4-523a-41fb-b531-40290a6857c4	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Sequence and Series – Basics of Progression and Series	18	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c02fd8fc-4ad5-42a2-89d9-7eeb20635ca3	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Sequence and Series – Arithmetic Progression	19	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c3ad5daf-6b98-43ab-a0c2-8be862f9d20c	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Sequence and Series – Arithmetic and Harmonic Progression	20	2026-12-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
00b118b6-e18f-4528-9ded-6223afb28568	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Sequence and Series – Geometric Progression	21	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
63f301b3-fdab-487b-8aee-7ce3fe80fda3	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Sequence and Series – Relation Between AM and GM	22	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4bec78ce-287c-4085-a092-4c2971509689	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Sequence and Series – PYQs and Doubts	23	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4806636d-848d-4b59-b3aa-003b798cfc7a	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Relations and Functions – Cartesian Products of Sets	24	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
82d1622f-d714-4881-9c9a-3fcc997bb5b9	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Relations and Functions – Relations	25	2026-12-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
307b4038-4c9f-4205-afaf-c7b0b40d32d5	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Relations and Functions – Functions	26	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
37c0f7b4-02f9-4307-9cc3-28f4865dde2a	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Relations and Functions – Some Functions and Their Graphs	27	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
265c3c53-3dd6-4436-b2c7-6a08f7f5309b	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Relations and Functions – Domain and Range	28	2026-12-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1ec339ad-e16c-452c-ae54-228fdb0131b5	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Relations and Functions – PYQs and Doubts	29	2026-12-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7ff2a623-6751-4444-9675-e1711f73811f	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Trigonometry – Introduction to Trigonometry & Identities, Quadrants and Conversion of Angle	30	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
c1eb0fa7-8522-4ecd-b524-917398e96451	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Trigonometry – Compound Angle and Transformation of Angles	31	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
a2a9fcf7-8ec8-4dd2-aaba-1b778c6e8e75	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Trigonometry – Multiple Angle Formulas	32	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
ba5fa0b2-a659-43ca-9e06-80564ab9e7a6	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Trigonometry – PYQs and Doubts	33	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
0cbaa022-190f-4bf2-a5ff-f8e20e1f85f1	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Trigonometric Equations – General Solutions of Trigonometric Equations	34	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
7ffb1256-a520-471e-82dd-e392b530c6ee	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Trigonometric Equations – PYQs and Doubts	35	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
03881716-e94d-42dd-b263-5bd56a2315d1	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Applications of Trigonometry – Heights and Distances	36	2027-01-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
227fe7a4-321c-4887-81d8-07cf2903791b	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Applications of Trigonometry – Properties of Triangle	37	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d2d72aa2-92d7-49e6-b0f4-d408bd94a6ee	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Applications of Trigonometry – PYQs and Doubts	38	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e9779743-c0c9-4cfa-a3d2-81ecc48ed1f8	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Complex Numbers – Imaginary Number, Power of Iota, Basics of Complex	39	2027-01-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e3270f77-8c85-4c6b-9184-6f9a02f234ec	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Noun	3	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9301ae2f-bb3f-42e7-8ae4-fad3df038801	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Complex Numbers – Conjugate and Modulus, Amplitude, Polar Form	40	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f2e6d68d-c316-48ba-8a1c-45f28a831a68	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Complex Numbers – Eulerian Form, Square Root, Cube Root of Unity	41	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f00fe70a-7a5e-4337-a26e-3fbe022781f4	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Complex Numbers – Maximum, Minimum	42	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
aea5ee33-a9ae-490f-8e5a-2ad598d6e99a	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Permutations & Combinations – Permutations	43	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ec1a4c5d-27df-485a-a832-232b42b2522b	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Permutations & Combinations – Combinations	44	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4d124e02-f678-4441-b916-72ecb73a5b90	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Permutations & Combinations – Mixed Problems	45	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5d1dca24-c3a4-4580-9fd0-fc3e9555661c	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Permutations & Combinations – PYQs and Doubts	46	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
069b12ce-48b9-4bb6-8e47-1be6cf104ae6	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Binomial Theorem – Number of Terms, General Term	47	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
93986f0e-d3fc-4827-bdab-892749ec7b64	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Binomial Theorem – Coefficient of Terms, Middle Term, Greatest Term	48	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
817bf609-faaa-4e83-8fc6-777a1177caed	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Binomial Theorem – NGT and Special Formula	49	2027-01-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
911df603-bd27-462c-8e18-a651efcd448c	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Binomial Theorem – PYQs and Doubts	50	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d9e394bb-e183-4a0c-8576-48617cca671e	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Probability – Random Experiments, Outcomes and Sample Space, Event, Occurrence of an Event	51	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f6ea38d6-a790-4577-8dd7-739a2c0a22a2	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Probability – Types of Events, Algebra of Events	52	2027-02-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a74d4c1b-6991-4c67-88ba-0aff5fc54cd9	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Probability – Axiomatic Approach to Probability	53	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5e0d98ed-f95d-4e6d-94bc-9b5e96c9963a	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Probability – Probability (Advanced)	54	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1bc4e759-d78c-428b-a088-3b0c2a54a7e0	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Probability – Conditional Probability	55	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3629f98c-9e82-4f4b-918f-b8a2992d6042	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Probability – Total Probability Theorem	56	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
38247308-2e93-4e0d-be60-bb5dd886f0c4	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Probability – Bayes’ Theorem	57	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ac20834d-de71-4a87-a6d0-b5e73f10c172	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Probability – Probability Distribution	58	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
94b219df-9c8d-4965-9354-d2dc4a5245b8	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Probability – PYQs and Doubts	59	2027-02-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c9b33da4-6b0c-4132-8ecc-72b40833844d	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Co-ordinate Geometry – Cartesian Coordinate System and Section Formula	60	2027-02-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
53eca044-c9df-4483-aba0-b16775bcf026	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Co-ordinate Geometry – Slope, Equation of Line, Angle Between Two Lines	61	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
32e9480e-6358-462c-b0e4-4e11747d135f	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Co-ordinate Geometry – Various Forms of the Equation of a Line	62	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
554650f3-451b-4088-a091-dc8c6320c5e4	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Co-ordinate Geometry – Distance of a Point From a Line	63	2027-02-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f8769d99-9f4e-490a-b19a-a72e8a65778a	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Co-ordinate Geometry – Pairs of Straight Line and Miscellaneous	64	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3b2c3b29-9843-4c6a-a2e6-2bcd5f7586b5	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Co-ordinate Geometry – Term Related to Triangles	65	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
723807e4-e7e9-4ea2-9dee-51bed2e9275a	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Co-ordinate Geometry – PYQs and Doubts	66	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b7d4b82b-4435-4e7c-a70b-1c669eb16a93	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Conic Section – Basics of Circles	67	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6b668093-035b-4d78-8b7f-074f1905f5a0	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Conic Section – Intersections of Circle and Parametric Form of Circle	68	2027-03-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b4ce2622-7806-4097-883b-b466b4e32a2e	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Conic Section – Tangent and Normal of Circles	69	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
56f32715-0056-41fd-a0d1-ee4171643a45	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Conic Section – Introduction to Parabola and Standard Form	70	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
05109819-c286-4011-b5ea-76cfb30c49dd	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Conic Section – Shifting of Parabola	71	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
de2687ea-e254-467f-a53f-08b69e822f83	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Conic Section – Ellipse	72	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
94daf963-6996-4ca7-b941-35c50eccdf2f	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Conic Section – Hyperbola	73	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8b3a26be-ca1b-4f0b-949c-e6198379a612	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Conic Section – PYQs and Doubts	74	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6df2e743-77ed-453e-bcf5-2fdc0d77fe0a	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Three Dimensional Geometry – Basics of Three Dimensional Geometry	75	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a7357a2f-cc7c-4175-b240-79ed2540d3ea	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Limits and Derivatives – Basics of Limits	76	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
49951288-3ac5-468d-a29c-61f627526e1c	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Limits and Derivatives – Existence of Limits	77	2027-03-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2512ec0f-4c30-4631-8960-46e11f6b6bb4	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Limits and Derivatives – Limits and Evaluation of Limits	78	2027-03-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8849cf2f-6f80-41fa-83c0-3019078eba29	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Limits and Derivatives – Derivatives	79	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
10840dc7-1d3c-4216-ba27-054788ce5ad5	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Limits and Derivatives – L’Hôpital Rule of Limit	80	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2ae9fd86-fb8e-497b-8bab-9af91ed59954	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Limits and Derivatives – First Principle of Differentiation	81	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4d89d75e-2165-483a-9e6b-2dd36da8cd72	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Limits and Derivatives – Chain Rule of Derivative	82	2027-03-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ee5de84d-2fa9-4860-b911-466eb93c1fa1	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Limits and Derivatives – Algebra of Derivative (Product and Division Rule)	83	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9516e128-3276-44b9-a55d-729696b67676	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Limits and Derivatives – Parametric Form of Derivative	84	2027-03-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3425e99a-02b8-4660-bf13-4a194836378a	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Limits and Derivatives – Logarithmic & Implicit Differentiation	85	2027-04-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d7678174-af89-42a4-8d60-0b564b7f8d9c	3c2c2a3f-71aa-45d1-a3b2-cee48038e416	Binary Numbers	87	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e80919f9-8496-4f50-bec7-a590b2286b85	a79d6e73-675c-4374-8007-e13d1dffa262	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
70d2826b-a83a-42d0-9b14-3a41d02f2b2c	a79d6e73-675c-4374-8007-e13d1dffa262	Basic Mathematics	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fcf88865-bd13-4338-8f40-f03fb390b7c2	a79d6e73-675c-4374-8007-e13d1dffa262	Units & Measurements (Errors + Dimensions)	3	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
926c8cd3-b794-4721-a0c6-586994bf2e47	a79d6e73-675c-4374-8007-e13d1dffa262	Vector	4	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7c22b988-1935-4967-8fe3-07c4398ccaae	a79d6e73-675c-4374-8007-e13d1dffa262	Motion in Straight Line	5	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9296df72-ffe2-4f36-8ae3-088d746c21e2	a79d6e73-675c-4374-8007-e13d1dffa262	Motion in Plane	6	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3d16264b-a28c-451b-a3a4-8e61faeec633	a79d6e73-675c-4374-8007-e13d1dffa262	Newton’s Laws of Motion (NLM)	7	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
126fef84-7564-486f-a7db-aca4af75d8f5	a79d6e73-675c-4374-8007-e13d1dffa262	Friction	8	2026-12-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
21de03f9-faf1-42f8-9621-b229103c0227	a79d6e73-675c-4374-8007-e13d1dffa262	Work, Power & Energy (WPE)	9	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bb3abef6-1b4f-4a06-b547-9b0501beb4d5	a79d6e73-675c-4374-8007-e13d1dffa262	Gravitation	10	2026-12-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1d4981e6-7567-4de5-8f63-38485faaae64	a79d6e73-675c-4374-8007-e13d1dffa262	Rotation (Basics)	11	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3b41f3d0-e885-44b8-a9fe-db78e7e3316a	a79d6e73-675c-4374-8007-e13d1dffa262	Mechanical Properties of Solids	12	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
824da9a3-8c33-4ce0-9a1a-6ece0b0c2693	a79d6e73-675c-4374-8007-e13d1dffa262	Mechanical Properties of Fluids	13	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
48ee683f-94e3-451a-bddf-10d71cd750a0	a79d6e73-675c-4374-8007-e13d1dffa262	Heat & Thermal Properties	14	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8df869f0-de7f-4887-b7e9-4eb878049760	a79d6e73-675c-4374-8007-e13d1dffa262	Thermodynamics + Kinetic Theory of Gases	15	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
66e03701-8979-4bd2-9ce4-dcc5f2da938e	a79d6e73-675c-4374-8007-e13d1dffa262	Simple Harmonic Motion (SHM)	16	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
72ad137a-b008-4f5b-8a1a-810fe93e4546	a79d6e73-675c-4374-8007-e13d1dffa262	Waves & Sound	17	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c7f468f0-81fa-4d51-ab25-347e5c406939	a79d6e73-675c-4374-8007-e13d1dffa262	Electrostatics	18	2027-02-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
86d87247-d001-494b-b34a-ca7a849d0fc7	a79d6e73-675c-4374-8007-e13d1dffa262	Current Electricity	19	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
48b1cc9d-a6e8-4b28-870a-ce34226b2a8a	a79d6e73-675c-4374-8007-e13d1dffa262	Magnetism & Moving Charges	20	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
43144d0b-9fd8-4dab-8787-430337e58444	a79d6e73-675c-4374-8007-e13d1dffa262	Electromagnetic Induction (EMI) + AC	21	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0430193f-f8ff-42f9-95fc-c156d3f4a707	a79d6e73-675c-4374-8007-e13d1dffa262	Ray Optics + Wave Optics	22	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
94076c02-561c-417b-a9b5-897c457aca88	a79d6e73-675c-4374-8007-e13d1dffa262	Modern Physics	23	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0d5a1005-c210-45f4-a068-fe1369e61989	a79d6e73-675c-4374-8007-e13d1dffa262	Semiconductor Electronics	24	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
13363aba-6309-4f6c-866e-68c80cb7d20c	a79d6e73-675c-4374-8007-e13d1dffa262	PYQ + Final Revision	25	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
71e564bf-7cd9-462e-993c-e48f79967269	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e454fb2c-2c4b-4b22-b60b-47af1b9c3f8f	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	Physical Classification of Matter	2	2026-11-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
358f2120-ca84-450e-88d1-144fd502daa8	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	Elements, Compounds and Mixtures	3	2026-11-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
97771e2a-999e-4b75-8e53-1657a36473b6	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	Structure of Atom	4	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6af0440d-526f-4efa-aadb-836124e52617	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	Electronic Configuration	5	2026-12-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0d6ed7ce-3e4f-41cb-95ee-716c9688ca9a	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	Periodic Table	6	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
73a862a2-e050-465f-bf53-6832ab80ee26	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	Chemical Bonding	7	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
087218ed-6e39-47e8-b5e8-1f08d0561885	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	Acids, Bases and Salts	8	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7ff4f416-647d-4372-8f61-aa6213730687	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	Metals and Non-Metals	9	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2eb23431-2380-4956-ae66-93e23866eeee	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	The Iso Species and Carbon	10	2027-02-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3388aafe-c98e-43f7-bf62-70d23521616d	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	IUPAC Nomenclature and Types of Reactions	11	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
90e0adbc-02fe-49c3-a69b-e687fedea266	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	Important Industrial Preparations, Corrosion, Water and Types of Hardness	12	2027-03-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
38ebdf40-db05-4889-bb7d-7c1927efe94f	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	Mole Concept	13	2027-03-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e99f4a92-33ed-4fe7-8c21-c9a8c19f7784	9f07eaef-2752-4e0e-bcc4-126e2f52c2cc	Chemistry in Everyday Life	14	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8f045f42-2984-41e6-afa5-2440b1baa6a8	83d5ed5e-7251-4f4b-8309-039871e01d9f	Cell	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1501c1c5-1f59-4374-89ce-189b28a1a348	83d5ed5e-7251-4f4b-8309-039871e01d9f	Animal Tissues	2	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b55a2e1c-0dd0-46d2-8c18-aa8409c3cc98	83d5ed5e-7251-4f4b-8309-039871e01d9f	Plant Tissues	3	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
72b40bcd-7cfd-491b-9adf-c5ba974b4791	83d5ed5e-7251-4f4b-8309-039871e01d9f	Life Processes	4	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
60af5ec0-60ba-438e-9c46-0a78bdb9ca20	83d5ed5e-7251-4f4b-8309-039871e01d9f	Control and Coordination in Humans	5	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fe31fd9b-0eab-42c7-8df2-f5fa65c0b8c0	83d5ed5e-7251-4f4b-8309-039871e01d9f	Control and Coordination in Plants	6	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1406339c-96f3-4519-8ecc-0bb4be0452e0	83d5ed5e-7251-4f4b-8309-039871e01d9f	Reproduction – Introduction	7	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a83cc6f0-2bb8-460c-83bd-1db93311ef1e	83d5ed5e-7251-4f4b-8309-039871e01d9f	Sexual Reproduction in Flowering Plants	8	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bf47fe6b-d671-48dc-8d8a-dee080585782	83d5ed5e-7251-4f4b-8309-039871e01d9f	Human Reproduction	9	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
835da23f-d384-4db3-9d09-d9ee06e46a7d	83d5ed5e-7251-4f4b-8309-039871e01d9f	Diversity in Organisms	10	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b8e1e1d5-f857-4994-b52b-0c68fb89304d	83d5ed5e-7251-4f4b-8309-039871e01d9f	Human Health and Diseases	11	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
01925d98-8068-415d-a8b4-e0b4de58a80e	83d5ed5e-7251-4f4b-8309-039871e01d9f	Important Vitamins and Minerals	12	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e49d1f83-dbd2-4569-9cdd-75f541e6b8c5	83d5ed5e-7251-4f4b-8309-039871e01d9f	Genetics	13	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0bcc03e6-4b65-4bce-ab0a-3e3fc38ea3f6	73ecb8d5-fa4b-4e70-955e-5e49e559133f	All About NDA Exam	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
69c204e9-661e-4899-a1af-cc0fd2d0ff95	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Vocabulary	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a99796b9-cb15-4657-b7c6-3424830723b4	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Pronoun	4	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
81375f8c-3a44-453a-a9c4-5aafe4e93ca8	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Idioms and Phrases	5	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d1a35672-475a-4445-9246-91bccb4aa502	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Conjunction	6	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1542ec2b-84fa-45c1-bf4e-c0272171eb02	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Adjective	7	2026-12-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ac8ece04-de46-4e85-a86d-2df790592fc6	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Adverb	8	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b3e94ce3-9a19-42e4-bfea-a3fbe2229b68	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Preposition	9	2026-12-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
81411360-cadf-42da-9329-0f938e788444	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Fixed Preposition	10	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0d390eb3-92ca-4ac3-bdd6-8633b6c1ad00	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Articles	11	2027-01-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
68f73939-9cc2-404c-86f2-83b2ba91b34d	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Sentence Arrangement	12	2027-01-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e3968067-fe13-4758-9b07-0bd4793b43c5	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Verb	13	2027-01-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9d4b206a-0331-4d44-86d3-341505cfafed	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Tense	14	2027-01-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
936bf928-f249-4c6d-a8c9-46ad17f0a533	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Conditional Sentences	15	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3f374bf9-9900-4659-9f2c-ec141008df21	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Question Tag	16	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
536a6494-051c-46fd-8e05-fed94b409969	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Voice	17	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6cb245f0-05dc-487a-9757-6981111c2086	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Narration	18	2027-02-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bdfb62b4-74f8-4316-a6ec-0dfcac0de5bd	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Modals	19	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e2f7cc00-b193-44d6-b8a8-dfd3e7f4382e	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Passage	20	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6dfeac18-5e42-4ff6-9477-b56678c79c6d	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Cloze Test	21	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5b780bfc-7457-4e4c-95c4-b8789f477b95	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Previous Year Questions	22	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c77875b7-2d82-43f8-98a6-2b2148d74bcc	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Homophones	23	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d54132a4-b764-41ce-ba67-fe95b9c9dc36	73ecb8d5-fa4b-4e70-955e-5e49e559133f	Important Miscellaneous Questions	24	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f6616d53-735b-42f2-979a-d575bf0f34fc	e8349e7a-e816-4144-a611-d7332bd9a0b8	September	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0fa87eb2-529c-44a3-aa86-afe3bb680cd0	e8349e7a-e816-4144-a611-d7332bd9a0b8	October	2	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e600afd6-4b43-4eba-a024-7b8366fd42e6	e8349e7a-e816-4144-a611-d7332bd9a0b8	November	3	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1efc397e-4912-4fb4-9406-8739f3131862	e8349e7a-e816-4144-a611-d7332bd9a0b8	December	4	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d67175a0-cd9c-44dc-911c-3e6f9b84cbf0	e8349e7a-e816-4144-a611-d7332bd9a0b8	January	5	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b2472d16-edd9-46c3-81d8-b2ef940d3e90	2db504df-e864-45f7-b386-e17d20a724ca	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a40ee594-1b4e-4e78-8ddc-c23d3b77a514	2db504df-e864-45f7-b386-e17d20a724ca	Origin of Human	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c0582e95-9877-4cf9-ace4-7269522f28fc	2db504df-e864-45f7-b386-e17d20a724ca	Indus Valley Civilization	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f4062319-1b4b-4d59-8e1f-66cf40f12dfd	2db504df-e864-45f7-b386-e17d20a724ca	Vedic Civilization	4	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
89f420ab-6353-4212-8875-88dcdb200269	2db504df-e864-45f7-b386-e17d20a724ca	Religious Movement	5	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cc65ff26-1052-453c-91a3-240617081974	2db504df-e864-45f7-b386-e17d20a724ca	Mahajanapadas / Foreign Invasions	6	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ed87637d-d1a6-40ab-a2bb-efb60b2ec4de	2db504df-e864-45f7-b386-e17d20a724ca	Mauryan Empire	7	2026-12-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
effa2379-4cf5-48a1-a209-57b47aba21cd	2db504df-e864-45f7-b386-e17d20a724ca	Post Mauryan Age	8	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f93c8f68-b4b1-42e6-9dba-395c2dc74d70	2db504df-e864-45f7-b386-e17d20a724ca	Sangam Era	9	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3d2ebdec-5da1-4053-a4a9-30cfde55c2be	2db504df-e864-45f7-b386-e17d20a724ca	Gupta Empire	10	2026-12-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
14d41a17-41f5-40dd-ab9a-bb5e037576d0	2db504df-e864-45f7-b386-e17d20a724ca	Post Gupta Age	11	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9be58957-f037-478c-bfd7-0768ecc4a145	2db504df-e864-45f7-b386-e17d20a724ca	Rajput Period	12	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
119b93e8-d733-4780-afc0-04e469fa2865	2db504df-e864-45f7-b386-e17d20a724ca	Chola Empire	13	2026-12-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e3bbf41f-2a02-48c7-b0e0-14b927a91149	2db504df-e864-45f7-b386-e17d20a724ca	Delhi Sultanate	14	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e92ab0db-fbe0-4bf3-8851-ad36b921f290	2db504df-e864-45f7-b386-e17d20a724ca	Vijaynagar Empire	15	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e24744d7-3c0c-434b-b5e8-1ba0e1c38d30	2db504df-e864-45f7-b386-e17d20a724ca	Bahamani Empire	16	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
992e4483-eab4-40fb-93da-b51d94350dc7	2db504df-e864-45f7-b386-e17d20a724ca	Bhakti Movement	17	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3def9420-39b7-4fca-a70f-bf4f8e19c321	2db504df-e864-45f7-b386-e17d20a724ca	Sufi Movement	18	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1cd16071-bbf7-4025-bc98-cacea85d241b	2db504df-e864-45f7-b386-e17d20a724ca	Rise of Mughals	19	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6154bab2-8399-4e3b-9d4f-982582035bb3	2db504df-e864-45f7-b386-e17d20a724ca	Expansion of Mughal Empire	20	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9d4bd760-f49d-4f1d-be1e-e1725b5fbc5c	2db504df-e864-45f7-b386-e17d20a724ca	Aurangzeb and Decline of Mughals	21	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1f11b462-28b0-4c30-8d46-dfa42d6bb631	2db504df-e864-45f7-b386-e17d20a724ca	Later Mughals	22	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c003b96c-3144-4e00-ae5c-aad03203a06c	2db504df-e864-45f7-b386-e17d20a724ca	The Rise of Maratha Empire under Shivaji	23	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2d0f0bbd-334f-4c93-9d81-56d125674c83	2db504df-e864-45f7-b386-e17d20a724ca	Peshwa and Third Battle of Panipat	24	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
61db2815-62c9-4d60-81a2-112b189af2b6	2db504df-e864-45f7-b386-e17d20a724ca	Arrival of Europeans in India	25	2027-02-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4c0ac130-6f93-4c11-a532-a11656edfa9a	2db504df-e864-45f7-b386-e17d20a724ca	British Conquest in India	26	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
abea32b5-e2a2-4c6b-a0c0-4af5693958a8	2db504df-e864-45f7-b386-e17d20a724ca	Early Revolts Against British Rule	27	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
912dbdfd-44e6-481c-8ffe-d50399a1adc6	2db504df-e864-45f7-b386-e17d20a724ca	Indian Renaissance	28	2027-03-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7b3b4d0e-a7cc-4e37-9fe1-6f7428779609	2db504df-e864-45f7-b386-e17d20a724ca	Rise of British Rule	29	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
80337a67-8e05-4721-b955-d3a642bd855a	2db504df-e864-45f7-b386-e17d20a724ca	British Rule	30	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9d83d240-6039-4b3e-b3d2-bbb54d0fb90d	2db504df-e864-45f7-b386-e17d20a724ca	The Revolt of 1857	31	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fb0c46ee-4847-41c8-8a98-72b59148733d	2db504df-e864-45f7-b386-e17d20a724ca	Crown Rule	32	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f94dc905-f565-4d8e-bcdd-70829136d099	2db504df-e864-45f7-b386-e17d20a724ca	National Movement	33	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
17c247e3-c251-448f-9a33-a64607ea1559	2db504df-e864-45f7-b386-e17d20a724ca	World History	34	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
73b448ac-a20b-4ecf-b1f9-e21132e4b96b	c42d9384-2910-422f-9908-f80e448b0e0d	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
de989164-07f7-4134-8446-fc6d42e6b709	c42d9384-2910-422f-9908-f80e448b0e0d	Basics of Polity	2	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8d4cb52c-c303-430d-8141-eea03332ee4b	c42d9384-2910-422f-9908-f80e448b0e0d	Constitutional Development	3	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dd58eb09-e337-4802-8891-860f4e2bf706	c42d9384-2910-422f-9908-f80e448b0e0d	Making of Constitution	4	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
427429b4-2828-40ed-9452-f60a1696c80c	c42d9384-2910-422f-9908-f80e448b0e0d	Features and Preamble of Constitution	5	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
77b7c9b4-5fd1-44d1-a1fb-259aaa5635e1	c42d9384-2910-422f-9908-f80e448b0e0d	Union and Its Territories	6	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c3d5957d-4496-4721-b1a8-3391c4bb81c5	c42d9384-2910-422f-9908-f80e448b0e0d	Citizenship	7	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
22a330ef-30fa-4387-9003-da7ce7a6c17c	c42d9384-2910-422f-9908-f80e448b0e0d	Fundamental Rights	8	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fc03c2b8-5485-47bb-8365-772a11f96e49	c42d9384-2910-422f-9908-f80e448b0e0d	Directive Principles of State Policy	9	2027-01-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d507f036-0730-447e-af4d-aad285be5b6f	c42d9384-2910-422f-9908-f80e448b0e0d	Fundamental Duties	10	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9b683713-e5bf-48e8-b2ca-328038af9b20	c42d9384-2910-422f-9908-f80e448b0e0d	Parliament	11	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9bf5f170-3942-4148-8742-517583c85550	c42d9384-2910-422f-9908-f80e448b0e0d	President	12	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
53586f92-8d01-4aaf-ab27-0d6065552c16	c42d9384-2910-422f-9908-f80e448b0e0d	Vice President	13	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0f9b4cb5-0fb0-42c2-bfe2-735bef40fa8c	c42d9384-2910-422f-9908-f80e448b0e0d	State Legislature	14	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d9250bae-9e7f-4811-886a-45a712f6ab98	c42d9384-2910-422f-9908-f80e448b0e0d	Governor	15	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c84a846a-b653-4057-a7cf-9b36dff61645	c42d9384-2910-422f-9908-f80e448b0e0d	Supreme Court	16	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2f7697b0-67d0-474d-a0ca-c940b63b82e2	c42d9384-2910-422f-9908-f80e448b0e0d	High Court	17	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
85e38bc4-dd47-427f-8a63-f5db904b783d	c42d9384-2910-422f-9908-f80e448b0e0d	Emergency	18	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0fafe524-6a71-463a-ae7a-2b422a884048	c42d9384-2910-422f-9908-f80e448b0e0d	Local Self Government	19	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
df9d026d-3f0e-4692-8a0c-99e0ffe088ff	c42d9384-2910-422f-9908-f80e448b0e0d	Constitutional Bodies	20	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f200dd01-db3d-4a62-b13e-9d12fda507e5	c42d9384-2910-422f-9908-f80e448b0e0d	Important Amendments	21	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b5ee32c9-35a3-457b-8fec-e9bf011e1d84	c42d9384-2910-422f-9908-f80e448b0e0d	Miscellaneous	22	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
eb1ece34-8445-451a-98c5-a38ab692a1fd	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Introduction to SSB Process	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
54df579a-deb8-4e55-b1d3-90745e32ec8a	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	OIR Lectures	2	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c1a3c909-2bef-4476-a965-2fcb2e711329	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	PPDT: Story Writing	3	2026-11-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6546a942-19fd-4c0d-932f-d766312166a9	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	PPDT: Narration & Group Discussion	4	2026-12-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5b1ab1b9-414d-40db-8e04-18ccc8bb0de8	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Introduction to GTO & Its Importance	5	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
aeac2ffa-4b2d-4a9c-8c29-bf316ef38eee	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Group Tasks: GD + GPE	6	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7e394932-e1a9-4118-88c0-f2a269041ea7	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Group Tasks: Individual Obstacles (IO) & Group Obstacle Race (GOR)	7	2027-01-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b2a91c72-40eb-413b-9c50-8eb1e8178c17	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Group Tasks: PGT/HGT/CT/FGT	8	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
162578ab-9523-4e77-a485-af5dca3ec55f	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Introduction to Lecturette	9	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
de6fda04-ea8f-415f-b446-986b5ded021d	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Introduction to Psychological Tests	10	2027-02-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1665f6f9-5df2-4fcf-9d67-c0fe3efe6e2f	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Thematic Apperception Test	11	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
81ac74be-989c-4b2d-86ee-117b365bba73	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Word Association Test	12	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a5d53e63-af40-4620-86ea-eb8e8c4ff00d	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Situation Reaction Test	13	2027-03-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b87d3d36-a36d-4ac9-88e2-cc577364c6c0	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Self Description Test	14	2027-03-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4d24115f-2a6b-4910-9ca5-1888d3032a4a	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Introduction to Personal Interview & Understanding PIQ Form	15	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c3b899a0-a36c-45a2-a738-9da40c422c97	c6f91768-6b5e-4b3a-b73f-35ad89b105f5	Introduction to CPSS (AFSB)	16	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ed8807b4-003d-46d0-be2e-539c913a5fcf	fdca98d5-8ae8-4242-9227-f2a8727f609d	Basics of Economics	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9aec8676-3747-4871-b6c4-e2b0de2b142a	fdca98d5-8ae8-4242-9227-f2a8727f609d	Types of Economy	2	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4be2be64-80dd-4e8d-9e54-613e18347bd0	fdca98d5-8ae8-4242-9227-f2a8727f609d	Planning in India	3	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5d6466f9-8c46-4262-96f7-eb468ac9a4c6	fdca98d5-8ae8-4242-9227-f2a8727f609d	Five Year Plans	4	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e25b36be-c29e-44f3-bc72-ab5ad05eb878	fdca98d5-8ae8-4242-9227-f2a8727f609d	Money	5	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
32538b60-2d5b-4025-ab2b-ff49072a195c	fdca98d5-8ae8-4242-9227-f2a8727f609d	Banking	6	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f0c18db9-5ed1-46f0-928e-34e0c0e14321	fdca98d5-8ae8-4242-9227-f2a8727f609d	Current Budget	7	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ecb6516b-4380-43a0-8d0d-bd771fd1f6e6	fdca98d5-8ae8-4242-9227-f2a8727f609d	International Institutions	8	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
64e0a7b6-7006-4a07-a120-cd0035278cad	20ad20fd-416b-47c8-9679-dc0a54500312	Introduction of Geography & Syllabus	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f3bed7f6-ec58-43d1-b3ce-eca5e7755fa6	20ad20fd-416b-47c8-9679-dc0a54500312	Universe and Cosmology	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
831633ff-c771-4333-bb9b-91cd53e91ad5	20ad20fd-416b-47c8-9679-dc0a54500312	Solar System	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1ec86bdb-9f20-4a4f-89b7-ddb5f48a1487	20ad20fd-416b-47c8-9679-dc0a54500312	Earth, Latitude & Longitude	4	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
257ef922-4f8b-4ca6-991d-5bcddf98b05f	20ad20fd-416b-47c8-9679-dc0a54500312	Interior of the Earth	5	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e3e833ef-335e-4716-9354-3727dfa889b4	20ad20fd-416b-47c8-9679-dc0a54500312	Formation of the Continents & Rocks	6	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c57a5d6d-6fbe-4a6f-bb50-ebf496ca1f79	20ad20fd-416b-47c8-9679-dc0a54500312	Plate Tectonics	7	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
afa49116-0514-4420-b09f-ea74c7beab36	ee3d6099-911f-4697-a1c2-a2b18fe2dbe5	September	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3e77aeb0-07a7-4f3f-b401-4bef0bc9ce8a	20ad20fd-416b-47c8-9679-dc0a54500312	Geomorphic Process (Endogenetic & Exogenetic)	8	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
12eed66f-2835-4c62-aee4-5051926a42a4	20ad20fd-416b-47c8-9679-dc0a54500312	Formation of Mountains, Plateaus & Plains	9	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dc132f6f-43a8-4c92-9b16-a7758f342ba7	20ad20fd-416b-47c8-9679-dc0a54500312	Volcanos, Earthquake & Tsunami	10	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f59c791f-710c-4f58-b4d3-cc4edfc93518	20ad20fd-416b-47c8-9679-dc0a54500312	Composition & Structure of Atmosphere	11	2026-12-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ca4a64cb-afef-4b62-a413-30d461835229	20ad20fd-416b-47c8-9679-dc0a54500312	Earth Temperature & Atmospheric Pressure	12	2026-12-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e8844328-ef20-48ba-84df-722e489483e7	20ad20fd-416b-47c8-9679-dc0a54500312	Temperature Zones, Pressure Belts & Winds	13	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c0821385-dcb4-4b00-87d2-b699d02e4a91	20ad20fd-416b-47c8-9679-dc0a54500312	Climate & Weather	14	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1472cfa0-09eb-4cfb-979c-84ed59590913	20ad20fd-416b-47c8-9679-dc0a54500312	Precipitation, Cloud, Jet Stream & Cyclones	15	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d7575b49-59cf-4d7c-a7c0-4185149f2a04	20ad20fd-416b-47c8-9679-dc0a54500312	Ocean & Ocean Relief Features	16	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bdfa203a-e0e5-4083-8491-91a47522e546	20ad20fd-416b-47c8-9679-dc0a54500312	Ocean Water Properties, Waves, Current & Tides	17	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1b962a2a-8ea4-4320-a152-ca6111a439b5	20ad20fd-416b-47c8-9679-dc0a54500312	Other Water Bodies & Formations	18	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7ee0ae9b-567d-4b7f-98f3-a4078c0b5cf0	20ad20fd-416b-47c8-9679-dc0a54500312	World Facts About Continents	19	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5f771f41-2427-4c0a-9618-213a7d5d3e2b	20ad20fd-416b-47c8-9679-dc0a54500312	Soil, Natural Vegetation & Types	20	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
44016a3e-e9aa-4638-9e31-caf6e8204694	20ad20fd-416b-47c8-9679-dc0a54500312	Physiography of India	21	2027-02-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e39c8cd7-143b-41f1-8ac3-6d0ed3a84d2b	20ad20fd-416b-47c8-9679-dc0a54500312	Indian Mountains	22	2027-02-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
da58ab62-7227-4ac3-b62e-f80740e04d00	20ad20fd-416b-47c8-9679-dc0a54500312	Indian Plateau & Coastal Regions (Ghats)	23	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
989132cf-2787-4836-b513-dd9fd0218a5f	20ad20fd-416b-47c8-9679-dc0a54500312	Plainland, Desert & Islands	24	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d44cc2db-1353-403b-bed6-69fedf1648d8	20ad20fd-416b-47c8-9679-dc0a54500312	Drainage System (Northern)	25	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3c49a22e-cec4-4ea9-8051-c66893f40256	20ad20fd-416b-47c8-9679-dc0a54500312	Drainage System (Peninsula)	26	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
95dd5e4b-63d3-4f56-9c2f-96556a81d4d6	20ad20fd-416b-47c8-9679-dc0a54500312	Indian Climate & Monsoon	27	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e1ee21fd-b5f3-4a2b-aa76-9fe9ebb77cc9	20ad20fd-416b-47c8-9679-dc0a54500312	Vegetation & Forest	28	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c680d04f-b9d2-43c8-812d-f37931431fd6	20ad20fd-416b-47c8-9679-dc0a54500312	India Soil & Agriculture (Crops)	29	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3d696da0-9947-4c3e-a8de-bb179abf02e1	20ad20fd-416b-47c8-9679-dc0a54500312	Minerals, Energy & Industry	30	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c1db67c1-fedc-4968-8ec8-f4ae7f534402	20ad20fd-416b-47c8-9679-dc0a54500312	Transportation	31	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c56fb143-333b-45d6-bb0c-8c18f6c9f24e	20ad20fd-416b-47c8-9679-dc0a54500312	Practice Session	32	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
344f59ef-d2fa-4f60-8176-9590ccbca9fc	94d3a789-d680-498d-aef5-05fb1af4d9ce	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9846fa85-9493-43bb-9a17-1fb47ab697b9	94d3a789-d680-498d-aef5-05fb1af4d9ce	Basic Math – Basic Formulae, Indices	2	2026-11-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cc949996-f522-49eb-8df2-d6c02aa747a5	94d3a789-d680-498d-aef5-05fb1af4d9ce	Basic Math – Inequality	3	2026-11-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2802f58e-f191-422a-82df-f946cb75b1e0	94d3a789-d680-498d-aef5-05fb1af4d9ce	Basic Math – Modulus Basic	4	2026-11-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
408052e0-cf3c-4eb5-ba28-0358c73b2fad	94d3a789-d680-498d-aef5-05fb1af4d9ce	Basic Math – Modulus Advanced	5	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
eb582f83-f64f-4c28-8df6-a51174f1845e	94d3a789-d680-498d-aef5-05fb1af4d9ce	Logarithms – Logarithms Properties	6	2026-11-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
596a6cd5-f8e8-40ad-9f90-2f594292f00f	94d3a789-d680-498d-aef5-05fb1af4d9ce	Logarithms – Logarithms and Exponential Function	7	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c68bdecf-2a44-4d50-ad82-4148e3000edb	94d3a789-d680-498d-aef5-05fb1af4d9ce	Logarithms – PYQs and Doubts	8	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f3bdd6e8-4a60-487a-a0c9-d98490386a1a	94d3a789-d680-498d-aef5-05fb1af4d9ce	Sets – Sets and Their Representations	9	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
201d1b4f-a7af-4a89-bf99-802aadb20839	94d3a789-d680-498d-aef5-05fb1af4d9ce	Sets – Types of Set	10	2026-11-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
355e3180-96bd-4711-b9db-e5e23cfc14ea	94d3a789-d680-498d-aef5-05fb1af4d9ce	Sets – Venn Diagram	11	2026-11-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3afad784-3783-40b4-934f-35318c226d8b	94d3a789-d680-498d-aef5-05fb1af4d9ce	Sets – Operation on Sets (Union, Intersection, Difference of Sets)	12	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6b125b16-a014-4660-8276-e35dc860df41	94d3a789-d680-498d-aef5-05fb1af4d9ce	Sets – PYQs and Doubts	13	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
51d092a5-4073-4106-9854-b70b798cf7b1	94d3a789-d680-498d-aef5-05fb1af4d9ce	Quadratic Equations – Basics of Roots, Solution and Nature of Roots	14	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
eceb0152-c8df-4508-914c-856f2527fa4b	94d3a789-d680-498d-aef5-05fb1af4d9ce	Quadratic Equations – Properties of Roots	15	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
32fd2345-94ce-4296-b6c7-47abb8e07cdc	94d3a789-d680-498d-aef5-05fb1af4d9ce	Quadratic Equations – Graph and Location of Roots	16	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e99b674a-3583-4d22-9618-f6637ff01b79	94d3a789-d680-498d-aef5-05fb1af4d9ce	Quadratic Equations – PYQs and Doubts	17	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
88ab6599-f202-4570-9529-dcb85d54f1e0	94d3a789-d680-498d-aef5-05fb1af4d9ce	Sequence and Series – Basics of Progression and Series	18	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e02b5fdd-62d6-4d8f-afe3-342674293846	94d3a789-d680-498d-aef5-05fb1af4d9ce	Sequence and Series – Arithmetic Progression	19	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fe9994b1-26c4-4fb2-974b-2b28102c0b83	94d3a789-d680-498d-aef5-05fb1af4d9ce	Sequence and Series – Arithmetic and Harmonic Progression	20	2026-12-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
944c2c9c-b66c-4e7d-bf21-3410ece0fefd	94d3a789-d680-498d-aef5-05fb1af4d9ce	Sequence and Series – Geometric Progression	21	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7daf14df-0559-41a9-8cf5-78fa01da4833	94d3a789-d680-498d-aef5-05fb1af4d9ce	Sequence and Series – Relation Between AM and GM	22	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d8a1257a-14bb-4872-b73b-67c0147683a8	94d3a789-d680-498d-aef5-05fb1af4d9ce	Sequence and Series – PYQs and Doubts	23	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
94633ba9-1225-4336-920f-228474fd5996	94d3a789-d680-498d-aef5-05fb1af4d9ce	Relations and Functions – Cartesian Products of Sets	24	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
99eff0eb-cbb7-46bf-96b7-ab34c87778b4	94d3a789-d680-498d-aef5-05fb1af4d9ce	Relations and Functions – Relations	25	2026-12-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
64b94618-32c5-478c-9a59-7a67211534c9	94d3a789-d680-498d-aef5-05fb1af4d9ce	Relations and Functions – Functions	26	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
39712d28-c07f-4c2c-8fca-9f057a43c504	94d3a789-d680-498d-aef5-05fb1af4d9ce	Relations and Functions – Some Functions and Their Graphs	27	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3f8df5b9-6745-466a-86a4-adacd94ea28d	94d3a789-d680-498d-aef5-05fb1af4d9ce	Relations and Functions – Domain and Range	28	2026-12-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a1a95b25-0984-4886-beca-60540188d66c	94d3a789-d680-498d-aef5-05fb1af4d9ce	Relations and Functions – PYQs and Doubts	29	2026-12-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4bb0d504-4bdc-41ab-8a8e-5335dc661165	94d3a789-d680-498d-aef5-05fb1af4d9ce	Trigonometry – Introduction to Trigonometry & Identities, Quadrants and Conversion of Angle	30	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
3a158cac-18ce-4162-bd6b-1858df4e330c	94d3a789-d680-498d-aef5-05fb1af4d9ce	Trigonometry – Compound Angle and Transformation of Angles	31	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
ec74c966-7390-4638-a643-0c5f8b8f93c5	94d3a789-d680-498d-aef5-05fb1af4d9ce	Trigonometry – Multiple Angle Formulas	32	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
9c1e6188-49b3-4b04-be20-f381830dbd22	94d3a789-d680-498d-aef5-05fb1af4d9ce	Trigonometry – PYQs and Doubts	33	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
2c5cb348-e8ec-40e3-a96d-2d3984e425f1	94d3a789-d680-498d-aef5-05fb1af4d9ce	Trigonometric Equations – General Solutions of Trigonometric Equations	34	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
874cd62e-cb03-48d9-87f6-d3882fc8faaa	94d3a789-d680-498d-aef5-05fb1af4d9ce	Trigonometric Equations – PYQs and Doubts	35	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
9a9989f8-fdb7-4be0-8268-9e9bca29dfa6	94d3a789-d680-498d-aef5-05fb1af4d9ce	Applications of Trigonometry – Heights and Distances	36	2027-01-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
91425174-1886-4764-b311-7f3490fc458f	94d3a789-d680-498d-aef5-05fb1af4d9ce	Applications of Trigonometry – Properties of Triangle	37	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ed232f95-77bd-4349-b3f2-09f92ecfa97d	94d3a789-d680-498d-aef5-05fb1af4d9ce	Applications of Trigonometry – PYQs and Doubts	38	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
77d494b8-685e-4c83-b96b-1a7d99b39757	94d3a789-d680-498d-aef5-05fb1af4d9ce	Complex Numbers – Imaginary Number, Power of Iota, Basics of Complex	39	2027-01-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dc1707ca-0502-401a-bfda-1730ba869d3b	94d3a789-d680-498d-aef5-05fb1af4d9ce	Complex Numbers – Conjugate and Modulus, Amplitude, Polar Form	40	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f7afab2e-faba-4b4e-a808-5132dfcf9e9b	94d3a789-d680-498d-aef5-05fb1af4d9ce	Complex Numbers – Eulerian Form, Square Root, Cube Root of Unity	41	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7e5f16a8-afb9-4e8c-8e5a-e810560d21eb	94d3a789-d680-498d-aef5-05fb1af4d9ce	Complex Numbers – Maximum, Minimum	42	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3aacc3fa-3ae5-4627-a835-b832852c279c	94d3a789-d680-498d-aef5-05fb1af4d9ce	Permutations & Combinations – Permutations	43	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7a0b4e2a-aac4-436d-b751-06f9e0d3c6e7	94d3a789-d680-498d-aef5-05fb1af4d9ce	Permutations & Combinations – Combinations	44	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
75891593-403b-4039-97c5-055f771ee9c5	94d3a789-d680-498d-aef5-05fb1af4d9ce	Permutations & Combinations – Mixed Problems	45	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
695a2bc2-109b-4d77-9d4c-876c107f9766	94d3a789-d680-498d-aef5-05fb1af4d9ce	Permutations & Combinations – PYQs and Doubts	46	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c64ced8d-1fd3-44d4-8f8e-5c87c9fe4c6d	94d3a789-d680-498d-aef5-05fb1af4d9ce	Binomial Theorem – Number of Terms, General Term	47	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8353bec8-71ed-458b-aa87-d93c1f07845a	94d3a789-d680-498d-aef5-05fb1af4d9ce	Binomial Theorem – Coefficient of Terms, Middle Term, Greatest Term	48	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
43eb55f7-b973-428d-a5d1-41a29936936f	94d3a789-d680-498d-aef5-05fb1af4d9ce	Binomial Theorem – NGT and Special Formula	49	2027-01-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
86428f1c-1c35-4123-abef-c28c34bf6abf	94d3a789-d680-498d-aef5-05fb1af4d9ce	Binomial Theorem – PYQs and Doubts	50	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
acb154ac-8a4e-4a77-8176-bbac6ea1482d	94d3a789-d680-498d-aef5-05fb1af4d9ce	Probability – Random Experiments, Outcomes and Sample Space, Event, Occurrence of an Event	51	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
939ddb73-5ed8-44f6-a0dc-f1ee12566de6	94d3a789-d680-498d-aef5-05fb1af4d9ce	Probability – Types of Events, Algebra of Events	52	2027-02-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2c06a11f-f6f3-47bd-8520-cde96333db93	94d3a789-d680-498d-aef5-05fb1af4d9ce	Probability – Axiomatic Approach to Probability	53	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4d0f209f-8ae4-4a3e-9503-5f3bc6c8ce53	94d3a789-d680-498d-aef5-05fb1af4d9ce	Probability – Probability (Advanced)	54	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
41a08db7-fc76-43b1-aa78-9aca695f54a6	94d3a789-d680-498d-aef5-05fb1af4d9ce	Probability – Conditional Probability	55	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f0f39517-a45f-4bd9-9e95-0f691012e19b	94d3a789-d680-498d-aef5-05fb1af4d9ce	Probability – Total Probability Theorem	56	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
55b70c02-9baf-4c4b-9a49-efe4fea97f8e	94d3a789-d680-498d-aef5-05fb1af4d9ce	Probability – Bayes’ Theorem	57	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9d5ba3d9-8971-43bd-a2f7-751a6fe0b3bc	94d3a789-d680-498d-aef5-05fb1af4d9ce	Probability – Probability Distribution	58	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8f1cbfde-e0ea-4f4d-9b23-7c5f423485d8	94d3a789-d680-498d-aef5-05fb1af4d9ce	Probability – PYQs and Doubts	59	2027-02-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1222d7b1-2125-43a5-8e64-43f095869ede	94d3a789-d680-498d-aef5-05fb1af4d9ce	Co-ordinate Geometry – Cartesian Coordinate System and Section Formula	60	2027-02-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
860a57bc-2f8b-405a-8aa3-be447ed59b83	94d3a789-d680-498d-aef5-05fb1af4d9ce	Co-ordinate Geometry – Slope, Equation of Line, Angle Between Two Lines	61	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
610d7083-ac67-4dd3-bbde-37559d9148b5	94d3a789-d680-498d-aef5-05fb1af4d9ce	Co-ordinate Geometry – Various Forms of the Equation of a Line	62	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5f22c76c-363b-491c-aa31-afebb2fad443	94d3a789-d680-498d-aef5-05fb1af4d9ce	Co-ordinate Geometry – Distance of a Point From a Line	63	2027-02-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
247b9752-c85f-49cc-ab68-f25ca955a4af	94d3a789-d680-498d-aef5-05fb1af4d9ce	Co-ordinate Geometry – Pairs of Straight Line and Miscellaneous	64	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9b2361ee-e375-43d4-998b-ac3bbd076712	94d3a789-d680-498d-aef5-05fb1af4d9ce	Co-ordinate Geometry – Term Related to Triangles	65	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9ae8f473-359e-40ee-b059-950385cb2e85	94d3a789-d680-498d-aef5-05fb1af4d9ce	Co-ordinate Geometry – PYQs and Doubts	66	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a3278b2e-dce1-4cd8-b29a-b81adb3bf919	94d3a789-d680-498d-aef5-05fb1af4d9ce	Conic Section – Basics of Circles	67	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ceb8baab-8701-4cb3-8647-62945bdb5283	94d3a789-d680-498d-aef5-05fb1af4d9ce	Conic Section – Intersections of Circle and Parametric Form of Circle	68	2027-03-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
26698a67-4423-4d11-b1e7-240f69c61c63	94d3a789-d680-498d-aef5-05fb1af4d9ce	Conic Section – Tangent and Normal of Circles	69	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3cbc8123-e912-4def-8b3d-4b299fcdef87	94d3a789-d680-498d-aef5-05fb1af4d9ce	Conic Section – Introduction to Parabola and Standard Form	70	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d0b7c841-b397-40a5-9396-99508953c2af	94d3a789-d680-498d-aef5-05fb1af4d9ce	Conic Section – Shifting of Parabola	71	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dc58d5e1-e46c-4d74-ac44-a04fa898afa3	ee3d6099-911f-4697-a1c2-a2b18fe2dbe5	October	2	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
56c34f6e-5388-4925-b788-6fc854d9dd0c	94d3a789-d680-498d-aef5-05fb1af4d9ce	Conic Section – Ellipse	72	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4e463943-cb62-49df-9ab3-f794899ab9e0	94d3a789-d680-498d-aef5-05fb1af4d9ce	Conic Section – Hyperbola	73	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
df5dd82b-b174-47e4-9fed-2dd54206b982	94d3a789-d680-498d-aef5-05fb1af4d9ce	Conic Section – PYQs and Doubts	74	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
032504e9-8c71-435b-b061-d66579ea9ab4	94d3a789-d680-498d-aef5-05fb1af4d9ce	Three Dimensional Geometry – Basics of Three Dimensional Geometry	75	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
24235faf-1b6e-4178-91c3-06147ffd4068	94d3a789-d680-498d-aef5-05fb1af4d9ce	Limits and Derivatives – Basics of Limits	76	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
874896ce-279b-4a20-9a6c-0502c859a643	94d3a789-d680-498d-aef5-05fb1af4d9ce	Limits and Derivatives – Existence of Limits	77	2027-03-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2b43e9ca-4180-4839-b227-36de245a039a	94d3a789-d680-498d-aef5-05fb1af4d9ce	Limits and Derivatives – Limits and Evaluation of Limits	78	2027-03-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b76e8a61-7e56-4d09-8dff-aedab2a8a877	94d3a789-d680-498d-aef5-05fb1af4d9ce	Limits and Derivatives – Derivatives	79	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6ce7d2b4-2ce8-4117-99be-14cca7e4b90d	94d3a789-d680-498d-aef5-05fb1af4d9ce	Limits and Derivatives – L’Hôpital Rule of Limit	80	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a9fa897d-4796-4cf0-8a81-5c16d339cdf4	94d3a789-d680-498d-aef5-05fb1af4d9ce	Limits and Derivatives – First Principle of Differentiation	81	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ec1e3689-142f-473b-9a3f-673cd2c0ca89	94d3a789-d680-498d-aef5-05fb1af4d9ce	Limits and Derivatives – Chain Rule of Derivative	82	2027-03-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c80ca14c-b720-47c2-9f85-06ba4445e31a	94d3a789-d680-498d-aef5-05fb1af4d9ce	Limits and Derivatives – Algebra of Derivative (Product and Division Rule)	83	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7136a839-0113-4b9d-ac0e-33022e8a66ba	94d3a789-d680-498d-aef5-05fb1af4d9ce	Limits and Derivatives – Parametric Form of Derivative	84	2027-03-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0d64d269-1b09-4df8-a93a-6ad3ab427ba6	94d3a789-d680-498d-aef5-05fb1af4d9ce	Limits and Derivatives – Logarithmic & Implicit Differentiation	85	2027-04-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b04db302-919a-4bd4-80d7-71488d1c2466	94d3a789-d680-498d-aef5-05fb1af4d9ce	Statistics	86	2027-04-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e12418c8-c905-444f-849b-ba7456a881d7	94d3a789-d680-498d-aef5-05fb1af4d9ce	Binary Numbers	87	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a2406463-fa9d-406b-bc35-57deb01a3a2d	a43f195b-fd15-4155-8e77-fe80e4a9f766	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a08fa7cc-7bdb-4e07-a4d7-eb4ddced1c19	a43f195b-fd15-4155-8e77-fe80e4a9f766	Basic Mathematics	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
abbcf944-5840-4b36-9d99-78689a9884b0	a43f195b-fd15-4155-8e77-fe80e4a9f766	Units & Measurements (Errors + Dimensions)	3	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
db39badc-87aa-4ad3-9c83-c1678c1b71b5	a43f195b-fd15-4155-8e77-fe80e4a9f766	Vector	4	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
abc16872-93fc-4137-8e44-8517f4836251	a43f195b-fd15-4155-8e77-fe80e4a9f766	Motion in Straight Line	5	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dd2eea0f-8a99-4e3b-9259-a165907b71c4	a43f195b-fd15-4155-8e77-fe80e4a9f766	Motion in Plane	6	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d6a7fc9d-e479-43d8-8cf6-6b0096518d38	a43f195b-fd15-4155-8e77-fe80e4a9f766	Newton’s Laws of Motion (NLM)	7	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
57357c67-acbf-4938-b176-953dec9a687d	a43f195b-fd15-4155-8e77-fe80e4a9f766	Friction	8	2026-12-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5484e361-31ce-4ff6-907f-e0fb86eb55a0	a43f195b-fd15-4155-8e77-fe80e4a9f766	Work, Power & Energy (WPE)	9	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cb90814b-9ec9-478b-9f5a-f46fb35a08e5	a43f195b-fd15-4155-8e77-fe80e4a9f766	Gravitation	10	2026-12-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
13c300c4-42ec-4cf2-9d62-6e53fcc7e1db	a43f195b-fd15-4155-8e77-fe80e4a9f766	Rotation (Basics)	11	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6208a6c7-20fa-45f2-974c-ad7f2811fc0f	a43f195b-fd15-4155-8e77-fe80e4a9f766	Mechanical Properties of Solids	12	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
326760d2-631f-4d69-9014-65f26bb3d4d2	a43f195b-fd15-4155-8e77-fe80e4a9f766	Mechanical Properties of Fluids	13	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9c010026-c878-41d6-a584-29eb1492ae01	a43f195b-fd15-4155-8e77-fe80e4a9f766	Heat & Thermal Properties	14	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9d828515-ad8b-4c3e-b561-50229345c348	a43f195b-fd15-4155-8e77-fe80e4a9f766	Thermodynamics + Kinetic Theory of Gases	15	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5f78db74-8865-46e9-9fd7-3209b295e55e	a43f195b-fd15-4155-8e77-fe80e4a9f766	Simple Harmonic Motion (SHM)	16	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5790ea9f-3ce1-4a5a-937e-bee89f1c4b23	a43f195b-fd15-4155-8e77-fe80e4a9f766	Waves & Sound	17	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
be5f52cd-2fab-45b5-8f18-c508b16d7e91	a43f195b-fd15-4155-8e77-fe80e4a9f766	Electrostatics	18	2027-02-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f5e99d52-de12-461b-95bd-a1b812f0e935	a43f195b-fd15-4155-8e77-fe80e4a9f766	Current Electricity	19	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8f0dd0af-8578-4d60-942c-c26bca142fb3	a43f195b-fd15-4155-8e77-fe80e4a9f766	Magnetism & Moving Charges	20	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
521e03e0-e197-4183-a26c-2b73da8ff2d5	a43f195b-fd15-4155-8e77-fe80e4a9f766	Electromagnetic Induction (EMI) + AC	21	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0ded23d3-d0c0-4d90-a57e-196489563468	a43f195b-fd15-4155-8e77-fe80e4a9f766	Ray Optics + Wave Optics	22	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
779ab0b7-0760-416a-9d07-19dea6a369b5	a43f195b-fd15-4155-8e77-fe80e4a9f766	Modern Physics	23	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2bfe8785-940f-42e4-a828-640a2a0f4c91	a43f195b-fd15-4155-8e77-fe80e4a9f766	Semiconductor Electronics	24	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b990f1b4-d468-4165-ab77-84e54f1809d2	a43f195b-fd15-4155-8e77-fe80e4a9f766	PYQ + Final Revision	25	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5e9fad8d-ff83-4e2c-97fd-566c28a1495a	636ee88b-da18-4eb6-9610-cfe648b8c624	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a4f24baa-5102-4052-acf8-9b2cbb65b49c	636ee88b-da18-4eb6-9610-cfe648b8c624	Physical Classification of Matter	2	2026-11-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fa47680f-b0a0-489c-a1a6-58402f1f756f	636ee88b-da18-4eb6-9610-cfe648b8c624	Elements, Compounds and Mixtures	3	2026-11-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a45fb75a-1537-42b1-848c-97a91d58746d	636ee88b-da18-4eb6-9610-cfe648b8c624	Structure of Atom	4	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5b0c9abf-1a8f-4d56-9fa5-5aa47163ec38	636ee88b-da18-4eb6-9610-cfe648b8c624	Electronic Configuration	5	2026-12-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4cca3ab4-85fb-47be-8a78-c294c10714ff	636ee88b-da18-4eb6-9610-cfe648b8c624	Periodic Table	6	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
64c93079-0530-4760-8ef2-0ee369cd2f76	636ee88b-da18-4eb6-9610-cfe648b8c624	Chemical Bonding	7	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
71324fc4-d26c-4fc0-8186-3e1fd47be63c	636ee88b-da18-4eb6-9610-cfe648b8c624	Acids, Bases and Salts	8	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4d115240-8f60-4a15-915e-a561191dd90e	636ee88b-da18-4eb6-9610-cfe648b8c624	Metals and Non-Metals	9	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5ed6815e-8c94-48ca-a191-b99f8a145038	636ee88b-da18-4eb6-9610-cfe648b8c624	The Iso Species and Carbon	10	2027-02-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2682bd11-d88f-402f-b2e8-be91064399d0	636ee88b-da18-4eb6-9610-cfe648b8c624	IUPAC Nomenclature and Types of Reactions	11	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b3c1d3b3-251f-4f5d-886b-4ce10cc11d52	ddf961f0-2251-445d-b324-41704eed0e43	Delhi Sultanate	14	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6c0ee594-0260-433b-b668-da3ab7f4cbe9	636ee88b-da18-4eb6-9610-cfe648b8c624	Important Industrial Preparations, Corrosion, Water and Types of Hardness	12	2027-03-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9448851b-0117-46df-9eca-8c676d214f06	636ee88b-da18-4eb6-9610-cfe648b8c624	Mole Concept	13	2027-03-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
926cd98e-7a79-4018-b725-63a6cd1d8d24	636ee88b-da18-4eb6-9610-cfe648b8c624	Chemistry in Everyday Life	14	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7a5a5ed0-fc66-4c16-8f2a-004fa23db5ac	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Cell	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c6b47a4f-abf5-4d46-8db2-48354a15821c	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Animal Tissues	2	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5b00aa95-7c74-4815-a337-848e26035d8d	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Plant Tissues	3	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
190704ca-5a08-4c42-80b0-b492d7f160eb	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Life Processes	4	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a15d77c2-78ed-41b9-8ec7-4647e58ca1f3	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Control and Coordination in Humans	5	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
03038ca0-95b7-4ee7-9946-cf250035def1	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Control and Coordination in Plants	6	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c7a7e4a8-30b6-4c74-ac65-58b2b16ddc9c	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Reproduction – Introduction	7	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b0146cda-3a42-4ca9-b000-3031d9e607ea	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Sexual Reproduction in Flowering Plants	8	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7b97e18c-d27b-4d23-9219-af573cdd4691	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Human Reproduction	9	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ffeb76b5-d0ba-4f31-9c6c-e6f656dead6c	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Diversity in Organisms	10	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0455c75d-574a-4919-ad84-d8274f0be088	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Human Health and Diseases	11	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
028675e0-f4d0-4415-9f19-b8e099ef8a87	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Important Vitamins and Minerals	12	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
634bbcda-b25c-488f-92be-f26370585093	48cf5b74-6a36-40ef-ab40-b43e4efcb72f	Genetics	13	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0552e41a-aec7-4f05-9fa8-63db6020df7d	41f1a480-c709-40b9-a40b-737b095207ff	All About NDA Exam	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1ad56e2a-2e84-403a-9a1d-aaae0f370a4e	41f1a480-c709-40b9-a40b-737b095207ff	Vocabulary	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1569c3b9-d500-418d-a512-fe960daaf122	41f1a480-c709-40b9-a40b-737b095207ff	Noun	3	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bd5dac6b-9893-4454-915f-916acf88407c	41f1a480-c709-40b9-a40b-737b095207ff	Pronoun	4	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
100642dc-2584-48b9-bc0b-46dc90e5c7af	41f1a480-c709-40b9-a40b-737b095207ff	Idioms and Phrases	5	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3a92538c-b78f-45b6-b9de-c8c13ed76bee	41f1a480-c709-40b9-a40b-737b095207ff	Conjunction	6	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b35bf13b-9bdb-4d35-89e5-0992aa9ba266	41f1a480-c709-40b9-a40b-737b095207ff	Adjective	7	2026-12-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
07cd1c62-b95b-4f9b-a871-576203b92504	41f1a480-c709-40b9-a40b-737b095207ff	Adverb	8	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a070343a-2a78-43a3-a07d-1303dbf00e41	41f1a480-c709-40b9-a40b-737b095207ff	Preposition	9	2026-12-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1938a1b1-b7a6-432b-9164-5431e72772d1	41f1a480-c709-40b9-a40b-737b095207ff	Fixed Preposition	10	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8ff00bbe-ca3a-4e28-89d4-b295f60c3be5	41f1a480-c709-40b9-a40b-737b095207ff	Articles	11	2027-01-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e4dba210-023c-4118-85e9-ac73500e3853	41f1a480-c709-40b9-a40b-737b095207ff	Sentence Arrangement	12	2027-01-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4543c69d-21bc-4779-a5ec-675e3ced03e6	41f1a480-c709-40b9-a40b-737b095207ff	Verb	13	2027-01-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4dac9b70-f00f-474f-9c86-181d52133337	41f1a480-c709-40b9-a40b-737b095207ff	Tense	14	2027-01-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
726a7f74-735f-4577-b808-7d660fcea09e	41f1a480-c709-40b9-a40b-737b095207ff	Conditional Sentences	15	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5f7984fc-ec4e-464d-b756-eda8b1a8ff4a	41f1a480-c709-40b9-a40b-737b095207ff	Question Tag	16	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d6426a4c-f97a-4453-b969-f5eba9945cdb	41f1a480-c709-40b9-a40b-737b095207ff	Voice	17	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fc78bb74-b8cf-48f9-a76b-3ef47bcc1322	41f1a480-c709-40b9-a40b-737b095207ff	Narration	18	2027-02-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2a540f38-06f0-4740-8c4c-ba2c73fec5c1	41f1a480-c709-40b9-a40b-737b095207ff	Modals	19	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
732a6af4-e3f3-45d6-b22b-92b3fd6c2f75	41f1a480-c709-40b9-a40b-737b095207ff	Passage	20	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2d2d1293-5308-434d-9491-060294a32f0d	41f1a480-c709-40b9-a40b-737b095207ff	Cloze Test	21	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5c450ba4-2569-499f-99cc-672bd2397675	41f1a480-c709-40b9-a40b-737b095207ff	Previous Year Questions	22	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5c92153b-dc18-4286-9b79-e2b7a4715650	41f1a480-c709-40b9-a40b-737b095207ff	Homophones	23	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ad34425d-2158-40f0-bc80-757adc1a8fb7	41f1a480-c709-40b9-a40b-737b095207ff	Important Miscellaneous Questions	24	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
88b23bad-68d6-4475-97f9-e5dbfc62bb7f	8acae6af-e1c2-44f2-ab26-d919f275423b	September	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2397bc31-19e9-444b-a06c-9e0918b3b17c	8acae6af-e1c2-44f2-ab26-d919f275423b	October	2	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
49ce5caa-84b5-46dc-88c9-9ef53cbceda1	8acae6af-e1c2-44f2-ab26-d919f275423b	November	3	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b8469be6-3159-45a6-80e0-e5774cf121e1	8acae6af-e1c2-44f2-ab26-d919f275423b	December	4	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4d6809b8-e99e-4316-935d-7e216e5159da	8acae6af-e1c2-44f2-ab26-d919f275423b	January	5	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
04b1d73f-9f22-4f96-9210-ef36a76efa1a	ddf961f0-2251-445d-b324-41704eed0e43	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
efa87ad6-b202-414d-ac50-6ef2956d9a9a	ddf961f0-2251-445d-b324-41704eed0e43	Origin of Human	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
aed41888-72b2-4aed-88d3-2afe63daba6b	ddf961f0-2251-445d-b324-41704eed0e43	Indus Valley Civilization	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7e2d906c-f036-41e9-8b15-106e069d9aa5	ddf961f0-2251-445d-b324-41704eed0e43	Vedic Civilization	4	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d93bad1d-ccad-4a59-ae49-0bb12f1d1957	ddf961f0-2251-445d-b324-41704eed0e43	Religious Movement	5	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
84bd33d6-7b8c-43f0-838d-6484839978bd	ddf961f0-2251-445d-b324-41704eed0e43	Mahajanapadas / Foreign Invasions	6	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
56b46f03-7c57-4a43-bbc1-c20a8ed3145a	ddf961f0-2251-445d-b324-41704eed0e43	Mauryan Empire	7	2026-12-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
204ff103-e475-4647-ba23-fc459946fbfc	ddf961f0-2251-445d-b324-41704eed0e43	Post Mauryan Age	8	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1956a35e-99bc-4600-be1e-10e9fdb0bbd4	ddf961f0-2251-445d-b324-41704eed0e43	Sangam Era	9	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bac735b5-26f1-46ad-8f67-c9a45740d0fc	ddf961f0-2251-445d-b324-41704eed0e43	Gupta Empire	10	2026-12-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
019e68d7-148d-45fb-904d-9386ac72a121	ddf961f0-2251-445d-b324-41704eed0e43	Post Gupta Age	11	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ff0ce225-9b94-4f5a-aa68-bf0c4e8db639	ddf961f0-2251-445d-b324-41704eed0e43	Rajput Period	12	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
210bab13-f578-4661-8d8c-3f9e36b07f5b	ddf961f0-2251-445d-b324-41704eed0e43	Chola Empire	13	2026-12-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3d3e1a23-6782-4694-8f81-5e675b4f273c	ddf961f0-2251-445d-b324-41704eed0e43	Vijaynagar Empire	15	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0ea2317b-d189-4dbf-a50c-ff4b4ff34c17	ddf961f0-2251-445d-b324-41704eed0e43	Bahamani Empire	16	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
affed440-c8eb-4af4-8f4f-03c28eff8315	ddf961f0-2251-445d-b324-41704eed0e43	Bhakti Movement	17	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
08e98f77-b8b6-4b69-9a78-4ead9246a38f	ddf961f0-2251-445d-b324-41704eed0e43	Sufi Movement	18	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fd3b7213-a427-4902-927b-73e84e73b93a	ddf961f0-2251-445d-b324-41704eed0e43	Rise of Mughals	19	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
19ce8a33-6d36-4c2a-8abf-744832008b89	ddf961f0-2251-445d-b324-41704eed0e43	Expansion of Mughal Empire	20	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e03c9ead-1787-4ff7-8906-8013d4febb7e	ddf961f0-2251-445d-b324-41704eed0e43	Aurangzeb and Decline of Mughals	21	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3485506f-2e5b-4437-9cbe-b706edb68496	ddf961f0-2251-445d-b324-41704eed0e43	Later Mughals	22	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ba810d9a-8246-4e22-9bf0-4d881b82f41d	ddf961f0-2251-445d-b324-41704eed0e43	The Rise of Maratha Empire under Shivaji	23	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
db7b89d8-c0d0-4fa0-9cc4-f73bebaecf26	ddf961f0-2251-445d-b324-41704eed0e43	Peshwa and Third Battle of Panipat	24	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a236c4e2-b7e4-443d-9bed-0f783216dfd7	ddf961f0-2251-445d-b324-41704eed0e43	Arrival of Europeans in India	25	2027-02-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ca9b95c0-8830-4438-950e-d284cfcfde7e	ddf961f0-2251-445d-b324-41704eed0e43	British Conquest in India	26	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8c5cc28f-025f-4eb0-972f-c290144c653b	ddf961f0-2251-445d-b324-41704eed0e43	Early Revolts Against British Rule	27	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
eab565e7-3340-4a26-b5ec-61d4f4d6cda1	ddf961f0-2251-445d-b324-41704eed0e43	Indian Renaissance	28	2027-03-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0f099cbf-7456-41a9-9d30-2bcd557e21be	ddf961f0-2251-445d-b324-41704eed0e43	Rise of British Rule	29	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ef983b49-4822-4a93-9adf-65b4b5117f51	ddf961f0-2251-445d-b324-41704eed0e43	British Rule	30	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9ddb059f-dc17-4c59-a314-fe1e4b06239f	ddf961f0-2251-445d-b324-41704eed0e43	The Revolt of 1857	31	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0e59691b-9b72-4ce0-adb9-6fa1ed458f53	ddf961f0-2251-445d-b324-41704eed0e43	Crown Rule	32	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fbd57521-63c0-4bc3-8981-343e59b235ec	ddf961f0-2251-445d-b324-41704eed0e43	National Movement	33	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a455894e-82af-495d-abf8-9856862cbb29	ddf961f0-2251-445d-b324-41704eed0e43	World History	34	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
afc5a5a8-f1cf-4127-ada4-fc7f5b915a8c	d239b467-ac86-4b22-90d7-70684abb6c35	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
63d71f52-f860-41c7-b4d8-fad4add3eb6e	d239b467-ac86-4b22-90d7-70684abb6c35	Basics of Polity	2	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a0afceb2-c069-49ba-8f2b-08cfa38614ca	d239b467-ac86-4b22-90d7-70684abb6c35	Constitutional Development	3	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
482232ae-52ad-4e05-9706-96e748a830e9	d239b467-ac86-4b22-90d7-70684abb6c35	Making of Constitution	4	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ae7bb6e7-7901-4272-bbce-e9e8e8ebc3e2	d239b467-ac86-4b22-90d7-70684abb6c35	Features and Preamble of Constitution	5	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d4f2fbf8-1481-4190-8684-583dac604dbc	d239b467-ac86-4b22-90d7-70684abb6c35	Union and Its Territories	6	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
918c9a90-d396-4f75-a482-7a7e9f5a7429	d239b467-ac86-4b22-90d7-70684abb6c35	Citizenship	7	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4859ecc9-9bcd-4a63-be5e-f51aec067b8e	d239b467-ac86-4b22-90d7-70684abb6c35	Fundamental Rights	8	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d5345a2f-5396-4209-8b11-f077d32d4a80	d239b467-ac86-4b22-90d7-70684abb6c35	Directive Principles of State Policy	9	2027-01-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1a8eee8f-15ec-4e0c-87fd-63661a230542	d239b467-ac86-4b22-90d7-70684abb6c35	Fundamental Duties	10	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f0e9c175-7c77-44fe-8f8e-f7ecc3e60384	d239b467-ac86-4b22-90d7-70684abb6c35	Parliament	11	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e18577f7-3c73-4d47-a048-b046c55950e2	d239b467-ac86-4b22-90d7-70684abb6c35	President	12	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bfa902c2-263f-4027-b5c3-db6186c43448	d239b467-ac86-4b22-90d7-70684abb6c35	Vice President	13	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3b6b4cde-c974-42d4-9d05-079af57f387c	d239b467-ac86-4b22-90d7-70684abb6c35	State Legislature	14	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
54e596f0-8f2c-40eb-8a99-4e6bf689ed52	d239b467-ac86-4b22-90d7-70684abb6c35	Governor	15	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
be59218b-2ea9-4ac5-a5e8-203021e26b49	d239b467-ac86-4b22-90d7-70684abb6c35	Supreme Court	16	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7a7566e7-3685-4524-9cf8-33158476b07e	d239b467-ac86-4b22-90d7-70684abb6c35	High Court	17	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
78dbf26a-da82-473d-8b28-9f42af55d73b	d239b467-ac86-4b22-90d7-70684abb6c35	Emergency	18	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0eafe0cd-29f2-40e1-b421-03f5c5d679c3	d239b467-ac86-4b22-90d7-70684abb6c35	Local Self Government	19	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e57893a7-0800-4fa3-9de9-1c459e0b4bec	d239b467-ac86-4b22-90d7-70684abb6c35	Constitutional Bodies	20	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b25b9fa6-44ad-4cfa-a8d7-9cb71c5eadc8	d239b467-ac86-4b22-90d7-70684abb6c35	Important Amendments	21	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dcb0dc19-de98-49af-a7a1-99c459edc1cc	d239b467-ac86-4b22-90d7-70684abb6c35	Miscellaneous	22	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dd3763c4-8440-42b2-a3b2-5f32c026ab94	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Introduction to SSB Process	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9beed801-61b0-4c63-9c59-9e45c9317e5a	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	OIR Lectures	2	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ffc6a440-d889-443e-ae8a-7d3959570d40	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	PPDT: Story Writing	3	2026-11-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ff30bfc3-a58a-44d7-9f33-762e126145be	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	PPDT: Narration & Group Discussion	4	2026-12-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2499f848-8bae-4a1a-80c1-f8c9acba4a14	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Introduction to GTO & Its Importance	5	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
43346064-1f98-4ec4-862a-cf659a0b7380	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Group Tasks: GD + GPE	6	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fb0e58a2-f219-46b5-bdd5-d07d2d5f762a	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Group Tasks: Individual Obstacles (IO) & Group Obstacle Race (GOR)	7	2027-01-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1cbe0df0-48fe-48ae-9265-b35701cabd64	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Group Tasks: PGT/HGT/CT/FGT	8	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bbaf95b9-2b19-400e-b197-25fd1933df34	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Introduction to Lecturette	9	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d2262819-b437-4d5f-a933-b63b0d23f2bf	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Introduction to Psychological Tests	10	2027-02-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
821b1e5c-99ee-4022-9c12-c06a92712fcc	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Thematic Apperception Test	11	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7a09ba06-d693-448a-8dad-cb098d71c2f5	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Word Association Test	12	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9212395d-49b9-4e86-ae2e-02eff17b2abe	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Situation Reaction Test	13	2027-03-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
173475c8-9359-4470-ba99-d07bb436366a	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Self Description Test	14	2027-03-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b9bd0220-8fe8-4f8a-8d3c-af20d2c3ed87	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Introduction to Personal Interview & Understanding PIQ Form	15	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8906fcc0-a749-4e6f-b1c8-385be3988c1a	d5a6b073-c2d1-4fa2-8bce-84a108ce9875	Introduction to CPSS (AFSB)	16	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0e864cf3-8f63-4f0a-ac66-3474be409985	4d1300b1-57b6-4b0c-ac41-7cb3198f8511	Basics of Economics	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4710ea68-bac9-40c6-876d-0a991c1380f7	4d1300b1-57b6-4b0c-ac41-7cb3198f8511	Types of Economy	2	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8fbe10b8-a875-48e0-92e4-a766826a6fad	4d1300b1-57b6-4b0c-ac41-7cb3198f8511	Planning in India	3	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3f315973-2780-4c23-8698-48817b500ef1	4d1300b1-57b6-4b0c-ac41-7cb3198f8511	Five Year Plans	4	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
45f02764-50ef-42f9-9034-84373fba1e4d	4d1300b1-57b6-4b0c-ac41-7cb3198f8511	Money	5	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
40dc566c-14ed-47ba-83d7-c3a97e47bfed	4d1300b1-57b6-4b0c-ac41-7cb3198f8511	Banking	6	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
43d580cb-b6ac-401c-9413-8b266ede782d	4d1300b1-57b6-4b0c-ac41-7cb3198f8511	Current Budget	7	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
11307e77-21f4-441c-ae8c-6eff561521f4	4d1300b1-57b6-4b0c-ac41-7cb3198f8511	International Institutions	8	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bdbf50b4-ddef-428d-a991-2c2bfb744cd0	760a3b3e-2709-45c9-8705-1081f9ed6c01	Introduction of Geography & Syllabus	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0b7b9a36-b69a-4c80-9558-acd226d95f4a	760a3b3e-2709-45c9-8705-1081f9ed6c01	Universe and Cosmology	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8c948f42-689e-4b24-bb05-852cd8707b0e	760a3b3e-2709-45c9-8705-1081f9ed6c01	Solar System	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
12c9fe29-2962-43d8-b17a-64a57c26fa92	760a3b3e-2709-45c9-8705-1081f9ed6c01	Earth, Latitude & Longitude	4	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
341f563c-2270-44f4-bc57-f317b292f3eb	760a3b3e-2709-45c9-8705-1081f9ed6c01	Interior of the Earth	5	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d9c06631-3b45-4915-95ab-5afb22916311	760a3b3e-2709-45c9-8705-1081f9ed6c01	Formation of the Continents & Rocks	6	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5cf0c737-1d5a-4982-8d2c-01bb2b5a86bd	760a3b3e-2709-45c9-8705-1081f9ed6c01	Plate Tectonics	7	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dcff7824-eef6-4197-a466-e954cec67e25	760a3b3e-2709-45c9-8705-1081f9ed6c01	Geomorphic Process (Endogenetic & Exogenetic)	8	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3bdc4bec-d19e-4ba0-95c4-d5b963aa5054	760a3b3e-2709-45c9-8705-1081f9ed6c01	Formation of Mountains, Plateaus & Plains	9	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cccd546e-805f-466b-b840-86de8f9c2106	760a3b3e-2709-45c9-8705-1081f9ed6c01	Volcanos, Earthquake & Tsunami	10	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
68cc0dd9-d1b5-49e0-9fbb-06b2de97ac02	760a3b3e-2709-45c9-8705-1081f9ed6c01	Composition & Structure of Atmosphere	11	2026-12-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1d6c5832-e04a-4833-8169-084a7de84eac	760a3b3e-2709-45c9-8705-1081f9ed6c01	Earth Temperature & Atmospheric Pressure	12	2026-12-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f6728dd3-9111-43ee-839e-a75a51bb632f	760a3b3e-2709-45c9-8705-1081f9ed6c01	Temperature Zones, Pressure Belts & Winds	13	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
60581de3-2e94-4f13-9138-8da0b701cf26	760a3b3e-2709-45c9-8705-1081f9ed6c01	Climate & Weather	14	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
723ee8b2-cd0d-4858-b3da-861db144bed5	760a3b3e-2709-45c9-8705-1081f9ed6c01	Precipitation, Cloud, Jet Stream & Cyclones	15	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d6fbbf13-e7be-4714-a3f3-fceb1539d0a9	760a3b3e-2709-45c9-8705-1081f9ed6c01	Ocean & Ocean Relief Features	16	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f7931787-2623-4694-9a64-8816bf72d4db	760a3b3e-2709-45c9-8705-1081f9ed6c01	Ocean Water Properties, Waves, Current & Tides	17	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f5e4a3c9-210e-4d2e-aad9-ca827cc69a8c	760a3b3e-2709-45c9-8705-1081f9ed6c01	Other Water Bodies & Formations	18	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6dc0db98-bb7d-48b4-aa9a-c95ea0eea726	760a3b3e-2709-45c9-8705-1081f9ed6c01	World Facts About Continents	19	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
175011ff-7bf9-431f-a5d8-29e9266a449b	760a3b3e-2709-45c9-8705-1081f9ed6c01	Soil, Natural Vegetation & Types	20	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f63577a9-3e97-4c27-b681-eb4748be511b	760a3b3e-2709-45c9-8705-1081f9ed6c01	Physiography of India	21	2027-02-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8b111421-4978-4df0-b809-a6c2c919f13d	760a3b3e-2709-45c9-8705-1081f9ed6c01	Indian Mountains	22	2027-02-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
721fcb65-cb1f-451a-8e09-ac42f9273534	760a3b3e-2709-45c9-8705-1081f9ed6c01	Indian Plateau & Coastal Regions (Ghats)	23	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4c2ca69e-b498-4238-9aad-06bd497e57c3	760a3b3e-2709-45c9-8705-1081f9ed6c01	Plainland, Desert & Islands	24	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8834ed6d-84ac-45b9-8e5a-68ebd788b1a5	760a3b3e-2709-45c9-8705-1081f9ed6c01	Drainage System (Northern)	25	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5f7e2170-49fc-43d8-b2c7-a24a5a5eb3d2	760a3b3e-2709-45c9-8705-1081f9ed6c01	Drainage System (Peninsula)	26	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
edeba530-d64c-4696-8b8a-cd6a737fe10d	760a3b3e-2709-45c9-8705-1081f9ed6c01	Indian Climate & Monsoon	27	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
82e1636b-49bc-484f-8b37-51411cdbd0b4	760a3b3e-2709-45c9-8705-1081f9ed6c01	Vegetation & Forest	28	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e1c2e2ae-c160-4ed8-88c8-168d2c2a17b8	760a3b3e-2709-45c9-8705-1081f9ed6c01	India Soil & Agriculture (Crops)	29	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2e793a36-7322-42a3-a4cf-436f3a6e6249	760a3b3e-2709-45c9-8705-1081f9ed6c01	Minerals, Energy & Industry	30	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dbee298c-0eba-49fa-94a3-4550badf948a	760a3b3e-2709-45c9-8705-1081f9ed6c01	Transportation	31	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2eaafd4c-705f-4e7a-8ddd-5f669308bb59	760a3b3e-2709-45c9-8705-1081f9ed6c01	Practice Session	32	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a19b413e-2c4c-44f8-8295-d4e65351217f	b9e97456-8606-4841-a57a-6aae1bb13d8a	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7146cc0a-a586-47b7-8b02-7f6dc8d59032	b9e97456-8606-4841-a57a-6aae1bb13d8a	Basic Math – Basic Formulae, Indices	2	2026-11-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4512e258-525d-4c15-b23d-8a66fa41af53	b9e97456-8606-4841-a57a-6aae1bb13d8a	Basic Math – Inequality	3	2026-11-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
060ac9c6-ed79-4276-8cd8-329da5fa79b2	b9e97456-8606-4841-a57a-6aae1bb13d8a	Basic Math – Modulus Basic	4	2026-11-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
825f0e8a-a3ae-44da-b836-3e05cc345ee2	b9e97456-8606-4841-a57a-6aae1bb13d8a	Basic Math – Modulus Advanced	5	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
16fb5f81-db08-498e-93bc-c20954e2e52a	b9e97456-8606-4841-a57a-6aae1bb13d8a	Logarithms – Logarithms Properties	6	2026-11-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d8572965-9e83-428e-840b-eb48dd2053ae	b9e97456-8606-4841-a57a-6aae1bb13d8a	Logarithms – Logarithms and Exponential Function	7	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0ff05f0a-da97-419b-a0ae-b46030a9829c	b9e97456-8606-4841-a57a-6aae1bb13d8a	Logarithms – PYQs and Doubts	8	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fa4c27ce-5ed5-4a0e-887f-eb2e9a67576d	b9e97456-8606-4841-a57a-6aae1bb13d8a	Sets – Sets and Their Representations	9	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
61203fa1-a69a-4825-9955-ccba307eafad	b9e97456-8606-4841-a57a-6aae1bb13d8a	Sets – Types of Set	10	2026-11-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c201c9c1-2a34-486c-abb0-47779541189f	b9e97456-8606-4841-a57a-6aae1bb13d8a	Sets – Venn Diagram	11	2026-11-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
013eb3ec-145c-463a-b0a3-ce8c37110b57	b9e97456-8606-4841-a57a-6aae1bb13d8a	Sets – Operation on Sets (Union, Intersection, Difference of Sets)	12	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7f3cef5a-0710-41a7-bbf1-91784695c4b6	b9e97456-8606-4841-a57a-6aae1bb13d8a	Sets – PYQs and Doubts	13	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4c9e1df0-a7ea-4d11-bf98-ba913ec30de0	b9e97456-8606-4841-a57a-6aae1bb13d8a	Quadratic Equations – Basics of Roots, Solution and Nature of Roots	14	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
17b5cf0a-a3d9-4741-8d30-ec9dc235707b	b9e97456-8606-4841-a57a-6aae1bb13d8a	Quadratic Equations – Properties of Roots	15	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1c1aad62-8e96-4dc8-bfba-c593798334a1	b9e97456-8606-4841-a57a-6aae1bb13d8a	Quadratic Equations – Graph and Location of Roots	16	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bc01f499-30b7-4d4f-ab0f-bed4ad831594	b9e97456-8606-4841-a57a-6aae1bb13d8a	Quadratic Equations – PYQs and Doubts	17	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
232c5fbc-265e-48a0-8c9a-0a6e01c568ee	b9e97456-8606-4841-a57a-6aae1bb13d8a	Sequence and Series – Basics of Progression and Series	18	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a009c300-f31f-4d9e-a5b0-8cf51bdac8f5	b9e97456-8606-4841-a57a-6aae1bb13d8a	Sequence and Series – Arithmetic Progression	19	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bde72608-ae88-4929-b1fc-b77e63d7312c	b9e97456-8606-4841-a57a-6aae1bb13d8a	Sequence and Series – Arithmetic and Harmonic Progression	20	2026-12-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fa4ea9c0-5b0d-4798-8630-423967d1a47f	b9e97456-8606-4841-a57a-6aae1bb13d8a	Sequence and Series – Geometric Progression	21	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
adfa8cad-3fd5-4719-a044-d5a94dbf49a3	b9e97456-8606-4841-a57a-6aae1bb13d8a	Sequence and Series – Relation Between AM and GM	22	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
54d05023-3f1e-49ff-a430-766f9b743b29	b9e97456-8606-4841-a57a-6aae1bb13d8a	Sequence and Series – PYQs and Doubts	23	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6e4d0521-7c37-46d1-a109-3f737296c5d2	b9e97456-8606-4841-a57a-6aae1bb13d8a	Relations and Functions – Cartesian Products of Sets	24	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3bef4a9c-4ee1-49ae-8071-6937122c1829	b9e97456-8606-4841-a57a-6aae1bb13d8a	Relations and Functions – Relations	25	2026-12-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
daec147d-cb9d-43c6-a425-622f03715e24	b9e97456-8606-4841-a57a-6aae1bb13d8a	Relations and Functions – Functions	26	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e0c79816-463d-4274-b9e2-cc420c0848c4	b9e97456-8606-4841-a57a-6aae1bb13d8a	Relations and Functions – Some Functions and Their Graphs	27	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1e5e854b-9945-4829-a231-7d3e1cbd75ae	b9e97456-8606-4841-a57a-6aae1bb13d8a	Relations and Functions – Domain and Range	28	2026-12-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c8c80ef4-587c-4e29-815e-1d17b890f284	b9e97456-8606-4841-a57a-6aae1bb13d8a	Relations and Functions – PYQs and Doubts	29	2026-12-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
44c987ff-7a80-46c8-96a3-88d3a56d7e30	b9e97456-8606-4841-a57a-6aae1bb13d8a	Trigonometry – Introduction to Trigonometry & Identities, Quadrants and Conversion of Angle	30	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
fe5d1a4d-5596-409b-81d5-e67aa13bb1be	b9e97456-8606-4841-a57a-6aae1bb13d8a	Trigonometry – Compound Angle and Transformation of Angles	31	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
2b145591-d97a-44c0-a079-9ab3b0ca5628	b9e97456-8606-4841-a57a-6aae1bb13d8a	Trigonometry – Multiple Angle Formulas	32	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
bdcda2bb-4790-40cc-aba2-e54783bafad3	b9e97456-8606-4841-a57a-6aae1bb13d8a	Trigonometry – PYQs and Doubts	33	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
41f69ec2-39bc-4e66-97c9-a38c1de6c5e5	b9e97456-8606-4841-a57a-6aae1bb13d8a	Trigonometric Equations – General Solutions of Trigonometric Equations	34	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
6bac3651-9a74-448e-b35e-45fea8d075f1	b9e97456-8606-4841-a57a-6aae1bb13d8a	Trigonometric Equations – PYQs and Doubts	35	2026-10-24	Completed foundation module (Prior to late Oct 2026)	2026-11-04 10:40:08.924969+00
165279fe-5e5a-4bd9-9dd7-c885fde6e3cc	b9e97456-8606-4841-a57a-6aae1bb13d8a	Applications of Trigonometry – Heights and Distances	36	2027-01-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
336d7500-9638-4268-bcfe-2665ea1c6337	b9e97456-8606-4841-a57a-6aae1bb13d8a	Applications of Trigonometry – Properties of Triangle	37	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0d803aec-f58e-4a3d-83f6-f941dd286d50	b9e97456-8606-4841-a57a-6aae1bb13d8a	Applications of Trigonometry – PYQs and Doubts	38	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0eb4695a-162f-41b0-a779-2d46bf61dcdb	b9e97456-8606-4841-a57a-6aae1bb13d8a	Complex Numbers – Imaginary Number, Power of Iota, Basics of Complex	39	2027-01-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
78f6dad5-cfbb-4b5f-9c98-ec096bc3061a	b9e97456-8606-4841-a57a-6aae1bb13d8a	Complex Numbers – Conjugate and Modulus, Amplitude, Polar Form	40	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b666b82b-9f52-452e-832c-dea58630c1b3	b9e97456-8606-4841-a57a-6aae1bb13d8a	Complex Numbers – Eulerian Form, Square Root, Cube Root of Unity	41	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b209a4cc-ef54-423e-a712-7a00ba1fe4dc	b9e97456-8606-4841-a57a-6aae1bb13d8a	Complex Numbers – Maximum, Minimum	42	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c7c13a1e-601a-4368-aa80-a2b4e18d9848	b9e97456-8606-4841-a57a-6aae1bb13d8a	Permutations & Combinations – Permutations	43	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
174246ed-a10a-446d-8fd7-c076e29e16f6	b9e97456-8606-4841-a57a-6aae1bb13d8a	Permutations & Combinations – Combinations	44	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bc339cac-dad6-470a-aaa3-d120b1ba8bb6	b9e97456-8606-4841-a57a-6aae1bb13d8a	Permutations & Combinations – Mixed Problems	45	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
17602346-a012-4276-a961-ed747a14bb1a	b9e97456-8606-4841-a57a-6aae1bb13d8a	Permutations & Combinations – PYQs and Doubts	46	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
676af6aa-d696-45a2-bd54-f47ae5fe3e5e	b9e97456-8606-4841-a57a-6aae1bb13d8a	Binomial Theorem – Number of Terms, General Term	47	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
43da588a-11cc-440f-baad-c40d1bf46695	b9e97456-8606-4841-a57a-6aae1bb13d8a	Binomial Theorem – Coefficient of Terms, Middle Term, Greatest Term	48	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b3ac89a0-bd8d-430c-94bd-cb58f1c4f7df	b9e97456-8606-4841-a57a-6aae1bb13d8a	Binomial Theorem – NGT and Special Formula	49	2027-01-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5549ffa5-bfc7-4949-aecb-8c0f762aaa00	b9e97456-8606-4841-a57a-6aae1bb13d8a	Binomial Theorem – PYQs and Doubts	50	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4a7cea1c-646f-4565-abb8-9ca15eea991f	b9e97456-8606-4841-a57a-6aae1bb13d8a	Probability – Random Experiments, Outcomes and Sample Space, Event, Occurrence of an Event	51	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9c497e35-8159-4441-9c39-8ffa5e76ab5c	b9e97456-8606-4841-a57a-6aae1bb13d8a	Probability – Types of Events, Algebra of Events	52	2027-02-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a2066e6c-734d-49dc-a840-8e020d1a8aef	b9e97456-8606-4841-a57a-6aae1bb13d8a	Probability – Axiomatic Approach to Probability	53	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
28e3034d-ca2e-4289-8878-8a813bfa45ab	b9e97456-8606-4841-a57a-6aae1bb13d8a	Probability – Probability (Advanced)	54	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e3b120b4-49e9-4177-aeae-48f8c169aacf	b9e97456-8606-4841-a57a-6aae1bb13d8a	Probability – Conditional Probability	55	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7f48ad90-2e7f-4f81-8e88-e85c42c46864	b9e97456-8606-4841-a57a-6aae1bb13d8a	Probability – Total Probability Theorem	56	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a9e24814-0e42-4a7e-a7e0-7cf6f1ab167f	b9e97456-8606-4841-a57a-6aae1bb13d8a	Probability – Bayes’ Theorem	57	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
16f11eba-945d-4280-bc3e-26a98d83c521	b9e97456-8606-4841-a57a-6aae1bb13d8a	Probability – Probability Distribution	58	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
950a92c5-31b5-4284-95e3-13f18080ba2a	b9e97456-8606-4841-a57a-6aae1bb13d8a	Probability – PYQs and Doubts	59	2027-02-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0e56ff29-cdd7-47cf-9417-d396792c195f	b9e97456-8606-4841-a57a-6aae1bb13d8a	Co-ordinate Geometry – Cartesian Coordinate System and Section Formula	60	2027-02-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
74ec763d-5600-4fc0-b636-16448d3ffdca	b9e97456-8606-4841-a57a-6aae1bb13d8a	Co-ordinate Geometry – Slope, Equation of Line, Angle Between Two Lines	61	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
54c219a4-4f78-4732-9bd1-81ddabd70808	b9e97456-8606-4841-a57a-6aae1bb13d8a	Co-ordinate Geometry – Various Forms of the Equation of a Line	62	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9e69a98a-6229-416e-9052-1957bf491cf7	b9e97456-8606-4841-a57a-6aae1bb13d8a	Co-ordinate Geometry – Distance of a Point From a Line	63	2027-02-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f30c6483-3595-43ae-8288-95255d7819c5	b9e97456-8606-4841-a57a-6aae1bb13d8a	Co-ordinate Geometry – Pairs of Straight Line and Miscellaneous	64	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c5f666a9-b8e8-4206-8100-64b23a348595	b9e97456-8606-4841-a57a-6aae1bb13d8a	Co-ordinate Geometry – Term Related to Triangles	65	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9040e2b9-4f1f-4e97-9e32-145589ff161b	b9e97456-8606-4841-a57a-6aae1bb13d8a	Co-ordinate Geometry – PYQs and Doubts	66	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9eec1512-062e-47a3-a883-4fdcdec580f6	b9e97456-8606-4841-a57a-6aae1bb13d8a	Conic Section – Basics of Circles	67	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c1b80701-d290-4975-868b-93e0e869ab9d	b9e97456-8606-4841-a57a-6aae1bb13d8a	Conic Section – Intersections of Circle and Parametric Form of Circle	68	2027-03-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
eb6e85c5-c159-4617-b2f6-f3215ff9a627	b9e97456-8606-4841-a57a-6aae1bb13d8a	Conic Section – Tangent and Normal of Circles	69	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
842fb7c8-20a2-4495-af04-ff168f7e1a30	b9e97456-8606-4841-a57a-6aae1bb13d8a	Conic Section – Introduction to Parabola and Standard Form	70	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
af65b1ec-6698-4584-a522-92ff41b60b51	b9e97456-8606-4841-a57a-6aae1bb13d8a	Conic Section – Shifting of Parabola	71	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e1fb76ff-13b5-4e78-96f5-5de55b6c9c84	b9e97456-8606-4841-a57a-6aae1bb13d8a	Conic Section – Ellipse	72	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
707515e4-d167-403e-af98-dae116e8c998	b9e97456-8606-4841-a57a-6aae1bb13d8a	Conic Section – Hyperbola	73	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
428ef062-18f0-4498-93b9-5e15d9c5239d	b9e97456-8606-4841-a57a-6aae1bb13d8a	Conic Section – PYQs and Doubts	74	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6694d729-e4c2-4b1f-9881-7c90ec17912e	b9e97456-8606-4841-a57a-6aae1bb13d8a	Three Dimensional Geometry – Basics of Three Dimensional Geometry	75	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
803e6f4d-00f8-4ec8-8419-27b23aa8c114	b9e97456-8606-4841-a57a-6aae1bb13d8a	Limits and Derivatives – Basics of Limits	76	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0e7ae7af-6816-4d7a-8b98-0c0dd696c122	b9e97456-8606-4841-a57a-6aae1bb13d8a	Limits and Derivatives – Existence of Limits	77	2027-03-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
669a8cb6-e54c-468c-9a56-5f8d1287aeb2	b9e97456-8606-4841-a57a-6aae1bb13d8a	Limits and Derivatives – Limits and Evaluation of Limits	78	2027-03-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
287ac9f8-392b-4e03-8515-770139bc1643	b9e97456-8606-4841-a57a-6aae1bb13d8a	Limits and Derivatives – Derivatives	79	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6ebbaece-6311-4334-948c-94a2091b897c	b9e97456-8606-4841-a57a-6aae1bb13d8a	Limits and Derivatives – L’Hôpital Rule of Limit	80	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1b206b9c-c838-420b-b726-20c023a82220	b9e97456-8606-4841-a57a-6aae1bb13d8a	Limits and Derivatives – First Principle of Differentiation	81	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
99976558-8a18-4568-816b-7ba0aab0ddbc	b9e97456-8606-4841-a57a-6aae1bb13d8a	Limits and Derivatives – Chain Rule of Derivative	82	2027-03-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e654c205-caf4-48e1-81c8-8405e1bcb5e0	b9e97456-8606-4841-a57a-6aae1bb13d8a	Limits and Derivatives – Algebra of Derivative (Product and Division Rule)	83	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0fab6ce7-bc92-43e2-8cb4-b3f42cd48ba6	b9e97456-8606-4841-a57a-6aae1bb13d8a	Limits and Derivatives – Parametric Form of Derivative	84	2027-03-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5dc59d2f-5f64-4a12-ad62-c38f355d568e	b9e97456-8606-4841-a57a-6aae1bb13d8a	Limits and Derivatives – Logarithmic & Implicit Differentiation	85	2027-04-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
aabfd913-ef75-4e43-bd17-64e34326e34b	b9e97456-8606-4841-a57a-6aae1bb13d8a	Statistics	86	2027-04-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8d9254d3-aa0a-4666-aa34-3136179c8fe4	b9e97456-8606-4841-a57a-6aae1bb13d8a	Binary Numbers	87	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1951d41d-14f0-49c1-bd9f-6bccafd78379	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1e175df6-1b33-4849-8e08-b0f13dda4324	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Basic Mathematics	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6b80112d-c1e7-4d34-bd57-413436d254cd	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Units & Measurements (Errors + Dimensions)	3	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e06e943f-0ea5-4fc1-aaa7-839c6a9e4952	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Vector	4	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
006c781a-c1f7-4f74-aab1-af3096b387c3	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Motion in Straight Line	5	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3c18be82-c758-4ecc-9d59-88033e7d47c2	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Motion in Plane	6	2026-12-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f0c64054-d329-4f22-9f71-9b8b71e6a4c1	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Newton’s Laws of Motion (NLM)	7	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
602e195d-4b30-487b-b93b-98eee9e421e2	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Friction	8	2026-12-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1e390053-af4b-47c9-ac08-540e68510a74	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Work, Power & Energy (WPE)	9	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
41e5dad0-1bdc-4faf-b30c-b8f0412f7800	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Gravitation	10	2026-12-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7c89a694-83c5-4a1f-bb7d-c1377587d274	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Rotation (Basics)	11	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0b8e2307-7b74-4812-a3bb-28fc97c09679	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Mechanical Properties of Solids	12	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0527d398-a0aa-4d6c-a864-a9930eed8dd9	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Mechanical Properties of Fluids	13	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
91b9879e-87a7-4177-85ce-8a5582d2780e	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Heat & Thermal Properties	14	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
11863fe4-8715-45c7-aa69-139bbfb22c2c	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Thermodynamics + Kinetic Theory of Gases	15	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c1c5b1c3-7159-4e57-acd2-0b13b911e41a	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Simple Harmonic Motion (SHM)	16	2027-02-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
941a4e01-9ad1-40fe-8275-602920cd9f1e	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Waves & Sound	17	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
574a986c-3ffa-4749-b88d-31606acfec48	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Electrostatics	18	2027-02-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
70cce8aa-c95d-4cb7-9efb-0254920e9b2e	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Current Electricity	19	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b93dfb78-6877-4b95-9ac3-d7924e07b9ac	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Magnetism & Moving Charges	20	2027-03-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c283dd8a-29ff-466a-8dc6-0b77cc758c92	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Electromagnetic Induction (EMI) + AC	21	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5bd7b4f2-951e-4253-b068-a8cbfe30e949	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Ray Optics + Wave Optics	22	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bffb6cc7-2a34-4ec4-8a51-6e95b6d259ae	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Modern Physics	23	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
67777123-b9c9-47bf-880b-e6b4ff9baa1a	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	Semiconductor Electronics	24	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
520c5c2c-05a9-4ec3-87cd-9c1c40336efa	0a4a05bd-4b4b-4d86-aeb4-bb224baaa827	PYQ + Final Revision	25	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1ff47c41-3906-43fb-927e-9029c234ffea	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d22000ce-373b-4fdc-8f26-2916abbb625e	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	Physical Classification of Matter	2	2026-11-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
759556dc-432e-4c99-8c3e-0ffee067373c	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	Elements, Compounds and Mixtures	3	2026-11-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
57e4f803-fdb8-40c4-90b1-adf160228ccd	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	Structure of Atom	4	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f29405e2-5ca1-4530-9b67-f33283bf9e9c	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	Electronic Configuration	5	2026-12-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9d953222-6d9f-461c-a209-24dc646b54f3	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	Periodic Table	6	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
46a147bf-7e88-4479-a7a7-cf92ade3fedd	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	Chemical Bonding	7	2027-01-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
64a63f08-b7d9-4b97-80ca-b222f2f99e3e	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	Acids, Bases and Salts	8	2027-01-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
87ac6b55-4a9a-4445-b6f4-f89b892aaa62	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	Metals and Non-Metals	9	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
03e718f7-bef3-4051-a0c9-8cdb16677da1	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	The Iso Species and Carbon	10	2027-02-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9ac16954-4cc3-4714-830f-d150ce407f36	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	IUPAC Nomenclature and Types of Reactions	11	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8a476e21-9c34-46f8-9d61-369ead430350	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	Important Industrial Preparations, Corrosion, Water and Types of Hardness	12	2027-03-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
256059e8-a370-4c47-9caf-c78c5c2d6d9c	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	Mole Concept	13	2027-03-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b2f9e04a-ca36-4e0d-9b9c-990bddf7f80c	27c0fdf0-bdae-4ebe-bf95-69c24c3fefbf	Chemistry in Everyday Life	14	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ea4ff4cd-8507-4caa-95bf-23d8b376adcf	607b7030-b40c-4679-beb7-2e75e9d23dcc	Cell	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8986643d-663f-465c-bc1f-14c0a2e3a08e	607b7030-b40c-4679-beb7-2e75e9d23dcc	Animal Tissues	2	2026-11-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
935442ec-0d29-4384-b9d8-e82f12d285f8	607b7030-b40c-4679-beb7-2e75e9d23dcc	Plant Tissues	3	2026-11-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6eb26d54-90c3-4877-8080-4a31fdb876e8	607b7030-b40c-4679-beb7-2e75e9d23dcc	Life Processes	4	2026-12-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e884f25e-59c2-4828-985e-62055555077a	607b7030-b40c-4679-beb7-2e75e9d23dcc	Control and Coordination in Humans	5	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
074fa084-d815-4d31-9258-ad744cd48b6e	607b7030-b40c-4679-beb7-2e75e9d23dcc	Control and Coordination in Plants	6	2027-01-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f103e330-3ea5-4e84-87dd-329c01a8732b	607b7030-b40c-4679-beb7-2e75e9d23dcc	Reproduction – Introduction	7	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1898afbd-45f3-4c4d-8d92-bcd2692b375c	607b7030-b40c-4679-beb7-2e75e9d23dcc	Sexual Reproduction in Flowering Plants	8	2027-02-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0e387d8f-7d2b-46d4-ae55-53439b8517c4	607b7030-b40c-4679-beb7-2e75e9d23dcc	Human Reproduction	9	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b8e873fb-0f50-4c9a-b247-f084b83b03b9	607b7030-b40c-4679-beb7-2e75e9d23dcc	Diversity in Organisms	10	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0f3b91e9-354d-4e83-8a66-deb26558b8d9	607b7030-b40c-4679-beb7-2e75e9d23dcc	Human Health and Diseases	11	2027-03-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f65f295d-a85f-4f55-8f39-d507e9497207	607b7030-b40c-4679-beb7-2e75e9d23dcc	Important Vitamins and Minerals	12	2027-03-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
23873975-77c0-4fb2-8a15-a7757b6169a2	607b7030-b40c-4679-beb7-2e75e9d23dcc	Genetics	13	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
979d241a-669c-46f5-a528-5d6d5706be39	2c31c03e-133b-4893-b7ad-23958391635c	All About NDA Exam	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e3b207e9-fed9-4cc2-8199-22cdbb6fec58	2c31c03e-133b-4893-b7ad-23958391635c	Vocabulary	2	2026-11-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4b347be1-5ffe-451a-8125-061afd13dd77	2c31c03e-133b-4893-b7ad-23958391635c	Noun	3	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
217c866a-7ef3-4c4e-968c-afba84f41167	2c31c03e-133b-4893-b7ad-23958391635c	Pronoun	4	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ef221e88-ed7c-45e2-81ac-069ff9d122d4	2c31c03e-133b-4893-b7ad-23958391635c	Idioms and Phrases	5	2026-12-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c5df8d19-afc7-4dde-93b8-88438dc76a3e	2c31c03e-133b-4893-b7ad-23958391635c	Conjunction	6	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c3ef82a0-f424-48e7-8727-ba1bd410f1ff	2c31c03e-133b-4893-b7ad-23958391635c	Adjective	7	2026-12-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
04eb8445-f815-4cf8-94a3-0f182f3e3323	2c31c03e-133b-4893-b7ad-23958391635c	Adverb	8	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8a9229ab-a534-4239-916a-81834834acec	2c31c03e-133b-4893-b7ad-23958391635c	Preposition	9	2026-12-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3966ba01-6fb6-4118-9676-20173fd56a00	2c31c03e-133b-4893-b7ad-23958391635c	Fixed Preposition	10	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
22f87d85-e586-499a-b1e7-1d0cc82aebbb	2c31c03e-133b-4893-b7ad-23958391635c	Articles	11	2027-01-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cc3a25ae-308e-4e6b-9c81-77e933b7c021	2c31c03e-133b-4893-b7ad-23958391635c	Sentence Arrangement	12	2027-01-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a063b389-982b-4450-8625-151f7925009f	2c31c03e-133b-4893-b7ad-23958391635c	Verb	13	2027-01-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
22d7e31c-ce4f-4f9a-bcf9-0114ec7d94d1	2c31c03e-133b-4893-b7ad-23958391635c	Tense	14	2027-01-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
048ce0e5-5d38-4ae3-8015-404f926946c2	2c31c03e-133b-4893-b7ad-23958391635c	Conditional Sentences	15	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
788045fb-bed4-4e62-a551-18dd997b9e5a	2c31c03e-133b-4893-b7ad-23958391635c	Question Tag	16	2027-02-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0b5e4120-382a-480e-a43d-3890d0ee687a	2c31c03e-133b-4893-b7ad-23958391635c	Voice	17	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7d00ffaf-f65a-4215-9640-e9bf09b39224	2c31c03e-133b-4893-b7ad-23958391635c	Narration	18	2027-02-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1d295943-c9bc-4d63-ac94-44b854f66de3	2c31c03e-133b-4893-b7ad-23958391635c	Modals	19	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a713deee-e55d-4fc2-8701-39b45af000d9	2c31c03e-133b-4893-b7ad-23958391635c	Passage	20	2027-03-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b7fa3757-a33f-43ee-966c-bb73650866e7	2c31c03e-133b-4893-b7ad-23958391635c	Cloze Test	21	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
93ed04b3-98e9-428f-847b-921d1b8d6dc7	2c31c03e-133b-4893-b7ad-23958391635c	Previous Year Questions	22	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7f3b0a2f-df8b-464e-8aca-d3a274e68384	2c31c03e-133b-4893-b7ad-23958391635c	Homophones	23	2027-03-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7b9a4398-16d6-4a0e-b843-5882a0dc8653	2c31c03e-133b-4893-b7ad-23958391635c	Important Miscellaneous Questions	24	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ab181a3e-72d6-4810-b8a9-0f9293639416	ee3d6099-911f-4697-a1c2-a2b18fe2dbe5	November	3	2027-01-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e71a30ac-1749-4538-adb2-dcbce711c7f6	ee3d6099-911f-4697-a1c2-a2b18fe2dbe5	December	4	2027-02-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
da6171ab-2755-4ce9-a9e1-964c8eeedf35	ee3d6099-911f-4697-a1c2-a2b18fe2dbe5	January	5	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dab2138a-16ff-490c-9106-c4e088f91772	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
85e3ab00-83b3-467c-9a8b-cf27ace2b75f	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Origin of Human	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a0470591-e8e1-4b6e-a63a-6f641b77b674	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Indus Valley Civilization	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
66d1a80c-c1cc-4c5a-bb9f-d2eba5f1c4dd	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Vedic Civilization	4	2026-11-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5e0e4a65-6e7f-468a-a6db-6d009bbb02cc	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Religious Movement	5	2026-11-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
88976fb0-28d0-4d4a-803a-05401a5c9a07	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Mahajanapadas / Foreign Invasions	6	2026-11-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e7ce7493-acbb-46d9-b203-9b15bcf17b59	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Mauryan Empire	7	2026-12-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
537634bd-e683-44f3-bf7a-7a7b08bce995	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Post Mauryan Age	8	2026-12-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5e0339b9-a4b7-4a1c-8ed8-bebe27139118	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Sangam Era	9	2026-12-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
952b43c8-4321-449e-a3a9-13f87338d017	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Gupta Empire	10	2026-12-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
57066d15-6e24-44ff-b3e2-cca7184b5356	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Post Gupta Age	11	2026-12-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0acee056-0a06-4975-b072-10324176e3ae	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Rajput Period	12	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1e31ee8c-24e6-4173-be07-938a8df293c3	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Chola Empire	13	2026-12-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
687454dc-46a8-4330-b9da-484aad8613c1	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Delhi Sultanate	14	2027-01-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
67e6fa73-e371-4d8a-8b4f-b6f677141122	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Vijaynagar Empire	15	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ec451344-a82f-44a2-bedd-b13ec19f165e	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Bahamani Empire	16	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
80245def-84a2-40de-8eb1-bc4b30842481	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Bhakti Movement	17	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e8f68eb3-e9fd-4f75-9902-f96f557798ba	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Sufi Movement	18	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
13e1c135-0ecb-41ea-b284-29901c2c0ffe	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Rise of Mughals	19	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b9b6ba15-8556-44f0-a04a-e5063e587aab	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Expansion of Mughal Empire	20	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0c1340de-4921-4d8f-bbc5-21d235f3f913	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Aurangzeb and Decline of Mughals	21	2027-02-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
82005fb4-29ce-4408-aa00-563b6acc443f	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Later Mughals	22	2027-02-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0fc63348-f5bc-47b3-ac18-5166b39e3126	d2e7b350-4ecf-4607-acd5-0626fcf5192c	The Rise of Maratha Empire under Shivaji	23	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
22b4b054-60e5-4df6-83aa-f9b33df67954	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Peshwa and Third Battle of Panipat	24	2027-02-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7ea2faae-623e-4fa9-92e2-aa5b0ab16d96	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Arrival of Europeans in India	25	2027-02-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6c2b53e0-5811-44c8-847b-e861a8a04e51	d2e7b350-4ecf-4607-acd5-0626fcf5192c	British Conquest in India	26	2027-02-27	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c1780d0f-4a90-4ad8-8cd5-c309c957a667	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Early Revolts Against British Rule	27	2027-03-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dbdc3e22-b97e-4b93-bfaf-bd5a668d9004	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Indian Renaissance	28	2027-03-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
687c0336-a853-4774-abf0-9f08fdc65f8b	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Rise of British Rule	29	2027-03-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bbf6ebf4-abe3-4514-a7b8-5971962b5ad5	d2e7b350-4ecf-4607-acd5-0626fcf5192c	British Rule	30	2027-03-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
447e5cb4-6ae1-422c-876b-aa99624245a4	d2e7b350-4ecf-4607-acd5-0626fcf5192c	The Revolt of 1857	31	2027-03-22	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b78dcf41-2d09-42ae-a5c5-98a5b16b5f5c	d2e7b350-4ecf-4607-acd5-0626fcf5192c	Crown Rule	32	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
571a1df3-1ccb-45bb-956b-7fe4afc2849d	d2e7b350-4ecf-4607-acd5-0626fcf5192c	National Movement	33	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
6955e64c-e99d-4f5a-9026-c3fe1e3a3d81	d2e7b350-4ecf-4607-acd5-0626fcf5192c	World History	34	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1a9c04ae-69a9-4883-8b13-297237ead989	33e66595-9958-4f01-acd4-4e74c90494af	Introduction	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
466361ce-8825-406a-9d7c-86622fd82455	33e66595-9958-4f01-acd4-4e74c90494af	Basics of Polity	2	2026-11-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
851e9fd9-2b7a-487d-b823-5a2f929b24ac	33e66595-9958-4f01-acd4-4e74c90494af	Constitutional Development	3	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4df5c5cf-0930-4d1b-b7c4-748ad385878a	33e66595-9958-4f01-acd4-4e74c90494af	Making of Constitution	4	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d416a849-b575-48dd-a0b1-ea01dbd99af2	33e66595-9958-4f01-acd4-4e74c90494af	Features and Preamble of Constitution	5	2026-12-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
697ef75c-f7df-4a59-92c7-315bfa49b617	33e66595-9958-4f01-acd4-4e74c90494af	Union and Its Territories	6	2026-12-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ebde132f-1bc6-4747-90eb-902d7e2c4f6c	33e66595-9958-4f01-acd4-4e74c90494af	Citizenship	7	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ab4cd1ea-7db7-4354-a88d-5aef6c4ce106	33e66595-9958-4f01-acd4-4e74c90494af	Fundamental Rights	8	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a1f850d8-c902-4b82-b168-087fe9453f17	33e66595-9958-4f01-acd4-4e74c90494af	Directive Principles of State Policy	9	2027-01-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0d21f472-57a2-4b8a-b5a4-9a80aafaf436	33e66595-9958-4f01-acd4-4e74c90494af	Fundamental Duties	10	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c0ce5446-29ca-4686-8ecd-fba734b8bc45	33e66595-9958-4f01-acd4-4e74c90494af	Parliament	11	2027-01-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
86f196d2-b418-4a58-87b1-bd1301cc565f	33e66595-9958-4f01-acd4-4e74c90494af	President	12	2027-01-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1567b9c3-6221-4adf-b2d0-080c95bc9a3b	33e66595-9958-4f01-acd4-4e74c90494af	Vice President	13	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
09578d7f-47ff-44fd-9e11-a01a0d5036c9	33e66595-9958-4f01-acd4-4e74c90494af	State Legislature	14	2027-02-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
60e62c3f-b292-4ab8-8f44-1d00336b4f14	33e66595-9958-4f01-acd4-4e74c90494af	Governor	15	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
43257d80-94db-4b8c-9892-ac4c03f3596e	33e66595-9958-4f01-acd4-4e74c90494af	Supreme Court	16	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5c67d75d-d80d-484e-a978-4cf261ee27c5	33e66595-9958-4f01-acd4-4e74c90494af	High Court	17	2027-02-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e2f29ba8-50fc-40e7-a44d-a8e49e6acdd5	33e66595-9958-4f01-acd4-4e74c90494af	Emergency	18	2027-03-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e651f567-0db9-4e91-b0aa-4358956434b9	33e66595-9958-4f01-acd4-4e74c90494af	Local Self Government	19	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
5a9dbcfa-6977-4c12-8caa-3b74c395db2f	33e66595-9958-4f01-acd4-4e74c90494af	Constitutional Bodies	20	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
96583e41-131e-4521-a222-c679a225b620	33e66595-9958-4f01-acd4-4e74c90494af	Important Amendments	21	2027-03-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b1114641-bb64-4aa6-b1d0-59c25a14ffc7	33e66595-9958-4f01-acd4-4e74c90494af	Miscellaneous	22	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
7971e256-8d00-4675-a66b-07ee9d6c6a5f	11c78503-6e03-440a-9533-0c8314dd82c2	Introduction to SSB Process	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2c2b3209-5dd1-4267-8d6a-e8fe0bc8bb7f	11c78503-6e03-440a-9533-0c8314dd82c2	OIR Lectures	2	2026-11-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cd146386-6daa-49a8-8ecf-ca8b70e45c99	11c78503-6e03-440a-9533-0c8314dd82c2	PPDT: Story Writing	3	2026-11-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
df9e696e-d857-4e4f-83b0-d0f761ccd43e	11c78503-6e03-440a-9533-0c8314dd82c2	PPDT: Narration & Group Discussion	4	2026-12-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
64cf72e3-3217-4f36-9e59-08b0c1ed70d2	11c78503-6e03-440a-9533-0c8314dd82c2	Introduction to GTO & Its Importance	5	2026-12-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c340045c-d981-4485-abdb-6ac7170acfae	11c78503-6e03-440a-9533-0c8314dd82c2	Group Tasks: GD + GPE	6	2026-12-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0a6e723e-6764-49ab-8a68-99cc6e186882	11c78503-6e03-440a-9533-0c8314dd82c2	Group Tasks: Individual Obstacles (IO) & Group Obstacle Race (GOR)	7	2027-01-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bfa5723c-a028-47e8-9364-676f0795d7fd	11c78503-6e03-440a-9533-0c8314dd82c2	Group Tasks: PGT/HGT/CT/FGT	8	2027-01-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f3dc6e47-7eaa-41ff-8f5f-51a03b992997	11c78503-6e03-440a-9533-0c8314dd82c2	Introduction to Lecturette	9	2027-01-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
0d82ad58-f34e-4a96-88f7-96b7e6d563be	11c78503-6e03-440a-9533-0c8314dd82c2	Introduction to Psychological Tests	10	2027-02-03	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
651d7516-fd14-4ba1-99c9-6be61fb794ea	11c78503-6e03-440a-9533-0c8314dd82c2	Thematic Apperception Test	11	2027-02-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
038293e3-e68a-4a21-b153-51c499fd3d55	11c78503-6e03-440a-9533-0c8314dd82c2	Word Association Test	12	2027-02-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
00125a45-d6f5-4249-a662-6ecc55b3f70b	11c78503-6e03-440a-9533-0c8314dd82c2	Situation Reaction Test	13	2027-03-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
34f078cd-4a13-4f6a-96d1-9144b714b6a9	11c78503-6e03-440a-9533-0c8314dd82c2	Self Description Test	14	2027-03-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
27e44d6e-ff96-477b-809c-660d09ec59d3	11c78503-6e03-440a-9533-0c8314dd82c2	Introduction to Personal Interview & Understanding PIQ Form	15	2027-03-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
36ab6f76-cb74-4241-a42a-67e4f9d87ea5	11c78503-6e03-440a-9533-0c8314dd82c2	Introduction to CPSS (AFSB)	16	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9a2c1616-2db2-46c4-9b7d-321d6b958de6	fb7009ce-347d-4ab5-a91d-c824e8b6a011	Basics of Economics	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4c2491da-ad33-4ffa-937d-665b8817f6eb	fb7009ce-347d-4ab5-a91d-c824e8b6a011	Types of Economy	2	2026-11-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
dcea08c5-232b-452b-b16c-9b59af10e765	fb7009ce-347d-4ab5-a91d-c824e8b6a011	Planning in India	3	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
8d0bb2de-b08a-4b1a-abc5-0051373edf53	fb7009ce-347d-4ab5-a91d-c824e8b6a011	Five Year Plans	4	2027-01-08	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
11594eb1-ffbd-48aa-8549-a8b1606677a2	fb7009ce-347d-4ab5-a91d-c824e8b6a011	Money	5	2027-01-30	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
e78d7240-0b22-4dc7-b4f5-3d734b58a03b	fb7009ce-347d-4ab5-a91d-c824e8b6a011	Banking	6	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
c48e742b-e647-4795-99d1-9cde33b1d821	fb7009ce-347d-4ab5-a91d-c824e8b6a011	Current Budget	7	2027-03-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a8065101-8951-4566-8ca2-f702e8b9d981	fb7009ce-347d-4ab5-a91d-c824e8b6a011	International Institutions	8	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
89b8c1a8-f220-46b5-92d1-9e34d63d3560	751ab330-68b6-4d4e-8c0b-87a9440d0119	Introduction of Geography & Syllabus	1	2026-11-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
b611885a-312d-41e0-ac2d-9838bec6913e	751ab330-68b6-4d4e-8c0b-87a9440d0119	Universe and Cosmology	2	2026-11-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
ef0ddaa4-89d4-42dd-acc4-75a8719a3223	751ab330-68b6-4d4e-8c0b-87a9440d0119	Solar System	3	2026-11-14	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
4a96e9e4-3ae4-4554-b445-82d3a02b79b4	751ab330-68b6-4d4e-8c0b-87a9440d0119	Earth, Latitude & Longitude	4	2026-11-19	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
35e199d4-c26f-4177-b7a8-34dc38da21bf	751ab330-68b6-4d4e-8c0b-87a9440d0119	Interior of the Earth	5	2026-11-24	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2075cf4b-6914-47fc-8430-6aeb199f139d	751ab330-68b6-4d4e-8c0b-87a9440d0119	Formation of the Continents & Rocks	6	2026-11-29	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
665954ae-a6e2-4505-a930-7a72d61c26c9	751ab330-68b6-4d4e-8c0b-87a9440d0119	Plate Tectonics	7	2026-12-04	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2fc52211-a843-47fc-80c3-b77e631448e3	751ab330-68b6-4d4e-8c0b-87a9440d0119	Geomorphic Process (Endogenetic & Exogenetic)	8	2026-12-09	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
71446ba8-577e-47ef-9493-9cb037f46fee	751ab330-68b6-4d4e-8c0b-87a9440d0119	Formation of Mountains, Plateaus & Plains	9	2026-12-13	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9a877ad3-c0c5-46f8-8715-dc4e77cef032	751ab330-68b6-4d4e-8c0b-87a9440d0119	Volcanos, Earthquake & Tsunami	10	2026-12-18	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d30e2e5f-0e97-4ed9-941b-d4ad7919f476	751ab330-68b6-4d4e-8c0b-87a9440d0119	Composition & Structure of Atmosphere	11	2026-12-23	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
187f2440-bb3a-47ce-ae0d-6430ea5738cd	751ab330-68b6-4d4e-8c0b-87a9440d0119	Earth Temperature & Atmospheric Pressure	12	2026-12-28	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
74c51709-2bb6-4043-96d7-d1afeb0d75e5	751ab330-68b6-4d4e-8c0b-87a9440d0119	Temperature Zones, Pressure Belts & Winds	13	2027-01-02	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
99d6d7d5-e46a-4646-ba69-1b48a6f54ae3	751ab330-68b6-4d4e-8c0b-87a9440d0119	Climate & Weather	14	2027-01-07	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
fe77c6f0-f765-47e2-b52f-1ec845aeb0d2	751ab330-68b6-4d4e-8c0b-87a9440d0119	Precipitation, Cloud, Jet Stream & Cyclones	15	2027-01-12	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
9f7a47d2-5a82-484b-b4c0-51c337f9c0cd	751ab330-68b6-4d4e-8c0b-87a9440d0119	Ocean & Ocean Relief Features	16	2027-01-17	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f2a86139-4cbc-4042-a645-0d0527e53396	751ab330-68b6-4d4e-8c0b-87a9440d0119	Ocean Water Properties, Waves, Current & Tides	17	2027-01-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
60d32c6f-7131-466d-9981-fc1f1a7e9501	751ab330-68b6-4d4e-8c0b-87a9440d0119	Other Water Bodies & Formations	18	2027-01-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
d72f180e-b3fe-461f-8c66-2cf84b65237f	751ab330-68b6-4d4e-8c0b-87a9440d0119	World Facts About Continents	19	2027-01-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
a612d99b-3428-450f-9d9e-fd32651d4ea9	751ab330-68b6-4d4e-8c0b-87a9440d0119	Soil, Natural Vegetation & Types	20	2027-02-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
f9068fd7-2943-487a-bd94-f04942d0d39e	751ab330-68b6-4d4e-8c0b-87a9440d0119	Physiography of India	21	2027-02-10	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
42d681d4-6247-4bbd-8a52-fa3d4d688696	751ab330-68b6-4d4e-8c0b-87a9440d0119	Indian Mountains	22	2027-02-15	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2e8331da-e464-4c0d-88d2-7f8714546ccc	751ab330-68b6-4d4e-8c0b-87a9440d0119	Indian Plateau & Coastal Regions (Ghats)	23	2027-02-20	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3c15c17a-e252-41b3-9f02-b0eacc31124f	751ab330-68b6-4d4e-8c0b-87a9440d0119	Plainland, Desert & Islands	24	2027-02-25	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
1f1da12c-28f3-4e1b-b824-96326b042b08	751ab330-68b6-4d4e-8c0b-87a9440d0119	Drainage System (Northern)	25	2027-03-01	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
196fd4be-b5bc-4697-b750-003611f035ee	751ab330-68b6-4d4e-8c0b-87a9440d0119	Drainage System (Peninsula)	26	2027-03-06	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
094d7a48-12d5-4d73-9dab-e6d2af24cd8f	751ab330-68b6-4d4e-8c0b-87a9440d0119	Indian Climate & Monsoon	27	2027-03-11	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
2e35633d-41e6-4d9a-b29c-5f98463051f5	751ab330-68b6-4d4e-8c0b-87a9440d0119	Vegetation & Forest	28	2027-03-16	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
30952c12-c8c1-4617-98c1-45dd1da3b21e	751ab330-68b6-4d4e-8c0b-87a9440d0119	India Soil & Agriculture (Crops)	29	2027-03-21	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
bff7ace7-f0bc-483d-8928-4066d27c2a21	751ab330-68b6-4d4e-8c0b-87a9440d0119	Minerals, Energy & Industry	30	2027-03-26	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
cf9b8175-275f-4212-bc99-e357127b8167	751ab330-68b6-4d4e-8c0b-87a9440d0119	Transportation	31	2027-03-31	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
3bab335c-9b14-44fa-9a37-89d099caedb8	751ab330-68b6-4d4e-8c0b-87a9440d0119	Practice Session	32	2027-04-05	NDA Foundation 2027 Comprehensive Module	2026-11-04 10:40:08.924969+00
\.


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: class_codes class_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_codes
    ADD CONSTRAINT class_codes_pkey PRIMARY KEY (id);


--
-- Name: course_settings course_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_settings
    ADD CONSTRAINT course_settings_pkey PRIMARY KEY (course_id);


--
-- Name: courses courses_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_code_key UNIQUE (code);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (student_id, course_id);


--
-- Name: entries entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: students students_roll_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_roll_no_key UNIQUE (roll_no);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: teacher_subjects teacher_subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teacher_subjects
    ADD CONSTRAINT teacher_subjects_pkey PRIMARY KEY (teacher_id, subject_id);


--
-- Name: teachers teachers_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_name_unique UNIQUE (name);


--
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);


--
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


--
-- Name: entries unique_student_topic_date; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT unique_student_topic_date UNIQUE (student_id, topic_id, class_date);


--
-- Name: idx_audit_log_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_log_created_at ON public.audit_log USING btree (created_at DESC);


--
-- Name: idx_class_codes_course_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_class_codes_course_date ON public.class_codes USING btree (course_id, class_date);


--
-- Name: idx_enrollments_course; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_enrollments_course ON public.enrollments USING btree (course_id);


--
-- Name: idx_entries_course_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entries_course_date ON public.entries USING btree (course_id, class_date);


--
-- Name: idx_entries_review_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entries_review_status ON public.entries USING btree (review_status);


--
-- Name: idx_entries_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entries_student ON public.entries USING btree (student_id);


--
-- Name: idx_entries_teacher; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entries_teacher ON public.entries USING btree (teacher_id);


--
-- Name: idx_entries_topic; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entries_topic ON public.entries USING btree (topic_id);


--
-- Name: idx_subjects_course_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subjects_course_id ON public.subjects USING btree (course_id);


--
-- Name: idx_topics_subject_id_seq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_topics_subject_id_seq ON public.topics USING btree (subject_id, seq_no);


--
-- Name: class_codes class_codes_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_codes
    ADD CONSTRAINT class_codes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_settings course_settings_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_settings
    ADD CONSTRAINT course_settings_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: entries entries_class_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_class_code_id_fkey FOREIGN KEY (class_code_id) REFERENCES public.class_codes(id) ON DELETE SET NULL;


--
-- Name: entries entries_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: entries entries_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: entries entries_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: entries entries_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;


--
-- Name: entries entries_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;


--
-- Name: subjects subjects_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: teacher_subjects teacher_subjects_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teacher_subjects
    ADD CONSTRAINT teacher_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: teacher_subjects teacher_subjects_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teacher_subjects
    ADD CONSTRAINT teacher_subjects_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;


--
-- Name: topics topics_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: class_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.class_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: course_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.course_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: courses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log no_direct_audit_log; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY no_direct_audit_log ON public.audit_log USING (false);


--
-- Name: class_codes no_direct_class_codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY no_direct_class_codes ON public.class_codes USING (false);


--
-- Name: courses no_direct_courses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY no_direct_courses ON public.courses USING (false);


--
-- Name: enrollments no_direct_enrollments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY no_direct_enrollments ON public.enrollments USING (false);


--
-- Name: entries no_direct_entries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY no_direct_entries ON public.entries USING (false);


--
-- Name: course_settings no_direct_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY no_direct_settings ON public.course_settings USING (false);


--
-- Name: students no_direct_students; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY no_direct_students ON public.students USING (false);


--
-- Name: subjects no_direct_subjects; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY no_direct_subjects ON public.subjects USING (false);


--
-- Name: teacher_subjects no_direct_teacher_subjects; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY no_direct_teacher_subjects ON public.teacher_subjects USING (false);


--
-- Name: teachers no_direct_teachers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY no_direct_teachers ON public.teachers USING (false);


--
-- Name: topics no_direct_topics; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY no_direct_topics ON public.topics USING (false);


--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- Name: subjects; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

--
-- Name: teacher_subjects; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;

--
-- Name: teachers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

--
-- Name: topics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict IflDf7AJt2qRHPlZwxx2sYuHEJkrPxXHflbG7cz8HnCWoRl6odXPtAlXcZNgiuZ

