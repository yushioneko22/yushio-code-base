import { input, select, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';

export async function runPrompts() {
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.bold('📋 プロジェクト設定\n'));

  const projectName = await input({
    message: 'プロジェクト名:',
    validate: (v) => /^[a-z0-9-]+$/.test(v) || '英小文字・数字・ハイフンのみ',
  });

  const cloud = await select({
    message: 'クラウドプロバイダー:',
    choices: [
      { name: 'AWS', value: 'aws' },
      { name: 'GCP', value: 'gcp' },
    ],
  });

  const backend = await select({
    message: 'バックエンド:',
    choices: [
      { name: 'Go', value: 'go' },
      { name: 'Node.js + Hono', value: 'node-hono' },
      { name: 'Python + FastAPI', value: 'python-fastapi' },
    ],
  });

  let compute, database;

  if (cloud === 'aws') {
    compute = await select({
      message: 'コンピュート:',
      choices: [
        { name: 'ECS Fargate', value: 'ecs-fargate' },
        { name: 'Lambda', value: 'lambda' },
      ],
    });

    database = await select({
      message: 'データベース:',
      choices: [
        { name: 'RDS (PostgreSQL)', value: 'rds-postgres' },
        { name: 'DynamoDB', value: 'dynamodb' },
      ],
    });
  } else {
    compute = await select({
      message: 'コンピュート:',
      choices: [
        { name: 'Cloud Run', value: 'cloud-run' },
      ],
    });

    database = await select({
      message: 'データベース:',
      choices: [
        { name: 'Cloud SQL (PostgreSQL)', value: 'cloud-sql' },
      ],
    });
  }

  const frontend = await select({
    message: 'フロントエンド:',
    choices: [
      { name: 'Next.js', value: 'nextjs' },
      { name: 'Vite + React', value: 'vite-react' },
      { name: 'なし', value: 'none' },
    ],
  });

  const cicd = await select({
    message: 'CI/CD:',
    choices: [
      { name: 'GitHub Actions', value: 'github-actions' },
      { name: 'CodePipeline (AWS)', value: 'codepipeline' },
      { name: 'Cloud Build (GCP)', value: 'cloud-build' },
    ],
  });

  console.log('');
  return { projectName, cloud, backend, frontend, compute, database, cicd };
}
