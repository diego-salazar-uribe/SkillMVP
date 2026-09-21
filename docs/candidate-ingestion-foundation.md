# Candidate ingestion foundation

Issue #124 adds a provider-neutral, file-based publication boundary for bounded batches of 1–50 course candidates. Issue #135 reuses and extends that boundary with one authorized live-source connector and a reviewed machine-publication policy. It does not add crawling, a database, an admin interface, automatic decision-grade approval, or production activation.

## Safety model

The workflow is deliberately split:

1. `ingest:candidates` converts one curated JSON input into staging only.
2. `validate:candidates` deterministically assigns `review_ready` or `quarantined` and records machine-readable exception codes.
3. `report:candidates` reports factual batch counts and can include a promotion receipt.
4. `review:candidates` remains available for manual/unapproved sources and exceptions.
5. A source-specific reviewed policy can record a machine decision for a validated candidate, including actor, policy/version, digest, timestamp, outcome, and reasons.
6. `promote:candidates` accepts explicit human-reviewed IDs by default. The autonomous orchestrator can opt into valid machine decisions only while targeting isolated accepted-data copies.

No ingest, validation, review, or reporting command can target `data/normalized/courses.json`, `data/normalized/course-source-metadata.json`, or `data/decision-grade-manifest.json`. The three legacy commands that previously normalized or built accepted data are disabled with migration guidance.

Promotion never changes `data/decision-grade-manifest.json`. A promoted course is source-ready only; decision-grade pair approval remains a separate product decision and workflow.

## Candidate envelope

Each staged record carries:

- stable `candidateId` and proposed canonical `proposedCourseId`;
- stable `sourceIdentity.sourceId` and provider-native `providerCourseId`;
- provider and platform identity;
- canonical official source URL plus discovered/observed dates;
- a normalized course payload that passes `CourseSchema`;
- field-level evidence for title, platform, source identity, availability, and pricing;
- exact, provider-qualified `starting_at`, or genuine `free` pricing evidence using the current pricing contract;
- current-offering evidence;
- source metadata proposed for publication, including an explicit `publicationStatus: "published"` decision;
- deterministic exception codes, optional human context, a `candidate`, `review_ready`, or `quarantined` disposition, a separate nullable human-review record, and a separate nullable machine decision.

Pricing evidence stays in the envelope and is preserved in promoted source metadata. New source-ready candidates must not include the decision-grade-only course fields; this prevents a valid `Course` parse from silently entering the approved decision-grade set.

## Deterministic quarantine

Validation supports these codes:

- `missing_source`
- `availability_conflict`
- `duplicate_identity`
- `source_identity_conflict`
- `missing_required_evidence`
- `pricing_unactionable`
- `pricing_conflict`
- `entitlement_unclear`
- `stale_commercial_evidence`
- `unsupported_offering`
- `normalization_conflict`

Commercial evidence older than 180 days relative to `--as-of` is quarantined. Invalid zero paid/subscription prices are rejected by the shared pricing schema. Genuine free access must use the distinct `free` semantic; `starting_at` evidence remains qualified and cannot populate an exact scalar course price.

New candidates without an explicit publication decision are quarantined; `source_blocked` candidates remain unsupported and cannot become review-ready. The accepted-metadata reader continues to tolerate the two audited historical `lastVerifiedAt: null` blockers, while candidate input still requires a current non-null verification date.

## Commands

```bash
corepack pnpm ingest:candidates -- --input path/to/batch.json --output data/staging/candidates.json
corepack pnpm validate:candidates -- --staging data/staging/candidates.json --as-of YYYY-MM-DD
corepack pnpm report:candidates -- --staging data/staging/candidates.json
corepack pnpm review:candidates -- --staging data/staging/candidates.json --ids candidate-a,candidate-b --reviewed-at YYYY-MM-DD --note "Reviewed official source and pricing evidence" --as-of YYYY-MM-DD
corepack pnpm promote:candidates -- --staging data/staging/candidates.json --ids candidate-a,candidate-b --receipt data/staging/promotion-receipt.json --as-of YYYY-MM-DD
corepack pnpm report:candidates -- --staging data/staging/candidates.json --promotion-receipt data/staging/promotion-receipt.json --as-of YYYY-MM-DD
```

The input batch must contain 1–50 candidates and an explicit `batchId` and `receivedAt`. Staging files are ignored by Git so operator batches do not become accepted data through a normal commit.

Promotion requires the persisted candidate to have already been validated as `review_ready` and to carry the explicit human-review record, revalidates it at promotion time, rejects ID/source collisions before writes, appends new records in deterministic ID order, and uses temporary files plus rollback to replace catalog and source metadata as one operation. Human review stores a SHA-256 digest of the reviewed candidate content; a later semantic edit or quarantine clears that approval. Re-promoting an equivalent accepted record reports zero accepted semantic changes and does not rewrite either accepted file.

For the issue #135 autonomous path, promotion instead accepts a valid `publish` machine decision only when the caller explicitly enables it. The decision digest covers the candidate content and is invalidated by a semantic change. Stable provider identity permits deterministic updates to the matching accepted record; an identity mismatch remains a collision. The normal `promote:candidates` CLI does not enable machine decisions, so this implementation does not silently activate automatic production publication.

## Authorized MIT Learn / OCW cycle

```bash
corepack pnpm run:authorized-ingestion -- --limit 50 --as-of YYYY-MM-DD --workspace data/staging/issue-135-mit-ocw
```

The connector calls the official anonymous MIT Learn API with `platform=ocw`, `resource_type=course`, `offset=0`, and a 20–50 record limit. It uses MIT Learn's numeric resource ID as the provider identity, retains the canonical OCW URL, publishes only factual listing metadata, does not reuse images or course-body text, and models OCW access as genuine free self-guided material with no certificate or academic credit.

The run:

- retries only HTTP 429/5xx/network failures, at most three attempts with bounded backoff and a ten-second request timeout;
- uses an exclusive lock and removes stale locks after 30 minutes;
- pauses before publication when the source count is zero or falls by more than 50% from a prior healthy baseline;
- writes candidate, audit, receipt, state, report, and accepted-data copies under the isolated workspace;
- records every automatic decision under actor `skillmvp:authorized-source-policy`, policy `authorized-source-publication` version `1.0.0`;
- never writes production normalized files, the decision-grade manifest, or SEO artifacts;
- records observations separately from withdrawal confirmation. A provider outage is not absence evidence, and withdrawal requires two healthy complete observations. The bounded list pilot is not treated as a complete catalog snapshot, so its omissions cannot withdraw courses.

No schedule is installed by this PR. A future reviewed activation can invoke the same entry point from existing infrastructure and must preserve its limits, alert on a paused source, and address OCW's noncommercial license before monetized production use.

## Bounded pilot evidence

`corepack pnpm check:ingestion-foundation` materializes a provider-neutral 10-record fixture in a temporary test area. It covers exact paid, qualified starting-at, and genuine-free candidates; missing source; availability conflict; invalid zero paid pricing; duplicate identity; unsupported offering; missing evidence; explicit publication decisions; partial promotion; idempotent import/promotion; source collision; and unchanged accepted files after invalid promotion. Promotion runs against temporary copies of the real 23-record catalog and source metadata, including both historical null verification dates. The fixture is synthetic and never enters production catalog data.

`corepack pnpm check:authorized-ingestion` adds synthetic fault coverage for digest-bound automatic decisions, stable-identity updates, invalid-data quarantine, retry termination, source-wide anomaly pause, outage-safe withdrawal state, and the two-observation withdrawal threshold.

The live evidence files record the 2026-09-21 isolated pilot. The first run discovered, normalized, validated, and inserted 50 of 50 real OCW records with zero human reviews; the second live run reported 50 unchanged, zero inserted, zero updated, and zero duplicated. Real-source quarantine and update counts were zero. Category coverage was 7 business/professional, 5 design/creativity, 2 languages, 4 technology/data, 17 science/engineering, 9 humanities, and 6 society/other. Production hashes were unchanged.
