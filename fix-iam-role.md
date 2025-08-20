# 🔐 Fix IAM Role Error - Manual Steps

## ❌ **Error: Role is not valid**

This error occurs because the IAM role `ecsTaskExecutionRole` doesn't exist in your AWS account.

## 🛠️ **Manual Fix (Choose One Option)**

### **Option 1: Run the Automated Script (Recommended)**
```bash
# Make the script executable
chmod +x create-iam-role.sh

# Run the script
./create-iam-role.sh
```

### **Option 2: Manual Commands (Step by Step)**

#### **Step 1: Get Your AWS Account ID**
```bash
aws sts get-caller-identity --query Account --output text
```
**Copy the output** - you'll need this for the next steps.

#### **Step 2: Create Trust Policy File**
```bash
cat > trust-policy.json << 'EOF'
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
```

#### **Step 3: Create IAM Role**
```bash
# Replace YOUR_ACCOUNT_ID with the actual account ID from Step 1
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file://trust-policy.json \
  --description "ECS Task Execution Role for loan-backend"
```

#### **Step 4: Attach ECS Execution Policy**
```bash
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

#### **Step 5: Create Custom Policy for Secrets**
```bash
# Replace YOUR_ACCOUNT_ID with your actual account ID
cat > secrets-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:loan-backend/*"
      ]
    }
  ]
}
EOF
```

#### **Step 6: Create and Attach Custom Policy**
```bash
# Replace YOUR_ACCOUNT_ID with your actual account ID
aws iam create-policy \
  --policy-name loan-backend-secrets-policy \
  --policy-document file://secrets-policy.json \
  --description "Policy for accessing loan-backend secrets"

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/loan-backend-secrets-policy
```

#### **Step 7: Update Task Definition**
```bash
# Replace YOUR_ACCOUNT_ID with your actual account ID
sed -i.bak "s/ACCOUNT_ID/YOUR_ACCOUNT_ID/g" task-definition.json
```

#### **Step 8: Clean Up**
```bash
rm -f trust-policy.json secrets-policy.json task-definition.json.bak
```

## 🔍 **Verify the Fix**

### **Check if Role Exists**
```bash
aws iam get-role --role-name ecsTaskExecutionRole
```

### **Check Role Policies**
```bash
aws iam list-attached-role-policies --role-name ecsTaskExecutionRole
```

### **Test Task Definition Registration**
```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

## 📋 **What Each Policy Does**

### **AmazonECSTaskExecutionRolePolicy (AWS Managed)**
- Pull images from ECR
- Write logs to CloudWatch
- Basic ECS operations

### **loan-backend-secrets-policy (Custom)**
- Access secrets from Secrets Manager
- Specifically for your loan-backend secrets
- Follows least privilege principle

## 🚨 **Common Issues & Solutions**

### **Issue: Access Denied**
```bash
# Check if your AWS user has IAM permissions
aws iam list-roles

# If denied, you need IAMFullAccess or IAMCreateRole permissions
```

### **Issue: Role Already Exists**
```bash
# Check existing role
aws iam get-role --role-name ecsTaskExecutionRole

# If it exists, just attach the policies
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### **Issue: Policy Already Exists**
```bash
# Check existing policies
aws iam list-policies --query 'Policies[?PolicyName==`loan-backend-secrets-policy`]'

# If it exists, just attach it to the role
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/loan-backend-secrets-policy
```

## ✅ **After Fixing IAM Role**

1. **Run the deployment script again:**
   ```bash
   ./deploy.sh
   ```

2. **The task definition should now register successfully**

3. **Continue with load balancer integration:**
   ```bash
   ./deploy-with-lb.sh
   ```

## 🔐 **Security Notes**

- The role follows the principle of least privilege
- Only ECS tasks can assume this role
- Access is limited to specific secrets
- No unnecessary permissions granted

## 📚 **Understanding IAM Roles**

### **What is an IAM Role?**
- A set of permissions that can be assumed by AWS services
- More secure than hardcoded credentials
- Automatically rotated by AWS

### **Why Does ECS Need This Role?**
- To pull Docker images from ECR
- To write application logs to CloudWatch
- To access secrets from Secrets Manager
- To perform basic ECS operations

### **Trust Policy Explanation**
```json
{
  "Principal": {
    "Service": "ecs-tasks.amazonaws.com"
  }
}
```
This means only the ECS service can assume this role, not users or other services.
