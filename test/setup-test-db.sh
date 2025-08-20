#!/bin/bash

# Create postgres user if it doesn't exist
createuser -s postgres 2>/dev/null || true

# Create test database
psql -U postgres -c "DROP DATABASE IF EXISTS loan_backend_test;"
psql -U postgres -c "CREATE DATABASE loan_backend_test;"