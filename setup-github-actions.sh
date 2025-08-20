#!/bin/bash

# Setup GitHub Actions IAM User for AWS ECS Deployment
# Make sure to run: chmod +x setup-github-actions.sh

set -e

echo "🔐 Setting up IAM user for GitHub Actions deployment..."

# Configuration
REGION="us-east-1"
USER_NAME="github-actions-deployer"
POLICY_NAME="github-actions-loan-backend-policy"

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

# Step 1: Create IAM user
print_status "Creating IAM user: $USER_NAME"
aws iam create-user --user-name $USER_NAME 2>/dev/null || print_warning "User already exists"

# Step 2: Create access key
print_status "Creating access key for user..."
ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name $USER_NAME 2>/dev/null || echo "Access key already exists")

if [[ $ACCESS_KEY_OUTPUT == *"AccessKeyId"* ]]; then
    ACCESS_KEY_ID=$(echo "$ACCESS_KEY_OUTPUT" | jq -r '.AccessKey.AccessKeyId')
    SECRET_ACCESS_KEY=$(echo "$ACCESS_KEY_OUTPUT" | jq -r '.AccessKey.SecretAccessKey')
    
    print_status "✅ Access key created successfully!"
    echo ""
    echo "🔑 SAVE THESE CREDENTIALS FOR GITHUB SECRETS:"
    echo "=============================================="
    echo "AWS_ACCESS_KEY_ID: $ACCESS_KEY_ID"
    echo "AWS_SECRET_ACCESS_KEY: $SECRET_ACCESS_KEY"
    echo "=============================================="
    echo ""
    echo "⚠️  IMPORTANT: Save these credentials now - you won't see the secret key again!"
    echo ""
else
    print_warning "Access key already exists. You'll need to create a new one manually if needed."
fi

# Step 3: Attach AWS managed policies
print_status "Attaching AWS managed policies..."

# ECS Full Access
aws iam attach-user-policy \
  --user-name $USER_NAME \
  --policy-arn arn:aws:iam::aws:policy/AmazonECS-FullAccess \
  2>/dev/null || print_warning "ECS policy already attached"

# ECR Full Access
aws iam attach-user-policy \
  --user-name $USER_NAME \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess \
  2>/dev/null || print_warning "ECR policy already attached"

# Secrets Manager access
aws iam attach-user-policy \
  --user-name $USER_NAME \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite \
  2>/dev/null || print_warning "Secrets Manager policy already attached"

# Load Balancer access
aws iam attach-user-policy \
  --user-name $USER_NAME \
  --policy-arn arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess \
  2>/dev/null || print_warning "Load Balancer policy already attached"

# Step 4: Create custom policy for specific resources
print_status "Creating custom policy for specific resources..."
cat > github-actions-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:ListTasks",
        "ecs:DescribeTasks"
      ],
      "Resource": [
        "arn:aws:ecs:us-east-1:$ACCOUNT_ID:cluster/loan-backend-cluster",
        "arn:aws:ecs:us-east-1:$ACCOUNT_ID:service/loan-backend-cluster/loan-backend-service",
        "arn:aws:ecs:us-east-1:$ACCOUNT_ID:task-definition/loan-backend:*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:us-east-1:$ACCOUNT_ID:repository/loan-backend"
    },
    {
      "Effect": "Allow",
      "Action": [
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeTargetGroups",
        "elasticloadbalancing:DescribeTargetHealth"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Step 5: Create and attach custom policy
print_status "Creating custom policy: $POLICY_NAME"
aws iam create-policy \
  --policy-name $POLICY_NAME \
  --policy-document file://github-actions-policy.json \
  2>/dev/null || print_warning "Custom policy already exists"

POLICY_ARN="arn:aws:iam::$ACCOUNT_ID:policy/$POLICY_NAME"
print_status "Attaching custom policy to user..."
aws iam attach-user-policy \
  --user-name $USER_NAME \
  --policy-arn $POLICY_ARN \
  2>/dev/null || print_warning "Custom policy already attached"

# Step 6: Verify user setup
print_status "Verifying user setup..."
USER_ARN=$(aws iam get-user --user-name $USER_NAME --query 'User.Arn' --output text)
print_status "User ARN: $USER_ARN"

# Step 7: List attached policies
print_status "Attached policies:"
aws iam list-attached-user-policies --user-name $USER_NAME --query 'AttachedPolicies[].PolicyName' --output table

# Step 8: Clean up
rm -f github-actions-policy.json

print_status "GitHub Actions IAM user setup completed successfully! 🎉"

echo ""
echo "📋 Next steps:"
echo "1. Copy the AWS credentials above to GitHub repository secrets"
echo "2. Add the workflow file to .github/workflows/deploy-aws-ecs.yml"
echo "3. Push to main branch to trigger deployment"
echo ""
echo "🔑 GitHub Secrets to add:"
echo "   - AWS_ACCESS_KEY_ID: $ACCESS_KEY_ID"
echo "   - AWS_SECRET_ACCESS_KEY: [The secret key shown above]"
echo ""
echo "📁 Repository structure needed:"
echo "   .github/workflows/deploy-aws-ecs.yml"
echo ""
echo "🚀 To test: git push origin main"
