resource "aws_cloudwatch_log_group" "app" {
  name              = "/ec2/${var.project_name}/app"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-app-logs"
  }
}

resource "aws_cloudwatch_log_group" "deploy" {
  name              = "/ec2/${var.project_name}/deploy"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-deploy-logs"
  }
}
