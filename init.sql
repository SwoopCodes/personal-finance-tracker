--
-- PostgreSQL database dump
--

\restrict qX50m0t5JAfZau9DCbrljpokAgylgvqbEX1k2zZfuL2VNeEJOJbdWGQUDIyOcpV

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

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

ALTER TABLE IF EXISTS ONLY public.portfolio_snapshots DROP CONSTRAINT IF EXISTS portfolio_snapshots_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.investment_transactions DROP CONSTRAINT IF EXISTS investment_transactions_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.investment_dividends DROP CONSTRAINT IF EXISTS investment_dividends_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.finance_transactions DROP CONSTRAINT IF EXISTS finance_transactions_account_id_fkey;
ALTER TABLE IF EXISTS ONLY public.accounts DROP CONSTRAINT IF EXISTS accounts_customer_id_fkey;
DROP INDEX IF EXISTS public.idx_investment_dividends_customer_ticker;
ALTER TABLE IF EXISTS ONLY public.portfolio_snapshots DROP CONSTRAINT IF EXISTS portfolio_snapshots_pkey;
ALTER TABLE IF EXISTS ONLY public.portfolio_snapshots DROP CONSTRAINT IF EXISTS portfolio_snapshots_customer_id_snapshot_date_key;
ALTER TABLE IF EXISTS ONLY public.investment_transactions DROP CONSTRAINT IF EXISTS investment_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.investment_dividends DROP CONSTRAINT IF EXISTS investment_dividends_pkey;
ALTER TABLE IF EXISTS ONLY public.finance_transactions DROP CONSTRAINT IF EXISTS finance_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.customers DROP CONSTRAINT IF EXISTS customers_username_key;
ALTER TABLE IF EXISTS ONLY public.customers DROP CONSTRAINT IF EXISTS customers_pkey;
ALTER TABLE IF EXISTS ONLY public.customers DROP CONSTRAINT IF EXISTS customers_email_key;
ALTER TABLE IF EXISTS ONLY public.accounts DROP CONSTRAINT IF EXISTS accounts_pkey;
ALTER TABLE IF EXISTS public.portfolio_snapshots ALTER COLUMN snapshot_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.investment_transactions ALTER COLUMN investment_txn_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.investment_dividends ALTER COLUMN dividend_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.finance_transactions ALTER COLUMN transaction_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.customers ALTER COLUMN customer_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.accounts ALTER COLUMN account_id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.portfolio_snapshots_snapshot_id_seq;
DROP TABLE IF EXISTS public.portfolio_snapshots;
DROP SEQUENCE IF EXISTS public.investment_transactions_investment_txn_id_seq;
DROP TABLE IF EXISTS public.investment_transactions;
DROP SEQUENCE IF EXISTS public.investment_dividends_dividend_id_seq;
DROP TABLE IF EXISTS public.investment_dividends;
DROP SEQUENCE IF EXISTS public.finance_transactions_transaction_id_seq;
DROP TABLE IF EXISTS public.finance_transactions;
DROP SEQUENCE IF EXISTS public.customers_customer_id_seq;
DROP TABLE IF EXISTS public.customers;
DROP SEQUENCE IF EXISTS public.accounts_account_id_seq;
DROP TABLE IF EXISTS public.accounts;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    account_id integer NOT NULL,
    customer_id integer NOT NULL,
    account_name character varying(50) NOT NULL,
    balance numeric(13,2) DEFAULT 0.00 NOT NULL
);


--
-- Name: accounts_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_account_id_seq OWNED BY public.accounts.account_id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    customer_id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    email character varying(100) NOT NULL,
    registration_date date DEFAULT CURRENT_DATE NOT NULL
);


--
-- Name: customers_customer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_customer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_customer_id_seq OWNED BY public.customers.customer_id;


--
-- Name: finance_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_transactions (
    transaction_id integer NOT NULL,
    account_id integer NOT NULL,
    amount numeric(13,2) NOT NULL,
    type character varying(10) NOT NULL,
    category character varying(50) NOT NULL,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    description text,
    CONSTRAINT finance_transactions_type_check CHECK (((type)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying])::text[])))
);


--
-- Name: finance_transactions_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_transactions_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_transactions_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_transactions_transaction_id_seq OWNED BY public.finance_transactions.transaction_id;


--
-- Name: investment_dividends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investment_dividends (
    dividend_id integer NOT NULL,
    customer_id integer NOT NULL,
    ticker character varying(16) NOT NULL,
    payment_date date NOT NULL,
    amount_per_share numeric(13,4) NOT NULL,
    shares_held numeric(13,4) NOT NULL,
    total_amount numeric(13,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: investment_dividends_dividend_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.investment_dividends_dividend_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: investment_dividends_dividend_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.investment_dividends_dividend_id_seq OWNED BY public.investment_dividends.dividend_id;


--
-- Name: investment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investment_transactions (
    investment_txn_id integer NOT NULL,
    customer_id integer NOT NULL,
    ticker character varying(10) NOT NULL,
    transaction_type character varying(4) NOT NULL,
    shares numeric(13,4) NOT NULL,
    price_per_share numeric(13,2) NOT NULL,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    CONSTRAINT investment_transactions_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['BUY'::character varying, 'SELL'::character varying])::text[])))
);


--
-- Name: investment_transactions_investment_txn_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.investment_transactions_investment_txn_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: investment_transactions_investment_txn_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.investment_transactions_investment_txn_id_seq OWNED BY public.investment_transactions.investment_txn_id;


--
-- Name: portfolio_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolio_snapshots (
    snapshot_id integer NOT NULL,
    customer_id integer NOT NULL,
    snapshot_date date DEFAULT CURRENT_DATE NOT NULL,
    total_value numeric(15,2) NOT NULL,
    total_invested numeric(15,2) NOT NULL
);


--
-- Name: portfolio_snapshots_snapshot_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.portfolio_snapshots_snapshot_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portfolio_snapshots_snapshot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.portfolio_snapshots_snapshot_id_seq OWNED BY public.portfolio_snapshots.snapshot_id;


--
-- Name: accounts account_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN account_id SET DEFAULT nextval('public.accounts_account_id_seq'::regclass);


--
-- Name: customers customer_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN customer_id SET DEFAULT nextval('public.customers_customer_id_seq'::regclass);


--
-- Name: finance_transactions transaction_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_transactions ALTER COLUMN transaction_id SET DEFAULT nextval('public.finance_transactions_transaction_id_seq'::regclass);


--
-- Name: investment_dividends dividend_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_dividends ALTER COLUMN dividend_id SET DEFAULT nextval('public.investment_dividends_dividend_id_seq'::regclass);


--
-- Name: investment_transactions investment_txn_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_transactions ALTER COLUMN investment_txn_id SET DEFAULT nextval('public.investment_transactions_investment_txn_id_seq'::regclass);


--
-- Name: portfolio_snapshots snapshot_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_snapshots ALTER COLUMN snapshot_id SET DEFAULT nextval('public.portfolio_snapshots_snapshot_id_seq'::regclass);


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.accounts (account_id, customer_id, account_name, balance) FROM stdin;
35	55	Account	200.00
38	61	Main Checking	2950.00
39	63	Savings	2000.00
24	9	Main	2698.65
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (customer_id, username, password, email, registration_date) FROM stdin;
9	Swoop	$2b$12$cxKlqLLeEi/0vit3//pUxOoYpJrhIVM1iNfZe48W/AxeNZqgpUpKa	swoop@gmail.com	2026-07-16
55	test	$2b$12$v5lQCQj6AV.llwFiYUp7WeJr0HEpFDHqo2/1Y07OQ6LyVYXYfwaTS	test@gmail.com	2026-07-29
61	nwtestuser2	$2b$12$IV6/c8tSecRXgAzvh29JROZl4Qfk7ot.KdskW2B5NzCqPRdurEZaq	nwtest2@example.com	2026-07-30
62	nwtestempty1	$2b$12$uQTXAFoOiO4BcOk/28ON8./vpSNvHHW8WQdNNvy2P8eTUqsk13ICS	nwtestempty1@example.com	2026-07-30
63	tester	$2b$12$JHeV94LH7pvGsD.3qldoWeIVFLiKkERLxgPEsNw4FiDOXaMrVmfTq	tester@gmail.com	2026-07-30
\.


--
-- Data for Name: finance_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.finance_transactions (transaction_id, account_id, amount, type, category, transaction_date, description) FROM stdin;
16	24	-22.14	expense	Uncategorized	2026-07-28	Claude Pro Subscription
21	24	-8.20	expense	Dining Out	2026-07-29	Subway
22	24	-12.20	expense	Groceries	2026-07-29	2x Monster 4pk + goujons
26	24	-18.00	expense	Transportation	2026-07-29	Windshield Washer fluid
27	38	-50.00	expense	Groceries	2026-07-30	Groceries
28	38	2000.00	income	Salary	2026-07-30	Paycheck
29	24	-96.91	expense	Travel	2026-07-30	Diesel
30	24	-15.00	expense	Miscellaneous	2026-07-30	Vape Liquid + coil
\.


--
-- Data for Name: investment_dividends; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.investment_dividends (dividend_id, customer_id, ticker, payment_date, amount_per_share, shares_held, total_amount, created_at) FROM stdin;
\.


--
-- Data for Name: investment_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.investment_transactions (investment_txn_id, customer_id, ticker, transaction_type, shares, price_per_share, transaction_date) FROM stdin;
60	55	PG	BUY	5.0000	100.00	2026-07-29
61	55	BYD	BUY	2.0000	115.00	2026-07-29
62	9	NIO	BUY	15.0000	4.92	2026-07-29
63	9	NIO	SELL	15.0000	4.68	2026-07-29
64	9	AAPL	BUY	2.0000	340.00	2026-07-29
65	9	MSFT	BUY	2.0000	389.10	2026-07-29
66	9	NVDA	BUY	4.0000	197.01	2026-07-29
67	9	AMZN	BUY	3.0000	230.86	2026-07-29
68	9	GOOG	BUY	2.0000	326.56	2026-07-29
69	9	META	BUY	1.0000	593.87	2026-07-29
70	9	TSLA	BUY	2.0000	309.22	2026-07-29
78	9	MSFT	SELL	2.0000	395.38	2026-07-29
79	9	NVDA	SELL	4.0000	191.85	2026-07-29
80	9	AMZN	SELL	3.0000	229.60	2026-07-29
81	9	AAPL	SELL	2.0000	340.93	2026-07-29
82	9	GOOG	SELL	2.0000	334.96	2026-07-29
83	9	TSLA	SELL	2.0000	301.68	2026-07-29
84	9	META	SELL	1.0000	592.99	2026-07-29
85	61	AAPL	BUY	5.0000	150.00	2026-06-01
58	55	AMD	BUY	0.2200	454.62	2026-07-29
59	55	AMD	BUY	0.3299	454.62	2026-07-29
43	55	SPXC	BUY	1.0000	200.00	2026-07-29
44	55	NVDA	BUY	1.0000	200.00	2026-07-29
57	55	NVDA	SELL	0.5076	197.01	2026-07-29
74	9	VWRL.AS	BUY	4.9941	140.47	2026-07-29
75	9	FXC.AS	BUY	5.8314	95.01	2026-07-29
76	9	21BC.DE	BUY	27.2165	15.89	2026-07-29
77	9	EXSA.DE	BUY	5.8533	57.67	2026-07-29
86	61	AAPL	BUY	1.0000	150.00	2026-07-30
87	61	MSFT	BUY	1.0000	300.00	2026-07-30
88	61	GOOGL	BUY	1.0000	140.00	2026-07-30
89	61	AMZN	BUY	1.0000	180.00	2026-07-30
\.


--
-- Data for Name: portfolio_snapshots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.portfolio_snapshots (snapshot_id, customer_id, snapshot_date, total_value, total_invested) FROM stdin;
\.


--
-- Name: accounts_account_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.accounts_account_id_seq', 39, true);


--
-- Name: customers_customer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customers_customer_id_seq', 63, true);


--
-- Name: finance_transactions_transaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.finance_transactions_transaction_id_seq', 30, true);


--
-- Name: investment_dividends_dividend_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.investment_dividends_dividend_id_seq', 2, true);


--
-- Name: investment_transactions_investment_txn_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.investment_transactions_investment_txn_id_seq', 89, true);


--
-- Name: portfolio_snapshots_snapshot_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.portfolio_snapshots_snapshot_id_seq', 1, false);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (account_id);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (customer_id);


--
-- Name: customers customers_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_username_key UNIQUE (username);


--
-- Name: finance_transactions finance_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_transactions
    ADD CONSTRAINT finance_transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: investment_dividends investment_dividends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_dividends
    ADD CONSTRAINT investment_dividends_pkey PRIMARY KEY (dividend_id);


--
-- Name: investment_transactions investment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_transactions
    ADD CONSTRAINT investment_transactions_pkey PRIMARY KEY (investment_txn_id);


--
-- Name: portfolio_snapshots portfolio_snapshots_customer_id_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_snapshots
    ADD CONSTRAINT portfolio_snapshots_customer_id_snapshot_date_key UNIQUE (customer_id, snapshot_date);


--
-- Name: portfolio_snapshots portfolio_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_snapshots
    ADD CONSTRAINT portfolio_snapshots_pkey PRIMARY KEY (snapshot_id);


--
-- Name: idx_investment_dividends_customer_ticker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investment_dividends_customer_ticker ON public.investment_dividends USING btree (customer_id, ticker);


--
-- Name: accounts accounts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE CASCADE;


--
-- Name: finance_transactions finance_transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_transactions
    ADD CONSTRAINT finance_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(account_id) ON DELETE CASCADE;


--
-- Name: investment_dividends investment_dividends_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_dividends
    ADD CONSTRAINT investment_dividends_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE CASCADE;


--
-- Name: investment_transactions investment_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_transactions
    ADD CONSTRAINT investment_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE CASCADE;


--
-- Name: portfolio_snapshots portfolio_snapshots_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_snapshots
    ADD CONSTRAINT portfolio_snapshots_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

