#!/bin/bash

# AWS Deployment Script for NestJS Loan Backend
# Make sure to run: chmod +x deploy.sh

set -e

echo "🚀 Starting AWS deployment for NestJS Loan Backend..."

# Configuration
REGION="us-east-1"
CLUSTER_NAME="loan-backend-cluster"
SERVICE_NAME="loan-backend-service"
TASK_FAMILY="loan-backend"
ECR_REPO_NAME="loan-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Update task definition with account ID
sed -i.bak "s/ACCOUNT_ID/$ACCOUNT_ID/g" task-definition.json

# Step 1: Create ECR repository if it doesn't exist
print_status "Creating ECR repository..."
aws ecr create-repository --repository-name $ECR_REPO_NAME --region $REGION --image-scanning-configuration scanOnPush=true 2>/dev/null || print_warning "ECR repository already exists"

# Step 2: Login to ECR
print_status "Logging in to ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Step 3: Build and push Docker image
print_status "Building Docker image..."
docker build -f Dockerfile.prod -t $ECR_REPO_NAME .

print_status "Tagging image..."
docker tag $ECR_REPO_NAME:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_NAME:latest

print_status "Pushing image to ECR..."
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_NAME:latest

# Step 4: Create ECS cluster if it doesn't exist
print_status "Creating ECS cluster..."
aws ecs create-cluster --cluster-name $CLUSTER_NAME --capacity-providers FARGATE --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 --region $REGION 2>/dev/null || print_warning "ECS cluster already exists"

# Step 5: Create CloudWatch log group
print_status "Creating CloudWatch log group..."
aws logs create-log-group --log-group-name /ecs/$TASK_FAMILY --region $REGION 2>/dev/null || print_warning "Log group already exists"

# Step 6: Register task definition
print_status "Registering task definition..."
TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file://task-definition.json --region $REGION --query 'taskDefinition.taskDefinitionArn' --output text)
print_status "Task definition registered: $TASK_DEF_ARN"

# Step 7: Create or update service
if aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION &> /dev/null; then
    print_status "Updating existing ECS service..."
    aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --task-definition $TASK_DEF_ARN --region $REGION
else
    print_status "Creating new ECS service..."
    # You'll need to create a load balancer first
    print_warning "Please create a load balancer and target group first, then run:"
    echo "aws ecs create-service --cluster $CLUSTER_NAME --service-name $SERVICE_NAME --task-definition $TASK_DEF_ARN --desired-count 1 --launch-type FARGATE --network-configuration \"awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-yyyyy],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}\" --region $REGION"
fi

print_status "Deployment completed successfully! 🎉"
print_status "Your application should be running on ECS Fargate."
print_status "Check the ECS console to monitor the service status."

# Clean up temporary files
rm -f task-definition.json.bak

echo ""
echo "📋 Next steps:"
echo "1. Create a load balancer and target group"
echo "2. Update the ECS service with load balancer configuration"
echo "3. Set up SSL certificate with AWS Certificate Manager"
echo "4. Configure domain name and DNS"
echo "5. Test your application endpoints"
