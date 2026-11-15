#!/usr/bin/env bash
# Verifies the `module` and `workflow` generators end to end, in a throwaway copy of the repo:
#   1. copies the repo to a temp dir (no node_modules, dist, .turbo or .git)
#   2. installs from the local pnpm store (offline, frozen lockfile)
#   3. runs `turbo gen module` once and `turbo gen workflow` twice, non-interactively:
#      a new feature, then a second workflow on that same feature (exercises the
#      "create" and the "modify existing files" paths)
#   4. checks the registry wiring, builds @projectx/api, typechecks it (specs included)
#      and runs the generated workflow tests (TestWorkflowEnvironment)
#
# Usage: pnpm test:generators            (KEEP_TMP=1 keeps the temp copy for inspection)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/projectx-generators.XXXXXX")"
REPO="$WORK_DIR/repo"

cleanup() {
  if [[ "${KEEP_TMP:-0}" == "1" ]]; then
    echo "Kept temp copy at $REPO"
  else
    rm -rf "$WORK_DIR"
  fi
}
trap cleanup EXIT

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mFAIL: %s\033[0m\n' "$*" >&2; exit 1; }
assert_contains() {
  local file="$1" pattern="$2"
  [[ -f "$file" ]] || fail "missing file $file"
  grep -Eq -- "$pattern" "$file" || fail "$file does not match /$pattern/"
}

step "Copying $ROOT to $REPO"
mkdir -p "$REPO"
rsync -a \
  --exclude node_modules \
  --exclude .turbo \
  --exclude .git \
  --exclude dist \
  --exclude coverage \
  --exclude .env \
  --exclude packages/db/generated \
  "$ROOT/" "$REPO/"
cd "$REPO"

step "Installing dependencies from the local pnpm store"
export HUSKY=0
# prisma generate reads DATABASE_URL from prisma.config.ts but never connects
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/projectx_db?schema=public}"
if ! pnpm install --offline --frozen-lockfile; then
  echo "Offline install failed (store incomplete?), retrying with --prefer-offline"
  pnpm install --prefer-offline --frozen-lockfile
fi

API_SRC="apps/api/src"
if [[ -f "$API_SRC/activities/activities.service.ts" ]]; then
  ACTIVITIES_DIR="$API_SRC/activities"
else
  ACTIVITIES_DIR="$API_SRC/app/activities"
fi
# Feature modules live next to app.module.ts
if [[ -f "$API_SRC/app/app.module.ts" ]]; then
  APP_MODULE="$API_SRC/app/app.module.ts"
else
  APP_MODULE="$API_SRC/app.module.ts"
fi
FEATURES_DIR="$(dirname "$APP_MODULE")"

step "turbo gen module"
pnpm exec turbo gen module --args verify-module "Endpoints created by the generator check"
assert_contains "$FEATURES_DIR/verify-module/verify-module.module.ts" "export class VerifyModuleModule"
assert_contains "$FEATURES_DIR/verify-module/verify-module.controller.spec.ts" "VerifyModuleController"
assert_contains "$APP_MODULE" "VerifyModuleModule"

step "turbo gen workflow (new feature)"
pnpm exec turbo gen workflow --args verifyGenerator verify-generator runVerifyGenerator "Generator check workflow"

step "turbo gen workflow (existing feature)"
pnpm exec turbo gen workflow --args verifyGeneratorFollowup verify-generator runVerifyGeneratorFollowup "Second workflow on the same feature"

step "turbo gen workflow (feature whose activities module already exists: auth)"
pnpm exec turbo gen workflow --args verifyAuthFeature auth runVerifyAuthFeature "Workflow added to the auth feature"

step "Checking the activity registry wiring"
FEATURE_DIR="$FEATURES_DIR/verify-generator"
assert_contains "$API_SRC/workflows/index.ts" 'export \* from "\./verify-generator\.workflow"'
assert_contains "$API_SRC/workflows/index.ts" 'export \* from "\./verify-generator-followup\.workflow"'
assert_contains "$API_SRC/workflows/verify-generator.workflow.ts" "export async function verifyGeneratorWorkflow"
assert_contains "$API_SRC/workflows/verify-generator.workflow.spec.ts" "TestWorkflowEnvironment"
assert_contains "$FEATURE_DIR/verify-generator.activities.ts" "async runVerifyGenerator\("
assert_contains "$FEATURE_DIR/verify-generator.activities.ts" "async runVerifyGeneratorFollowup\("
assert_contains "$FEATURE_DIR/verify-generator.module.ts" "providers: \[VerifyGeneratorActivities\]"
assert_contains "$FEATURE_DIR/verify-generator.module.ts" "exports: \[VerifyGeneratorActivities\]"
assert_contains "$ACTIVITIES_DIR/activities.module.ts" "VerifyGeneratorModule"
assert_contains "$ACTIVITIES_DIR/activities.service.ts" "private readonly verifyGeneratorActivities: VerifyGeneratorActivities"
assert_contains "$ACTIVITIES_DIR/activities.service.ts" "this\.verifyGeneratorActivities\.runVerifyGenerator\("
assert_contains "$ACTIVITIES_DIR/activities.service.ts" "this\.verifyGeneratorActivities\.runVerifyGeneratorFollowup\("
assert_contains "$FEATURES_DIR/auth/auth.activities.ts" "async runVerifyAuthFeature\("
assert_contains "$ACTIVITIES_DIR/activities.service.ts" "this\.authActivities\.runVerifyAuthFeature\("
# The activities go to the module that already provides AuthActivities, not
# to the feature's HTTP module (auth.module.ts) or a new one
if [[ -f "$FEATURES_DIR/auth/auth.module.ts" ]] && grep -qw "AuthActivities" "$FEATURES_DIR/auth/auth.module.ts"; then
  fail "wired AuthActivities into auth.module.ts instead of the module that provides it"
fi
assert_contains "$FEATURES_DIR/auth/auth-activities.module.ts" "providers: \[AuthActivities\]"
[[ "$(grep -c "verifyGeneratorActivities:" "$ACTIVITIES_DIR/activities.service.ts")" == "1" ]] \
  || fail "ActivitiesService injects VerifyGeneratorActivities more than once"

step "Linting the generated code"
pnpm exec biome check apps/api

step "Building @projectx/api and its dependencies"
pnpm exec turbo run build --filter=@projectx/api...

step "Typechecking @projectx/api (sources and specs)"
pnpm --filter @projectx/api run typecheck

step "Running the generated tests"
pnpm --filter @projectx/api run test -- \
  --testPathPatterns 'verify-(generator|auth-feature).*\.workflow\.spec\.ts$|verify-module\.controller\.spec\.ts$'

step "Generators verified"
