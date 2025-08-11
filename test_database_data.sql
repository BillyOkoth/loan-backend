-- Test script to verify the mock data in the loanapp database

-- 1. Show all clients
SELECT '=== CLIENTS DATA ===' as info;
SELECT customer_id, first_name, last_name, city, state, income, age, veteran 
FROM clients 
ORDER BY customer_id;

-- 2. Show loan applications with client info
SELECT '=== LOAN APPLICATIONS ===' as info;
SELECT 
    la.customer_id,
    c.first_name,
    c.last_name,
    la.requested_loan_amount,
    la.credit_score,
    la.loan_purpose,
    la.loan_status,
    la.final_decision
FROM loan_applications la
JOIN clients c ON la.customer_id = c.customer_id
ORDER BY la.application_id;

-- 3. Show client debt breakdown
SELECT '=== CLIENT DEBT BREAKDOWN ===' as info;
SELECT 
    cd.customer_id,
    c.first_name,
    c.last_name,
    cd.debt_type,
    cd.debt_amount,
    SUM(cd.debt_amount) OVER (PARTITION BY cd.customer_id) as total_debt
FROM client_debt cd
JOIN clients c ON cd.customer_id = c.customer_id
ORDER BY cd.customer_id, cd.debt_amount DESC;

-- 4. Show available loan products
SELECT '=== AVAILABLE LOAN PRODUCTS ===' as info;
SELECT 
    loan_id,
    loan_provider_name,
    loan_type,
    interest_rate,
    credit_score as min_credit_score,
    debt_to_income_ratio,
    down_payment_percent,
    is_first_time_home_buyer
FROM mock_loan_data
ORDER BY interest_rate;

-- 5. Show loan recommendations
SELECT '=== LOAN RECOMMENDATIONS ===' as info;
SELECT 
    ctr.customer_id,
    c.first_name,
    c.last_name,
    mld.loan_type,
    ctr.action_needed
FROM clients_to_loan_recommendations ctr
JOIN clients c ON ctr.customer_id = c.customer_id
JOIN mock_loan_data mld ON ctr.loan_id = mld.loan_id
ORDER BY ctr.customer_id;

-- 6. Summary statistics
SELECT '=== SUMMARY STATISTICS ===' as info;
SELECT 
    'Total Clients' as metric,
    COUNT(*) as value
FROM clients
UNION ALL
SELECT 
    'Total Loan Applications',
    COUNT(*)
FROM loan_applications
UNION ALL
SELECT 
    'Approved Applications',
    COUNT(*)
FROM loan_applications
WHERE final_decision = 'Approved'
UNION ALL
SELECT 
    'Pending Applications',
    COUNT(*)
FROM loan_applications
WHERE loan_status = 'Pending Review'
UNION ALL
SELECT 
    'Average Credit Score',
    ROUND(AVG(credit_score), 0)
FROM loan_applications
UNION ALL
SELECT 
    'Average Loan Amount',
    ROUND(AVG(requested_loan_amount), 0)
FROM loan_applications;
