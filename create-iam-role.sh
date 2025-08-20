#!/bin/bash

# Create IAM Role for ECS Task Execution
# Make sure to run: chmod +x create-iam-role.sh

set -e

echo "🔐 Creating IAM role for ECS task execution..."

# Configuration
REGION="us-east-1"
ROLE_NAME="ecsTaskExecutionRole"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
print_status "Using AWS Account ID: $ACCOUNT_ID"

# Step 1: Create trust policy file
print_status "Creating trust policy..."
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Step 2: Create the IAM role
print_status "Creating IAM role: $ROLE_NAME"
aws iam create-role \
  --role-name $ROLE_NAME \
  --assume-role-policy-document file://trust-policy.json \
  --description "ECS Task Execution Role for loan-backend" \
  2>/dev/null || print_warning "Role already exists"

# Step 3: Attach the AWS managed policy for ECS task execution
print_status "Attaching ECS task execution policy..."
aws iam attach-role-policy \
  --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Step 4: Create custom policy for Secrets Manager access
print_status "Creating custom policy for Secrets Manager access..."
cat > secrets-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:$ACCOUNT_ID:secret:loan-backend/*"
      ]
    }
  ]
}
EOF

# Step 5: Create the custom policy
POLICY_NAME="loan-backend-secrets-policy"
print_status "Creating custom policy: $POLICY_NAME"
aws iam create-policy \
  --policy-name $POLICY_NAME \
  --policy-document file://secrets-policy.json \
  --description "Policy for accessing loan-backend secrets" \
  2>/dev/null || print_warning "Policy already exists"

# Step 6: Attach the custom policy to the role
POLICY_ARN="arn:aws:iam::$ACCOUNT_ID:policy/$POLICY_NAME"
print_status "Attaching custom policy to role..."
aws iam attach-role-policy \
  --role-name $ROLE_NAME \
  --policy-arn $POLICY_ARN

# Step 7: Verify the role
print_status "Verifying role creation..."
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
print_status "Role created successfully: $ROLE_ARN"

# Step 8: Update task definition with correct account ID
print_status "Updating task definition with your account ID..."
sed -i.bak "s/ACCOUNT_ID/$ACCOUNT_ID/g" task-definition.json

# Step 9: Clean up temporary files
rm -f trust-policy.json secrets-policy.json task-definition.json.bak

print_status "IAM role setup completed successfully! 🎉"
print_status "Role ARN: $ROLE_ARN"

echo ""
echo "📋 Next steps:"
echo "1. Run: ./deploy.sh"
echo "2. The task definition should now register successfully"
echo "3. Continue with: ./deploy-with-lb.sh"
