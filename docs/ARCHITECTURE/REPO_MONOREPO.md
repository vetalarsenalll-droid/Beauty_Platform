REPO: Monorepo Structure

beauty-platform/
  apps/
    web/
    worker/
    mobile/
  packages/
    db/
    contracts/
    tokens/
    shared/
    shared-ui/ (optional)
  docs/
  DEVLOG.md
  MIGRATIONS.md
  API_CHANGELOG.md
  SETTINGS_CHANGELOG.md
  docker/
    dev/
    prod/
  scripts/
  .env.example
  README.md

Правило: apps — исполняемые, packages — источники истины.
