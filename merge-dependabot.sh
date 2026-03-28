#!/bin/bash
set -euo pipefail

MODE="${1:-preview}"  # preview | bulk | interactive

echo "Fetching Dependabot PRs..."

prs=$(gh pr list \
  --author 'dependabot[bot]' \
  --json number,title,mergeable,headRefName \
  -q '.[] | select(.mergeable == "MERGEABLE") | "\(.number)|\(.title)|\(.headRefName)"')

if [ -z "$prs" ]; then
  echo "No mergeable Dependabot PRs found."
  exit 0
fi

echo ""
echo "========== PR LIST =========="
echo "$prs" | while IFS="|" read -r number title branch; do
  echo "PR #$number | $title"
done
echo "============================="

if [ "$MODE" = "preview" ]; then
  echo ""
  echo "Preview mode only. No merges or closures will happen."
  echo "Run with './merge-dependabot.sh bulk' to merge patch updates automatically,"
  echo "or './merge-dependabot.sh interactive' for per-PR approval."
  exit 0
fi

confirm_all=false
if [ "$MODE" = "bulk" ]; then
  printf "Merge ALL patch updates? (y/N): "
  read confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    confirm_all=true
  else
    echo "Aborted."
    exit 0
  fi
fi

success=0
skipped=0
failed=0
closed=0

# --- Function to check if PR is redundant ---
is_redundant() {
  local pr_number=$1
  local commits
  commits=$(gh pr view "$pr_number" --json commits --jq '.commits[].oid')
  for sha in $commits; do
    if ! git merge-base --is-ancestor "$sha" master; then
      return 1  # Not all commits in master
    fi
  done
  return 0  # All commits already in master
}

# --- Function to check if bump is patch-only ---
is_patch_update() {
  local title="$1"
  if [[ "$title" =~ bump[[:space:]]+[^[:space:]]+[[:space:]]+from[[:space:]]+([0-9]+)\.([0-9]+)\.([0-9]+)[[:space:]]+to[[:space:]]+([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
    local major_from=${BASH_REMATCH[1]}
    local minor_from=${BASH_REMATCH[2]}
    local patch_from=${BASH_REMATCH[3]}
    local major_to=${BASH_REMATCH[4]}
    local minor_to=${BASH_REMATCH[5]}
    local patch_to=${BASH_REMATCH[6]}
    if [[ "$major_from" -eq "$major_to" && "$minor_from" -eq "$minor_to" && "$patch_from" -ne "$patch_to" ]]; then
      return 0
    else
      return 1
    fi
  fi
  return 1
}

echo "$prs" | while IFS="|" read -r number title branch; do
  echo ""
  echo "----------------------------------------"
  echo "PR #$number"
  echo "Title : $title"
  echo "Branch: $branch"
  echo "----------------------------------------"

  # 1️⃣ Close redundant PRs
  if is_redundant "$number"; then
    echo "⚠ PR #$number is redundant — all commits already in master"
    gh pr close "$number" --comment "Closed automatically: all commits already applied to master."
    ((closed++))
    continue
  fi

  # 2️⃣ Skip non-patch updates automatically
  if ! is_patch_update "$title"; then
    echo "⚠ Skipping non-patch update (manual review required)"
    ((skipped++))
    continue
  fi

  # 3️⃣ Interactive per-PR approval
  if [ "$MODE" = "interactive" ]; then
    printf "Merge this PR? (y/N): "
    read confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo "Skipped PR #$number"
      ((skipped++))
      continue
    fi
  fi

  # 4️⃣ Bulk mode confirmation
  if [ "$confirm_all" = false ] && [ "$MODE" = "bulk" ]; then
    echo "Skipping PR #$number (bulk confirm not given)"
    ((skipped++))
    continue
  fi

  # 5️⃣ Merge the PR via Claude
  echo "Merging PR #$number..."
  if claude -p "Merge PR #$number: checkout, rebase on master, resolve package-lock conflicts, push, merge. If conflicts can't be auto-resolved, skip and report." \
      --allowedTools "Bash,Read,Edit"; then
    echo "✅ PR #$number merged"
    ((success++))
  else
    echo "❌ PR #$number failed"
    ((failed++))
  fi
done

echo ""
echo "========== Summary =========="
echo "Merged     : $success"
echo "Skipped    : $skipped"
echo "Closed     : $closed"
echo "Failed     : $failed"
echo "============================="
