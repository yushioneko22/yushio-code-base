import chalk from 'chalk';

export function banner() {
  console.log('');
  console.log(chalk.bold.cyan('  yushio-devenv-set-cli'));
  console.log(chalk.dim('  プロジェクト初期環境を対話形式でセットアップ'));
  console.log('');
}

export function success(projectName) {
  console.log('');
  console.log(chalk.green.bold('✔ プロジェクトを生成しました!'));
  console.log('');
  console.log(`  ${chalk.cyan('cd')} ${projectName}`);
  console.log(`  ${chalk.cyan('make init')}    # Terraform初期化`);
  console.log(`  ${chalk.cyan('make plan')}    # 変更プレビュー`);
  console.log('');
  console.log(chalk.dim('  CLAUDE.md が生成されています。'));
  console.log(chalk.dim('  Claude Code で開くとプロジェクトのコンテキストが自動で読み込まれます。'));
  console.log('');
}

export function fail(message) {
  console.log('');
  console.log(chalk.red.bold('✖ エラーが発生しました'));
  console.log(chalk.red(`  ${message}`));
  console.log('');
}
