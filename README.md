# create-yushio-devenv

対話形式でフルスタックプロジェクトの初期環境（Terraform / Docker / CI/CD）をスキャフォールドする CLI ツールです。

## 使い方

### npx で実行（インストール不要）

```bash
npx create-yushio-devenv
```

### ローカルで実行

```bash
git clone https://github.com/yushioneko22/yushio-code-base.git
cd yushio-code-base
npm install
npm start
```

## 対話プロンプト

実行すると以下の項目を対話形式で選択できます。

| 項目 | 選択肢 |
|------|--------|
| プロジェクト名 | 英小文字・数字・ハイフン |
| クラウドプロバイダー | AWS / GCP |
| バックエンド | Go / Node.js + Hono / Python + FastAPI |
| コンピュート | ECS Fargate, Lambda (AWS) / Cloud Run (GCP) |
| データベース | RDS PostgreSQL, DynamoDB (AWS) / Cloud SQL (GCP) |
| CI/CD | GitHub Actions / CodePipeline / Cloud Build |

## 生成されるプロジェクト構成

```
<project-name>/
├── CLAUDE.md              # Claude Code 用コンテキスト
├── Makefile               # Terraform 操作用コマンド
└── infra/
    ├── modules/           # Terraform モジュール（選択に応じて生成）
    │   ├── networking/
    │   ├── alb/
    │   ├── ecs-fargate/
    │   └── rds-postgres/
    └── environments/
        ├── dev/           # main.tf, variables.tf, provider.tf 等
        ├── stg/
        └── prod/
```

## 生成後の使い方

```bash
cd <project-name>
make init    # terraform init
make plan    # terraform plan
make apply   # terraform apply
```

環境を切り替える場合:

```bash
make plan ENV=stg
make apply ENV=prod
```

## ライセンス

MIT
