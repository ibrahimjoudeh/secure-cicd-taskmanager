# AWS Free-Tier Deployment Quick Checklist

Before applying Terraform:

- Confirm the AWS account is eligible for Free Tier.
- Create an AWS Budget alert in the Billing console.
- Use only one `t2.micro` or `t3.micro` EC2 instance.
- Keep `root_volume_size_gb = 8`.
- Do not add NAT Gateway, ALB, RDS, ECS Fargate, WAF, Secrets Manager, or Elastic IP.
- Keep ECR images below the free storage limit.
- Destroy resources after the demo using `terraform -chdir=terraform destroy`.
