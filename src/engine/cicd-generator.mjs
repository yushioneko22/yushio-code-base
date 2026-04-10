import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * CI/CD ワークフローファイルを生成
 */
export async function generateCicd(outDir, answers) {
  if (answers.cicd !== 'github-actions') return;

  const workflowDir = join(outDir, '.github', 'workflows');
  await mkdir(workflowDir, { recursive: true });

  await writeFile(join(workflowDir, 'ci.yml'), generateCiYml(answers));
  await writeFile(join(workflowDir, 'deploy.yml'), generateDeployYml(answers));
}

// ---------------------------------------------------------------------------
// CI (Build & Test)
// ---------------------------------------------------------------------------

function generateCiYml(answers) {
  const hasFrontend = answers.frontend && answers.frontend !== 'none';

  const lines = [
    `name: CI`,
    ``,
    `on:`,
    `  push:`,
    `    branches: [main]`,
    `  pull_request:`,
    `    branches: [main]`,
    ``,
    `jobs:`,
    `  test-backend:`,
    `    runs-on: ubuntu-latest`,
    `    defaults:`,
    `      run:`,
    `        working-directory: backend`,
    `    steps:`,
    `      - uses: actions/checkout@v4`,
    ``,
  ];

  lines.push(...ciStepsForBackend(answers.backend));

  if (hasFrontend) {
    lines.push(
      `  test-frontend:`,
      `    runs-on: ubuntu-latest`,
      `    defaults:`,
      `      run:`,
      `        working-directory: frontend`,
      `    steps:`,
      `      - uses: actions/checkout@v4`,
      ``,
      `      - uses: actions/setup-node@v4`,
      `        with:`,
      `          node-version: "20"`,
      `          cache: npm`,
      `          cache-dependency-path: frontend/package-lock.json`,
      ``,
      `      - name: Install`,
      `        run: npm ci`,
      ``,
      `      - name: Lint`,
      `        run: npm run lint --if-present`,
      ``,
      `      - name: Build`,
      `        run: npm run build`,
      ``,
      `      - name: Test`,
      `        run: npm test -- --passWithNoTests`,
      ``,
    );
  }

  return lines.join('\n');
}

function ciStepsForBackend(backend) {
  switch (backend) {
    case 'go':
      return [
        `      - uses: actions/setup-go@v5`,
        `        with:`,
        `          go-version: "1.22"`,
        ``,
        `      - name: Build`,
        `        run: go build ./...`,
        ``,
        `      - name: Test`,
        `        run: go test ./...`,
        ``,
      ];
    case 'node-hono':
      return [
        `      - uses: actions/setup-node@v4`,
        `        with:`,
        `          node-version: "20"`,
        `          cache: npm`,
        ``,
        `      - name: Install`,
        `        run: npm ci`,
        ``,
        `      - name: Build`,
        `        run: npm run build --if-present`,
        ``,
        `      - name: Test`,
        `        run: npm test`,
        ``,
      ];
    case 'python-fastapi':
      return [
        `      - uses: actions/setup-python@v5`,
        `        with:`,
        `          python-version: "3.12"`,
        ``,
        `      - name: Install`,
        `        run: pip install -r requirements.txt`,
        ``,
        `      - name: Test`,
        `        run: pytest`,
        ``,
      ];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Deploy
// ---------------------------------------------------------------------------

function generateDeployYml(answers) {
  if (answers.compute === 'ecs-fargate') {
    return generateEcsFargateDeploy(answers);
  }
  if (answers.compute === 'lambda') {
    return generateLambdaDeploy(answers);
  }
  return '';
}

function generateEcsFargateDeploy(answers) {
  return `name: Deploy

on:
  push:
    branches: [main]    # → dev
    tags: ["v*"]        # → prod
  workflow_dispatch:
    inputs:
      environment:
        description: "Deploy target environment"
        required: true
        default: stg
        type: choice
        options: [dev, stg, prod]

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: ap-northeast-1
  # TODO: terraform apply 後に以下を埋めてください
  ECR_REPOSITORY: <ECR_REPOSITORY_URL>
  ECS_CLUSTER: ${answers.projectName}-dev
  ECS_SERVICE: ${answers.projectName}-dev
  CONTAINER_NAME: app

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Determine environment
        id: env
        run: |
          if [[ "\${{ github.event_name }}" == "workflow_dispatch" ]]; then
            echo "env=\${{ inputs.environment }}" >> "$GITHUB_OUTPUT"
          elif [[ "\${{ github.ref }}" == refs/tags/v* ]]; then
            echo "env=prod" >> "$GITHUB_OUTPUT"
          else
            echo "env=dev" >> "$GITHUB_OUTPUT"
          fi

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          # TODO: terraform output の github_actions_deploy_role_arn を設定
          role-to-assume: <DEPLOY_ROLE_ARN>
          aws-region: \${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image
        id: build
        run: |
          IMAGE_TAG=\${{ github.sha }}
          docker build -t \${{ env.ECR_REPOSITORY }}:$IMAGE_TAG .
          docker push \${{ env.ECR_REPOSITORY }}:$IMAGE_TAG
          echo "image=\${{ env.ECR_REPOSITORY }}:$IMAGE_TAG" >> "$GITHUB_OUTPUT"

      - name: Download current task definition
        run: |
          aws ecs describe-task-definition \\
            --task-definition \${{ env.ECS_SERVICE }} \\
            --query taskDefinition \\
            > task-definition.json

      - name: Update task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: \${{ env.CONTAINER_NAME }}
          image: \${{ steps.build.outputs.image }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: \${{ steps.task-def.outputs.task-definition }}
          service: \${{ env.ECS_SERVICE }}
          cluster: \${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
`;
}

function generateLambdaDeploy(answers) {
  const buildStep = lambdaBuildStep(answers.backend);

  return `name: Deploy

on:
  push:
    branches: [main]    # → dev
    tags: ["v*"]        # → prod
  workflow_dispatch:
    inputs:
      environment:
        description: "Deploy target environment"
        required: true
        default: stg
        type: choice
        options: [dev, stg, prod]

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: ap-northeast-1
  # TODO: terraform apply 後に設定
  FUNCTION_NAME: ${answers.projectName}-dev

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Determine environment
        id: env
        run: |
          if [[ "\${{ github.event_name }}" == "workflow_dispatch" ]]; then
            echo "env=\${{ inputs.environment }}" >> "$GITHUB_OUTPUT"
          elif [[ "\${{ github.ref }}" == refs/tags/v* ]]; then
            echo "env=prod" >> "$GITHUB_OUTPUT"
          else
            echo "env=dev" >> "$GITHUB_OUTPUT"
          fi

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          # TODO: terraform output の github_actions_deploy_role_arn を設定
          role-to-assume: <DEPLOY_ROLE_ARN>
          aws-region: \${{ env.AWS_REGION }}

${buildStep}
      - name: Deploy to Lambda
        run: |
          aws lambda update-function-code \\
            --function-name \${{ env.FUNCTION_NAME }} \\
            --zip-file fileb://function.zip
`;
}

function lambdaBuildStep(backend) {
  switch (backend) {
    case 'go':
      return `      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"

      - name: Build
        run: |
          GOOS=linux GOARCH=amd64 go build -o bootstrap .
          zip function.zip bootstrap

`;
    case 'node-hono':
      return `      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Build
        run: |
          npm ci --production
          zip -r function.zip . -x "*.git*"

`;
    case 'python-fastapi':
      return `      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Build
        run: |
          pip install -r requirements.txt -t package/
          cd package && zip -r ../function.zip .
          cd .. && zip function.zip lambda_handler.py

`;
    default:
      return '';
  }
}
