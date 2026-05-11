resource "aws_ssm_parameter" "instance_id" {
  name  = "/${var.project_name}/ec2_instance_id"
  type  = "String"
  value = aws_instance.app.id
}

resource "aws_ssm_parameter" "app_url" {
  name  = "/${var.project_name}/app_url"
  type  = "String"
  value = "http://${aws_instance.app.public_ip}:5000"
}

resource "aws_ssm_parameter" "ecr_url" {
  name  = "/${var.project_name}/ecr_url"
  type  = "String"
  value = aws_ecr_repository.app.repository_url
}
