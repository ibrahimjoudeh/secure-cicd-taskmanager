# Secure CI/CD Pipeline for a Containerized Web Application — Free-Tier AWS Version

Course: Cloud Computing & Security (Fall 2025)  
Team: Ibrahim Joudeh 20200254, Zaina Derbas 20220512, Malek Alsatari 20210021

This repository implements a secure DevSecOps pipeline for a Flask task management app. The original production-style architecture used ECS Fargate, RDS, ALB, NAT Gateway, Secrets Manager, and WAF. This version was changed to a **free-tier-focused AWS deployment** so the project can be demonstrated on AWS without intentionally creating always-paid services.


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
