#!/bin/bash
set -euxo pipefail

PROJECT_NAME="${project_name}"
AWS_REGION="${aws_region}"
ECR_URL="${ecr_url}"
APP_LOG_GROUP="${app_log_group}"
DEPLOY_LOG_GROUP="${deploy_log_group}"
APP_DIR="/opt/taskmanager"
COMPOSE_VERSION="v2.29.7"

exec > >(tee /var/log/taskmanager-user-data.log | logger -t taskmanager-user-data -s 2>/dev/console) 2>&1

# Keep the base operating system current.
dnf update -y

# Explicitly install and start AWS Systems Manager Agent first.
# This ensures the instance can register with SSM and receive deployment commands.
yum install -y https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm
systemctl enable amazon-ssm-agent
systemctl restart amazon-ssm-agent
systemctl status amazon-ssm-agent --no-pager || true

# Install runtime tools needed for Docker deployment and logging.
dnf install -y docker unzip openssl awscli amazon-cloudwatch-agent

# Start Docker.
systemctl enable --now docker

# Install Docker Compose v2 plugin.
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/$COMPOSE_VERSION/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose

# Create deployment directory.
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Generate runtime secrets locally on the EC2 host.
DB_PASSWORD=$(openssl rand -hex 16)
SECRET_KEY=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 24)

cat > .env <<ENVEOF
POSTGRES_USER=taskuser
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=taskmanager
APP_ENV=production
SECRET_KEY=$SECRET_KEY
JWT_SECRET=$JWT_SECRET
DATABASE_URL=postgresql://taskuser:$DB_PASSWORD@db:5432/taskmanager
CORS_ORIGINS=*
AWS_REGION=$AWS_REGION
ECR_IMAGE=$ECR_URL:latest
ENVEOF

chmod 600 .env

# AWS Compose file used on the EC2 host.
cat > docker-compose.aws.yml <<'COMPOSEEOF'
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file:
      - .env
    environment:
      POSTGRES_USER: $${POSTGRES_USER}
      POSTGRES_PASSWORD: $${POSTGRES_PASSWORD}
      POSTGRES_DB: $${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 6

  app:
    image: $${ECR_IMAGE}
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "5000:5000"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:5000/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    logging:
      driver: awslogs
      options:
        awslogs-region: $${AWS_REGION}
        awslogs-group: ${app_log_group}
        awslogs-stream: app

volumes:
  pgdata:
COMPOSEEOF

# Deployment script called from GitHub Actions through AWS Systems Manager.
cat > deploy.sh <<'DEPLOYEOF'
#!/bin/bash
set -euo pipefail

IMAGE="$${1:?Usage: deploy.sh <ecr-image-uri>}"
APP_DIR="/opt/taskmanager"
REGION="${aws_region}"

cd "$APP_DIR"

CURRENT_IMAGE=""
if grep -q '^ECR_IMAGE=' .env; then
  CURRENT_IMAGE=$(grep '^ECR_IMAGE=' .env | cut -d= -f2- || true)
fi

if [ -n "$CURRENT_IMAGE" ]; then
  echo "$CURRENT_IMAGE" > .previous_image
fi

if grep -q '^ECR_IMAGE=' .env; then
  sed -i "s|^ECR_IMAGE=.*|ECR_IMAGE=$IMAGE|" .env
else
  echo "ECR_IMAGE=$IMAGE" >> .env
fi

REGISTRY=$(echo "$IMAGE" | cut -d/ -f1)
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

docker compose -f docker-compose.aws.yml pull app
docker compose -f docker-compose.aws.yml up -d

for attempt in $(seq 1 18); do
  if curl -fsS http://127.0.0.1:5000/health; then
    echo "$IMAGE" > .last_good_image
    docker image prune -af --filter "until=24h" || true
    exit 0
  fi

  echo "Waiting for healthy app... attempt $attempt"
  sleep 5
done

echo "Deployment failed health check"
exit 1
DEPLOYEOF

chmod +x deploy.sh

# Rollback script called only when deployment health validation fails.
cat > rollback.sh <<'ROLLBACKEOF'
#!/bin/bash
set -euo pipefail

APP_DIR="/opt/taskmanager"
REGION="${aws_region}"

cd "$APP_DIR"

ROLLBACK_IMAGE=""

if [ -s .previous_image ]; then
  ROLLBACK_IMAGE=$(cat .previous_image)
elif [ -s .last_good_image ]; then
  ROLLBACK_IMAGE=$(cat .last_good_image)
fi

if [ -z "$ROLLBACK_IMAGE" ]; then
  echo "No previous image available for rollback"
  exit 1
fi

sed -i "s|^ECR_IMAGE=.*|ECR_IMAGE=$ROLLBACK_IMAGE|" .env

REGISTRY=$(echo "$ROLLBACK_IMAGE" | cut -d/ -f1)
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

docker compose -f docker-compose.aws.yml pull app
docker compose -f docker-compose.aws.yml up -d

for attempt in $(seq 1 12); do
  if curl -fsS http://127.0.0.1:5000/health; then
    echo "Rollback successful to $ROLLBACK_IMAGE"
    exit 0
  fi

  sleep 5
done

echo "Rollback failed health check"
exit 1
ROLLBACKEOF

chmod +x rollback.sh

# Start only PostgreSQL during bootstrap.
# The app container starts after GitHub Actions pushes the first image to ECR and deploys it.
docker compose -f docker-compose.aws.yml up -d db

echo "EC2 bootstrap complete. Waiting for first CI/CD deployment image."