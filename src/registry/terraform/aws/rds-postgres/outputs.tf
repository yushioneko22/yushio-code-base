output "db_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "db_address" {
  value = aws_db_instance.main.address
}

output "db_credentials_secret_arn" {
  value = aws_secretsmanager_secret.db_credentials.arn
}

output "database_url" {
  value     = "postgresql://postgres:${random_password.db_password.result}@${aws_db_instance.main.address}:5432/${replace(var.project_name, "-", "_")}?schema=public"
  sensitive = true
}
