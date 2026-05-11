# Demo Script — 10 to 15 Minutes

## 0:00–1:00 — Project Introduction

Say:

> Our project is a secure CI/CD pipeline for a containerized task management web application. The goal is to show how a small team can build, scan, deploy, monitor, and recover a web application using DevSecOps practices. Because the instructor requested a free-only AWS deployment, we use an AWS Free Tier EC2 instance instead of paid services such as ECS Fargate, RDS, NAT Gateway, ALB, Secrets Manager, and WAF.

Show:

- Project repository folder.
- `README.md`.
- `docs/architecture-diagram.txt`.

## 1:00–3:00 — Local Application Demo

Open:

```text
http://localhost:5000
```

Demonstrate:

1. Register a user.
2. Log in.
3. Create a task.
4. Mark the task complete.
5. Mark it open again.
6. Delete the task.

Open:

```text
http://localhost:5000/health
```

Say:

> The health endpoint validates that the Flask application is running and that the database connection works. The same endpoint is used by CI/CD to validate AWS deployments.

## 3:00–5:00 — Code and Docker

Show:

- `app/backend/app.py`
- `app/backend/Dockerfile`
- `docker-compose.yml`
- `app/frontend/index.html`
- `app/frontend/app.js`
- `app/frontend/styles.css`

Say:

> The backend is a Flask REST API with JWT authentication, task CRUD routes, structured JSON logging, security headers, and rate limiting. Docker packages the app into a portable image. Locally, Docker Compose runs the app and PostgreSQL as separate containers.

## 5:00–7:00 — GitHub Actions CI/CD

Show:

```text
.github/workflows/deploy.yml
```

Explain stages:

1. Ruff linting.
2. Pytest unit/API tests.
3. Gitleaks secret scanning.
4. Docker image build.
5. Trivy vulnerability scanning.
6. Push to Amazon ECR.
7. Deploy to EC2 using AWS Systems Manager.
8. Check `/health`.
9. Rollback if health fails.

Say:

> The deployment uses GitHub OIDC instead of long-term AWS access keys, reducing credential exposure risk.

## 7:00–9:30 — AWS Deployment

Show AWS Console:

1. EC2 instance running.
2. Security Group allowing port 5000.
3. ECR repository with image tags.
4. IAM roles.
5. SSM Parameters:
   - `/secure-cicd-taskmanager/ec2_instance_id`
   - `/secure-cicd-taskmanager/app_url`
6. CloudWatch Logs group.

Open the deployed app:

```text
http://EC2_PUBLIC_IP:5000
http://EC2_PUBLIC_IP:5000/health
```

Say:

> The AWS version runs the same Dockerized app on a free-tier EC2 instance. PostgreSQL runs as a private Docker container on the same host, so no paid RDS instance is needed.

## 9:30–11:30 — Security Analysis

Show:

- `docs/threat-model.txt`
- `docs/security-checklist.md`
- Terraform IAM file: `terraform/iam.tf`
- Terraform security group file: `terraform/vpc.tf`

Say:

> We mitigated common CI/CD and cloud risks: secret leakage, vulnerable images, over-permissive IAM, exposed database ports, broken deployments, and accidental paid services.

## 11:30–13:00 — Failure and Rollback

Explain or demonstrate:

1. Temporarily change `/health` to return 503.
2. Push to GitHub.
3. GitHub Actions deploys the broken image.
4. Health check fails.
5. Rollback script restores the previous image.

Say:

> This proves that deployment success depends on a real health check, not only a successful container start.

## 13:00–15:00 — Wrap-up

Say:

> The final result is a working secure DevSecOps prototype that uses GitHub, Docker, AWS EC2, ECR, IAM, SSM, CloudWatch, VPC, and Security Groups. It satisfies the course requirement for cloud services, working prototype, security analysis, monitoring, CI/CD, testing, and documentation while staying aligned with a free-only deployment constraint.
