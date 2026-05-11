data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "random_id" "secret_suffix" {
  byte_length = 4
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.app.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  associate_public_ip_address = true
  key_name                    = var.key_name == "" ? null : var.key_name

  user_data_replace_on_change = true
  user_data = templatefile("${path.module}/templates/user_data.sh.tpl", {
    project_name = var.project_name
    aws_region   = var.aws_region
    ecr_url      = aws_ecr_repository.app.repository_url
    app_log_group = aws_cloudwatch_log_group.app.name
    deploy_log_group = aws_cloudwatch_log_group.deploy.name
  })

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size_gb
    encrypted             = true
    delete_on_termination = true
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  tags = {
    Name = "${var.project_name}-free-tier-ec2"
  }
}
