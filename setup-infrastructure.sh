#!/bin/bash

# AWS Infrastructure Setup Script for NestJS Loan Backend
# Make sure to run: chmod +x setup-infrastructure.sh

set -e

echo "🏗️ Setting up AWS infrastructure for NestJS Loan Backend..."

# Configuration
REGION="us-east-1"
VPC_CIDR="10.0.0.0/16"
SUBNET_1_CIDR="10.0.1.0/24"
SUBNET_2_CIDR="10.0.2.0/24"
AVAILABILITY_ZONE_1="us-east-1a"
AVAILABILITY_ZONE_2="us-east-1b"

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

# Step 1: Create VPC
print_status "Creating VPC..."
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block $VPC_CIDR \
  --tag-specifications ResourceType=vpc,Tags=[{Key=Name,Value=loan-backend-vpc}] \
  --query 'Vpc.VpcId' \
  --output text \
  --region $REGION)

print_status "VPC created with ID: $VPC_ID"

# Step 2: Create Internet Gateway
print_status "Creating Internet Gateway..."
IGW_ID=$(aws ec2 create-internet-gateway \
  --query 'InternetGateway.InternetGatewayId' \
  --output text \
  --region $REGION)

aws ec2 attach-internet-gateway \
  --vpc-id $VPC_ID \
  --internet-gateway-id $IGW_ID \
  --region $REGION

print_status "Internet Gateway created and attached: $IGW_ID"

# Step 3: Create public subnets
print_status "Creating public subnets..."
SUBNET_1_ID=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block $SUBNET_1_CIDR \
  --availability-zone $AVAILABILITY_ZONE_1 \
  --tag-specifications ResourceType=subnet,Tags=[{Key=Name,Value=loan-backend-subnet-1}] \
  --query 'Subnet.SubnetId' \
  --output text \
  --region $REGION)

SUBNET_2_ID=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block $SUBNET_2_CIDR \
  --availability-zone $AVAILABILITY_ZONE_2 \
  --tag-specifications ResourceType=subnet,Tags=[{Key=Name,Value=loan-backend-subnet-2}] \
  --query 'Subnet.SubnetId' \
  --output text \
  --region $REGION)

print_status "Subnets created: $SUBNET_1_ID, $SUBNET_2_ID"

# Step 4: Create route table
print_status "Creating route table..."
ROUTE_TABLE_ID=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications ResourceType=route-table,Tags=[{Key=Name,Value=loan-backend-rt}] \
  --query 'RouteTable.RouteTableId' \
  --output text \
  --region $REGION)

# Add route to internet gateway
aws ec2 create-route \
  --route-table-id $ROUTE_TABLE_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID \
  --region $REGION

# Associate route table with subnets
aws ec2 associate-route-table \
  --route-table-id $ROUTE_TABLE_ID \
  --subnet-id $SUBNET_1_ID \
  --region $REGION

aws ec2 associate-route-table \
  --route-table-id $ROUTE_TABLE_ID \
  --subnet-id $SUBNET_2_ID \
  --region $REGION

print_status "Route table created and configured: $ROUTE_TABLE_ID"

# Step 5: Create security group
print_status "Creating security group..."
SG_ID=$(aws ec2 create-security-group \
  --group-name loan-backend-sg \
  --description "Security group for loan backend" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text \
  --region $REGION)

# Configure security group rules
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region $REGION

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region $REGION

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 3000 \
  --cidr 0.0.0.0/0 \
  --region $REGION

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 5432 \
  --source-group $SG_ID \
  --region $REGION

print_status "Security group created: $SG_ID"

# Step 6: Create RDS subnet group
print_status "Creating RDS subnet group..."
aws rds create-db-subnet-group \
  --db-subnet-group-name loan-backend-subnet-group \
  --db-subnet-group-description "Subnet group for loan backend" \
  --subnet-ids $SUBNET_1_ID $SUBNET_2_ID \
  --region $REGION

print_status "RDS subnet group created"

# Step 7: Create RDS instance
print_status "Creating RDS PostgreSQL instance..."
aws rds create-db-instance \
  --db-instance-identifier loan-backend-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password YourSecurePassword123! \
  --allocated-storage 20 \
  --storage-type gp2 \
  --db-subnet-group-name loan-backend-subnet-group \
  --vpc-security-group-ids $SG_ID \
  --backup-retention-period 7 \
  --storage-encrypted \
  --deletion-protection \
  --region $REGION

print_status "RDS instance creation started. This may take several minutes..."

# Step 8: Create Application Load Balancer
print_status "Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name loan-backend-alb \
  --subnets $SUBNET_1_ID $SUBNET_2_ID \
  --security-groups $SG_ID \
  --scheme internet-facing \
  --type application \
  --region $REGION \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

print_status "Load Balancer created: $ALB_ARN"

# Step 9: Create target group
print_status "Creating target group..."
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
  --name loan-backend-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 2 \
  --region $REGION \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

print_status "Target group created: $TARGET_GROUP_ARN"

# Step 10: Create listener
print_status "Creating ALB listener..."
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN \
  --region $REGION

print_status "ALB listener created"

# Step 11: Create Secrets Manager secrets
print_status "Creating Secrets Manager secrets..."

# Wait for RDS to be available
print_status "Waiting for RDS instance to be available..."
aws rds wait db-instance-available --db-instance-identifier loan-backend-db --region $REGION

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier loan-backend-db \
  --region $REGION \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

# Store database credentials
aws secretsmanager create-secret \
  --name loan-backend/database \
  --description "Database credentials for loan backend" \
  --secret-string "{\"username\":\"admin\",\"password\":\"YourSecurePassword123!\",\"host\":\"$RDS_ENDPOINT\",\"port\":5432,\"database\":\"loanapp\"}" \
  --region $REGION

# Store application secrets
aws secretsmanager create-secret \
  --name loan-backend/app \
  --description "Application secrets for loan backend" \
  --secret-string "{\"JWT_SECRET\":\"your-super-secret-jwt-key-here\",\"AI_API_KEY\":\"your-openai-key-here\",\"NODE_ENV\":\"production\"}" \
  --region $REGION

print_status "Secrets created in Secrets Manager"

# Step 12: Create CloudWatch log group
print_status "Creating CloudWatch log group..."
aws logs create-log-group --log-group-name /ecs/loan-backend --region $REGION

# Set retention policy
aws logs put-retention-policy --log-group-name /ecs/loan-backend --retention-in-days 7 --region $REGION

print_status "CloudWatch log group created"

# Save infrastructure details
cat > infrastructure-details.txt << EOF
AWS Infrastructure Details for NestJS Loan Backend
================================================

Region: $REGION
VPC ID: $VPC_ID
Subnet 1 ID: $SUBNET_1_ID
Subnet 2 ID: $SUBNET_2_ID
Security Group ID: $SG_ID
Route Table ID: $ROUTE_TABLE_ID
Internet Gateway ID: $IGW_ID
Load Balancer ARN: $ALB_ARN
Target Group ARN: $TARGET_GROUP_ARN
RDS Instance: loan-backend-db
RDS Endpoint: $RDS_ENDPOINT

Next Steps:
1. Update your task-definition.json with the correct subnet IDs and security group ID
2. Run the deployment script: ./deploy.sh
3. Create ECS service with load balancer integration
4. Set up SSL certificate with AWS Certificate Manager
5. Configure domain name and DNS

Security Notes:
- Database is only accessible from within the VPC
- Security group restricts access to necessary ports only
- Secrets are stored in AWS Secrets Manager
- RDS encryption is enabled
EOF

print_status "Infrastructure setup completed successfully! 🎉"
print_status "Details saved to infrastructure-details.txt"

echo ""
echo "📋 Next steps:"
echo "1. Update task-definition.json with the subnet IDs: $SUBNET_1_ID, $SUBNET_2_ID"
echo "2. Update task-definition.json with security group ID: $SG_ID"
echo "3. Run: ./deploy.sh"
echo "4. Create ECS service with load balancer integration"
echo "5. Test your application endpoints"
