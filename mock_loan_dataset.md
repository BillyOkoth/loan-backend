# Mock Loan Data & Client Dataset

This document contains mock datasets used for simulating a mortgage and loan application system. The data is structured across the following sections:

---

## 🧍 Clients Data

```python
CLIENTS_DATA = [
    ("CUST_1000", "James", "Smith", "New York City", "NY", 10033, 52, 130000, "Yes"),
    ("CUST_2000", "James", "Woods", "East Gina", "AR", 58967, 27, 5000, "Yes"),
    ("CUST_3000", "Evan", "Burton", "Detroit", "MI", 48202, 24, 65000, "No"),
    ("CUST_4000", "Alex", "Anderson", "Austin", "TX", 78744, 26, 25000, "No"),
    ("CUST_5000", "Richard", "Thomas", "Chicago", "IL", 60127, 27, 80000, "Yes"),
    ("CUST_6000", "Karen", "Smith", "San Jose", "CA", 94560, 42, 115000, "No"),
    ("CUST_7000", "Omar", "Santos", "Orlando", "FL", 32802, 34, 25000, "No"),
]
```

---

## 🧾 Loan Applications

```python
LOAN_APPLICATIONS_DATA = [
    ("CUST_1000", 1000, 200000, 780, 10033, "Mortgage", "Pending Review", "No", "PhD", None, None, None),
    ("CUST_2000", 1001, 100000, 520, 58967, "Mortgage", "Pending Review", "No", "High School", None, None, None),
    ("CUST_3000", 1002, 150000, 675, 48202, "Mortgage", "Pending Review", "No", "Masters", None, None, None),
    # ... (truncated for brevity)
]
```

---

## 💳 Client Debt Data

```python
CLIENT_DEBT_DATA = [
    ("CUST_1000", 1000, "First Time Home Owner", 90000),
    ("CUST_2000", 1001, "Home", 8843),
    ("CUST_2000", 1001, "CREDIT_CARD", 31560),
    # ... (truncated for brevity)
]
```

---

## 🏦 Mock Loan Products

```python
MOCK_LOAN_DATA = [
    (1, "provider1", "Bridge loan for transitional homebuyers", 4.75, 1.0618, 38, 649, 27.15, 150377, 12.43, "NO"),
    (2, "provider2", "Second mortgage loan", 3.31, 1.926, 25, 776, 28.81, 154763, 3.76, "NO"),
    # ... (truncated for brevity)
]
```

---

## 🏘️ Affordable Housing Zones

```python
AFFORDABLE_HOUSING_ZONE_DATA = [(1, 48202)]
```

---

## 💡 Usage

This dataset can be imported into a PostgreSQL or Oracle DB for simulation, analytics, LLM semantic search, or AI model training.

> For detailed schema and model relationships, refer to the system documentation.

