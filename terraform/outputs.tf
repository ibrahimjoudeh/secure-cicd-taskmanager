output "app_url" {
  description = "Public URL for the free-tier EC2 deployment."
  value       = "http://${aws_instance.app.public_ip}:5000"
}

output "health_url" {
  description = "Health endpoint URL."
  value       = "http://${aws_instance.app.public_ip}:5000/health"
}

output "ec2_instance_id" {
  description = "EC2 instance used by GitHub Actions deployment through SSM."
  value       = aws_instance.app.id
}

output "ecr_repository_url" {
  description = "Amazon ECR repository URL."
  value       = aws_ecr_repository.app.repository_url
}

output "github_actions_role_arn" {
  description = "Add this value to GitHub Actions secret AWS_GHA_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.github_actions.arn
}

output "ssm_app_url_parameter" {
  description = "SSM parameter read by GitHub Actions for health checks."
  value       = aws_ssm_parameter.app_url.name
}
