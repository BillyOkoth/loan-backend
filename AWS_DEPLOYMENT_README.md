# 🚀 AWS Deployment Guide for NestJS Loan Backend

This guide will help you deploy your NestJS loan backend application to AWS using ECS Fargate, RDS PostgreSQL, and Application Load Balancer.

## 📋 Prerequisites

- AWS Account with free tier access
- AWS CLI installed and configured
- Docker installed locally
- Git repository for your code
- Domain name (optional but recommended)

## 🔒 Security Features

- ✅ VPC with private subnets for database
- ✅ Security groups with minimal required access
- ✅ Secrets stored in AWS Secrets Manager
- ✅ RDS encryption at rest and in transit
- ✅ IAM roles with least privilege access
- ✅ CloudTrail enabled for audit logging

## 🏗️ Architecture Overview

```
Internet → CloudFront → ALB → ECS Fargate → NestJS App
                    ↓
                RDS PostgreSQL
                ↓
            Secrets Manager + IAM
```

## 📁 Files Created

- `Dockerfile.prod` - Production-optimized Dockerfile
- `task-definition.json` - ECS task definition
- `setup-infrastructure.sh` - Infrastructure setup script
- `deploy.sh` - Application deployment script
- `deploy-with-lb.sh` - Load balancer integration script

## 🚀 Quick Start Deployment

### Step 1: AWS CLI Setup
```bash
# Install AWS CLI (macOS)
brew install awscli

# Configure AWS CLI
aws configure
# Enter your Access Key ID, Secret Access Key, region (us-east-1), and output format (json)
```

### Step 2: Make Scripts Executable
```bash
chmod +x setup-infrastructure.sh
chmod +x deploy.sh
chmod +x deploy-with-lb.sh
```

### Step 3: Setup Infrastructure
```bash
./setup-infrastructure.sh
```

This script will create:
- VPC with public subnets
- Security groups
- RDS PostgreSQL instance
- Application Load Balancer
- Target group
- Secrets Manager secrets
- CloudWatch log group

### Step 4: Deploy Application
```bash
./deploy.sh
```

This script will:
- Create ECR repository
- Build and push Docker image
- Create ECS cluster
- Register task definition

### Step 5: Create ECS Service with Load Balancer
```bash
./deploy-with-lb.sh
```

This script will:
- Create ECS service
- Integrate with load balancer
- Test the deployment

## 🔧 Manual Configuration

### Update Task Definition
After running `setup-infrastructure.sh`, update `task-definition.json` with:
- Your AWS Account ID
- Subnet IDs from `infrastructure-details.txt`
- Security Group ID from `infrastructure-details.txt`

### Environment Variables
The following environment variables are automatically configured:
- `NODE_ENV=production`
- `PORT=3000`
- `DATABASE_TYPE=postgres`
- Database credentials from Secrets Manager
- JWT secret from Secrets Manager
- AI API key from Secrets Manager

## 📊 Monitoring & Logging

### CloudWatch Logs
- Log group: `/ecs/loan-backend`
- Retention: 7 days
- View logs: `aws logs tail /ecs/loan-backend --region us-east-1 --follow`

### Health Checks
- Endpoint: `/health`
- Interval: 30 seconds
- Timeout: 3 seconds
- Retries: 3

### Metrics
- CPU utilization
- Memory usage
- Network metrics
- Application metrics

## 🔍 Troubleshooting

### Common Issues

#### 1. ECS Service Not Starting
```bash
# Check service events
aws ecs describe-services --cluster loan-backend-cluster --services loan-backend-service --region us-east-1

# Check task logs
aws logs tail /ecs/loan-backend --region us-east-1 --follow
```

#### 2. Database Connection Issues
```bash
# Check RDS status
aws rds describe-db-instances --db-instance-identifier loan-backend-db --region us-east-1

# Check security group rules
aws ec2 describe-security-groups --group-ids sg-xxxxx --region us-east-1
```

#### 3. Load Balancer Health Check Failing
```bash
# Check target group health
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/loan-backend-tg --region us-east-1

# Check security group rules for port 3000
```

### Debug Commands
```bash
# Check ECS cluster status
aws ecs describe-clusters --clusters loan-backend-cluster --region us-east-1

# List running tasks
aws ecs list-tasks --cluster loan-backend-cluster --region us-east-1

# Describe task
aws ecs describe-tasks --cluster loan-backend-cluster --tasks TASK_ARN --region us-east-1

# Check load balancer
aws elbv2 describe-load-balancers --region us-east-1
```

## 💰 Cost Management

### Free Tier Limits (12 months)
- **EC2**: 750 hours/month of t2.micro or t3.micro
- **RDS**: 750 hours/month of db.t3.micro
- **ECS Fargate**: 2,000 vCPU seconds and 4GB memory hours/month
- **ALB**: 750 hours/month
- **Data Transfer**: 15GB/month outbound

### Cost Optimization
```bash
# Set up billing alerts
aws cloudwatch put-metric-alarm \
  --alarm-name billing-alert \
  --alarm-description "Billing alert" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

## 🔐 Security Best Practices

### IAM Policies
- Use least privilege access
- Regularly rotate access keys
- Enable MFA on all accounts

### Network Security
- Database in private subnets
- Security groups restrict access
- VPC flow logs enabled

### Data Protection
- RDS encryption enabled
- Secrets in AWS Secrets Manager
- Regular backups configured

## 📚 Additional Resources

- [AWS Free Tier Documentation](https://aws.amazon.com/free/)
- [ECS Fargate Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/userguide/best-practices.html)
- [AWS Security Best Practices](https://aws.amazon.com/security/security-learning/)
- [NestJS Production Deployment](https://docs.nestjs.com/deployment)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review CloudWatch logs
3. Verify infrastructure components are running
4. Check security group configurations
5. Ensure all required services are enabled

## 📝 Notes

- The deployment uses `us-east-1` region by default
- All resources are tagged for easy identification
- Infrastructure details are saved to `infrastructure-details.txt`
- Scripts include error handling and colored output
- Health checks are configured for automatic recovery

## 🎯 Next Steps After Deployment

1. **SSL Certificate**: Set up HTTPS with AWS Certificate Manager
2. **Domain**: Configure custom domain and DNS
3. **Monitoring**: Set up CloudWatch dashboards and alerts
4. **Backup**: Configure automated backups for RDS
5. **Scaling**: Set up auto-scaling policies
6. **CI/CD**: Integrate with GitHub Actions or AWS CodePipeline

---

**Happy Deploying! 🚀**

Your NestJS loan backend will be running securely on AWS with enterprise-grade infrastructure.
