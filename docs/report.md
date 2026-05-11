# Secure CI/CD Pipeline for a Containerized Web Application

## 1. Title Page

**Project Title:** Secure CI/CD Pipeline for a Containerized Web Application  
**Course:** Cloud Computing & Security — Fall 2025  
**Students:** Ibrahim Joudeh 20200254, Zaina Derbas 20220512, Malek Alsatari 20210021  
**Cloud Provider:** Amazon Web Services (AWS)  
**Deployment Constraint:** Free-tier-focused AWS deployment  
**Submission Date:** [Insert submission date]

---

## 2. Abstract

This project implements a secure DevSecOps pipeline for a containerized task management web application. The system addresses the risk of insecure software delivery pipelines, including leaked secrets, vulnerable container images, manual deployment errors, weak access control, and lack of operational visibility. The application is a Flask-based web system with user registration, JWT login, task creation, update, completion, deletion, and a `/health` endpoint that validates application and database connectivity. To satisfy the free-only AWS deployment constraint, the live cloud deployment uses a Free Tier EC2 instance running Docker Compose instead of paid services such as ECS Fargate, RDS, NAT Gateway, Application Load Balancer, Secrets Manager, and WAF. GitHub Actions automates linting, testing, Gitleaks secret scanning, Docker image building, Trivy vulnerability scanning, Amazon ECR image publishing, AWS Systems Manager deployment, health-check validation, and rollback. Terraform provisions EC2, ECR, IAM, VPC, Security Groups, SSM parameters, and CloudWatch Logs. The result is a working, reproducible, and security-focused cloud project suitable for academic demonstration.

---

## 3. Introduction

### 3.1 Problem Description

Modern development teams use containers and CI/CD pipelines to release applications quickly. However, insecure pipelines may accidentally expose credentials, deploy vulnerable container images, or push broken builds into production. Many academic cloud projects demonstrate only basic deployment, while real systems require security scanning, least-privilege access, secret handling, monitoring, health checks, and recovery procedures.

### 3.2 Motivation

This project is motivated by the need to demonstrate a realistic but cost-conscious DevSecOps workflow. The instructor required AWS deployment but also requested a free-only approach. Therefore, the architecture was redesigned to avoid always-paid services while still showing meaningful cloud engineering, CI/CD, security, and monitoring.

### 3.3 Project Focus

The project focuses on both **Cloud Computing** and **Cloud Security**. It combines Docker containerization, GitHub Actions automation, AWS deployment, Infrastructure as Code, IAM hardening, vulnerability scanning, secret scanning, health checks, and rollback.

### 3.4 Objectives

- Build a working task management web application with login and task CRUD operations.
- Containerize the application using Docker.
- Automate linting, testing, secret scanning, vulnerability scanning, image build, and deployment.
- Deploy on AWS using only free-tier-focused resources.
- Use at least three AWS cloud services meaningfully.
- Apply least-privilege IAM and avoid long-term AWS keys in GitHub.
- Validate deployments using `/health` and support rollback.
- Provide documentation, diagrams, testing evidence, and reproducible setup steps.

---

## 4. Cloud Architecture

### 4.1 Cloud Provider and Services Used

The cloud provider is AWS. The free-tier-focused version uses the following services:

| AWS Service | Role in the Project | Cost-Safety Purpose |
|---|---|---|
| Amazon EC2 | Hosts Docker Compose with Flask and PostgreSQL containers | Uses one micro instance instead of Fargate/RDS |
| Amazon ECR | Stores Docker images built by CI/CD | Keeps only last 5 images through lifecycle policy |
| AWS IAM | Provides least-privilege EC2 and GitHub Actions roles | Avoids broad permanent credentials |
| AWS Systems Manager | Deploys to EC2 using Run Command and stores deployment metadata | Avoids SSH keys and bastion hosts |
| Amazon VPC | Provides isolated network | Uses public subnet only; no NAT Gateway |
| Security Groups | Restrict inbound traffic | Allows only app port 5000 and optional SSH |
| CloudWatch Logs | Stores application logs | Short retention to reduce cost risk |

### 4.2 Removed Paid Services

The original production design included ECS Fargate, RDS PostgreSQL, Application Load Balancer, NAT Gateway, Secrets Manager, WAF, and custom KMS keys. These are strong production services, but they may create charges. They were removed from the live deployment and replaced with a free-tier-focused EC2 deployment.

### 4.3 Architecture Diagram

```text
GitHub Repository
    ↓
GitHub Actions CI/CD
    ↓
Lint + Tests + Gitleaks + Trivy + Docker Build
    ↓
Amazon ECR
    ↓
AWS Systems Manager Run Command
    ↓
EC2 Free-Tier Micro Instance
    ↓
Docker Compose
    ↓
Flask App Container + PostgreSQL Container
    ↓
CloudWatch Logs
```

A full ASCII architecture diagram is provided in `docs/architecture-diagram.txt`.

### 4.4 Deployment Model

The application runs in two environments:

1. **Local development:** Docker Desktop runs the Flask app container and PostgreSQL container.
2. **AWS deployment:** Terraform provisions an EC2 micro instance. GitHub Actions builds and scans a Docker image, pushes it to ECR, then uses AWS Systems Manager to run a deployment script on EC2. EC2 pulls the approved image and starts Docker Compose.

---

## 5. Core Implementation

### 5.1 Application Components

The application is implemented using:

- **Backend:** Python Flask REST API.
- **Frontend:** Lightweight HTML, CSS, and JavaScript.
- **Database:** PostgreSQL in Docker.
- **Authentication:** JWT tokens.
- **Containerization:** Multi-stage Dockerfile.
- **Local orchestration:** Docker Compose.
- **Cloud deployment:** EC2 + Docker Compose.

### 5.2 Backend Features

The backend exposes:

| Endpoint | Method | Purpose |
|---|---|---|
| `/` | GET | Serves frontend UI |
| `/health` | GET | Checks app and database health |
| `/api/auth/register` | POST | Creates user account |
| `/api/auth/login` | POST | Authenticates user and returns JWT |
| `/api/tasks` | GET | Lists authenticated user's tasks |
| `/api/tasks` | POST | Creates a task |
| `/api/tasks/<id>` | PUT | Updates task title, description, or completion status |
| `/api/tasks/<id>` | DELETE | Deletes a task |

### 5.3 Security-Aware Implementation Details

- Passwords are hashed using Werkzeug password hashing.
- JWT tokens protect task routes.
- Basic input sanitization removes simple HTML tag characters from task fields.
- Flask-Limiter enforces rate limits.
- Security headers are added to responses.
- Structured JSON logging supports observability.
- `/health` performs a database query to detect database failure.

### 5.4 Docker Implementation

The Dockerfile uses a multi-stage build. The builder stage installs Python dependencies into wheels. The runtime stage installs only runtime packages, creates a non-root user, exposes port 5000, and defines a Docker health check.

### 5.5 Infrastructure as Code

Terraform provisions:

- VPC and public subnet.
- Internet Gateway and route table.
- Security Group for port 5000.
- EC2 micro instance.
- IAM instance profile.
- GitHub Actions OIDC deploy role.
- Amazon ECR repository and lifecycle policy.
- SSM parameters for app URL and instance ID.
- CloudWatch log groups.

---

## 6. Security Analysis

### 6.1 IAM Security

The project uses two main IAM roles:

1. **EC2 instance role**  
   Allows the EC2 instance to pull images from ECR, receive SSM Run Command, and write logs to CloudWatch.

2. **GitHub Actions role**  
   Allows GitHub Actions to push to the project ECR repository, read specific SSM parameters, and send deployment commands to the specific EC2 instance.

GitHub Actions uses OIDC instead of static AWS access keys. The trust policy is restricted to the selected GitHub repository and branch.

### 6.2 Network Security

- PostgreSQL is not exposed publicly.
- Only the Flask application port 5000 is exposed for the demo.
- SSH is disabled by default unless an SSH CIDR and EC2 key pair are explicitly configured.
- EC2 uses IMDSv2 to reduce metadata credential abuse risk.

### 6.3 Secret Handling

No application secrets are committed to the repository. Runtime secrets such as the database password, Flask secret, and JWT secret are generated on the EC2 instance during bootstrap and stored in `/opt/taskmanager/.env` with restrictive permissions. SSM Parameter Store stores only deployment metadata, not application secrets.

### 6.4 Container Security

- Multi-stage build reduces runtime image size.
- Runtime container runs as non-root user.
- Trivy scans the final Docker image.
- Deployment is blocked for HIGH/CRITICAL vulnerabilities.
- ECR lifecycle policy reduces unnecessary image storage.

### 6.5 CI/CD Security

- Gitleaks prevents leaked secrets from passing the pipeline.
- Trivy prevents vulnerable images from being deployed.
- GitHub OIDC removes the need for long-term AWS credentials.
- Post-deployment `/health` validation prevents broken deployments from being accepted.
- Rollback script restores the previous image on failure.

### 6.6 Risk Matrix

| Risk | Impact | Likelihood | Mitigation |
|---|---:|---:|---|
| Secret committed to GitHub | High | Medium | Gitleaks and `.gitignore` |
| Vulnerable Docker image | High | Medium | Trivy HIGH/CRITICAL blocking |
| Broken deployment | Medium | Medium | Health check and rollback |
| Over-permissive IAM | High | Low | Least-privilege roles and OIDC trust conditions |
| Public database exposure | High | Low | PostgreSQL not published outside Docker network |
| Accidental AWS charges | High | Medium | Removed paid services, small EC2, ECR lifecycle, short log retention |

---

## 7. Evaluation and Testing

### 7.1 Functional Testing

Functional tests verify:

- User registration.
- User login.
- Task creation.
- Task listing.
- Task update.
- Task deletion.
- `/health` response.

Command:

```bash
cd app/backend
pytest -q
```

Expected result:

```text
5 passed
```

### 7.2 Docker Testing

Command:

```bash
docker compose up --build
curl http://localhost:5000/health
```

Expected result:

```json
{"database":"connected","status":"healthy","timestamp":"..."}
```

### 7.3 Pipeline Testing

The GitHub Actions workflow validates:

- Linting succeeds.
- Unit tests pass.
- Gitleaks finds no exposed secrets.
- Trivy finds no HIGH/CRITICAL vulnerabilities.
- Docker image is pushed to ECR.
- EC2 deployment command succeeds.
- `/health` succeeds after deployment.

### 7.4 Security Testing

| Test | Tool/Method | Expected Result |
|---|---|---|
| Secret scan | Gitleaks | No leaked secrets |
| Image vulnerability scan | Trivy | No HIGH/CRITICAL deployable findings |
| JWT enforcement | API tests/manual | Unauthenticated task requests rejected |
| DB exposure check | Docker/SG review | PostgreSQL not internet-accessible |
| IAM review | Terraform code | Least-privilege scoped policies |

### 7.5 Performance Smoke Testing

The included script sends repeated requests to the health endpoint:

```bash
./scripts/perf-test.sh http://localhost:5000/health
```

Expected result: stable HTTP 200 responses under basic concurrent access. Because the free-tier EC2 instance has limited CPU and memory, the goal is not high throughput but stable behavior for a classroom prototype.

### 7.6 Failure and Recovery Testing

Failure test:

1. Modify `/health` to return HTTP 503.
2. Push to main.
3. GitHub Actions deploys the image.
4. Health check fails.
5. Rollback command runs on EC2.
6. Previous image becomes active again.

Expected result: the deployed app returns to healthy status.

---

## 8. Challenges and Lessons Learned

### 8.1 Technical Challenges

The main challenge was balancing strong cloud engineering with a free-only deployment constraint. Production-grade AWS services such as ECS Fargate, RDS, ALB, NAT Gateway, Secrets Manager, and WAF are appropriate for real deployments, but they can create charges. The project was redesigned to use EC2, ECR, IAM, SSM, VPC, Security Groups, and CloudWatch Logs instead.

### 8.2 Lessons Learned

- Free-tier architecture requires careful service selection.
- Docker Compose is useful for both local development and small AWS prototypes.
- GitHub OIDC improves CI/CD security by removing long-term AWS keys.
- Health checks should verify dependencies, not only process availability.
- Least-privilege IAM must be designed per actor: EC2 and CI/CD need different permissions.
- Cost control is a cloud security and operations concern.

### 8.3 Future Improvements

If budget is available, the system can be upgraded to ECS Fargate, RDS, ALB, HTTPS with ACM, Secrets Manager, WAF, CloudWatch alarms, and multi-AZ deployment. These are stronger production choices but were intentionally avoided in the free-only implementation.

---

## 9. Conclusion

This project demonstrates a secure CI/CD pipeline for a containerized task management web application using GitHub, Docker, and AWS. The final free-tier AWS deployment uses EC2 with Docker Compose, ECR for image storage, IAM for access control, Systems Manager for SSH-free deployment, VPC and Security Groups for network control, and CloudWatch Logs for observability. The project includes testing, security scanning, vulnerability blocking, deployment validation, and rollback. It satisfies the course goals of cloud service usage, working prototype, security analysis, monitoring, CI/CD, documentation, and reproducibility while respecting the free-only deployment constraint.

---

## 10. References

1. Amazon Web Services. (n.d.). *Amazon EC2 T2 instances*. https://aws.amazon.com/ec2/instance-types/t2/
2. Amazon Web Services. (n.d.). *Amazon Elastic Container Registry pricing*. https://aws.amazon.com/ecr/pricing/
3. Amazon Web Services. (n.d.). *AWS Systems Manager pricing*. https://aws.amazon.com/systems-manager/pricing/
4. Amazon Web Services. (n.d.). *Amazon CloudWatch Logs billing and cost*. https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/LogsBillingDetails.html
5. Amazon Web Services. (n.d.). *IAM roles*. https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html
6. Amazon Web Services. (n.d.). *AWS Systems Manager Run Command*. https://docs.aws.amazon.com/systems-manager/latest/userguide/execute-remote-commands.html
7. Amazon Web Services. (n.d.). *Amazon EC2 instance metadata and user data*. https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-metadata.html
8. GitHub Docs. (n.d.). *Configuring OpenID Connect in Amazon Web Services*. https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
9. Docker Docs. (n.d.). *Dockerfile reference*. https://docs.docker.com/reference/dockerfile/
10. Docker Docs. (n.d.). *Docker Compose overview*. https://docs.docker.com/compose/
11. Gitleaks. (n.d.). *Gitleaks documentation*. https://github.com/gitleaks/gitleaks
12. Aqua Security. (n.d.). *Trivy documentation*. https://aquasecurity.github.io/trivy/
13. Pallets Projects. (n.d.). *Flask documentation*. https://flask.palletsprojects.com/
14. PyJWT. (n.d.). *PyJWT documentation*. https://pyjwt.readthedocs.io/
15. HashiCorp. (n.d.). *Terraform AWS Provider documentation*. https://registry.terraform.io/providers/hashicorp/aws/latest/docs

---

## 11. Appendices

### Appendix A — Deployment Commands

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
terraform -chdir=terraform init
terraform -chdir=terraform validate
terraform -chdir=terraform apply
```

### Appendix B — GitHub Secret

```text
AWS_GHA_DEPLOY_ROLE_ARN=<terraform output github_actions_role_arn>
```

### Appendix C — Important Files

```text
.github/workflows/deploy.yml
terraform/*.tf
terraform/templates/user_data.sh.tpl
app/backend/app.py
app/backend/Dockerfile
docker-compose.yml
docs/security-checklist.md
docs/demo-script.md
```

### Appendix D — Screenshot Placeholders

- Screenshot 1: Local Docker Desktop containers.
- Screenshot 2: Task management UI with created tasks.
- Screenshot 3: `/health` endpoint showing database connected.
- Screenshot 4: GitHub Actions successful workflow.
- Screenshot 5: Amazon ECR image tags.
- Screenshot 6: EC2 instance running.
- Screenshot 7: Security Group inbound rules.
- Screenshot 8: CloudWatch Logs for app container.
