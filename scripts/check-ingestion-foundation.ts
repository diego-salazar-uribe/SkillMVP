import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  assertSafeStagingTarget,
  buildBatchReport,
  ingestCandidateInput,
  markCandidatesReviewed,
  promoteCandidates,
  validateCandidateBatch,
  writeJsonAtomic
} from "./lib/candidate-pipeline";

const AS_OF = "2026-09-09";
const OBSERVED_AT = "2026-09-01";

type PriceKind = "exact" | "starting_at" | "free" | "zero_paid";

const buildPricing = (id: string, kind: PriceKind) => {
  const isFree = kind === "free";
  const startingAt = kind === "starting_at";
  const amount = isFree || kind === "zero_paid" ? 0 : startingAt ? 19 : 29;
  return {
    id: `${id}-price`,
    model: isFree ? "free" : "subscription",
    amount,
    currency: "USD",
    normalizedUsdAmount: amount,
    qualifier: startingAt ? "starting_at" : "exact",
    cadence: isFree ? "other" : "month",
    scope: isFree ? "Training content access" : `${id} course access`,
    normalizationBasis: "provider_published_usd",
    actionUrl: `https://provider.example/courses/${id}`,
    evidenceUrls: [`https://provider.example/courses/${id}`],
    observedAt: OBSERVED_AT,
    referenceMarket: isFree ? null : "United States",
    accessContext: "public_provider_page",
    conditions: startingAt
      ? "Provider-published starting price; final checkout may vary"
      : isFree
        ? "Training access only; adjacent credentials are separate"
        : null
  };
};

const buildCandidate = (
  candidateId: string,
  kind: PriceKind,
  options: {
    proposedCourseId?: string;
    sourceUrl?: string;
    availability?: "current" | "unavailable" | "conflicting" | "unknown";
    omitPricingEvidenceField?: boolean;
    publicationStatus?: "published" | "source_blocked" | null;
  } = {}
) => {
  const proposedCourseId = options.proposedCourseId ?? `fixture-${candidateId}`;
  const sourceUrl =
    options.sourceUrl === undefined
      ? `https://provider.example/courses/${proposedCourseId}`
      : options.sourceUrl;
  const pricing = buildPricing(proposedCourseId, kind);
  const isFree = kind === "free";
  const startingAt = kind === "starting_at";
  const fieldEvidence = [
    "title",
    "platform",
    "sourceUrl",
    "availability",
    "pricingOptions"
  ]
    .filter(
      (field) => !(options.omitPricingEvidenceField && field === "pricingOptions")
    )
    .map((field) => ({
      field,
      sourceUrl: sourceUrl || "https://provider.example/missing-source-fixture",
      observedAt: OBSERVED_AT
    }));

  return {
    candidateId,
    proposedCourseId,
    sourceIdentity: {
      sourceId: "fixture-provider",
      providerCourseId: proposedCourseId
    },
    platform: "Fixture Platform",
    provider: "Fixture Provider",
    canonicalSourceUrl: sourceUrl,
    discoveredAt: OBSERVED_AT,
    observedAt: OBSERVED_AT,
    course: {
      id: proposedCourseId,
      platform: "Fixture Platform",
      title: `Fixture course ${candidateId}`,
      url: sourceUrl || "https://provider.example/missing-source-fixture",
      skillSlug: "fixture-skill",
      level: "beginner",
      durationHours: null,
      language: "unknown",
      priceModel: isFree ? "free" : "subscription",
      priceAmount: startingAt ? null : pricing.amount,
      currency: startingAt ? null : "USD",
      priceInterval: isFree ? null : "month",
      rating: null,
      reviewCount: null,
      certificate: null,
      lastUpdatedAt: null,
      shortDescription: null,
      syllabusBullets: [],
      prerequisitesBullets: [],
      source: "other"
    },
    fieldEvidence,
    pricingEvidence: [pricing],
    availability: {
      status: options.availability ?? "current",
      evidenceUrls: [
        sourceUrl || "https://provider.example/missing-source-fixture"
      ],
      observedAt: OBSERVED_AT
    },
    sourceMetadata: {
      courseId: proposedCourseId,
      sourceUrl,
      sourceType: "official_provider_page",
      verificationStatus: "partially_verified",
      ...(options.publicationStatus === null
        ? {}
        : { publicationStatus: options.publicationStatus ?? "published" }),
      lastVerifiedAt: OBSERVED_AT,
      verifiedFields: {
        title: true,
        platform: true,
        sourceUrl: true,
        price: true,
        pricingOptions: !options.omitPricingEvidenceField
      },
      notes: "Synthetic non-production fixture for the ingestion foundation check."
    }
  };
};

const input = {
  batchId: "issue-124-ten-candidate-fixture",
  receivedAt: "2026-09-09T09:00:00.000Z",
  candidates: [
    buildCandidate("valid-exact", "exact"),
    buildCandidate("valid-starting-at", "starting_at"),
    buildCandidate("valid-free", "free"),
    buildCandidate("missing-source", "exact", { sourceUrl: "" }),
    buildCandidate("availability-conflict", "exact", {
      availability: "conflicting"
    }),
    buildCandidate("zero-paid", "zero_paid"),
    buildCandidate("duplicate-identity", "exact", {
      proposedCourseId: "fixture-duplicate-course"
    }),
    buildCandidate("duplicate-identity", "exact", {
      proposedCourseId: "fixture-duplicate-course"
    }),
    buildCandidate("unsupported", "exact", { availability: "unavailable" }),
    buildCandidate("missing-evidence", "exact", {
      omitPricingEvidenceField: true
    })
  ]
};

const taskTemp = mkdtempSync(join(tmpdir(), "skillmvp-ingestion-"));
const stagingPath = join(taskTemp, "staging.json");
const catalogPath = join(taskTemp, "courses.json");
const metadataPath = join(taskTemp, "course-source-metadata.json");
const receiptPath = join(taskTemp, "promotion-receipt.json");
const manifestPath = resolve("data/decision-grade-manifest.json");
const productionCatalogPath = resolve("data/normalized/courses.json");
const productionMetadataPath = resolve(
  "data/normalized/course-source-metadata.json"
);
const manifestBefore = readFileSync(manifestPath, "utf8");

try {
  const firstImport = ingestCandidateInput(input);
  writeJsonAtomic(stagingPath, firstImport);
  const firstImportBytes = readFileSync(stagingPath, "utf8");
  writeJsonAtomic(stagingPath, ingestCandidateInput(input));
  assert.equal(
    readFileSync(stagingPath, "utf8"),
    firstImportBytes,
    "A second identical import must create zero staging churn."
  );

  const validated = validateCandidateBatch(firstImport, { asOf: AS_OF });
  writeJsonAtomic(stagingPath, validated.batch);
  const report = buildBatchReport(validated.batch, { asOf: AS_OF });

  assert.equal(report.candidatesReceived, 10);
  assert.equal(report.reviewReady, 3);
  assert.equal(report.quarantined, 7);
  assert.equal(report.exceptionCounts.missing_source, 1);
  assert.equal(report.exceptionCounts.availability_conflict, 1);
  assert.equal(report.exceptionCounts.pricing_conflict, 1);
  assert.equal(report.exceptionCounts.duplicate_identity, 2);
  assert.equal(report.exceptionCounts.unsupported_offering, 1);
  assert.equal(report.exceptionCounts.missing_required_evidence, 2);

  const byId = new Map(
    validated.batch.candidates.map((candidate) => [candidate.candidateId, candidate])
  );
  assert.equal(byId.get("valid-exact")?.disposition, "review_ready");
  assert.equal(byId.get("valid-starting-at")?.disposition, "review_ready");
  assert.equal(byId.get("valid-free")?.disposition, "review_ready");
  assert.equal(byId.get("missing-source")?.disposition, "quarantined");
  assert.equal(byId.get("availability-conflict")?.disposition, "quarantined");
  assert.equal(byId.get("zero-paid")?.disposition, "quarantined");

  const missingPublication = validateCandidateBatch(
    ingestCandidateInput({
      batchId: "missing-publication-decision-fixture",
      receivedAt: input.receivedAt,
      candidates: [
        buildCandidate("missing-publication", "exact", {
          publicationStatus: null
        })
      ]
    }),
    { asOf: AS_OF }
  ).batch.candidates[0];
  assert.equal(missingPublication.disposition, "quarantined");
  assert.ok(
    missingPublication.exceptionCodes.includes("missing_required_evidence"),
    "A new candidate without an explicit publication decision must be quarantined."
  );

  const sourceBlockedPublication = validateCandidateBatch(
    ingestCandidateInput({
      batchId: "source-blocked-publication-fixture",
      receivedAt: input.receivedAt,
      candidates: [
        buildCandidate("source-blocked-publication", "exact", {
          publicationStatus: "source_blocked"
        })
      ]
    }),
    { asOf: AS_OF }
  ).batch.candidates[0];
  assert.equal(sourceBlockedPublication.disposition, "quarantined");
  assert.ok(
    sourceBlockedPublication.exceptionCodes.includes("unsupported_offering"),
    "A source-blocked candidate must not become review-ready."
  );

  const reviewed = markCandidatesReviewed(validated.batch, {
    candidateIds: ["valid-exact", "valid-free"],
    reviewedAt: AS_OF,
    note: "Fixture reviewer confirmed the source and pricing evidence.",
    asOf: AS_OF
  });
  writeJsonAtomic(stagingPath, reviewed);
  assert.equal(
    reviewed.candidates.find(
      (candidate) => candidate.candidateId === "valid-starting-at"
    )?.humanReview,
    null,
    "Validation readiness must not imply human review."
  );
  const tampered = structuredClone(reviewed);
  const tamperedCandidate = tampered.candidates.find(
    (candidate) => candidate.candidateId === "valid-exact"
  )!;
  (tamperedCandidate.course as { title: string }).title =
    "Changed after human review";
  assert.equal(
    validateCandidateBatch(tampered, { asOf: AS_OF }).batch.candidates.find(
      (candidate) => candidate.candidateId === "valid-exact"
    )?.humanReview,
    null,
    "A semantic candidate change must invalidate its prior human review."
  );

  copyFileSync(productionCatalogPath, catalogPath);
  copyFileSync(productionMetadataPath, metadataPath);
  const initialCatalogCount = JSON.parse(
    readFileSync(catalogPath, "utf8")
  ).length;
  const initialMetadata = JSON.parse(readFileSync(metadataPath, "utf8")) as Array<{
    courseId: string;
    lastVerifiedAt: string | null;
  }>;
  assert.equal(initialCatalogCount, 23);
  assert.equal(initialMetadata.length, 23);
  assert.deepEqual(
    initialMetadata
      .filter((record) => record.lastVerifiedAt === null)
      .map((record) => record.courseId)
      .sort(),
    [
      "data-analytics-essentials-cisco",
      "introduction-cyber-security-nyux-edx"
    ],
    "The regression fixture must include the real nullable historical metadata."
  );
  assert.throws(
    () =>
      promoteCandidates({
        stagingPath,
        candidateIds: ["duplicate-identity"],
        catalogPath,
        metadataPath,
        asOf: AS_OF
      }),
    /resolve exactly once/
  );
  assert.throws(
    () =>
      promoteCandidates({
        stagingPath,
        candidateIds: ["valid-starting-at"],
        catalogPath,
        metadataPath,
        asOf: AS_OF
      }),
    /lacks an eligible human or machine publication decision/
  );
  const firstPromotion = promoteCandidates({
    stagingPath,
    candidateIds: ["valid-exact", "valid-free"],
    catalogPath,
    metadataPath,
    receiptPath,
    asOf: AS_OF
  });
  assert.equal(firstPromotion.promoted, 2);
  assert.equal(firstPromotion.acceptedSemanticChanges, 2);
  assert.equal(
    JSON.parse(readFileSync(catalogPath, "utf8")).length,
    initialCatalogCount + 2
  );
  const promotedMetadata = JSON.parse(
    readFileSync(metadataPath, "utf8")
  ) as Array<{
    courseId: string;
    lastVerifiedAt: string | null;
    publicationStatus?: string;
  }>;
  assert.equal(promotedMetadata.length, initialMetadata.length + 2);
  for (const promotedId of ["fixture-valid-exact", "fixture-valid-free"]) {
    assert.equal(
      promotedMetadata.find((record) => record.courseId === promotedId)
        ?.publicationStatus,
      "published",
      "Newly promoted metadata must persist an explicit published decision."
    );
  }
  assert.deepEqual(
    promotedMetadata
      .filter((record) => record.lastVerifiedAt === null)
      .map((record) => record.courseId)
      .sort(),
    [
      "data-analytics-essentials-cisco",
      "introduction-cyber-security-nyux-edx"
    ],
    "Promotion must preserve nullable historical source-blocked metadata."
  );
  assert.equal(
    byId.get("valid-starting-at")?.disposition,
    "review_ready",
    "Unselected review-ready candidates must remain staged."
  );

  const acceptedCatalog = readFileSync(catalogPath, "utf8");
  const acceptedMetadata = readFileSync(metadataPath, "utf8");
  const secondPromotion = promoteCandidates({
    stagingPath,
    candidateIds: ["valid-exact", "valid-free"],
    catalogPath,
    metadataPath,
    receiptPath,
    asOf: AS_OF
  });
  assert.equal(secondPromotion.acceptedSemanticChanges, 0);
  assert.equal(readFileSync(catalogPath, "utf8"), acceptedCatalog);
  assert.equal(readFileSync(metadataPath, "utf8"), acceptedMetadata);
  const postPromotionReport = buildBatchReport(
    reviewed,
    { asOf: AS_OF },
    secondPromotion
  );
  assert.equal(postPromotionReport.promoted, 2);
  assert.equal(postPromotionReport.acceptedSemanticChanges, 0);

  assert.throws(
    () =>
      promoteCandidates({
        stagingPath,
        candidateIds: ["zero-paid"],
        catalogPath,
        metadataPath,
        asOf: AS_OF
      }),
    /lacks an eligible human or machine publication decision/
  );
  assert.equal(readFileSync(catalogPath, "utf8"), acceptedCatalog);
  assert.equal(readFileSync(metadataPath, "utf8"), acceptedMetadata);

  const sourceCollisionInput = {
    batchId: "source-collision-fixture",
    receivedAt: input.receivedAt,
    candidates: [
      buildCandidate("source-collision", "exact", {
        proposedCourseId: "fixture-new-id",
        sourceUrl: "https://provider.example/courses/fixture-valid-exact"
      })
    ]
  };
  const collisionStaging = markCandidatesReviewed(
    validateCandidateBatch(ingestCandidateInput(sourceCollisionInput), {
      asOf: AS_OF
    }).batch,
    {
      candidateIds: ["source-collision"],
      reviewedAt: AS_OF,
      note: "Fixture reviewer confirmed the candidate before collision testing.",
      asOf: AS_OF
    }
  );
  const collisionPath = join(taskTemp, "collision-staging.json");
  writeJsonAtomic(collisionPath, collisionStaging);
  assert.throws(
    () =>
      promoteCandidates({
        stagingPath: collisionPath,
        candidateIds: ["source-collision"],
        catalogPath,
        metadataPath,
        asOf: AS_OF
      }),
    /Source URL collision/
  );
  assert.equal(readFileSync(catalogPath, "utf8"), acceptedCatalog);
  assert.equal(readFileSync(metadataPath, "utf8"), acceptedMetadata);

  assert.equal(
    readFileSync(manifestPath, "utf8"),
    manifestBefore,
    "Promotion must never modify the decision-grade manifest."
  );
  assert.throws(
    () => assertSafeStagingTarget(resolve("data/normalized/courses.json")),
    /Refusing to write staging data/
  );

  for (const legacyScript of [
    "scripts/ingest-edx.ts",
    "scripts/ingest-coursera.ts",
    "scripts/build-catalog.ts"
  ]) {
    const source = readFileSync(resolve(legacyScript), "utf8");
    assert.doesNotMatch(source, /writeFileSync|durationHours\s*[:=].*\*/s);
    assert.match(source, /Disabled:/);
  }

  console.log(
    "[check:ingestion-foundation] PASS — real 23-record accepted metadata parsed with 2 historical null dates; 10 candidates staged; missing/source-blocked publication decisions quarantined; subset promotion explicit, atomic, and idempotent; legacy direct publishers disabled."
  );
} finally {
  rmSync(taskTemp, { recursive: true, force: true });
}
