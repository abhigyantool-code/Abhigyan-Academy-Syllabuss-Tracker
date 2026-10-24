--
-- PostgreSQL database dump
--

\restrict i5qYaZnkIPSuDCVOV1L4RvIa8jg6iqiqrIZGKVGJ6VZNfMYfg7v9lRxYgusL19b

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
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.audit_log VALUES ('0fbd0d71-c576-440e-9a40-ba124b058757', 'System Initializer', 'SEED_DATABASE', 'system', NULL, NULL, '{"date": "2026-10-24", "courses": 4, "students": 10, "teachers": 3}', '2026-10-24 08:20:45.289536+00');


--
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.courses VALUES ('f552f044-2ec4-4939-b955-6ffacd22099a', 'National Defence Academy (NDA)', 'NDA', 1, true, '2026-10-24 08:20:44.966144+00');
INSERT INTO public.courses VALUES ('1c7c7590-4326-40da-8db2-b1709d1c2474', 'Combined Defence Services (CDS)', 'CDS', 2, true, '2026-10-24 08:20:44.980878+00');
INSERT INTO public.courses VALUES ('b95e3216-28bd-4641-b4d2-10efee8c4574', 'Services Selection Board (SSB Interview)', 'SSB', 3, true, '2026-10-24 08:20:44.99072+00');
INSERT INTO public.courses VALUES ('595ad6e9-7789-4a21-bdab-7d50505cf911', 'Staff Selection Commission (SSC)', 'SSC', 4, true, '2026-10-24 08:20:44.994154+00');


--
-- Data for Name: class_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.class_codes VALUES ('3757a7d2-bfa6-48c1-b477-25eb0c2ddb5e', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'Alpha', '2026-10-24', 'NDA-942', '2026-10-24 08:15:45.218+00', '2026-10-25 08:20:45.218+00', '2026-10-24 08:20:45.219474+00');
INSERT INTO public.class_codes VALUES ('237e42eb-91ac-44a7-bf06-2c3f5766a135', '1c7c7590-4326-40da-8db2-b1709d1c2474', 'Alpha', '2026-10-24', 'CDS-318', '2026-10-24 08:15:45.218+00', '2026-10-25 08:20:45.218+00', '2026-10-24 08:20:45.222224+00');
INSERT INTO public.class_codes VALUES ('af1ffc08-c9c2-42fc-83d7-15dfd0c01fd6', 'b95e3216-28bd-4641-b4d2-10efee8c4574', 'Alpha', '2026-10-24', 'SSB-550', '2026-10-24 08:15:45.218+00', '2026-10-25 08:20:45.218+00', '2026-10-24 08:20:45.224192+00');
INSERT INTO public.class_codes VALUES ('927e787b-eb27-43f7-8f32-954b2792a192', '595ad6e9-7789-4a21-bdab-7d50505cf911', 'Alpha', '2026-10-24', 'SSC-721', '2026-10-24 08:15:45.218+00', '2026-10-25 08:20:45.218+00', '2026-10-24 08:20:45.22621+00');


--
-- Data for Name: course_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.course_settings VALUES ('f552f044-2ec4-4939-b955-6ffacd22099a', 5, 6, 120, true, '2026-10-24 08:20:44.974645+00');
INSERT INTO public.course_settings VALUES ('1c7c7590-4326-40da-8db2-b1709d1c2474', 4, 6, 120, true, '2026-10-24 08:20:44.988924+00');
INSERT INTO public.course_settings VALUES ('b95e3216-28bd-4641-b4d2-10efee8c4574', 3, 6, 120, false, '2026-10-24 08:20:44.992378+00');
INSERT INTO public.course_settings VALUES ('595ad6e9-7789-4a21-bdab-7d50505cf911', 5, 6, 120, true, '2026-10-24 08:20:45.000594+00');


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.students VALUES ('37a00a36-0700-49e0-9333-30f3d610b388', 'ABG-2026-001', 'Aarav Mehta', NULL, true, '2026-10-24 08:20:45.137513+00');
INSERT INTO public.students VALUES ('d9cce80e-95ae-4b12-bd65-c6a22396bc86', 'ABG-2026-002', 'Rohit Chauhan', NULL, true, '2026-10-24 08:20:45.13996+00');
INSERT INTO public.students VALUES ('0a1ed3b0-38ae-432e-9311-b9a41886eeff', 'ABG-2026-003', 'Ananya Deshmukh', NULL, true, '2026-10-24 08:20:45.141378+00');
INSERT INTO public.students VALUES ('4f382c3a-5f4e-448c-9c26-452502345545', 'ABG-2026-004', 'Siddharth Nair', NULL, true, '2026-10-24 08:20:45.142862+00');
INSERT INTO public.students VALUES ('edec6661-676c-403f-96d5-13899b5db06c', 'ABG-2026-005', 'Priya Rathore', NULL, true, '2026-10-24 08:20:45.144723+00');
INSERT INTO public.students VALUES ('ead1238e-d968-4a47-820b-1b29e1159a6e', 'ABG-2026-006', 'Devansh Rawat', NULL, true, '2026-10-24 08:20:45.147449+00');
INSERT INTO public.students VALUES ('b36395d9-f794-490b-a15e-b75bf5cadf85', 'ABG-2026-007', 'Tanvi Joshi', NULL, true, '2026-10-24 08:20:45.150096+00');
INSERT INTO public.students VALUES ('c8aa7da9-47a0-4d66-863a-694bb9694f6e', 'ABG-2026-008', 'Harshvardhan Rana', NULL, true, '2026-10-24 08:20:45.152033+00');
INSERT INTO public.students VALUES ('6fb822ed-d00c-4afa-a7b5-4a089b2823f5', 'ABG-2026-009', 'Ishita Saxena', NULL, true, '2026-10-24 08:20:45.153802+00');
INSERT INTO public.students VALUES ('5cc49413-2fec-4d80-819e-deaf0d458202', 'ABG-2026-010', 'Karan Thapa', NULL, true, '2026-10-24 08:20:45.155433+00');


--
-- Data for Name: enrollments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.enrollments VALUES ('37a00a36-0700-49e0-9333-30f3d610b388', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'Alpha-Batch');
INSERT INTO public.enrollments VALUES ('d9cce80e-95ae-4b12-bd65-c6a22396bc86', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'Alpha-Batch');
INSERT INTO public.enrollments VALUES ('0a1ed3b0-38ae-432e-9311-b9a41886eeff', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'Alpha-Batch');
INSERT INTO public.enrollments VALUES ('4f382c3a-5f4e-448c-9c26-452502345545', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'Alpha-Batch');
INSERT INTO public.enrollments VALUES ('edec6661-676c-403f-96d5-13899b5db06c', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'Alpha-Batch');
INSERT INTO public.enrollments VALUES ('ead1238e-d968-4a47-820b-1b29e1159a6e', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'Alpha-Batch');
INSERT INTO public.enrollments VALUES ('4f382c3a-5f4e-448c-9c26-452502345545', '1c7c7590-4326-40da-8db2-b1709d1c2474', 'Bravo-Batch');
INSERT INTO public.enrollments VALUES ('edec6661-676c-403f-96d5-13899b5db06c', '1c7c7590-4326-40da-8db2-b1709d1c2474', 'Bravo-Batch');
INSERT INTO public.enrollments VALUES ('ead1238e-d968-4a47-820b-1b29e1159a6e', '1c7c7590-4326-40da-8db2-b1709d1c2474', 'Bravo-Batch');
INSERT INTO public.enrollments VALUES ('b36395d9-f794-490b-a15e-b75bf5cadf85', '1c7c7590-4326-40da-8db2-b1709d1c2474', 'Bravo-Batch');
INSERT INTO public.enrollments VALUES ('c8aa7da9-47a0-4d66-863a-694bb9694f6e', '1c7c7590-4326-40da-8db2-b1709d1c2474', 'Bravo-Batch');
INSERT INTO public.enrollments VALUES ('37a00a36-0700-49e0-9333-30f3d610b388', 'b95e3216-28bd-4641-b4d2-10efee8c4574', 'SSB-Batch-1');
INSERT INTO public.enrollments VALUES ('d9cce80e-95ae-4b12-bd65-c6a22396bc86', 'b95e3216-28bd-4641-b4d2-10efee8c4574', 'SSB-Batch-1');
INSERT INTO public.enrollments VALUES ('b36395d9-f794-490b-a15e-b75bf5cadf85', 'b95e3216-28bd-4641-b4d2-10efee8c4574', 'SSB-Batch-1');
INSERT INTO public.enrollments VALUES ('c8aa7da9-47a0-4d66-863a-694bb9694f6e', 'b95e3216-28bd-4641-b4d2-10efee8c4574', 'SSB-Batch-1');
INSERT INTO public.enrollments VALUES ('b36395d9-f794-490b-a15e-b75bf5cadf85', '595ad6e9-7789-4a21-bdab-7d50505cf911', 'SSC-General');
INSERT INTO public.enrollments VALUES ('c8aa7da9-47a0-4d66-863a-694bb9694f6e', '595ad6e9-7789-4a21-bdab-7d50505cf911', 'SSC-General');
INSERT INTO public.enrollments VALUES ('6fb822ed-d00c-4afa-a7b5-4a089b2823f5', '595ad6e9-7789-4a21-bdab-7d50505cf911', 'SSC-General');
INSERT INTO public.enrollments VALUES ('5cc49413-2fec-4d80-819e-deaf0d458202', '595ad6e9-7789-4a21-bdab-7d50505cf911', 'SSC-General');


--
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subjects VALUES ('6bd29f85-f263-4404-beaa-f0d68519092d', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'Mathematics', 1, '2026-10-24 08:20:45.011359+00');
INSERT INTO public.subjects VALUES ('bde4b87c-9a48-45c0-9298-6391163569cc', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'General Ability Test (GAT) - English', 2, '2026-10-24 08:20:45.04373+00');
INSERT INTO public.subjects VALUES ('73e9f655-a85a-450b-bf6d-9bfb4d6e54b4', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'General Ability Test (GAT) - Physics', 3, '2026-10-24 08:20:45.056558+00');
INSERT INTO public.subjects VALUES ('7a6128ef-a974-48d8-b4e7-2f2b54754928', '1c7c7590-4326-40da-8db2-b1709d1c2474', 'Elementary Mathematics', 1, '2026-10-24 08:20:45.069059+00');
INSERT INTO public.subjects VALUES ('28dd8d2e-d292-40f5-9bd3-b2c6b56fd0ea', '1c7c7590-4326-40da-8db2-b1709d1c2474', 'English Language', 2, '2026-10-24 08:20:45.078363+00');
INSERT INTO public.subjects VALUES ('44c1a743-7d28-4c15-a636-6abe493aa80a', 'b95e3216-28bd-4641-b4d2-10efee8c4574', 'Screening & Psychological Tests', 1, '2026-10-24 08:20:45.089131+00');
INSERT INTO public.subjects VALUES ('562434dc-97ec-4b87-bb1b-28f34e2f5bbd', 'b95e3216-28bd-4641-b4d2-10efee8c4574', 'GTO Tasks & Personal Interview', 2, '2026-10-24 08:20:45.104151+00');
INSERT INTO public.subjects VALUES ('9ef24a38-a29e-40d4-9f3f-338fc12480fe', '595ad6e9-7789-4a21-bdab-7d50505cf911', 'Quantitative Aptitude', 1, '2026-10-24 08:20:45.114938+00');
INSERT INTO public.subjects VALUES ('f5aae621-663b-4768-b57a-7b566b2a0688', '595ad6e9-7789-4a21-bdab-7d50505cf911', 'General Intelligence & Reasoning', 2, '2026-10-24 08:20:45.128717+00');


--
-- Data for Name: teachers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.teachers VALUES ('daa4c3ec-3d8d-4974-a32b-e87a75339dea', 'Col. R. K. Sharma (Retd.)', '+91 98765 43210', true, '2026-10-24 08:20:45.003594+00');
INSERT INTO public.teachers VALUES ('61f020f1-253a-4e6d-a107-81fdb15d750a', 'Prof. Neha Verma', '+91 98111 22334', true, '2026-10-24 08:20:45.007017+00');
INSERT INTO public.teachers VALUES ('c46aef40-e001-47f6-9d80-112dccfc1cf6', 'Maj. Vikram Singh (Retd.)', '+91 98222 33445', true, '2026-10-24 08:20:45.009162+00');


--
-- Data for Name: topics; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.topics VALUES ('ad877772-5d64-444b-a42a-f40b61eedaff', '6bd29f85-f263-4404-beaa-f0d68519092d', 'Sets, Relations and Functions', 1, '2026-10-09', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.020331+00');
INSERT INTO public.topics VALUES ('2754f26f-2877-4741-b5d3-e0244d60f027', '6bd29f85-f263-4404-beaa-f0d68519092d', 'Complex Numbers & Quadratic Equations', 2, '2026-10-14', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.026551+00');
INSERT INTO public.topics VALUES ('42f9b1f2-efd9-4338-91fa-0fe5a67d3794', '6bd29f85-f263-4404-beaa-f0d68519092d', 'Matrices and Determinants', 3, '2026-10-19', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.032047+00');
INSERT INTO public.topics VALUES ('827c0216-1f7c-48fb-b79b-ca91d76efddf', '6bd29f85-f263-4404-beaa-f0d68519092d', 'Trigonometry & Inverse Trigonometric Functions', 4, '2026-10-27', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.034537+00');
INSERT INTO public.topics VALUES ('f8bc243c-fdd0-43c3-a2ce-a5d538f1e250', '6bd29f85-f263-4404-beaa-f0d68519092d', 'Differential Calculus & Limits', 5, '2026-11-05', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.038824+00');
INSERT INTO public.topics VALUES ('10da9a68-db72-4dd5-936b-a287927e614c', '6bd29f85-f263-4404-beaa-f0d68519092d', 'Integral Calculus & Vector Algebra', 6, '2026-11-18', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.040868+00');
INSERT INTO public.topics VALUES ('a85c4d35-11e0-4ecd-aaf0-3d46b36509a4', 'bde4b87c-9a48-45c0-9298-6391163569cc', 'Spotting Errors & Sentence Correction', 1, '2026-10-12', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.050367+00');
INSERT INTO public.topics VALUES ('c3742fea-8f00-41ee-a1ed-0d48f0b927cb', 'bde4b87c-9a48-45c0-9298-6391163569cc', 'Synonyms & Antonyms', 2, '2026-10-20', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.052588+00');
INSERT INTO public.topics VALUES ('50fddc39-3efd-4c30-a048-e9c943e23480', 'bde4b87c-9a48-45c0-9298-6391163569cc', 'Reading Comprehension & Cloze Test', 3, '2026-11-01', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.054773+00');
INSERT INTO public.topics VALUES ('536823e2-d606-4f9f-9812-554d6ae1e953', '73e9f655-a85a-450b-bf6d-9bfb4d6e54b4', 'Physical Properties and States of Matter', 1, '2026-10-16', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.060005+00');
INSERT INTO public.topics VALUES ('b73f941d-c5a5-444b-9053-cea7a1c37280', '73e9f655-a85a-450b-bf6d-9bfb4d6e54b4', 'Newton Laws of Motion & Gravitation', 2, '2026-10-26', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.061811+00');
INSERT INTO public.topics VALUES ('bee02351-41e9-446d-bace-24e4ddea5a94', '73e9f655-a85a-450b-bf6d-9bfb4d6e54b4', 'Work, Power and Energy', 3, '2026-11-08', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.065507+00');
INSERT INTO public.topics VALUES ('12e94b5f-17ef-432e-a6ac-0b672464600e', '7a6128ef-a974-48d8-b4e7-2f2b54754928', 'Number System & Arithmetic Operations', 1, '2026-10-10', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.073166+00');
INSERT INTO public.topics VALUES ('f559067a-138d-499f-b2f5-f725e670cd7b', '7a6128ef-a974-48d8-b4e7-2f2b54754928', 'Algebra, Ratio and Proportions', 2, '2026-10-18', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.074895+00');
INSERT INTO public.topics VALUES ('ab662156-8bf7-44a2-9bde-3706432514e3', '7a6128ef-a974-48d8-b4e7-2f2b54754928', 'Geometry, Mensuration & Trigonometry', 3, '2026-10-31', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.076461+00');
INSERT INTO public.topics VALUES ('00f9fe01-10ad-41e4-b617-bff4eaa9bc21', '28dd8d2e-d292-40f5-9bd3-b2c6b56fd0ea', 'Grammar, Parts of Speech & Prepositions', 1, '2026-10-15', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.085217+00');
INSERT INTO public.topics VALUES ('3942519e-81d1-47dc-9e1f-f0c8b10fe247', '28dd8d2e-d292-40f5-9bd3-b2c6b56fd0ea', 'Ordering of Sentences & Para Jumbles', 2, '2026-10-28', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.087441+00');
INSERT INTO public.topics VALUES ('c04f3b57-4d9e-4ac3-8215-f250555e6c11', '44c1a743-7d28-4c15-a636-6abe493aa80a', 'Officer Intelligence Rating (OIR) Test', 1, '2026-10-14', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.092479+00');
INSERT INTO public.topics VALUES ('940284aa-c0dc-46fd-afda-08760d867e31', '44c1a743-7d28-4c15-a636-6abe493aa80a', 'Picture Perception & Discussion Test (PPDT)', 2, '2026-10-22', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.094645+00');
INSERT INTO public.topics VALUES ('ffa99c21-cae1-42a9-9a1c-53270d76ee5d', '44c1a743-7d28-4c15-a636-6abe493aa80a', 'Thematic Apperception Test (TAT)', 3, '2026-10-29', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.098177+00');
INSERT INTO public.topics VALUES ('3dd7eace-b3aa-4c02-8f68-ecdedd4d394e', '44c1a743-7d28-4c15-a636-6abe493aa80a', 'Situation Reaction Test (SRT)', 4, '2026-11-07', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.102413+00');
INSERT INTO public.topics VALUES ('3372d191-e27f-4dac-8fcf-63ec681f58fe', '562434dc-97ec-4b87-bb1b-28f34e2f5bbd', 'Group Discussion & Military Planning Task (GD/GPE)', 1, '2026-10-18', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.10748+00');
INSERT INTO public.topics VALUES ('8d99d0c6-a287-4858-9bce-7daffff006d2', '562434dc-97ec-4b87-bb1b-28f34e2f5bbd', 'Progressive Group Task (PGT) & Snake Race', 2, '2026-10-30', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.109551+00');
INSERT INTO public.topics VALUES ('f818e806-31a4-4f40-90de-e77f5510fbfa', '562434dc-97ec-4b87-bb1b-28f34e2f5bbd', 'Personal Interview Techniques & CIQ Handling', 3, '2026-11-11', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.11219+00');
INSERT INTO public.topics VALUES ('bd3b990d-4a44-4a50-b60f-c70b7361fb31', '9ef24a38-a29e-40d4-9f3f-338fc12480fe', 'Percentages, Profit, Loss & Discount', 1, '2026-10-14', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.119179+00');
INSERT INTO public.topics VALUES ('b1d4f7d3-ef0b-4efd-bdaf-ea686998338b', '9ef24a38-a29e-40d4-9f3f-338fc12480fe', 'Time, Speed and Distance & Trains', 2, '2026-10-29', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.121395+00');
INSERT INTO public.topics VALUES ('29582279-ce86-459e-88b4-9a0756af5b29', '9ef24a38-a29e-40d4-9f3f-338fc12480fe', 'Data Interpretation (DI) Charts', 3, '2026-11-08', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.126445+00');
INSERT INTO public.topics VALUES ('28eb5644-9bee-4227-84ae-d3fa00eba455', 'f5aae621-663b-4768-b57a-7b566b2a0688', 'Analogy, Classification & Series', 1, '2026-10-16', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.132766+00');
INSERT INTO public.topics VALUES ('85f2855e-1492-4a22-9ce6-9150607f4cfe', 'f5aae621-663b-4768-b57a-7b566b2a0688', 'Direction Sense, Syllogism & Blood Relations', 2, '2026-10-29', 'Standard Abhigyan Academy curriculum block', '2026-10-24 08:20:45.135537+00');


--
-- Data for Name: entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.entries VALUES ('2c1515fd-0fd6-4582-a6bd-5633a9a86042', 'f552f044-2ec4-4939-b955-6ffacd22099a', '37a00a36-0700-49e0-9333-30f3d610b388', 'daa4c3ec-3d8d-4974-a32b-e87a75339dea', '6bd29f85-f263-4404-beaa-f0d68519092d', 'ad877772-5d64-444b-a42a-f40b61eedaff', '2026-10-10', 'covered', NULL, NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.233523+00');
INSERT INTO public.entries VALUES ('dd52dfc9-5355-40ef-b611-711f4c8288ba', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'd9cce80e-95ae-4b12-bd65-c6a22396bc86', 'daa4c3ec-3d8d-4974-a32b-e87a75339dea', '6bd29f85-f263-4404-beaa-f0d68519092d', 'ad877772-5d64-444b-a42a-f40b61eedaff', '2026-10-10', 'covered', NULL, NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.240627+00');
INSERT INTO public.entries VALUES ('1fcee2e5-c313-46d9-8caa-56171f6c7b0a', 'f552f044-2ec4-4939-b955-6ffacd22099a', '0a1ed3b0-38ae-432e-9311-b9a41886eeff', 'daa4c3ec-3d8d-4974-a32b-e87a75339dea', '6bd29f85-f263-4404-beaa-f0d68519092d', 'ad877772-5d64-444b-a42a-f40b61eedaff', '2026-10-10', 'covered', NULL, NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.24301+00');
INSERT INTO public.entries VALUES ('c9b1ecbc-fd4d-42d7-af44-1304ceaf0a4c', 'f552f044-2ec4-4939-b955-6ffacd22099a', '4f382c3a-5f4e-448c-9c26-452502345545', 'daa4c3ec-3d8d-4974-a32b-e87a75339dea', '6bd29f85-f263-4404-beaa-f0d68519092d', 'ad877772-5d64-444b-a42a-f40b61eedaff', '2026-10-10', 'covered', NULL, NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.250529+00');
INSERT INTO public.entries VALUES ('71d54fb5-2144-4ed6-849a-bebd52bfa9b9', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'edec6661-676c-403f-96d5-13899b5db06c', 'daa4c3ec-3d8d-4974-a32b-e87a75339dea', '6bd29f85-f263-4404-beaa-f0d68519092d', 'ad877772-5d64-444b-a42a-f40b61eedaff', '2026-10-10', 'covered', NULL, NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.253323+00');
INSERT INTO public.entries VALUES ('0bc7c759-1ff1-4bd1-a90a-7215dbb339ba', 'f552f044-2ec4-4939-b955-6ffacd22099a', '37a00a36-0700-49e0-9333-30f3d610b388', 'daa4c3ec-3d8d-4974-a32b-e87a75339dea', '6bd29f85-f263-4404-beaa-f0d68519092d', '2754f26f-2877-4741-b5d3-e0244d60f027', '2026-10-15', 'covered', NULL, NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.255772+00');
INSERT INTO public.entries VALUES ('db86f128-84c0-4b6d-a24d-3f9f001649de', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'd9cce80e-95ae-4b12-bd65-c6a22396bc86', 'daa4c3ec-3d8d-4974-a32b-e87a75339dea', '6bd29f85-f263-4404-beaa-f0d68519092d', '2754f26f-2877-4741-b5d3-e0244d60f027', '2026-10-15', 'covered', NULL, NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.258102+00');
INSERT INTO public.entries VALUES ('afc48559-3aeb-4d97-86fd-0adcaeda4bb5', 'f552f044-2ec4-4939-b955-6ffacd22099a', '37a00a36-0700-49e0-9333-30f3d610b388', 'daa4c3ec-3d8d-4974-a32b-e87a75339dea', '6bd29f85-f263-4404-beaa-f0d68519092d', '42f9b1f2-efd9-4338-91fa-0fe5a67d3794', '2026-10-21', 'partial', 'Covered upto matrix multiplication', NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.26062+00');
INSERT INTO public.entries VALUES ('025dd2dc-dded-4453-bc84-b61d6552ff20', 'f552f044-2ec4-4939-b955-6ffacd22099a', '37a00a36-0700-49e0-9333-30f3d610b388', '61f020f1-253a-4e6d-a107-81fdb15d750a', 'bde4b87c-9a48-45c0-9298-6391163569cc', 'a85c4d35-11e0-4ecd-aaf0-3d46b36509a4', '2026-10-13', 'covered', NULL, NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.263416+00');
INSERT INTO public.entries VALUES ('29e385c6-2b9c-4b6f-81be-6e296c68b0d5', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'd9cce80e-95ae-4b12-bd65-c6a22396bc86', '61f020f1-253a-4e6d-a107-81fdb15d750a', 'bde4b87c-9a48-45c0-9298-6391163569cc', 'a85c4d35-11e0-4ecd-aaf0-3d46b36509a4', '2026-10-13', 'covered', NULL, NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.266355+00');
INSERT INTO public.entries VALUES ('94b09f2c-92fd-41f0-8f56-84ace399f1ee', 'f552f044-2ec4-4939-b955-6ffacd22099a', '0a1ed3b0-38ae-432e-9311-b9a41886eeff', '61f020f1-253a-4e6d-a107-81fdb15d750a', 'bde4b87c-9a48-45c0-9298-6391163569cc', 'a85c4d35-11e0-4ecd-aaf0-3d46b36509a4', '2026-10-13', 'covered', NULL, NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.270812+00');
INSERT INTO public.entries VALUES ('70db736e-30f4-4689-86a0-985c7df02634', 'f552f044-2ec4-4939-b955-6ffacd22099a', '4f382c3a-5f4e-448c-9c26-452502345545', '61f020f1-253a-4e6d-a107-81fdb15d750a', 'bde4b87c-9a48-45c0-9298-6391163569cc', 'a85c4d35-11e0-4ecd-aaf0-3d46b36509a4', '2026-10-13', 'covered', NULL, NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.273194+00');
INSERT INTO public.entries VALUES ('8bcf183b-83d5-4d2a-ae8a-783af7f4ac94', 'f552f044-2ec4-4939-b955-6ffacd22099a', 'edec6661-676c-403f-96d5-13899b5db06c', '61f020f1-253a-4e6d-a107-81fdb15d750a', 'bde4b87c-9a48-45c0-9298-6391163569cc', 'a85c4d35-11e0-4ecd-aaf0-3d46b36509a4', '2026-10-13', 'covered', NULL, NULL, 'dev-seed-uuid', '[]', 'auto', '2026-10-24 08:20:45.278532+00');
INSERT INTO public.entries VALUES ('b4a9f2dd-e02a-46ca-9d9a-82b99e9a1f01', 'f552f044-2ec4-4939-b955-6ffacd22099a', '0a1ed3b0-38ae-432e-9311-b9a41886eeff', 'daa4c3ec-3d8d-4974-a32b-e87a75339dea', '6bd29f85-f263-4404-beaa-f0d68519092d', 'f8bc243c-fdd0-43c3-a2ce-a5d538f1e250', '2026-10-24', 'covered', 'Skipped ahead to calculus', NULL, 'dev-suspicious-device', '["FLAG_SEQUENCE_JUMP"]', 'pending', '2026-10-24 08:20:45.285924+00');


--
-- Data for Name: teacher_subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.teacher_subjects VALUES ('daa4c3ec-3d8d-4974-a32b-e87a75339dea', '6bd29f85-f263-4404-beaa-f0d68519092d');
INSERT INTO public.teacher_subjects VALUES ('61f020f1-253a-4e6d-a107-81fdb15d750a', 'bde4b87c-9a48-45c0-9298-6391163569cc');
INSERT INTO public.teacher_subjects VALUES ('c46aef40-e001-47f6-9d80-112dccfc1cf6', '73e9f655-a85a-450b-bf6d-9bfb4d6e54b4');
INSERT INTO public.teacher_subjects VALUES ('daa4c3ec-3d8d-4974-a32b-e87a75339dea', '7a6128ef-a974-48d8-b4e7-2f2b54754928');
INSERT INTO public.teacher_subjects VALUES ('61f020f1-253a-4e6d-a107-81fdb15d750a', '28dd8d2e-d292-40f5-9bd3-b2c6b56fd0ea');
INSERT INTO public.teacher_subjects VALUES ('c46aef40-e001-47f6-9d80-112dccfc1cf6', '44c1a743-7d28-4c15-a636-6abe493aa80a');
INSERT INTO public.teacher_subjects VALUES ('daa4c3ec-3d8d-4974-a32b-e87a75339dea', '562434dc-97ec-4b87-bb1b-28f34e2f5bbd');
INSERT INTO public.teacher_subjects VALUES ('61f020f1-253a-4e6d-a107-81fdb15d750a', '9ef24a38-a29e-40d4-9f3f-338fc12480fe');
INSERT INTO public.teacher_subjects VALUES ('c46aef40-e001-47f6-9d80-112dccfc1cf6', 'f5aae621-663b-4768-b57a-7b566b2a0688');


--
-- PostgreSQL database dump complete
--

\unrestrict i5qYaZnkIPSuDCVOV1L4RvIa8jg6iqiqrIZGKVGJ6VZNfMYfg7v9lRxYgusL19b

