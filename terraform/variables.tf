variable "project_name" {
  description = "Name prefix for AWS resources."
  type        = string
  default     = "secure-cicd-taskmanager"

  validation {
    condition     = can(regex("^[a-z0-9-]{3,32}$", var.project_name))
    error_message = "project_name must be 3-32 lowercase letters, numbers, or hyphens."
  }
}

variable "aws_region" {
  description = "AWS region for the free-tier deployment."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment tag."
  type        = string
  default     = "dev"
}

variable "github_repo" {
  description = "GitHub repository allowed to assume the AWS deploy role, in owner/repo format."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repo))
    error_message = "github_repo must be in owner/repo format."
  }
}

variable "github_branch" {
  description = "GitHub branch allowed to deploy."
  type        = string
  default     = "main"
}

variable "instance_type" {
  description = "Free-tier eligible EC2 instance type. Use t3.micro or t2.micro depending on account/region eligibility."
  type        = string
  default     = "t3.micro"

  validation {
    condition     = contains(["t2.micro", "t3.micro"], var.instance_type)
    error_message = "Use t2.micro or t3.micro to stay aligned with AWS Free Tier."
  }
}

variable "allowed_app_cidr" {
  description = "CIDR allowed to access the Flask app on port 5000. For demo use 0.0.0.0/0; for safer use your public IP /32."
  type        = string
  default     = "0.0.0.0/0"
}

variable "allowed_ssh_cidr" {
  description = "Optional CIDR allowed for SSH. Leave empty to block SSH and use AWS Systems Manager Session Manager instead."
  type        = string
  default     = ""
}

variable "key_name" {
  description = "Optional EC2 key pair name for SSH. Leave empty to avoid SSH and use SSM."
  type        = string
  default     = ""
}

variable "root_volume_size_gb" {
  description = "Root EBS volume size. Keep small for Free Tier."
  type        = number
  default     = 8

  validation {
    condition     = var.root_volume_size_gb >= 8 && var.root_volume_size_gb <= 30
    error_message = "Use 8-30 GB for the root volume."
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days. Keep low to minimize cost."
  type        = number
  default     = 3
}
