# Roadmap

The roadmap is phase-gated. Agents must not pull work forward from a later phase unless the task explicitly changes the roadmap. Phase numbers describe workstreams and gates; they do not require strict execution order when a phase is explicitly blocked by an external dependency.

## Phase 0 — MVP

**Status: complete for the current MVP scope.**

Goal: prove the core utility of Search -> Compare -> Decide.

Included:

- Skill search and routing.
- Skill course listings and filters.
- Course detail pages.
- Two-course comparison.
- Mobile selection and compare UX.
- Initial SEO/blog foundation.
- Curated normalized dataset.
- Trust and data-quality signaling.
- Decision-focused visual polish across the core journey.

Future work in this area should be limited to concrete usability defects or regressions discovered through review. Do not reopen broad Phase 0 feature expansion without an explicit product decision.

## Phase 1 — Real Data

**Status: Phase 1A source trust complete; Phase 1C.1 foundation and Phase 1C.2 isolated autonomous-source cycle are implemented for independent review. Production activation remains off.**

Goal: make the catalog both trustworthy and useful enough to support real user decisions.

### Phase 1A — Source Trust

Completed for the current 19-course MVP catalog:

- Manual source review across all catalog records.
- Skill normalization and consistent source metadata.
- Conservative verification statuses.
- Stable-field verification where official provider pages support it.
- Explicit provenance blockers where an exact current offering cannot be confirmed.

Current trust result: 17 of 19 courses are `partially_verified`, 2 remain `pending` with explicit source blockers, and source URL mismatches are 0. Zero pending records is not a goal by itself.

### Phase 1B — Decision-Grade Data

Product review showed that source-trusted data is not automatically decision-useful data. The normalized model and comparison layer must preserve enough provider-backed information to help users choose without making them perform the full comparison on provider sites.

Completed:

- **Phase 1B.1 — Comparison Integrity Fix** in PR #93: unknown or unverified values no longer create confident `Same` / `Different` claims; runtime mapping now preserves nullable and verification semantics needed for trustworthy comparisons.
- **Phase 1B.2 — Decision Data Contract v2 pilot** in issue #94: the structured contract and four-course migration are implemented, both required comparisons pass the internal 5/7 gate, and unsupported dimensions remain explicitly insufficient.
- **Phase 1B.3 — Pricing as Core Decision Data** in issue #97: structured multi-path pricing is implemented for the same four-course pilot, pricing is a hard gate in addition to the unchanged 5/7 gate, and the comparison surfaces exact USD commitments with provenance and regional context.
- **Phase 1B.4 — Compare Decision Hierarchy** in issue #99: the compare flow now moves from a deterministic decision summary into a source-backed course snapshot, detailed pricing evidence, criteria, curriculum detail, and final provider verification for the same four-course pilot.
- **Phase 1B.5 — Decision-Grade Rollout Batch 1** in issue #101: exactly four additional courses across Data Analysis and Cloud Computing now use the approved contract. Both new pairs pass pricing plus 7/7 source-backed dimensions, and an explicit eight-course/four-pair manifest keeps unrelated catalog records outside the migration.
- **Phase 1B.6 — Decision-Grade Rollout Batch 2** in issue #106: the Google Project Management Professional Certificate and UCI Project Management Principles and Practices Specialization now use the approved contract. The pair passes pricing plus 6/7 source-backed dimensions, with UCI tools/technologies explicitly insufficient, and the manifest now contains exactly ten courses across five pairs.
- **Phase 1B.7 — Multi-provider Acceptance + Cross-platform Project Management** in issue #108: all five incumbent pairs pass cumulative desktop/mobile product acceptance, the current public AdelaideX course page establishes a non-promotional `$149 USD` one-time Premium certificate path, and Google Project Management vs AdelaideX passes pricing plus 6/7 dimensions with edX tools/technologies explicitly insufficient. The manifest now contains exactly 11 courses across six approved pairs.
- **Phase 1B.8 — Pluralsight Provider Batch** in issue #116: one current Pluralsight Cloud video course clears the unchanged pricing and 5/7 gates. The Cybersecurity candidate is blocked and intentionally omitted because official Pluralsight pages conflict on whether it is retired; no substitute was added. The catalog now contains 20 courses; the approved set contains 12 courses across seven pairs. The Cloud canonical guide surfaces the new pair automatically without provider-specific page code.
- **Pricing evidence semantics** in issue #121: exact pricing remains backward compatible, official provider-published `starting at` paths can clear the pricing gate without becoming exact commitments, and genuinely free access has a distinct zero-price semantic. Qualified amounts remain ineligible for exact-price Same/Different claims, and no provider/course ingestion is included.
- **Phase 1B.9 — LinkedIn Learning + Microsoft Learn Provider Batch** in issue #122: LinkedIn Become a Data Analyst and two Microsoft Learn paths clear the actionable-pricing and 5/7 gates through shared provider-neutral structures. LinkedIn Getting Started as a Project Manager is blocked at 4/7 and intentionally omitted; no substitute is added. The catalog contains 23 courses and the approved set contains 15 courses across ten pairs. LinkedIn pricing remains qualified `starting_at`; Microsoft Learn training is genuine free access distinct from certification exams and Azure resource costs.
- **Source-blocked publication boundary** in issue #125: the 23-record normalized catalog remains intact for audit, while the 21-course public catalog excludes two unavailable legacy offerings through provider-neutral source metadata. Their direct routes return 404, the derived sitemap contains 30 URLs, readiness pairs remain unchanged, and the 20 generated templates remain `noindex, follow` without blocked IDs.

Do not infer decision-grade eligibility from source-ready publication. The decision-grade manifest remains an explicit, separately reviewed contract.

### Phase 1C — Safe ingestion operations

- **Phase 1C.1 — Candidate staging and explicit promotion foundation** in issue #124: bounded 10–50-record JSON inputs now move through provider-neutral staging, deterministic review-ready/quarantine validation, factual reporting, and explicit named-ID promotion. Promotion updates accepted catalog/source metadata together, is collision-safe and idempotent, and never changes the decision-grade manifest. Legacy direct publishers are disabled. The production catalog is unchanged by the foundation pilot.

Phase 1C.1 by itself authorizes safer batch mechanics, not automatic discovery, publication, catalog expansion, or decision-grade approval. Phase 1C.2 adds reviewed machine-policy capability for an approved source in isolation; production activation remains a separate reviewed change.

- **Phase 1C.2 — first autonomous authorized-source cycle** in issue #135: the existing foundation now supports source identities, digest-bound versioned machine decisions, inserts and stable-identity updates, bounded retries, automatic quarantine, source anomaly stops, withdrawal confirmation state, and isolated atomic publication. A real 50-course MIT Learn/OCW pilot completed without human record review and an identical refresh produced 50 unchanged records with no duplicates. Production catalog, production automation, the decision-grade manifest, and SEO outputs remain unchanged. OCW's noncommercial license is an explicit production/monetization gate.

The former permanent per-batch human-review requirement is superseded for stabilized sources governed by the reviewed machine policy. Human review remains available for manual/unapproved sources and exceptions. Production activation still requires independent review.

### Approved Phase 1C sequence

1. Review and activate the first connector and unattended schedule with monitoring; do not activate from this implementation PR.
2. Add a complementary authorized provider with production-compatible terms and useful coverage gaps.
3. Grow toward 100–300 useful courses across the four approved families while measuring freshness, unresolved quarantine, defects, cost, and human minutes.
4. Implement automatic comparison eligibility only as a separate bounded initiative; never infer it from listing publication.

## Phase 2 — Monetization

**Status: gated / not started; does not block Phase 3.**

Goal: monetize existing decision intent without damaging trust.

This phase activates only when a real and auditable affiliate or referral program exists. Until then, it remains intentionally gated while Discovery and SEO may proceed.

Only after a real program exists:

- Affiliate/referral links.
- Required disclosures.
- Click tracking appropriate to the monetization relationship.

Do not implement speculative affiliate parameters, fake discounts, paid ranking, or placeholder monetization.

## Phase 3 — Discovery and SEO

**Status: active; indexable-surface foundation complete and selective decision-led canonical skill expansion implemented for independent product review.**

Goal: grow qualified organic traffic by making useful decision surfaces discoverable and by adding genuinely differentiated content only when the catalog supports it.

Completed:

- **Indexable Surface Foundation (Batch A)** in PR #92: sitemap now promotes the homepage, canonical skill pages, and canonical course-detail pages; `/compare` and generated template SEO routes are no longer promoted in the sitemap; generated routes remain accessible with `noindex, follow`; prominent homepage SEO links target canonical skill pages.
- **Phase 3B — Selective decision-led SEO reactivation** in issue #111: the five canonical skills with manifest-approved comparisons now expose reusable, source-backed decision guides and exact Compare entry points. Metadata reflects stable comparison intent, while generated SEO templates remain gated and the sitemap surface is unchanged.
- **Phase 3C — Privacy-friendly Vercel pageview analytics baseline** in issue #129: automatic Vercel Web Analytics pageviews are integrated once at the root on the existing Hobby plan. The dormant Plausible path is removed, and custom events, conversion tracking, cookies, paid analytics, and plan changes remain out of scope.

Phase 3B deliberately limits acquisition work to durable canonical skill hubs backed by accepted comparison data. Do not create new SEO page types, keyword-scaled content, or indexable template volume merely because the technical foundation exists.

## Phase 4 — Recommendation

**Status: later.**

Goal: provide rankings or suggestions based on real, explicit signals.

Requires:

- Defined ranking criteria.
- Sufficient trustworthy catalog data.
- Real user or behavioral signals where appropriate.
- Clear explanation of why a recommendation is made.

No artificial "best course" claims before these conditions exist.

## Phase 5 — Robust Product

**Status: only if traction justifies it.**

Potential scope:

- Database-backed catalog.
- Admin tooling.
- Additional pipeline platforms beyond the bounded file-based ingestion needed for approved delivery.
- More scalable operational infrastructure.

Do not build Phase 5 architecture to solve hypothetical scale.

## Immediate Sequence

1. Independently review issue #135's connector, source terms, policy audit trail, isolated pilot evidence, failure recovery, and unchanged production boundaries.
2. Decide whether to activate unattended operation only after review; OCW commercial compatibility or explicit permission is required before any monetized use.
3. Add a complementary authorized source and grow useful horizontal coverage without weakening truth or pricing requirements.
4. Keep decision-grade comparison, generated SEO indexability, and source-ready listing separate.
5. Activate Phase 2 monetization only when a real program and appropriate disclosures are ready; commission must never affect visible ordering or factual presentation.
