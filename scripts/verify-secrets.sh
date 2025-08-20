#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Check if a secret file exists and has content
check_secret() {
    local name=$1
    local file="secrets/${name}.txt"
    
    printf "Checking ${name}... "
    if [ ! -f "$file" ]; then
        echo -e "${RED}Missing${NC}"
        return 1
    elif [ ! -s "$file" ]; then
        echo -e "${RED}Empty${NC}"
        return 1
    else
        echo -e "${GREEN}OK${NC}"
        return 0
    fi
}

# Required secrets
REQUIRED_SECRETS=(
    "ai_api_key"
    "postgres_password"
    "pgadmin_default_password"
    "grafana_admin_password"
)

# Check all required secrets
echo "Verifying secrets..."
MISSING=0
for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! check_secret "$secret"; then
        MISSING=$((MISSING + 1))
    fi
done

if [ $MISSING -gt 0 ]; then
    echo -e "\n${RED}Found $MISSING missing or empty secrets${NC}"
    echo "Please run ./scripts/secure-secrets.sh to set up missing secrets"
    exit 1
else
    echo -e "\n${GREEN}All secrets verified successfully${NC}"
fi

# Verify permissions
echo -e "\nChecking permissions..."
if [ "$(stat -f %Lp secrets)" != "700" ]; then
    echo -e "${RED}Warning: secrets directory should have 700 permissions${NC}"
    chmod 700 secrets
    echo "Fixed secrets directory permissions"
fi

for secret in "${REQUIRED_SECRETS[@]}"; do
    file="secrets/${secret}.txt"
    if [ -f "$file" ] && [ "$(stat -f %Lp "$file")" != "600" ]; then
        echo -e "${RED}Warning: $file should have 600 permissions${NC}"
        chmod 600 "$file"
        echo "Fixed $file permissions"
    fi
done

echo -e "\n${GREEN}Verification complete${NC}"
