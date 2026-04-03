import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Dockerfile と docker-compose.yml を生成
 */
export async function generateDocker(outDir, answers) {
  // backend/
  const backendDir = join(outDir, 'backend');
  await mkdir(backendDir, { recursive: true });
  await writeFile(join(backendDir, 'Dockerfile'), generateBackendDockerfile(answers));

  // docker-compose.yml (ルート)
  await writeFile(join(outDir, 'docker-compose.yml'), generateDockerCompose(answers));

  // .dockerignore
  await writeFile(join(backendDir, '.dockerignore'), generateDockerignore(answers));
}

// ---------------------------------------------------------------------------
// Backend Dockerfile
// ---------------------------------------------------------------------------

function generateBackendDockerfile(answers) {
  switch (answers.backend) {
    case 'go':
      return goDockerfile(answers);
    case 'node-hono':
      return nodeHonoDockerfile(answers);
    case 'python-fastapi':
      return pythonFastapiDockerfile(answers);
    default:
      return '';
  }
}

function goDockerfile(answers) {
  return `# ---- Build ----
FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# ---- Runtime ----
FROM alpine:3.19

RUN apk add --no-cache ca-certificates curl

WORKDIR /app
COPY --from=builder /app/server .

EXPOSE 8080
CMD ["./server"]
`;
}

function nodeHonoDockerfile(answers) {
  return `# ---- Build ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build --if-present

# ---- Runtime ----
FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

EXPOSE 8080
CMD ["node", "dist/index.js"]
`;
}

function pythonFastapiDockerfile(answers) {
  return `FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
}

// ---------------------------------------------------------------------------
// docker-compose.yml
// ---------------------------------------------------------------------------

function generateDockerCompose(answers) {
  const backendPort = answers.backend === 'python-fastapi' ? 8000 : 8080;
  const dbName = answers.projectName.replace(/-/g, '_');

  const lines = [
    `services:`,
  ];

  // Backend
  lines.push(
    `  backend:`,
    `    build:`,
    `      context: ./backend`,
    `      dockerfile: Dockerfile`,
    `    ports:`,
    `      - "${backendPort}:${backendPort}"`,
    `    environment:`,
    `      - PORT=${backendPort}`,
    `      - APP_ENV=local`,
  );

  if (answers.database === 'rds-postgres') {
    lines.push(
      `      - DATABASE_URL=postgresql://postgres:postgres@db:5432/${dbName}?schema=public`,
      `    depends_on:`,
      `      db:`,
      `        condition: service_healthy`,
    );
  }

  lines.push(
    `    volumes:`,
    `      - ./backend:/app`,
  );

  // Add hot-reload exclusion for node_modules
  if (answers.backend === 'node-hono') {
    lines.push(`      - /app/node_modules`);
  }

  lines.push(``);

  // Frontend (placeholder for future)
  lines.push(
    `  # frontend:`,
    `  #   build:`,
    `  #     context: ./frontend`,
    `  #     dockerfile: Dockerfile`,
    `  #   ports:`,
    `  #     - "3000:3000"`,
    `  #   depends_on:`,
    `  #     - backend`,
    ``,
  );

  // Database
  if (answers.database === 'rds-postgres') {
    lines.push(
      `  db:`,
      `    image: postgres:16-alpine`,
      `    ports:`,
      `      - "5432:5432"`,
      `    environment:`,
      `      POSTGRES_USER: postgres`,
      `      POSTGRES_PASSWORD: postgres`,
      `      POSTGRES_DB: ${dbName}`,
      `    volumes:`,
      `      - db-data:/var/lib/postgresql/data`,
      `    healthcheck:`,
      `      test: ["CMD-SHELL", "pg_isready -U postgres"]`,
      `      interval: 5s`,
      `      timeout: 5s`,
      `      retries: 5`,
      ``,
    );
  }

  // Volumes
  if (answers.database === 'rds-postgres') {
    lines.push(
      `volumes:`,
      `  db-data:`,
    );
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// .dockerignore
// ---------------------------------------------------------------------------

function generateDockerignore(answers) {
  const lines = [
    `node_modules`,
    `.git`,
    `.gitignore`,
    `*.md`,
    `.env`,
    `.env.*`,
    `Dockerfile`,
    `.dockerignore`,
  ];

  if (answers.backend === 'go') {
    lines.push(`vendor`, `*.test.go`);
  }

  if (answers.backend === 'python-fastapi') {
    lines.push(`__pycache__`, `*.pyc`, `.venv`, `venv`);
  }

  return lines.join('\n') + '\n';
}
