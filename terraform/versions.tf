terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Free-tier lab note:
  # This version intentionally uses local Terraform state instead of an S3 backend
  # to avoid creating extra AWS resources for state storage. For a production team,
  # use an S3 backend with locking.
}
