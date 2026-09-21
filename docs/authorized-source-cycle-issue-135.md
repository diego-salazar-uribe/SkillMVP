# Authorized-source cycle — Issue #135

Observed and executed on 2026-09-21. This document records source selection, implemented behavior, isolated pilot evidence, and activation blockers. It is not a production rollout record.

## Source evaluation

| Source | Verified access | Decision |
| --- | --- | --- |
| edX | `https://api.edx.org/catalog/v1/catalogs/` returned HTTP 401; no edX credential variables were present | Blocked pending authorized credentials and reuse terms |
| Coursera | The official catalog endpoint returned HTTP 200 anonymously, but Coursera's Developer Agreement requires program registration/acceptance and no accepted developer account or credentials were available | Not used; the agent did not accept an agreement or apply to a program |
| Microsoft Learn | The legacy anonymous catalog API is in deprecation; the current Learn Platform API requires an onboarded Entra identity | Not used; no obsolete endpoint or unapproved onboarding |
| OpenLearn | OpenLearn explicitly authorizes RSS reuse, but the runtime received a Cloudflare HTTP 403 challenge for the official feed | Blocked; no access-control bypass attempted |
| MIT Learn / MIT OpenCourseWare | `https://api.learn.mit.edu/api/v1/learning_resources/` returned HTTP 200 without authentication, with 2,586 current OCW courses and stable numeric IDs | Selected for the isolated noncommercial pilot |

MIT Learn is the official MIT catalog surface and permits anonymous read-only access to the learning-resource endpoint. MIT OCW materials are offered under CC BY-NC-SA 4.0. The connector retains source attribution and the license URL, copies no images or course-body text, and publishes only factual listing metadata in isolated files. OCW's noncommercial condition is a hard production/monetization gate; activation requires a separate compatibility review or permission.

Primary references:

- MIT Learn API request used by the pilot: `https://api.learn.mit.edu/api/v1/learning_resources/?platform=ocw&resource_type=course&limit=50&offset=0`
- MIT OCW terms: `https://ocw.mit.edu/pages/privacy-and-terms-of-use/`
- Coursera Developer Agreement: `https://building.coursera.org/developer-program/agreement/`
- Microsoft Learn Platform API overview: `https://learn.microsoft.com/en-us/training/support/integrations-learn-platform-api-catalog`
- OpenLearn feed permission: `https://www.open.edu/openlearn/get-started/frequently-asked-questions/can-i-take-feed-openlearn-content`

## Implemented cycle

`run:authorized-ingestion` performs:

1. one bounded official API discovery request;
2. provider-neutral candidate normalization with stable source identity;
3. existing deterministic validation and automatic quarantine;
4. a versioned, digest-bound machine publication decision;
5. atomic insert/update reconciliation into isolated accepted-data copies;
6. source-state and withdrawal-confirmation reconciliation;
7. per-record decision audit plus run report.

Limits are 20–50 records, one catalog request for this pilot, three attempts, ten seconds per attempt, bounded exponential backoff, and a 30-minute stale-lock recovery threshold. A zero or greater-than-50% source count drop pauses the source. Provider failures never count as withdrawal evidence; two healthy complete observations are required. The bounded first-page pilot is explicitly incomplete for withdrawal purposes.

The automatic actor is `skillmvp:authorized-source-policy`; policy ID is `authorized-source-publication`; version is `1.0.0`. Any semantic candidate change invalidates its prior decision digest and requires re-evaluation. Human-review records are neither created nor simulated.

## Real isolated pilot

First run:

- source catalog available: 2,586;
- discovered / normalized / valid: 50 / 50 / 50;
- quarantined: 0;
- published to isolated copies: 50 (50 inserted, 0 updated);
- human reviews: 0;
- confirmed withdrawals: 0.

Second live run against the same isolated workspace:

- discovered / normalized / valid: 50 / 50 / 50;
- inserted / updated / unchanged: 0 / 0 / 50;
- duplicates: 0;
- quarantined / withdrawals: 0 / 0.

Category assignment is deterministic from official topic metadata: business/professional 7, design/creativity 5, languages 2, technology/data 4, science/engineering 17, humanities 9, and society/other 6. This is broader than the prior technology-first order, but MIT OCW is still weighted toward science and engineering.

The live reports are `docs/issue-135-mit-ocw-pilot-first.json` and `docs/issue-135-mit-ocw-pilot-refresh.json`. Synthetic fault regression is limited to failure/update cases that could not be induced against the live provider: changed-record reconciliation, invalid-data quarantine, decision invalidation, bounded retry exhaustion, source-wide anomaly pause, outage behavior, and two-observation withdrawal confirmation.

Production SHA-256 digests stayed unchanged across both runs:

- catalog: `69166293b12fd3eadb32c99e2bf89537b6fd933f94f34a863d3debaf79af32a6`;
- source metadata: `96e040803b9881663dd49e2f400ae60c53625bcdb41dd056983751d80b82797f`;
- decision-grade manifest: `104adf6fc5702765ea4b5a33f1e53a0d4c9dceb217221b77019e6bc6c45efe4f`.

## Activation and next increment

Not activated: production catalog writes, scheduling, monitoring delivery, decision-grade comparison eligibility, SEO indexability, monetization, assets, and affiliate behavior.

Human intervention still required:

- independent code/product/source-rights review;
- decision on OCW noncommercial compatibility or permission before monetized production use;
- explicit production activation and scheduling configuration;
- credentials/contracts for edX, Coursera, Microsoft Learn, or another complementary provider if chosen.

The next bounded increment is reviewed unattended activation with alert delivery plus a complementary authorized provider that improves language, design, and business depth under production-compatible terms. Automatic comparison eligibility remains a separate later implementation.
