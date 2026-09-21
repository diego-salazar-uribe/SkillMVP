# Catalog Phase 1: Curated course foundation

## Purpose
Phase 1 defines a practical, traceable catalog foundation so Skills Compare can help users make real decisions before scaling SEO, affiliate links, or ads.

## Why curated and normalized data comes first
- Users need reliable comparisons (price model, level, duration, certificate), not volume.
- SEO pages should only be generated from real catalog coverage.
- Affiliate monetization requires trustworthy data and disclosure discipline.
- Unknown or volatile provider data must stay unknown until verified.

## Required course fields
Each normalized course record must include:
- `id` (stable unique identifier)
- `title`
- `platform`
- `provider`
- `url` (canonical destination)
- `skillTags` (at least one)
- `level`
- `priceModel` (`free`, `paid_once`, `subscription`, or `unknown`)
- `language`
- `certificate` (boolean when known, otherwise null/unknown pattern supported by schema)
- provenance fields from current schema (for example `source`, `sourceUrl`, or mapped equivalents)

## Optional course fields
Optional data can be present when verified:
- `durationText`
- `priceAmount` and `currency`
- `ratingValue`
- `reviewCount`
- `shortDescription`
- `whatYouLearnBullets`
- `prerequisitesBullets`
- freshness metadata (last verified timestamps)

## Source fields and provenance
- Every externally sourced record must be traceable to a provider/source URL.
- Provenance should identify the ingestion or curation source.
- If provenance cannot be confirmed, the record should not be published as verified catalog data.
- Per-course source metadata lives in `data/normalized/course-source-metadata.json`.
- Source metadata should stay separate from the runtime course schema until there is a product need to display it.
- Public availability is an explicit, provider-neutral source-metadata decision. An absent `publicationStatus` is backward-compatible `published`; `source_blocked` retains the raw record and provenance for audit while excluding it at the runtime adapter boundary.
- Publication status is independent from verification status. It must never be inferred from `pending`, a provider name, or free-text notes.
- Verification can be partial. Stable fields such as title, platform, source URL, level, primary taught language, duration signals, certificate visibility, syllabus topics, and prerequisites can be marked verified while volatile fields such as price, rating, and review count remain unknown/null.
- After the Batch A and Batch B manual verification passes, 17 of 19 curated courses are `partially_verified`; 2 remain `pending` because their exact recorded offerings could not be confirmed from a current official provider page.
- The two pending records are `introduction-cyber-security-nyux-edx` and `data-analytics-essentials-cisco`. Their pending state reflects explicit source uncertainty rather than an unreviewed backlog; both are also explicitly `source_blocked` because their historical destinations do not establish a currently available exact offering.
- The normalized `language` field represents the primary taught language when the official provider source clearly identifies it. Additional dubbing, subtitles, translations, or available presentation languages should remain provenance context unless a future product initiative expands the runtime schema.
- Workload statements such as months at a weekly pace can be verified in source metadata without converting them into an exact `durationHours` value.

## Data quality rules
- Do not invent course data.
- Missing price/rating/reviews must remain null/unknown (never fabricated placeholders).
- Keep skill tags and level consistent with observable provider content.
- Treat pricing, certificate terms, and availability as volatile.
- Use explicit unverified wording where needed.
- Unknown price, rating, review count, duration, and certificate terms are expected during phase 1 and should be surfaced as decision risk, not hidden.
- Do not force a record out of `pending` merely to improve a coverage metric when the exact offering cannot be confirmed from an official source.
- Do not delete a source-blocked raw record, infer a replacement, or expose it through discovery, selection, Compare, sitemap, generated SEO lists, or an active provider CTA. A direct public route must use a deliberate unavailable response such as 404.

## Allowed source types
- Official provider course pages
- Provider APIs or exports already approved in repository workflows
- Manually curated entries with verifiable external links

## Prohibited practices
- No fake prices
- No fake ratings or review counts
- No fake affiliate URLs
- No scraping introduced in this phase
- No unverifiable claims of "best" ranking
- No ranking or recommendation claims unless explicit criteria are defined and displayed

## Update workflow
1. Put a bounded 1–50-record provider-neutral input through the shared candidate boundary; discovery must be an approved official source or explicit curated input.
2. Run deterministic validation and automatic quarantine.
3. For a reviewed authorized-source policy, record a versioned digest-bound machine decision. Otherwise complete explicit human review for named review-ready IDs.
4. Promote only explicitly selected candidates with a valid human or authorized machine decision; catalog/source metadata update together and the decision-grade manifest remains separate.
5. Reconcile stable source identities for updates. Treat withdrawal only from confirmed healthy observations, never from a provider failure or incomplete page.
6. Regenerate derived SEO artifacts only when production accepted catalog inputs actually change.
7. Run validation and build checks and submit a reviewable PR with provenance notes.

The legacy `ingest:edx`, `ingest:coursera`, and `build:catalog` commands remain disabled because they lacked the current evidence/quarantine contract or could write accepted data directly. The issue #135 MIT Learn/OCW connector uses the shared boundary and is isolated-only until separately activated.

## Validation workflow
Run:
- `pnpm validate:data`
- `pnpm report:data-quality`
- `pnpm check:ingestion-foundation`
- `pnpm generate:seo` (when SEO templates/catalog changes)
- `pnpm build`

Validation failures should be fixed at data/source level; do not bypass checks to make CI pass.
The data quality report is allowed to show unknown prices, ratings, review counts, durations, and certificate values. Unknown data is expected until manual verification is complete.
The data quality report should fail only for structural mismatches such as missing source metadata, orphaned metadata, source URL mismatches, or duplicate metadata records.

## Future affiliate fields (out of scope for Phase 1)
These are planned but not implemented in this phase:
- `affiliateUrl`
- `affiliateNetwork`
- `affiliateDisclosureRequired`
- `commissionType`

When affiliate fields are introduced later:
- They must be real and auditable.
- Disclosure must be explicit in UX and content.
- Non-affiliate fallback destination URLs must remain available.
