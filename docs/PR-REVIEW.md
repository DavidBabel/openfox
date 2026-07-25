# PR Review Workflow

> How to review, fix, and merge pull requests in OpenFox — agent-assisted.

## Overview

**All PRs must target `develop`.** The setup phase enforces this automatically. Features accumulate via squash-merges. `main` stays aligned with the latest published version (see release process in [AGENTS.md](../AGENTS.md#release)).

PRs can come from **same-repo branches** or **forks** — the workflow is identical for both. We never push to the contributor's branch. All review fixes land as a single commit directly on `develop` after the merge.

## Agent-Assisted Workflow

The agent drives the review. The user reviews code, confirms fixes, and does manual testing.

### Phase 1 — Setup

The agent creates an isolated workspace and pulls in the PR branch.

```bash
# 1. Create/switch to a review workspace (auto-creates if new, runs npm install)
workspace switch review-pr-<N>

# 2. Point origin to GitHub (workspaces use --shared clone, origin
#    defaults to the local repo path — gh needs a GitHub remote)
git remote set-url origin git@github.com:co-l/openfox.git

# 3. Sync workspace with develop
git fetch origin
git reset --hard origin/develop

# 4. Fetch the PR branch
gh pr checkout <N>

# 5. Verify PR targets develop (all PRs must target develop, not main)
PR_BASE=$(gh pr view <N> --json baseRefName --jq '.baseRefName')
if [ "$PR_BASE" != "develop" ]; then
  echo "⚠️  PR #<N> targets '$PR_BASE' — retargeting to 'develop'"
  gh api repos/co-l/openfox/pulls/<N> -X PATCH -f base=develop
  git fetch origin
fi

# 6. Rebase PR branch onto latest develop (ensures review is against current code)
#    If conflicts arise, resolve them or abort with git rebase --abort.
git rebase origin/develop
```

### Phase 2 — Review

The agent examines the PR:

- Read the diff: `git diff origin/develop...HEAD`
- List changed files: `git diff --stat origin/develop...HEAD`
- Run full test suite: `npm run test:unit && npm run test:e2e`
- Run typecheck and lint: `npm run typecheck && npm run lint`
- Inspect code quality, error handling, edge cases
- Report findings to the user with specific line references

### Phase 3 — Fix

The user approves the fix plan. The agent applies fixes in the workspace.

```bash
# Apply fixes (agent uses write_file / edit_file tools)
# NOTE: Do NOT commit yet — that happens in Phase 5.
```

### Phase 4 — User Tests

The agent starts the dev server and hands off with a summary — no asking, just doing:

```bash
# Agent starts the dev server (no question — just do it)
dev_server start   # → http://localhost:<port>
```

Handoff format:

> **"PR #N is ready at http://localhost:<port>.**
>
> **Metrics:** Tests X → Y (+Z), Typecheck ✅, Lint ✅
>
> **What I fixed:**
>
> - _bullet list of specific changes_
> - _why each matters_
>
> **What to test:**
>
> Write each test item from the user's perspective. Describe what they do
> (e.g. 'tell the agent to…', 'click the branch modal button…', 'open
> settings and toggle…') and what they should observe as a result.
>
> - _specific things to try_
> - _edge cases_"

The user opens the link and kicks the tires. Loop back to Phase 3 if adjustments are needed.

### Phase 5 — Merge

When the user says **"Merge it"**, the agent runs a single unified flow. It works identically for same-repo branches and forks — we never push to the contributor's branch.

```bash
# ──────────────────────────────────────────────
# 1. Save all review fixes as a patch
# ──────────────────────────────────────────────
git diff > /tmp/pr-<N>-review-fixes.patch

# ──────────────────────────────────────────────
# 2. Squash-merge the PR (original contributor code only)
#    The API operates on the remote PR branch — it ignores our
#    local state entirely. No force-push needed.
# ──────────────────────────────────────────────
gh api repos/co-l/openfox/pulls/<N>/merge -X PUT \
  -f merge_method=squash \
  -f commit_title="feat: description (#<N>)"

# ──────────────────────────────────────────────
# 3. Switch back to the original project
# ──────────────────────────────────────────────
workspace switch original

# ──────────────────────────────────────────────
# 4. Pull the latest develop (now includes the squash-merge)
# ──────────────────────────────────────────────
git checkout develop && git pull origin develop --ff-only

# ──────────────────────────────────────────────
# 5. Apply all our fixes as ONE commit on develop
# ──────────────────────────────────────────────
git apply /tmp/pr-<N>-review-fixes.patch
git add -A
git commit -m "review: <summary of fixes> (#<N>)"   # timeout: 120000ms
git push origin develop

# ──────────────────────────────────────────────
# 6. ✅ Verify — both commits visible on origin/develop
# ──────────────────────────────────────────────
echo "=== origin/develop after merge ==="
git log --oneline origin/develop -3

# ──────────────────────────────────────────────
# 7. Clean up
# ──────────────────────────────────────────────
rm /tmp/pr-<N>-review-fixes.patch
workspace delete review-pr-<N>
```

**What's happening under the hood:**

- **Step 1** dumps the diff to `/tmp`. Plain text, human-readable, zero-config.
- **Step 2** tells GitHub to squash-merge the PR's remote branch into `develop`. Our local changes don't participate.
- **Step 5** replays the exact same diff onto develop and commits it as a single atomic fix commit.

**Result on `origin/develop`:**

```
abc1234 review: <summary> (#<N>)      ← our single fix commit
def5678 feat: description (#<N>)      ← PR squash-merge
ghi9012 ...                            ← previous develop
```

## Complete Example

```bash
# ── Setup ──
workspace switch review-pr-103
git remote set-url origin git@github.com:co-l/openfox.git
git fetch origin && git reset --hard origin/develop
gh pr checkout 103

PR_BASE=$(gh pr view 103 --json baseRefName --jq '.baseRefName')
if [ "$PR_BASE" != "develop" ]; then
  echo "⚠️  PR #103 targets '$PR_BASE' — retargeting to 'develop'"
  gh api repos/co-l/openfox/pulls/103 -X PATCH -f base=develop
  git fetch origin
fi

git rebase origin/develop

# ── Review ──
git diff --stat origin/develop...HEAD
npm run typecheck
npm run test:unit && npm run test:e2e

# ── Fix (agent proposes → user approves) ──
# agent applies fixes via edit_file
# NOTE: Do NOT commit yet — that happens in the merge phase.

# ── Agent starts dev server and hands off ──
dev_server start
# "PR #103 ready at http://localhost:.... Metrics: ..., Typecheck ✅, Lint ✅
#  What I fixed: ... What to test: ..."
# ── User tests, iterates if needed ──

# ── Merge (user says "merge it") ──
git diff > /tmp/pr-103-review-fixes.patch
gh api repos/co-l/openfox/pulls/103/merge -X PUT \
  -f merge_method=squash \
  -f commit_title="feat: PDF embedded-image support (#103)"
workspace switch original
git checkout develop && git pull origin develop --ff-only
git apply /tmp/pr-103-review-fixes.patch
git add -A && git commit -m "review: fix windows path handling in npm spawn (#103)"   # timeout: 120000ms
git push origin develop
git log --oneline origin/develop -3
rm /tmp/pr-103-review-fixes.patch
workspace delete review-pr-103
```

## Common Pitfalls

### Patch apply fails

**Scenario:** `git apply /tmp/pr-<N>-review-fixes.patch` fails with "patch does not apply."

**Root cause:** The squash-merge changed the base code in ways that conflict with our patch (rare — usually means the PR was force-pushed between review and merge).

**Fix:** Regenerate the patch from the workspace before resetting:

```bash
# In the workspace, after confirming the PR hasn't changed:
git diff > /tmp/pr-<N>-review-fixes.patch
```

If the PR did change (someone pushed new commits), re-review from Phase 2.

### `gh pr merge` GraphQL deprecation

`gh pr merge` may fail with `GraphQL: Projects (classic) is being deprecated` even when the merge succeeds. Use the REST API directly instead:

```bash
gh api repos/co-l/openfox/pulls/<N>/merge -X PUT \
  -f merge_method=squash \
  -f commit_title="feat: description (#<N>)"
```

### Orphaned workspaces

If a workspace switch fails midway, clean up manually:

```bash
workspace delete <name>          # via tool
# or manually:
rm -rf ~/.local/share/openfox/workspaces/<project>/<name>
```

### Rebase conflicts

If `git rebase origin/develop` produces conflicts in Phase 1:

```bash
# Check status
git status

# Resolve each conflicted file, then:
git add <file>
git rebase --continue

# Or abort entirely:
git rebase --abort
```

## Squash-Merge via API

Always use the REST API for merging to avoid GraphQL deprecation errors:

```bash
gh api repos/co-l/openfox/pulls/<N>/merge -X PUT \
  -f merge_method=squash \
  -f commit_title="feat: description (#<N>)"
```
