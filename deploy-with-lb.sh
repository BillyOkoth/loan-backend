#!/bin/bash

# Final Deployment Script with Load Balancer Integration
# Make sure to run: chmod +x deploy-with-lb.sh

set -e

echo "🚀 Final deployment with load balancer integration..."

# Configuration
REGION="us-east-1"
CLUSTER_NAME="loan-backend-cluster"
SERVICE_NAME="loan-backend-service"
TASK_FAMILY="loan-backend"

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

# Check if infrastructure-details.txt exists
if [ ! -f "infrastructure-details.txt" ]; then
    print_error "infrastructure-details.txt not found. Please run setup-infrastructure.sh first."
    exit 1
fi

# Extract infrastructure details
print_status "Reading infrastructure details..."
SUBNET_1_ID=$(grep "Subnet 1 ID:" infrastructure-details.txt | awk '{print $4}')
SUBNET_2_ID=$(grep "Subnet 2 ID:" infrastructure-details.txt | awk '{print $4}')
SG_ID=$(grep "Security Group ID:" infrastructure-details.txt | awk '{print $4}')
TARGET_GROUP_ARN=$(grep "Target Group ARN:" infrastructure-details.txt | awk '{print $4}')

if [ -z "$SUBNET_1_ID" ] || [ -z "$SUBNET_2_ID" ] || [ -z "$SG_ID" ]; then
    print_error "Could not extract infrastructure details. Please check infrastructure-details.txt"
    exit 1
fi

print_status "Using subnet IDs: $SUBNET_1_ID, $SUBNET_2_ID"
print_status "Using security group ID: $SG_ID"

# Get the latest task definition revision
print_status "Getting latest task definition..."
TASK_DEF_ARN=$(aws ecs describe-task-definition --task-definition $TASK_FAMILY --region $REGION --query 'taskDefinition.taskDefinitionArn' --output text)

if [ -z "$TASK_DEF_ARN" ]; then
    print_error "Task definition not found. Please run deploy.sh first."
    exit 1
fi

print_status "Using task definition: $TASK_DEF_ARN"

# Check if service already exists
if aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION &> /dev/null; then
    print_status "Updating existing ECS service..."
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --task-definition $TASK_DEF_ARN \
        --region $REGION
else
    print_status "Creating new ECS service with load balancer integration..."
    
    # Create service with load balancer
    aws ecs create-service \
        --cluster $CLUSTER_NAME \
        --service-name $SERVICE_NAME \
        --task-definition $TASK_DEF_ARN \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1_ID,$SUBNET_2_ID],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
        --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=loan-backend,containerPort=3000" \
        --region $REGION
fi

print_status "ECS service created/updated successfully! 🎉"

# Wait for service to be stable
print_status "Waiting for service to be stable..."
aws ecs wait services-stable --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION

# Get service details
print_status "Getting service details..."
SERVICE_DETAILS=$(aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION)

# Get load balancer DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers --region $REGION --query 'LoadBalancers[?contains(LoadBalancerName, `loan-backend-alb`)].DNSName' --output text)

if [ -n "$ALB_DNS" ]; then
    print_status "Load Balancer DNS: $ALB_DNS"
    print_status "Your application should be accessible at: http://$ALB_DNS"
    
    # Test the endpoint
    print_status "Testing application endpoint..."
    if curl -f http://$ALB_DNS/health &> /dev/null; then
        print_status "✅ Application is responding successfully!"
    else
        print_warning "⚠️ Application endpoint test failed. This might be normal during startup."
    fi
else
    print_warning "Could not retrieve load balancer DNS name."
fi

# Get task details
TASK_ARN=$(aws ecs list-tasks --cluster $CLUSTER_NAME --service-name $SERVICE_NAME --region $REGION --query 'taskArns[0]' --output text)

if [ -n "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ]; then
    print_status "Task ARN: $TASK_ARN"
    
    # Get task public IP
    TASK_IP=$(aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $TASK_ARN --region $REGION --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' --output text)
    
    if [ -n "$TASK_IP" ] && [ "$TASK_IP" != "None" ]; then
        print_status "Task Private IP: $TASK_IP"
    fi
fi

print_status "Deployment completed successfully! 🎉"

echo ""
echo "📋 Next steps:"
echo "1. Set up SSL certificate with AWS Certificate Manager"
echo "2. Configure domain name and DNS"
echo "3. Set up monitoring and alerts"
echo "4. Test all application endpoints"
echo "5. Monitor CloudWatch logs for any issues"

echo ""
echo "🔍 Useful commands:"
echo "Check service status: aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION"
echo "View logs: aws logs tail /ecs/loan-backend --region $REGION --follow"
echo "Scale service: aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --desired-count 2 --region $REGION"
