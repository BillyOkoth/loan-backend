# 🚀 GitHub Actions Setup for AWS ECS Deployment

This guide will help you set up automated CI/CD deployment from GitHub to AWS ECS.

## 📋 **Prerequisites**

- ✅ AWS infrastructure already deployed (VPC, ECS, RDS, ALB)
- ✅ GitHub repository with your NestJS code
- ✅ AWS CLI configured locally
- ✅ IAM user with deployment permissions

## 🔐 **Step 1: Create IAM User for GitHub Actions**

### **1.1 Create Deployment User**
```bash
# Create a new IAM user for GitHub Actions
aws iam create-user --user-name github-actions-deployer

# Create access key
aws iam create-access-key --user-name github-actions-deployer
```

**Save the Access Key ID and Secret Access Key** - you'll need these for GitHub secrets.

### **1.2 Attach Required Policies**
```bash
# Attach policies for ECS deployment
aws iam attach-user-policy \
  --user-name github-actions-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonECS-FullAccess

# Attach policies for ECR access
aws iam attach-user-policy \
  --user-name github-actions-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess

# Attach policies for Secrets Manager
aws iam attach-user-policy \
  --user-name github-actions-deployer \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite

# Attach policies for Load Balancer access
aws iam attach-user-policy \
  --user-name github-actions-deployer \
  --policy-arn arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess
```

### **1.3 Create Custom Policy for Specific Resources**
```bash
# Get your account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create custom policy for your specific resources
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

# Create and attach the custom policy
aws iam create-policy \
  --policy-name github-actions-loan-backend-policy \
  --policy-document file://github-actions-policy.json

aws iam attach-user-policy \
  --user-name github-actions-deployer \
  --policy-arn arn:aws:iam::$ACCOUNT_ID:policy/github-actions-loan-backend-policy

# Clean up
rm github-actions-policy.json
```

## 🔑 **Step 2: Configure GitHub Secrets**

### **2.1 Go to Your GitHub Repository**
1. Navigate to your repository on GitHub
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions**

### **2.2 Add the Following Secrets**
Click **New repository secret** and add:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | Your GitHub Actions user access key ID |
| `AWS_SECRET_ACCESS_KEY` | Your GitHub Actions user secret access key |

**Example:**
```
Secret Name: AWS_ACCESS_KEY_ID
Secret Value: AKIAIOSFODNN7EXAMPLE

Secret Name: AWS_SECRET_ACCESS_KEY
Secret Value: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

## 📁 **Step 3: Repository Structure**

Ensure your repository has this structure:
```
loan-backend/
├── .github/
│   └── workflows/
│       └── deploy-aws-ecs.yml
├── src/
├── Dockerfile.prod
├── task-definition.json
├── package.json
└── README.md
```

## 🚀 **Step 4: Test the Workflow**

### **4.1 Push to Main Branch**
```bash
# Make sure you're on main branch
git checkout main

# Add the workflow file
git add .github/workflows/deploy-aws-ecs.yml

# Commit and push
git commit -m "Add GitHub Actions workflow for AWS ECS deployment"
git push origin main
```

### **4.2 Monitor the Workflow**
1. Go to your GitHub repository
2. Click **Actions** tab
3. You should see "Deploy to AWS ECS" workflow running
4. Click on it to see detailed progress

## 🔍 **Step 5: Workflow Explanation**

### **Test Job (Runs on PR and Push)**
```yaml
test:
  runs-on: ubuntu-latest
  steps:
  - Checkout code
  - Setup Node.js 18
  - Install dependencies (npm ci)
  - Run tests (npm test)
  - Run linting (npm run lint)
  - Type checking (npm run build)
```

**What it does:**
- Ensures code quality before deployment
- Catches bugs early
- Prevents broken code from reaching production

### **Deploy Job (Runs only on main branch)**
```yaml
deploy:
  needs: test
  if: github.ref == 'refs/heads/main'
  steps:
  - Configure AWS credentials
  - Login to ECR
  - Build and push Docker image
  - Download current task definition
  - Update image reference
  - Deploy to ECS
  - Verify deployment
  - Health check
```

**What it does:**
- Only runs after tests pass
- Only deploys from main branch
- Builds production Docker image
- Updates ECS service with new image
- Waits for service stability
- Tests health endpoint

## 🐳 **Step 6: Docker Image Strategy**

### **Image Tags Used:**
- **`latest`**: Always points to the most recent deployment
- **`{commit-sha}`**: Specific version for rollback capability

### **Benefits:**
- Easy rollback to previous versions
- Clear version tracking
- Production and staging can use different tags

## 🔄 **Step 7: Deployment Process**

### **What Happens on Each Push:**
1. **Code Pushed** → GitHub Actions triggered
2. **Tests Run** → Code quality verified
3. **Docker Build** → Production image created
4. **ECR Push** → Image uploaded to AWS
5. **Task Definition** → Updated with new image
6. **ECS Update** → Service updated with new task definition
7. **Health Check** → Deployment verified

### **Rollback Process:**
```bash
# If you need to rollback to a specific commit
aws ecs update-service \
  --cluster loan-backend-cluster \
  --service loan-backend-service \
  --task-definition loan-backend:REVISION_NUMBER
```

## 🚨 **Troubleshooting Common Issues**

### **Issue 1: AWS Credentials Error**
```bash
# Verify IAM user has correct permissions
aws sts get-caller-identity

# Check if user can access ECS
aws ecs list-clusters
```

### **Issue 2: ECR Login Failed**
```bash
# Verify ECR repository exists
aws ecr describe-repositories --repository-names loan-backend

# Check IAM permissions for ECR
aws ecr get-login-password
```

### **Issue 3: ECS Service Update Failed**
```bash
# Check service status
aws ecs describe-services \
  --cluster loan-backend-cluster \
  --services loan-backend-service

# Check task definition
aws ecs describe-task-definition \
  --task-definition loan-backend
```

### **Issue 4: Health Check Failed**
```bash
# Check load balancer health
aws elbv2 describe-target-health \
  --target-group-arn YOUR_TARGET_GROUP_ARN

# Check ECS task logs
aws logs tail /ecs/loan-backend --follow
```

## 📊 **Monitoring & Alerts**

### **GitHub Actions Notifications:**
- Workflow success/failure notifications
- Detailed logs for debugging
- Status badges for README

### **AWS Monitoring:**
- CloudWatch metrics for ECS
- ECR image scanning results
- Load balancer health metrics

## 🔒 **Security Best Practices**

### **IAM Permissions:**
- ✅ Least privilege access
- ✅ Specific resource restrictions
- ✅ No admin permissions

### **Secrets Management:**
- ✅ GitHub secrets encrypted
- ✅ No hardcoded credentials
- ✅ Regular key rotation

### **Network Security:**
- ✅ VPC isolation
- ✅ Security group restrictions
- ✅ Private subnets for database

## 📈 **Scaling & Optimization**

### **Build Optimization:**
```yaml
# Add to workflow for faster builds
- name: Cache Docker layers
  uses: actions/cache@v3
  with:
    path: /tmp/.buildx-cache
    key: ${{ runner.os }}-buildx-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-buildx-
```

### **Parallel Jobs:**
```yaml
# Run tests and build in parallel
test-and-build:
  strategy:
    matrix:
      job: [test, build]
  steps:
  - name: ${{ matrix.job }}
    run: |
      if [ "${{ matrix.job }}" = "test" ]; then
        npm test
      else
        npm run build
      fi
```

## 🎯 **Next Steps After Setup**

1. **Test the workflow** with a small change
2. **Monitor first deployment** closely
3. **Set up notifications** for deployment status
4. **Configure branch protection** rules
5. **Add deployment badges** to README
6. **Set up staging environment** for testing

## 📚 **Useful Commands**

### **Check Workflow Status:**
```bash
# View recent workflow runs
gh run list --workflow=deploy-aws-ecs.yml

# View specific run details
gh run view RUN_ID --workflow=deploy-aws-ecs.yml
```

### **Manual Deployment:**
```bash
# If you need to deploy manually
gh workflow run deploy-aws-ecs.yml
```

### **View Logs:**
```bash
# View workflow logs
gh run view --log
```

---

## 🎉 **Congratulations!**

You now have a fully automated CI/CD pipeline that:
- ✅ Tests your code automatically
- ✅ Builds production Docker images
- ✅ Deploys to AWS ECS
- ✅ Verifies deployment health
- ✅ Provides rollback capability

Your NestJS loan backend will automatically deploy every time you push to the main branch! 🚀
