# Security Verification Checklist — Free-Tier AWS Deployment

## Repository and CI/CD

- [ ] Repository contains no plaintext passwords, AWS keys, or database credentials.
- [ ] `.env` files are excluded by `.gitignore`.
- [ ] GitHub Actions workflow exists at `.github/workflows/deploy.yml`.
- [ ] Gitleaks runs before deployment.
- [ ] Trivy blocks deployment on HIGH/CRITICAL vulnerabilities.
- [ ] GitHub Actions uses OIDC, not long-term AWS access keys.
- [ ] GitHub OIDC trust policy is restricted to the correct repository and branch.

## Docker and Application

- [ ] Dockerfile uses a multi-stage build.
- [ ] Runtime image does not include compiler/build tools.
- [ ] App runs as non-root user `1000:1000`.
- [ ] Docker health check calls `/health`.
- [ ] Flask API validates input and removes simple HTML characters from task fields.
- [ ] Passwords are stored as hashes, not plaintext.
- [ ] JWT tokens are required for task APIs.
- [ ] Rate limiting is enabled.
- [ ] Security headers are added to responses.

## AWS IAM

- [ ] EC2 instance profile has only required permissions: ECR pull, SSM, and CloudWatch log write.
- [ ] GitHub Actions role has only required permissions: ECR push, SSM parameter read, and SSM Run Command.
- [ ] No IAM user access keys are stored in GitHub secrets.
- [ ] EC2 metadata service requires IMDSv2.

## Network Security

- [ ] Security Group opens TCP 5000 only for demo access.
- [ ] SSH is disabled by default unless `allowed_ssh_cidr` is explicitly set.
- [ ] PostgreSQL port 5432 is not exposed to the internet.
- [ ] No NAT Gateway, ALB, or Elastic IP is created.

## Secrets and Configuration

- [ ] Runtime secrets are generated on the EC2 instance during bootstrap.
- [ ] Database password, Flask secret, and JWT secret are not committed to GitHub.
- [ ] SSM Parameter Store contains only deployment metadata such as instance ID and app URL, not application secrets.

## Monitoring and Recovery

- [ ] App logs are sent to CloudWatch Logs with short retention.
- [ ] `/health` returns application status and database connectivity.
- [ ] GitHub Actions checks `/health` after deployment.
- [ ] Rollback script exists at `/opt/taskmanager/rollback.sh` on EC2.
- [ ] A failed deployment triggers rollback to the previous image.

## Cost-Safety

- [ ] Only one `t2.micro` or `t3.micro` EC2 instance is used.
- [ ] Root EBS volume is 8 GB by default.
- [ ] ECR lifecycle policy keeps only 5 images.
- [ ] CloudWatch log retention is 3 days by default.
- [ ] AWS Budget alert is created manually in Billing console.
- [ ] `terraform destroy` is run after the final demo if resources are no longer needed.
