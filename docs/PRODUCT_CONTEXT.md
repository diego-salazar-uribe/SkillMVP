# Product Context

## What Skills Compare Is

Skills Compare is a web product that helps people search, evaluate, and choose online courses for a skill through clear, structured, honest comparison.

The product is not trying to become an undifferentiated course directory. Its job is to reduce decision friction between discovering a skill and choosing a course while building useful horizontal coverage across business/professional skills, languages, design/creativity, and technology/data as authorized sources permit.

## Core User Job

A user should be able to:

1. Search for a skill.
2. Review relevant course options and factual decision signals.
3. Select two courses.
4. Compare them side by side.
5. Understand important differences and uncertainty.
6. Open the original provider page to verify final details and enroll if appropriate.

The intended product loop is **Search -> Compare -> Decide**.

## Product Value

Skills Compare should make course decisions easier by presenting the information users actually need to compare: provider, level, price status, duration/workload, certificate visibility, content, prerequisites, and verification uncertainty.

The product should help users make a better-informed decision. It must not pretend to know which course is universally "best" without evidence.

## Business Objective

Build an organic and recurring audience around skill-based course discovery, then monetize only when the product and catalog are sufficiently trustworthy.

The product-owner-approved direction recorded in issue #136 is to grow catalog breadth and automated operation together, with low recurring human effort and long-term profitability. Catalog development does not wait for a traffic threshold, but production activation, evidence, source permission, comparison, SEO, and monetization remain separate gates.

Long-term business levers may include:

- Organic search traffic.
- Repeat discovery and comparison usage.
- Affiliate or referral revenue where a real program exists.
- Better recommendations once real behavioral and catalog signals exist.

Monetization is subordinate to trust and decision utility.

## Product Principles

### 1. Never invent information

If a fact is not verified, it must remain unknown, pending, or clearly qualified. Mock or placeholder data must be explicitly treated as such.

### 2. Product-first

A change should improve user understanding, decision quality, validated learning, or a clearly approved business objective.

### 3. Iterate by phase

First utility, then optimization, then scale. Do not build later-stage infrastructure before the product has evidence that it is needed.

### 4. UX over unnecessary technical complexity

Clarity for the user wins over architectural sophistication.

### 5. Use AI as a tool, not as a source of invented truth

Agents may accelerate implementation and analysis, but product judgment and data truth standards remain explicit.

### 6. Keep cost and maintenance low

Avoid speculative systems, dependencies, services, and operational burden before traction requires them.

### 7. Automate routine source decisions safely

For stabilized authorized sources, deterministic versioned policy should process valid records without per-record or per-batch human approval. Evidence, provenance, actor identity, rule version, content digest, outcome, reasons, rollback, bounded retries, and quarantine remain mandatory. Human intervention is reserved for permissions, credentials, business-policy changes, spending, and high-impact exceptions.

## Success Definition

The project is moving in the right direction when:

- A new user understands the product value without explanation.
- The Search -> Compare -> Decide flow feels natural on mobile and desktop.
- Course information is transparent about what is known and unknown.
- Each product phase produces actionable learning before the next phase expands scope.
- Organic discovery grows without sacrificing trust.

## Current Non-Goals

Until the roadmap explicitly advances:

- No fake or inferred rankings presented as objective truth.
- No employment or salary promises.
- No provider endorsement claims.
- No broad recommendation engine.
- No user accounts or database merely for future-proofing.
- No affiliate or ad implementation before a real, auditable monetization program exists.
- No production activation of a connector merely because its isolated pilot passes.
