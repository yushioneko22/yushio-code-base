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

  return modules.map((mod) => ({
    name: mod,
    wiring: rules[mod] || {},
  }));
}
