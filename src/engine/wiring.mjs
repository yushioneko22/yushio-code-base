// モジュール間の output → variable 接続ルール (Ideaxis パターン)
const WIRING_RULES = {
  aws: {
    'alb': {
      'vpc_id': 'module.networking.vpc_id',
      'public_subnet_ids': 'module.networking.public_subnet_ids',
      'alb_security_group_id': 'module.networking.alb_security_group_id',
    },
    'ecs-fargate': {
      'private_subnet_ids': 'module.networking.private_subnet_ids',
      'ecs_security_group_id': 'module.networking.ecs_security_group_id',
      'backend_target_group_arn': 'module.alb.backend_target_group_arn',
    },
    'rds-postgres': {
      'private_subnet_ids': 'module.networking.private_subnet_ids',
      'rds_security_group_id': 'module.networking.rds_security_group_id',
    },
  },
  gcp: {},
};

/**
 * 解決済みモジュールリストにワイヤリング情報を付与して返す
 */
export function wire(modules, answers) {
  const rules = WIRING_RULES[answers.cloud] || {};

  return modules.map((mod) => {
    let wiring = rules[mod] || {};

    // ecs-fargate: RDS選択時に DB 接続情報を渡す
    if (mod === 'ecs-fargate' && answers.database === 'rds-postgres') {
      wiring = {
        ...wiring,
        'db_credentials_secret_arn': 'module.rds-postgres.db_credentials_secret_arn',
      };
    }

    // github-oidc は選択内容に応じて動的にワイヤリング
    if (mod === 'github-oidc') {
      wiring = {
        'github_owner': 'var.github_owner',
        'github_repo': 'var.github_repo',
        'attach_ecr_policy': answers.compute === 'ecs-fargate' ? 'true' : 'false',
        'attach_ecs_policy': answers.compute === 'ecs-fargate' ? 'true' : 'false',
        'attach_lambda_policy': answers.compute === 'lambda' ? 'true' : 'false',
      };
    }

    return { name: mod, wiring };
  });
}
