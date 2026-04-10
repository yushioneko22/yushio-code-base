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
  await writeFile(join(backendDir, '.dockerignore'), generateDockerignore(answers));

  // frontend/
  if (answers.frontend && answers.frontend !== 'none') {
    const frontendDir = join(outDir, 'frontend');
    await mkdir(frontendDir, { recursive: true });
    await writeFile(join(frontendDir, 'Dockerfile'), generateFrontendDockerfile(answers));
    await writeFile(join(frontendDir, '.dockerignore'), generateNodeDockerignore());
  }

  // docker-compose.yml (ルート)
  await writeFile(join(outDir, 'docker-compose.yml'), generateDockerCompose(answers));
}

// ---------------------------------------------------------------------------
// Backend Dockerfile
// ---------------------------------------------------------------------------

function generateBackendDockerfile(answers) {
  switch (answers.backend) {
    case 'go':
      return goDockerfile();
    case 'node-hono':
      return nodeHonoDockerfile();
    case 'python-fastapi':
      return pythonFastapiDockerfile();
    default:
      return '';
  }
}

function goDockerfile() {
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

function nodeHonoDockerfile() {
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

function pythonFastapiDockerfile() {
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
// Frontend Dockerfile
// ---------------------------------------------------------------------------

function generateFrontendDockerfile(answers) {
  switch (answers.frontend) {
    case 'nextjs':
      return nextjsDockerfile();
    case 'vite-react':
      return viteReactDockerfile();
    default:
      return '';
  }
}

function nextjsDockerfile() {
  return `# ---- Dependencies ----
FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---- Build ----
FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runtime ----
FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
`;
}

function viteReactDockerfile() {
  return `# ---- Build ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime ----
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 3000;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
`;
}

// ---------------------------------------------------------------------------
// docker-compose.yml
// ---------------------------------------------------------------------------

function generateDockerCompose(answers) {
  const backendPort = answers.backend === 'python-fastapi' ? 8000 : 8080;
  const dbName = answers.projectName.replace(/-/g, '_');
  const hasFrontend = answers.frontend && answers.frontend !== 'none';

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

  if (answers.backend === 'node-hono') {
    lines.push(`      - /app/node_modules`);
  }

  lines.push(``);

  // Frontend
  if (hasFrontend) {
    lines.push(
      `  frontend:`,
      `    build:`,
      `      context: ./frontend`,
      `      dockerfile: Dockerfile`,
    );

    if (answers.frontend === 'nextjs') {
      lines.push(
        `    ports:`,
        `      - "3000:3000"`,
        `    environment:`,
        `      - NEXT_PUBLIC_API_URL=http://localhost:${backendPort}`,
        `    depends_on:`,
        `      - backend`,
        `    volumes:`,
        `      - ./frontend:/app`,
        `      - /app/node_modules`,
        `      - /app/.next`,
      );
    } else {
      // vite-react: 開発時は vite dev server を使う
      lines.push(
        `    ports:`,
        `      - "3000:3000"`,
        `    environment:`,
        `      - VITE_API_URL=http://localhost:${backendPort}`,
        `    depends_on:`,
        `      - backend`,
        `    volumes:`,
        `      - ./frontend:/app`,
        `      - /app/node_modules`,
      );
    }

    lines.push(``);
  }

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

function generateNodeDockerignore() {
  return `node_modules
.git
.gitignore
*.md
.env
.env.*
Dockerfile
.dockerignore
.next
dist
`;
}
