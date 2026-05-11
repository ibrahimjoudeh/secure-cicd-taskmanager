# Secure CI/CD Pipeline for a Containerized Web Application — Free-Tier AWS Version

Course: Cloud Computing & Security (Fall 2025)  
Team: Ibrahim Joudeh 20200254, Zaina Derbas 20220512, Malek Alsatari 20210021

This repository implements a secure DevSecOps pipeline for a Flask task management app. The original production-style architecture used ECS Fargate, RDS, ALB, NAT Gateway, Secrets Manager, and WAF. This version was changed to a **free-tier-focused AWS deployment** so the project can be demonstrated on AWS without intentionally creating always-paid services.

## Free-Tier Architecture Summary

Live AWS deployment:

```text
GitHub Repository
    ↓
GitHub Actions CI/CD
    ↓
Tests + Gitleaks + Trivy + Docker build
    ↓
Amazon ECR private repository
    ↓
AWS Systems Manager Run Command
    ↓
Amazon EC2 t2.micro/t3.micro instance
    ↓
Docker Compose on EC2
    ↓
Flask App Container + PostgreSQL Container
    ↓
CloudWatch Logs + Security Groups + IAM
```

AWS services used meaningfully:

1. **Amazon EC2**: hosts Docker Compose, Flask, and PostgreSQL containers on a free-tier eligible micro instance.
2. **Amazon ECR**: stores approved Docker images built by GitHub Actions.
3. **AWS IAM**: provides least-privilege EC2 and GitHub Actions OIDC roles.
4. **Amazon VPC and Security Groups**: isolate networking and allow only required inbound ports.
5. **AWS Systems Manager Parameter Store / Run Command**: stores deployment metadata and lets GitHub deploy without SSH keys.
6. **Amazon CloudWatch Logs**: stores app logs with short retention to reduce cost risk.

Removed from live deployment to avoid paid services:

```text
ECS Fargate
RDS PostgreSQL
Application Load Balancer
NAT Gateway
Secrets Manager
AWS WAF
Custom KMS keys
CloudWatch dashboards/alarms
```

## Local Development

Run the app locally with Docker Desktop:

```bash
docker compose up --build
```

Open:

```text
http://localhost:5000
http://localhost:5000/health
```

Run local tests:

```bash
./scripts/local-test.sh
```

Expected output:

```text
ruff check .
All checks passed!
pytest --cov=. --cov-report=term-missing
5 passed
```

## Free-Tier AWS Deployment

### 1. Prerequisites

Install and configure:

```bash
aws --version
terraform -version
docker --version
git --version
```

Configure AWS CLI:

```bash
aws configure
aws sts get-caller-identity
```

### 2. Create GitHub Repository

Create a GitHub repository named:

```text
secure-cicd-taskmanager
```

Push this project:

```bash
git init
git add .
git commit -m "Initial free-tier AWS DevSecOps project"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/secure-cicd-taskmanager.git
git push -u origin main
```

### 3. Configure Terraform Variables

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
```

Edit:

```hcl
github_repo      = "YOUR_GITHUB_USERNAME/secure-cicd-taskmanager"
instance_type    = "t3.micro"
allowed_app_cidr = "0.0.0.0/0"
allowed_ssh_cidr = ""
key_name         = ""
```

Safer option: replace `allowed_app_cidr` with your public IP in `/32` format.

### 4. Provision Free-Tier AWS Infrastructure

```bash
terraform -chdir=terraform init
terraform -chdir=terraform validate
terraform -chdir=terraform plan
terraform -chdir=terraform apply
```

Save these outputs:

```text
app_url
health_url
ecr_repository_url
github_actions_role_arn
```

### 5. Add GitHub Actions Secret

In GitHub:

```text
Repository → Settings → Secrets and variables → Actions → New repository secret
```

Add:

```text
Name: AWS_GHA_DEPLOY_ROLE_ARN
Value: <terraform output github_actions_role_arn>
```

### 6. Trigger CI/CD Deployment

Make a small change and push:

```bash
git add .
git commit -m "Trigger EC2 free-tier deployment"
git push origin main
```

GitHub Actions will:

1. Run Ruff linting.
2. Run Pytest.
3. Scan repository secrets with Gitleaks.
4. Build the Docker image.
5. Scan the image with Trivy and block HIGH/CRITICAL vulnerabilities.
6. Push the image to Amazon ECR.
7. Use AWS Systems Manager to run `/opt/taskmanager/deploy.sh` on EC2.
8. Pull the new image on EC2.
9. Start Flask and PostgreSQL using Docker Compose.
10. Validate `/health`.
11. Run rollback script if the deployment fails.

### 7. Open the AWS App

After GitHub Actions succeeds:

```bash
terraform -chdir=terraform output -raw app_url
terraform -chdir=terraform output -raw health_url
```

Open the URLs in your browser.

## Testing Commands

Functional/API tests:

```bash
cd app/backend
pip install -r requirements.txt
pytest -q
```

Docker local test:

```bash
docker compose up --build
curl http://localhost:5000/health
```

Performance smoke test:

```bash
./scripts/perf-test.sh http://localhost:5000/health
```

Security checks:

```bash
gitleaks detect --source .
docker build -t secure-cicd-taskmanager:local -f app/backend/Dockerfile app
trivy image secure-cicd-taskmanager:local --severity HIGH,CRITICAL --exit-code 1
terraform -chdir=terraform validate
```

## Failure/Rollback Demo

1. Temporarily change `/health` in `app/backend/app.py` to return HTTP 503.
2. Commit and push to `main`.
3. GitHub Actions builds, scans, and deploys the broken image.
4. Health check fails.
5. Workflow calls `/opt/taskmanager/rollback.sh` on EC2 using Systems Manager.
6. EC2 returns to the previous working image.

## Cost-Safety Rules

This version avoids the always-paid services from the original design. To reduce cost risk:

```text
Use only one t2.micro/t3.micro EC2 instance.
Use an 8 GB root EBS volume.
Do not create NAT Gateway, ALB, ECS Fargate, RDS, Secrets Manager, WAF, or Elastic IP.
Keep only the last 5 ECR images.
Use short CloudWatch log retention.
Destroy resources after the demo.
Create an AWS Budget alert.
```

Destroy after demo:

```bash
terraform -chdir=terraform destroy
```

If ECR deletion fails because images exist, delete images in the AWS ECR console and run destroy again.

## Repository Structure

```text
secure-cicd-taskmanager/
├── .github/workflows/deploy.yml
├── terraform/
│   ├── versions.tf
│   ├── variables.tf
│   ├── main.tf
│   ├── vpc.tf
│   ├── ecr.tf
│   ├── iam.tf
│   ├── ec2.tf
│   ├── ssm.tf
│   ├── cloudwatch.tf
│   ├── outputs.tf
│   └── templates/user_data.sh.tpl
├── app/backend/
├── app/frontend/
├── docs/
├── scripts/
├── docker-compose.yml
└── README.md
```

## Enterprise UI Redesign

The frontend has been upgraded into a multi-page SaaS-style interface:

- `/` or `/index.html` — login/register page with demo credential hint
- `/dashboard.html` — task dashboard with stats cards, filters, Kanban/table views, drawer modal, toasts, and CRUD actions
- `/health.html` — deployment health dashboard that polls `/health` every 30 seconds

Frontend files are organized as:

```text
app/frontend/index.html
app/frontend/dashboard.html
app/frontend/health.html
app/frontend/css/styles.css
app/frontend/js/app.js
```

The backend API now supports enterprise task metadata while preserving backward compatibility with the older `completed` flag:

```json
{
  "title": "Prepare AWS demo",
  "description": "Show EC2, ECR, SSM, and CloudWatch",
  "status": "in-progress",
  "priority": "high",
  "due_date": "2025-12-20",
  "completed": false
}
```
