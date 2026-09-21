# Engineering Rules

These rules define how implementation work should be executed and published.

## Repository and Branch Safety

Canonical repository: `diegosalazaru/SkillMVP`.

Before implementation, local or cloud coding agents using Git must:

1. Confirm `origin` points to the canonical repository.
2. `git fetch origin main`.
3. Create or reset the task branch from `origin/main`.
4. Verify the merge base against `origin/main`.
5. Push the empty task branch before modifying files.

If any fetch, authentication, checkout, permissions, proxy, history, or push step fails, stop before implementation.

GitHub CLI (`gh`) is optional and is not part of the mandatory publishing preflight. Do not install or authenticate `gh` merely to execute an approved task. Standard `git` authentication through the configured remote is sufficient for fetch and push. If the implementation branch can be pushed but the local agent cannot create a pull request because `gh` is unavailable, that is not an implementation blocker: finish the approved work, push the branch, report the limitation, and let the connected GitHub workflow or product owner create the PR.

Do not reuse unrelated-history commits, synthetic-root history, stale workspaces, or unpublished local-only work.

## Approval Friction

Routine repository work should proceed without interrupting the user when the environment allows. This includes repository reads and edits, standard Git operations, Node/pnpm/TypeScript/Next validation and builds, localhost and browser checks, branch and PR updates, and narrow temporary sandbox escalation for a normal local command.

Explicit user approval is reserved for genuinely high-risk, security-sensitive, destructive, materially out-of-scope, or material product-decision actions. Examples include system or security policy changes, broad or permanent permissions, software or dependency installation, credential or secret access, destructive Git or history operations, filesystem changes outside the canonical repository, infrastructure/deployment/CI expansion not already approved, material scope expansion, unresolved decision-changing uncertainty, and realistic risk of data or work loss.

## PR Lifecycle and Merge Authority

### Coding-agent execution

- Coding agents must leave task PRs as draft by default.
- `Do not merge` is absolute for the coding agent executing the task.
- Coding agents must not mark a draft PR ready, merge, squash-merge, rebase-merge, enable auto-merge, or invoke an equivalent merge action unless their task explicitly delegates that specific action.
- Green CI, Vercel, or local validation is necessary evidence, never implicit merge authority for the coding agent.
- Finishing implementation means pushing the branch, opening or updating the draft PR, reporting validation results and blockers, and then stopping.

### Independent ChatGPT review

After independent product/code review, ChatGPT may autonomously mark a specific draft PR ready and merge it when all of the following are true:

- Scope matches the approved initiative.
- No material product, data-truth, security, build, history, or UX blocker remains.
- Required repository validation and checks are green, or any non-applicable check is explicitly understood.
- The merge is a normal, non-destructive repository operation.

ChatGPT does not need a separate product-owner message such as `Merge PR #X` for a routine reviewed merge. A coding-agent task instruction `Do not merge` applies to the coding agent executing that task; it does not prevent an independent ChatGPT reviewer from later marking the PR ready and merging it after acceptance.

ChatGPT must ask the product owner before merging when review exposes a material product tradeoff, meaningful scope expansion, unresolved decision-changing uncertainty, security or credential risk, a destructive or history-rewriting action, an infrastructure or system-policy change, or a realistic risk of data or work loss.

## Scope Discipline

- One approved initiative per PR.
- No opportunistic refactors unless required for the task.
- Do not add dependencies without explicit approval.
- Do not change deployment configuration or build tooling unless the task requires it.
- Do not add external APIs, scraping, cookies, external analytics, or new services without explicit approval.
- Prefer small changes that can be reviewed and reversed easily.

## Required Validation

For normal product/code PRs, run:

```bash
corepack pnpm validate:data
corepack pnpm report:data-quality
corepack pnpm check:ingestion-foundation
corepack pnpm check:authorized-ingestion
corepack pnpm exec tsc --noEmit
corepack pnpm build
```

### Windows TypeScript launcher fallback

On some Windows shells, `corepack pnpm exec tsc --noEmit` can fail before TypeScript runs because the shell cannot resolve the local `tsc` executable, for example with `"tsc" is not recognized as an internal or external command`.

If and only if all of the following are true:

- the failure is an executable-resolution/launcher error rather than TypeScript diagnostics,
- `typescript` remains declared in the repository devDependencies,
- the local installation is already present in `node_modules`, and
- no dependency or build-tooling change is required,

use this equivalent repository-local compiler invocation:

```bash
node node_modules/typescript/bin/tsc --noEmit
```

Rules for the fallback:

- Do not install or modify TypeScript, `package.json`, the lockfile, build tooling, or TypeScript configuration merely to work around the launcher error.
- A launcher-resolution error is not itself a TypeScript compilation failure.
- If the direct local compiler reports TypeScript diagnostics or exits unsuccessfully for a real compilation reason, treat validation as failed.
- Report in the PR when the fallback was used and why.

General validation rules:

- Data changes must pass validation.
- Build must pass before merge.
- `report:data-quality` must not show unexplained regressions caused by the PR.
- Do not initialize ESLint configuration just to make lint run. The repository currently has no finalized ESLint setup and `next lint` may prompt interactively.
- Do not run `generate:seo` unless catalog or SEO generation inputs changed.
- If the same validation fails twice for the same underlying reason, stop and document the blocker rather than improvising broad fixes. The documented Windows TypeScript launcher fallback above is the approved narrow exception for that specific launcher-resolution failure.

## Data Engineering Rules

- Normalized course data must conform to the existing schema.
- Do not invent exact values.
- Unknown values remain null, unknown, empty, pending, or explicitly unverified as appropriate to the schema.
- Source metadata and verification status must correspond to actual source review.
- Keep data changes small and auditable.
- Provider URLs should remain direct official URLs unless Phase 2 explicitly introduces a verified affiliate/referral relationship.

## Frontend Rules

- Preserve the Search -> Compare -> Decide hierarchy.
- Treat mobile as a first-class target.
- Maintain accessible semantics for buttons, links, forms, and stateful controls.
- Avoid layout regressions from long titles and unknown values.
- Do not add visible MVP/debug language to the production UI.
- Current production UI language is English-first.

## Architecture Rules

- Use existing patterns before introducing new abstractions.
- Avoid broad design-system work when a small component change solves the problem.
- Avoid speculative backend infrastructure.
- Avoid new packages for functionality already supported by the stack.
- Keep operational cost and maintenance low.

## PR Completion Checklist

Before finishing implementation on a draft PR:

- Branch is based on current `main` history.
- Scope matches the approved initiative.
- No unrelated files are changed.
- Validation results are reported.
- Product guardrails remain intact.
- Documentation is updated if a durable decision or roadmap state changed.
- GitHub checks are green or any missing check is explicitly explained.

Coding agents stop after the branch and draft PR are updated and the validation results and blockers are reported. Any later ready-for-review transition or merge follows the independent ChatGPT review rules above.
