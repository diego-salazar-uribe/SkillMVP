# Skills Compare

Skills Compare is a Next.js MVP for comparing online courses by skill. It helps users search a skill, review available courses, compare two options, and open the original course platform.

## Run Locally

```bash
corepack pnpm install
corepack pnpm dev
```

The app runs at `http://localhost:3000`.

## Validate Data

```bash
corepack pnpm validate:data
```

This validates `data/normalized/courses.json` against the course schema in `src/lib/schema/course.ts`.

## Build

```bash
corepack pnpm build
```

Run this before merging UI, routing, metadata, or data changes.

## Data Commands

```bash
corepack pnpm ingest:candidates -- --input path/to/batch.json --output data/staging/candidates.json
corepack pnpm validate:candidates -- --staging data/staging/candidates.json --as-of YYYY-MM-DD
corepack pnpm report:candidates -- --staging data/staging/candidates.json
corepack pnpm review:candidates -- --staging data/staging/candidates.json --ids candidate-a,candidate-b --note "Reviewed official evidence" --as-of YYYY-MM-DD
corepack pnpm promote:candidates -- --staging data/staging/candidates.json --ids candidate-a,candidate-b --as-of YYYY-MM-DD
corepack pnpm run:authorized-ingestion -- --limit 50 --as-of YYYY-MM-DD --workspace data/staging/issue-135-mit-ocw
```

Candidate ingestion writes to staging only. Normal promotion requires explicit human-reviewed IDs; the authorized-source runner can use versioned machine decisions only against isolated accepted-data copies. Neither path changes decision-grade approval. The legacy `ingest:edx`, `ingest:coursera`, and `build:catalog` publishers are disabled. See [docs/candidate-ingestion-foundation.md](docs/candidate-ingestion-foundation.md) for the contract and runbook.

## Current Product Limitations

- Catalog size is small and curated.
- Prices, ratings, and review counts are often unknown.
- External course links are not affiliate-enabled yet.
- Outbound click tracking is local-only when present; it does not send analytics externally.
- Ranking and recommendations are not implemented.
- Course data should remain `null`, `unknown`, or empty when not verified.

## Next Data Priorities

- Verify course syllabi and prerequisites from reliable sources.
- Improve provider coverage beyond the initial curated catalog.
- Add source freshness fields only when they can be validated.
- Preserve unknown prices and ratings until they are verified.
- Keep normalized data schema changes small and reviewed.

## Agent Workflow

Agents working on this repository should follow [docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md).
