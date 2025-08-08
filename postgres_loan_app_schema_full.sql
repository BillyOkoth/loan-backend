
-- PostgreSQL schema adapted from Oracle 23ai schema

-- Drop existing tables and views
DROP TABLE IF EXISTS loan_applications CASCADE;
DROP TABLE IF EXISTS clients_to_loan_recommendations CASCADE;
DROP TABLE IF EXISTS client_debt CASCADE;
DROP TABLE IF EXISTS clients_to_loan CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS mock_loan_data CASCADE;
DROP TABLE IF EXISTS loan_chunk CASCADE;
DROP TABLE IF EXISTS loan_provider CASCADE;
DROP TABLE IF EXISTS funding_provider_terms CASCADE;
DROP TABLE IF EXISTS lender_terms CASCADE;
DROP TABLE IF EXISTS affordable_housing_zone CASCADE;
DROP TABLE IF EXISTS floodzone CASCADE;

-- Required extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Clients table
CREATE TABLE clients (
    customer_id TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    city TEXT,
    state TEXT,
    zip_code INTEGER,
    age INTEGER,
    income NUMERIC,
    veteran TEXT
);

-- Loan Applications
CREATE TABLE loan_applications (
    customer_id TEXT REFERENCES clients(customer_id),
    application_id SERIAL PRIMARY KEY,
    requested_loan_amount NUMERIC,
    credit_score INTEGER,
    zipcode INTEGER,
    loan_purpose TEXT,
    loan_status TEXT,
    student_status TEXT,
    education_level TEXT,
    final_decision TEXT,
    recommendations TEXT,
    total_debt NUMERIC,
    credit_rank INTEGER
);

-- Client Debt
CREATE TABLE client_debt (
    id SERIAL PRIMARY KEY,
    customer_id TEXT,
    application_id INTEGER,
    debt_type TEXT,
    debt_amount NUMERIC
);

-- Mock Loan Data
CREATE TABLE mock_loan_data (
    loan_id SERIAL PRIMARY KEY,
    loan_provider_name TEXT,
    loan_type TEXT,
    interest_rate NUMERIC,
    origination_fee NUMERIC,
    time_to_close INTEGER,
    credit_score INTEGER,
    debt_to_income_ratio NUMERIC,
    income NUMERIC,
    down_payment_percent NUMERIC,
    is_first_time_home_buyer TEXT,
    offer_begin_date DATE DEFAULT CURRENT_DATE,
    offer_end_date DATE DEFAULT CURRENT_DATE + INTERVAL '30 days'
);

-- Loan Chunk
CREATE TABLE loan_chunk (
    id SERIAL PRIMARY KEY,
    customer_id TEXT,
    chunk_id INTEGER,
    chunk_text TEXT,
    chunk_vector VECTOR(384)
);
CREATE INDEX idx_chunk_vector ON loan_chunk USING ivfflat (chunk_vector vector_cosine_ops);

-- Clients to Loan Recommendations
CREATE TABLE clients_to_loan_recommendations (
    id SERIAL PRIMARY KEY,
    customer_id TEXT REFERENCES clients(customer_id),
    loan_id INTEGER REFERENCES mock_loan_data(loan_id),
    loan_application_id INTEGER REFERENCES loan_applications(application_id),
    action_needed TEXT
);

-- Clients to Loan
CREATE TABLE clients_to_loan (
    id SERIAL PRIMARY KEY,
    customer_id TEXT REFERENCES clients(customer_id),
    loan_id INTEGER REFERENCES mock_loan_data(loan_id),
    loan_application_id INTEGER REFERENCES loan_applications(application_id)
);

-- Loan Provider
CREATE TABLE loan_provider (
    loan_provider_id SERIAL PRIMARY KEY,
    loan_provider_name TEXT
);

-- Funding Provider Terms
CREATE TABLE funding_provider_terms (
    loan_provider_id INTEGER REFERENCES loan_provider(loan_provider_id),
    terms_id SERIAL PRIMARY KEY,
    interest_rate NUMERIC,
    loan_description TEXT,
    time_to_close INTEGER,
    loan_costs NUMERIC,
    offer_begin_date DATE,
    offer_end_date DATE
);

-- Lender Terms
CREATE TABLE lender_terms (
    lender_id INTEGER REFERENCES mock_loan_data(loan_id),
    terms_id SERIAL PRIMARY KEY,
    loan_description TEXT,
    interest_rate_markup NUMERIC,
    origination_fee NUMERIC,
    lender_time_to_close INTEGER,
    credit_score INTEGER,
    debt_to_income_ratio NUMERIC,
    income NUMERIC,
    down_payment_percent NUMERIC,
    offer_begin_date DATE,
    offer_end_date DATE
);

-- Affordable Housing Zone
CREATE TABLE affordable_housing_zone (
    land_tract_id SERIAL PRIMARY KEY,
    zipcode INTEGER
);

-- Floodzone (SDO_GEOMETRY not directly supported in PostgreSQL)
CREATE TABLE floodzone (
    id SERIAL PRIMARY KEY,
    geometry JSONB,
    descr TEXT
);
