provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.tags
  }
}

locals {
  tags = {
    Project     = var.project_name
    Environment = var.environment
    Course      = "Cloud Computing and Security Fall 2025"
    CostMode    = "Free-Tier-Lab"
    ManagedBy   = "Terraform"
  }
}
