// モジュール依存関係の定義
// key: モジュール名, value: 依存するモジュール名の配列
const DEPENDENCIES = {
  'networking': [],
  'alb': ['networking'],
  'ecs-fargate': ['networking', 'alb'],
  'rds-postgres': ['networking'],
  'lambda': ['networking'],
  'cloud-run': [],
  'cloud-sql': [],
  'dynamodb': [],
};

/**
 * ユーザーの選択から必要なモジュール一覧を依存解決付きで返す
 */
export function resolve(answers) {
  const selected = [answers.compute, answers.database];
  const resolved = new Set();

  function addWithDeps(mod) {
    if (resolved.has(mod)) return;
    const deps = DEPENDENCIES[mod] || [];
    for (const dep of deps) {
      addWithDeps(dep);
    }
    resolved.add(mod);
  }

  for (const mod of selected) {
    addWithDeps(mod);
  }

  return [...resolved];
}
