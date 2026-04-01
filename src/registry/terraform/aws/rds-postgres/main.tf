################################
# Random Password
################################
resource "random_password" "db_password" {
  length  = 32
  special = false
}

################################
# Secrets Manager
################################
resource "aws_secretsmanager_secret" "db_credentials" {
  name = "${var.project_name}-${var.environment}-db-credentials"
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username     = "postgres"
    password     = random_password.db_password.result
    host         = aws_db_instance.main.address
    port         = 5432
    dbname       = replace(var.project_name, "-", "_")
    database_url = "postgresql://postgres:${random_password.db_password.result}@${aws_db_instance.main.address}:5432/${replace(var.project_name, "-", "_")}?schema=public"
  })
}

################################
# Subnet Group
################################
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet"
  }
}

################################
# RDS Instance
################################
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-${var.environment}"
  engine         = "postgres"
  engine_version = "16.3"
  instance_class = var.instance_class

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true

  db_name  = replace(var.project_name, "-", "_")
  username = "postgres"
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.rds_security_group_id]

  multi_az            = var.multi_az
  skip_final_snapshot = true

  backup_retention_period = var.multi_az ? 7 : 1

  tags = {
    Name = "${var.project_name}-${var.environment}-rds"
  }
}
