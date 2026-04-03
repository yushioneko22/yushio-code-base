variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "github_owner" {
  description = "GitHub repository owner"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
}

variable "attach_ecr_policy" {
  description = "Attach ECR policy to the role"
  type        = bool
  default     = false
}

variable "attach_ecs_policy" {
  description = "Attach ECS policy to the role"
  type        = bool
  default     = false
}

variable "attach_lambda_policy" {
  description = "Attach Lambda policy to the role"
  type        = bool
  default     = false
}
