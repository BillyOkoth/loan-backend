-- Populate Mock Data for Loan Application System (Fixed Version)
-- This script inserts the mock data from mock_loan_dataset.md into the loanapp database

-- Clear existing data (optional - uncomment if you want to start fresh)
-- TRUNCATE TABLE clients_to_loan_recommendations CASCADE;
-- TRUNCATE TABLE clients_to_loan CASCADE;
-- TRUNCATE TABLE client_debt CASCADE;
-- TRUNCATE TABLE loan_applications CASCADE;
-- TRUNCATE TABLE clients CASCADE;
-- TRUNCATE TABLE mock_loan_data CASCADE;
-- TRUNCATE TABLE affordable_housing_zone CASCADE;

-- Insert Clients Data
INSERT INTO clients (customer_id, first_name, last_name, city, state, zip_code, age, income, veteran) VALUES
('CUST_1000', 'James', 'Smith', 'New York City', 'NY', 10033, 52, 130000, 'Yes'),
('CUST_2000', 'James', 'Woods', 'East Gina', 'AR', 58967, 27, 5000, 'Yes'),
('CUST_3000', 'Evan', 'Burton', 'Detroit', 'MI', 48202, 24, 65000, 'No'),
('CUST_4000', 'Alex', 'Anderson', 'Austin', 'TX', 78744, 26, 25000, 'No'),
('CUST_5000', 'Richard', 'Thomas', 'Chicago', 'IL', 60127, 27, 80000, 'Yes'),
('CUST_6000', 'Karen', 'Smith', 'San Jose', 'CA', 94560, 42, 115000, 'No'),
('CUST_7000', 'Omar', 'Santos', 'Orlando', 'FL', 32802, 34, 25000, 'No');

-- Insert Mock Loan Data
INSERT INTO mock_loan_data (loan_id, loan_provider_name, loan_type, interest_rate, origination_fee, time_to_close, credit_score, debt_to_income_ratio, income, down_payment_percent, is_first_time_home_buyer) VALUES
(1, 'provider1', 'Bridge loan for transitional homebuyers', 4.75, 1.0618, 38, 649, 27.15, 150377, 12.43, 'NO'),
(2, 'provider2', 'Second mortgage loan', 3.31, 1.926, 25, 776, 28.81, 154763, 3.76, 'NO'),
(3, 'provider3', 'Conventional mortgage', 4.25, 0.85, 30, 720, 25.5, 120000, 20.0, 'YES'),
(4, 'provider4', 'FHA loan', 3.75, 1.5, 45, 680, 30.2, 95000, 3.5, 'YES'),
(5, 'provider5', 'VA loan', 3.5, 0.5, 35, 750, 22.8, 110000, 0.0, 'YES');

-- Insert Loan Applications Data
INSERT INTO loan_applications (customer_id, application_id, requested_loan_amount, credit_score, zipcode, loan_purpose, loan_status, student_status, education_level, final_decision, recommendations, total_debt, credit_rank) VALUES
('CUST_1000', 1000, 200000, 780, 10033, 'Mortgage', 'Pending Review', 'No', 'PhD', NULL, NULL, NULL, NULL),
('CUST_2000', 1001, 100000, 520, 58967, 'Mortgage', 'Pending Review', 'No', 'High School', NULL, NULL, NULL, NULL),
('CUST_3000', 1002, 150000, 675, 48202, 'Mortgage', 'Pending Review', 'No', 'Masters', NULL, NULL, NULL, NULL),
('CUST_4000', 1003, 80000, 620, 78744, 'Personal Loan', 'Approved', 'Yes', 'Bachelors', 'Approved', 'Good credit score for student', 15000, 3),
('CUST_5000', 1004, 250000, 720, 60127, 'Mortgage', 'Under Review', 'No', 'Bachelors', NULL, NULL, NULL, NULL),
('CUST_6000', 1005, 300000, 750, 94560, 'Mortgage', 'Approved', 'No', 'Masters', 'Approved', 'Excellent credit and income', 45000, 1),
('CUST_7000', 1006, 120000, 580, 32802, 'Personal Loan', 'Rejected', 'No', 'High School', 'Rejected', 'Low credit score', 35000, 5);

-- Insert Client Debt Data
INSERT INTO client_debt (customer_id, application_id, debt_type, debt_amount) VALUES
('CUST_1000', 1000, 'First Time Home Owner', 90000),
('CUST_2000', 1001, 'Home', 8843),
('CUST_2000', 1001, 'CREDIT_CARD', 31560),
('CUST_3000', 1002, 'Student Loan', 25000),
('CUST_3000', 1002, 'Car Loan', 15000),
('CUST_4000', 1003, 'Student Loan', 15000),
('CUST_5000', 1004, 'Credit Card', 8000),
('CUST_5000', 1004, 'Car Loan', 12000),
('CUST_6000', 1005, 'Credit Card', 15000),
('CUST_6000', 1005, 'Personal Loan', 30000),
('CUST_7000', 1006, 'Credit Card', 20000),
('CUST_7000', 1006, 'Personal Loan', 15000);

-- Insert Affordable Housing Zone Data (using correct column name)
INSERT INTO affordable_housing_zone (land_tract_id, zipcode) VALUES
(1, 48202);

-- Insert some sample loan recommendations
INSERT INTO clients_to_loan_recommendations (customer_id, loan_id, loan_application_id, action_needed) VALUES
('CUST_1000', 1, 1000, 'Review credit score improvement options'),
('CUST_2000', 4, 1001, 'Consider FHA loan with lower credit requirements'),
('CUST_3000', 3, 1002, 'Good candidate for conventional mortgage'),
('CUST_4000', 5, 1003, 'Student loan consolidation recommended'),
('CUST_5000', 2, 1004, 'Consider second mortgage for additional funds'),
('CUST_6000', 1, 1005, 'Excellent candidate for bridge loan'),
('CUST_7000', 4, 1006, 'Credit counseling recommended before reapplication');

-- Insert some sample client-to-loan mappings (without action_needed column)
INSERT INTO clients_to_loan (customer_id, loan_id, loan_application_id) VALUES
('CUST_1000', 1, 1000),
('CUST_2000', 4, 1001),
('CUST_3000', 3, 1002),
('CUST_4000', 5, 1003),
('CUST_5000', 2, 1004),
('CUST_6000', 1, 1005),
('CUST_7000', 4, 1006);

-- Verify the data was inserted correctly
SELECT 'Clients' as table_name, COUNT(*) as record_count FROM clients
UNION ALL
SELECT 'Loan Applications', COUNT(*) FROM loan_applications
UNION ALL
SELECT 'Client Debt', COUNT(*) FROM client_debt
UNION ALL
SELECT 'Mock Loan Data', COUNT(*) FROM mock_loan_data
UNION ALL
SELECT 'Affordable Housing Zones', COUNT(*) FROM affordable_housing_zone
UNION ALL
SELECT 'Loan Recommendations', COUNT(*) FROM clients_to_loan_recommendations
UNION ALL
SELECT 'Client to Loan Mappings', COUNT(*) FROM clients_to_loan;
