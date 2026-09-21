# MVP Readiness

## Current State

- Skills Compare is an English-first product for finding skills, reviewing relevant online courses, comparing two options, and opening the original provider page.
- Phase 0 is complete for the current MVP scope.
- Phase 1A source trust is complete for the original 19-course catalog; Phase 1B.8 adds one current Pluralsight Cloud record, and Phase 1B.9 adds one LinkedIn Learning path plus two Microsoft Learn paths. The approved decision-grade set is exactly 15 courses and ten pairs. LinkedIn Getting Started as a Project Manager is blocked at 4/7 and omitted without a substitute.
- Phase 2 monetization is gated until a real auditable affiliate/referral program exists and does not block Phase 3.
- Phase 3 Discovery and SEO has its indexable-surface foundation plus selective decision guides on the five canonical skills with approved readiness pairs; scaled/generated expansion remains gated.
- The normalized catalog contains 23 curated audit records; 21 are published to runtime surfaces.
- 21 courses are `partially_verified`; 2 remain `pending` and explicitly `source_blocked` because the exact recorded offering could not be confirmed from a current official source.
- Source-blocked records remain available to validation and reporting but are absent from discovery, selection, Compare, the sitemap, and generated SEO inputs. Their former detail routes deliberately return 404 and expose no provider CTA.
- Source URL mismatches are 0 after Phase 1 Source Verification — Coverage Batch B.
- Generated SEO pages, sitemap support, and internal SEO links are present as an initial foundation, but the current generated SEO surface is not treated as automatically index-worthy.
- Provider CTA copy and external-link disclosure copy are centralized.
- Provider URLs are direct official provider URLs only.
- Outbound tracking is local-only and does not send data to an external analytics vendor.
- A data quality report is available with `corepack pnpm report:data-quality` and includes verification-status and publication-status counts, the source-blocked IDs, verified-field coverage, pending/partial courses, and unknown field counts.
- A provider-neutral workflow stages bounded 1–50-course batches, deterministically quarantines material exceptions, reports factual counts, and promotes explicit IDs with either human review or an eligible versioned source policy without touching decision-grade approval.
- One MIT Learn/OCW connector has completed a real 50-course cycle in isolated copies with zero human record reviews and an idempotent live refresh. It is implemented but not scheduled or activated in production.
- Mobile Selection and Discovery UX is merged: compare selection persists for up to 24 hours, returning selections are surfaced, and the compare bar is available globally outside the compare page.
- Decision-focused visual polish is merged across the core Search -> Compare -> Decide journey.
- Decision Data Contract v2 preserves provider-backed offering, workload, tool, practical-work, credential, and cost-model signals for the 15 explicitly approved courses.
- Structured pricing preserves source-backed exact, provider-qualified starting-at, and genuinely free paths with USD amounts, cadence, scope, provenance, freshness, and regional/access context. The current 15-course decision-grade set includes all three semantics without treating qualified amounts as exact commitments.
- Compare presents decision differences and a source-backed at-a-glance snapshot before detailed pricing, criteria, curriculum, and final provider verification.
- Canonical AI, Cybersecurity, Data Analysis, Cloud Computing, and Project Management pages now surface all ten manifest-approved pairs in deterministic order, with compact source-backed tradeoffs and explicit uncertainty before the detailed Compare flow.

## Trust and Data Quality Reality

- Phase 1 manual verification reviewed the full 19-course curated catalog at least at the record level.
- Verification remains conservative and can be partial when a current official page does not support a field.
- Stable fields such as title, platform/source URL, level, primary taught language, certificate visibility, workload/duration signals, learning topics, and prerequisites are marked verified only when clearly supported.
- Prices remain unverified or unknown for the 8 non-migrated courses; the 15 approved decision-grade courses have actionable source-backed exact, qualified starting-at, or genuinely free USD pricing paths. Ratings, review counts, some durations, and the new providers' primary taught language remain unknown by design.
- Monthly or weekly workload estimates are not converted into invented exact `durationHours`; those values remain null unless the official source provides a sufficiently exact total.
- The normalized `language` field represents the primary taught language when clearly supported. Additional dubbing, subtitle, translation, or language availability remains provenance context unless a future explicit schema initiative expands the model.
- `introduction-cyber-security-nyux-edx` remains pending and `source_blocked` because the recorded edX page is unavailable and no current official page clearly represents the exact same NYUx offering.
- `data-analytics-essentials-cisco` remains pending and `source_blocked` because the recorded Coursera listing returns 404 and Cisco's current first-party offering does not establish identity continuity with that historical listing.
- Unknown data must remain null, unknown, pending, or explicitly unverified.
- Both approved pilot comparisons pass the pricing hard gate and the unchanged internal 5/7 decision-readiness gate while retaining explicit insufficiencies; these gates are not visible rankings or course scores.
- Users can compare the current verified pricing commitments inside Skills Compare and should use provider checkout to confirm final taxes, regional terms, eligibility, and availability.

## What Works

- Users can search for a skill and land on skill-specific course pages.
- Skill pages show available courses from the normalized catalog.
- Course cards expose core decision facts and prioritize compare selection over outbound provider clicks.
- Course detail pages are decision-support pages with fit framing, verify-before-enrolling checks, provider CTA, compare action, learning content, and key facts.
- Compare supports two-course comparison with a deterministic decision summary, consolidated fit context, deep comparison details, final verification checklist, and outbound provider CTAs. Pilot comparisons additionally expose an at-a-glance snapshot and the seven approved decision dimensions.
- The compare page uses mobile-friendly stacked content instead of relying on a cramped desktop table.
- Compare selection persists across navigation and recent visits for up to 24 hours, with an explicit returning-selection state and clear action.
- Canonical and Open Graph metadata foundations are present for core pages.
- Data validation runs with `corepack pnpm validate:data`.
- Production build runs with `corepack pnpm build`.
- The public sitemap contains 30 derived URLs: one homepage, eight canonical skills, and 21 published course details. The 20 generated templates remain `noindex, follow` and outside the sitemap.

## What Is Not Implemented

- No affiliate program is implemented.
- No affiliate links or fake affiliate links are present.
- No external ads are implemented beyond reserved placeholder behavior.
- No verified rankings or recommendation algorithm exists.
- No "best course" recommendation engine exists; comparison copy must stay tied to explicit, factual criteria.
- No outcome, employment, partnership, or provider endorsement claims should be made.
- No user accounts, cookies, database, scraping, production-activated external connector, or new analytics vendor is implemented. The MIT Learn/OCW API connector is isolated-only pending review.

## Decision-Grade Data and Pricing Reality

- AI For Everyone vs Deep Learning Specialization passes 5/7 with tools and practical work explicitly insufficient for both sides.
- Google Cybersecurity vs IBM Cybersecurity Analyst passes 5/7 with starting point and cost-model context explicitly insufficient for both sides.
- Both pairs also pass the separate pricing hard gate; every pilot course has at least one source-backed payable path displayed in USD.
- Google Data Analytics vs Google Advanced Data Analytics passes 7/7 plus the pricing hard gate.
- AWS Cloud Technical Essentials vs Introduction to Cloud Computing passes 7/7 plus the pricing hard gate.
- Google Project Management Professional Certificate vs Project Management Principles and Practices Specialization passes 6/7 plus the pricing hard gate, with tools/technologies explicitly insufficient for the pair.
- Google Project Management Professional Certificate vs AdelaideX: Introduction to Project Management passes 6/7 plus the pricing hard gate, with edX tools/technologies explicitly insufficient for the pair.
- AWS Cloud Technical Essentials vs AWS Foundations: Getting Started with the AWS Cloud Essentials passes 5/7 plus the pricing hard gate, with Pluralsight prerequisites and practical work explicitly insufficient.
- Introduction to Information Security is blocked and intentionally omitted because its official course page appears active while the current official author page labels it `RETIRED`; no substitute Cybersecurity course was added.
- LinkedIn Become a Data Analyst passes 5/7 plus pricing against Google Data Analytics; prerequisites/starting point and practical work remain explicitly insufficient.
- Microsoft Learn Describe Azure architecture and services passes 6/7 plus pricing against AWS Cloud Technical Essentials; exact-path practical work remains explicitly insufficient.
- Microsoft Learn Get started with Microsoft data analytics passes 6/7 plus pricing against Google Data Analytics; practical work remains explicitly insufficient.
- LinkedIn Getting Started as a Project Manager is blocked at 4/7 and intentionally absent because starting point, named tools, and practical work are insufficient on the exact path.
- The schema migration is limited to the 15 records in `data/decision-grade-manifest.json`. Independent product review must decide whether another small, explicit batch or a separately scoped #117 ingestion pilot is justified.
- An official actionable exact, provider-qualified starting-at, or genuinely free pricing path is required for every approved decision-grade pair. Qualified starting amounts do not establish exact-price Same/Different results. Provider checkout remains the final source for transaction-specific taxes, eligibility, regional variation, and availability.

## Validation Workflow

Run these before opening or updating a normal product PR:

- `corepack pnpm validate:data`
- `corepack pnpm report:data-quality`
- `corepack pnpm check:publication-boundary`
- `corepack pnpm check:ingestion-foundation`
- `corepack pnpm check:pricing-contract`
- `corepack pnpm check:selective-seo`
- `corepack pnpm exec tsc --noEmit`
- `corepack pnpm build`

Use the documented repository-local TypeScript fallback only when the normal pnpm command fails solely because Windows cannot resolve the local `tsc` executable. Run `corepack pnpm generate:seo` only when SEO generation inputs actually change. Do not initialize ESLint configuration just to run lint; `next lint` may currently prompt for setup.

## Active Near-Term Gate

Phase 1C.2 is implemented for independent review: one authorized-source cycle runs end to end in isolation, while production catalog, schedule, comparison manifest, and SEO stay unchanged. The next gate is reviewed activation and a complementary source with production-compatible terms. OCW's CC BY-NC-SA license must be resolved before monetized production use. Phase 2 monetization remains gated until a real program exists.
