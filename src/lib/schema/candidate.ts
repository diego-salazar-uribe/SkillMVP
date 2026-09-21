import { z } from "zod";

import { PricingOptionSchema } from "./course";

export const CandidateExceptionCodeSchema = z.enum([
  "missing_source",
  "availability_conflict",
  "duplicate_identity",
  "source_identity_conflict",
  "missing_required_evidence",
  "pricing_unactionable",
  "pricing_conflict",
  "entitlement_unclear",
  "stale_commercial_evidence",
  "unsupported_offering",
  "normalization_conflict"
]);

export type CandidateExceptionCode = z.infer<
  typeof CandidateExceptionCodeSchema
>;

export const CandidateDispositionSchema = z.enum([
  "candidate",
  "review_ready",
  "quarantined"
]);

export const CandidateSourceIdentitySchema = z.object({
  sourceId: z.string().min(1),
  providerCourseId: z.string().min(1)
});

export const MachineDecisionSchema = z.object({
  actor: z.string().min(1),
  policyId: z.string().min(1),
  policyVersion: z.string().min(1),
  decidedAt: z.string().datetime(),
  candidateDigest: z.string().regex(/^[a-f0-9]{64}$/),
  outcome: z.enum(["publish", "quarantine"]),
  reasons: z.array(z.string().min(1)).min(1)
});

export const FieldEvidenceSchema = z.object({
  field: z.string().min(1),
  sourceUrl: z.string(),
  observedAt: z.string(),
  note: z.string().min(1).optional()
});

export const AvailabilityEvidenceSchema = z.object({
  status: z.enum(["current", "unavailable", "conflicting", "unknown"]),
  evidenceUrls: z.array(z.string()),
  observedAt: z.string()
});

export const CandidateSourceMetadataSchema = z
  .object({
    courseId: z.string(),
    sourceUrl: z.string(),
    sourceType: z.string(),
    verificationStatus: z.string(),
    publicationStatus: z.string().optional(),
    lastVerifiedAt: z.string(),
    verifiedFields: z.record(z.boolean()),
    notes: z.string()
  })
  .passthrough();

const CandidateCoreSchema = z.object({
  candidateId: z.string().min(1),
  proposedCourseId: z.string().min(1),
  sourceIdentity: CandidateSourceIdentitySchema,
  platform: z.string().min(1),
  provider: z.string().min(1),
  canonicalSourceUrl: z.string(),
  discoveredAt: z.string(),
  observedAt: z.string(),
  course: z.unknown(),
  fieldEvidence: z.array(FieldEvidenceSchema),
  pricingEvidence: z.array(z.unknown()),
  availability: AvailabilityEvidenceSchema,
  sourceMetadata: CandidateSourceMetadataSchema,
  humanNote: z.string().min(1).optional()
});

export const CandidateInputSchema = CandidateCoreSchema;

export const CandidateEnvelopeSchema = CandidateCoreSchema.extend({
  exceptionCodes: z.array(CandidateExceptionCodeSchema),
  disposition: CandidateDispositionSchema,
  humanReview: z
    .object({
      reviewedAt: z.string().date(),
      note: z.string().min(1),
      candidateDigest: z.string().regex(/^[a-f0-9]{64}$/)
    })
    .nullable(),
  machineDecision: MachineDecisionSchema.nullable()
});

export const CandidateBatchInputSchema = z.object({
  batchId: z.string().min(1),
  receivedAt: z.string().datetime(),
  candidates: z.array(CandidateInputSchema).min(1).max(50)
});

export const CandidateStagingFileSchema = z.object({
  batchId: z.string().min(1),
  receivedAt: z.string().datetime(),
  candidates: z.array(CandidateEnvelopeSchema).min(1).max(50)
});

export const AcceptedSourceMetadataSchema = z
  .object({
    courseId: z.string().min(1),
    sourceUrl: z.string().url(),
    sourceType: z.string().min(1),
    verificationStatus: z.enum(["pending", "partially_verified", "verified"]),
    publicationStatus: z.enum(["published", "source_blocked"]).optional(),
    lastVerifiedAt: z.string().date().nullable(),
    verifiedFields: z.record(z.boolean()),
    notes: z.string().min(1),
    ingestionCandidateId: z.string().min(1).optional(),
    pricingEvidence: z.array(PricingOptionSchema).optional(),
    fieldEvidence: z.array(FieldEvidenceSchema).optional(),
    humanReview: z
      .object({
        reviewedAt: z.string().date(),
        note: z.string().min(1),
        candidateDigest: z.string().regex(/^[a-f0-9]{64}$/)
      })
      .optional(),
    machineDecision: MachineDecisionSchema.optional(),
    ingestion: z
      .object({
        batchId: z.string().min(1),
        platform: z.string().min(1),
        provider: z.string().min(1),
        sourceIdentity: CandidateSourceIdentitySchema.optional(),
        discoveredAt: z.string().date(),
        observedAt: z.string().date(),
        availability: AvailabilityEvidenceSchema
      })
      .optional()
  })
  .passthrough();

export type CandidateEnvelope = z.infer<typeof CandidateEnvelopeSchema>;
export type CandidateStagingFile = z.infer<typeof CandidateStagingFileSchema>;
export type AcceptedSourceMetadata = z.infer<
  typeof AcceptedSourceMetadataSchema
>;
