import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

import {
  AcceptedSourceMetadata,
  AcceptedSourceMetadataSchema,
  CandidateBatchInputSchema,
  CandidateEnvelope,
  CandidateExceptionCode,
  CandidateStagingFile,
  CandidateStagingFileSchema
} from "../../src/lib/schema/candidate";
import { CourseSchema, PricingOptionSchema } from "../../src/lib/schema/course";
import { isActionablePricingOption } from "../../src/lib/pricing-contract";

const ACCEPTED_TARGETS = [
  resolve("data/normalized/courses.json"),
  resolve("data/normalized/course-source-metadata.json"),
  resolve("data/decision-grade-manifest.json")
].map((path) => path.toLowerCase());

const REQUIRED_EVIDENCE_FIELDS = [
  "title",
  "platform",
  "sourceUrl",
  "availability",
  "pricingOptions"
] as const;

const DECISION_GRADE_ONLY_FIELDS = [
  "offeringType",
  "workload",
  "toolsTechnologies",
  "practicalWorkBullets",
  "credential",
  "costModel",
  "pricingOptions"
] as const;

const EXCEPTION_ORDER: CandidateExceptionCode[] = [
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
];

const DEFAULT_STALE_AFTER_DAYS = 180;

export type CandidateBatchReport = {
  batchId: string;
  candidatesReceived: number;
  normalized: number;
  reviewReady: number;
  quarantined: number;
  promoted: number;
  exceptionCounts: Partial<Record<CandidateExceptionCode, number>>;
  duplicatesConflicts: number;
  acceptedSemanticChanges: number;
};

export type PromotionReceipt = {
  batchId: string;
  candidateIds: string[];
  promoted: number;
  inserted: number;
  updated: number;
  unchanged: number;
  acceptedSemanticChanges: number;
};

export type MachinePublicationPolicy = {
  actor: string;
  policyId: string;
  policyVersion: string;
  sourceId: string;
  allowedSourceHosts: readonly string[];
};

type ValidationOptions = {
  asOf: string;
  staleAfterDays?: number;
};

type PromotionOptions = ValidationOptions & {
  stagingPath: string;
  candidateIds: string[];
  catalogPath?: string;
  metadataPath?: string;
  receiptPath?: string;
  machinePolicy?: MachinePublicationPolicy;
};

const parseJsonFile = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8")) as unknown;

const stableJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
};

const semanticEqual = (left: unknown, right: unknown) =>
  JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));

export const candidateContentDigest = (candidate: CandidateEnvelope) => {
  const {
    disposition: _disposition,
    exceptionCodes: _exceptionCodes,
    humanReview: _humanReview,
    machineDecision: _machineDecision,
    ...reviewedContent
  } = candidate;
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(reviewedContent)))
    .digest("hex");
};

const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

const daysBetween = (earlier: string, later: string) =>
  Math.floor((Date.parse(later) - Date.parse(earlier)) / 86_400_000);

const normalizeUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/$/, "");
    return parsed.toString();
  } catch {
    return value;
  }
};

const add = (
  exceptions: Set<CandidateExceptionCode>,
  code: CandidateExceptionCode
) => exceptions.add(code);

const orderedExceptions = (exceptions: Set<CandidateExceptionCode>) =>
  EXCEPTION_ORDER.filter((code) => exceptions.has(code));

const countsBy = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
};

const sourceIdsByUrl = (candidates: CandidateEnvelope[]) => {
  const ids = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    if (!isHttpUrl(candidate.canonicalSourceUrl)) continue;
    const url = normalizeUrl(candidate.canonicalSourceUrl);
    const values = ids.get(url) ?? new Set<string>();
    values.add(candidate.proposedCourseId);
    ids.set(url, values);
  }
  return ids;
};

export const assertSafeStagingTarget = (path: string) => {
  if (ACCEPTED_TARGETS.includes(resolve(path).toLowerCase())) {
    throw new Error(
      `Refusing to write staging data to accepted publication target: ${path}`
    );
  }
};

export const writeJsonAtomic = (path: string, value: unknown) => {
  const resolvedPath = resolve(path);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  const temporaryPath = resolve(
    dirname(resolvedPath),
    `.${resolvedPath.split(/[\\/]/).pop()}.${process.pid}.tmp`
  );
  const backupPath = `${resolvedPath}.${process.pid}.bak`;
  let backedUp = false;
  let installed = false;
  writeFileSync(temporaryPath, stableJson(value), "utf8");
  try {
    if (existsSync(resolvedPath)) {
      renameSync(resolvedPath, backupPath);
      backedUp = true;
    }
    renameSync(temporaryPath, resolvedPath);
    installed = true;
    if (backedUp) {
      rmSync(backupPath);
      backedUp = false;
    }
  } catch (error) {
    if (installed && existsSync(resolvedPath)) rmSync(resolvedPath);
    if (backedUp && existsSync(backupPath)) {
      renameSync(backupPath, resolvedPath);
      backedUp = false;
    }
    throw error;
  } finally {
    if (existsSync(temporaryPath)) rmSync(temporaryPath);
  }
};

export const ingestCandidateInput = (input: unknown): CandidateStagingFile => {
  const parsed = CandidateBatchInputSchema.parse(input);
  return {
    batchId: parsed.batchId,
    receivedAt: parsed.receivedAt,
    candidates: [...parsed.candidates]
      .sort((left, right) => left.candidateId.localeCompare(right.candidateId))
      .map((candidate) => ({
        ...candidate,
        exceptionCodes: [],
        disposition: "candidate" as const,
        humanReview: null,
        machineDecision: null
      }))
  };
};

export const validateCandidateBatch = (
  input: unknown,
  { asOf, staleAfterDays = DEFAULT_STALE_AFTER_DAYS }: ValidationOptions
) => {
  if (!isDate(asOf)) throw new Error(`Invalid --as-of date: ${asOf}`);

  const batch = CandidateStagingFileSchema.parse(input);
  const candidateIdCounts = countsBy(
    batch.candidates.map((candidate) => candidate.candidateId)
  );
  const courseIdCounts = countsBy(
    batch.candidates.map((candidate) => candidate.proposedCourseId)
  );
  const sourceUrlIds = sourceIdsByUrl(batch.candidates);
  let normalized = 0;

  const candidates = batch.candidates.map((candidate) => {
    const exceptions = new Set<CandidateExceptionCode>();
    const courseResult = CourseSchema.safeParse(candidate.course);
    const pricingResult = PricingOptionSchema.array().safeParse(
      candidate.pricingEvidence
    );
    const metadataResult = AcceptedSourceMetadataSchema.safeParse(
      candidate.sourceMetadata
    );

    if (courseResult.success && pricingResult.success && metadataResult.success) {
      normalized += 1;
    }

    if (
      candidateIdCounts.get(candidate.candidateId)! > 1 ||
      courseIdCounts.get(candidate.proposedCourseId)! > 1
    ) {
      add(exceptions, "duplicate_identity");
    }

    if (
      isHttpUrl(candidate.canonicalSourceUrl) &&
      (sourceUrlIds.get(normalizeUrl(candidate.canonicalSourceUrl))?.size ?? 0) > 1
    ) {
      add(exceptions, "source_identity_conflict");
    }

    if (
      !isHttpUrl(candidate.canonicalSourceUrl) ||
      !isHttpUrl(candidate.sourceMetadata.sourceUrl)
    ) {
      add(exceptions, "missing_source");
    }

    if (!courseResult.success) {
      add(exceptions, "normalization_conflict");
    } else {
      const course = courseResult.data;
      const rawCourse = candidate.course as Record<string, unknown>;
      if (
        course.id !== candidate.proposedCourseId ||
        normalizeUrl(course.url) !== normalizeUrl(candidate.canonicalSourceUrl) ||
        course.platform.toLowerCase() !== candidate.platform.toLowerCase() ||
        candidate.sourceMetadata.courseId !== candidate.proposedCourseId ||
        normalizeUrl(candidate.sourceMetadata.sourceUrl) !==
          normalizeUrl(candidate.canonicalSourceUrl)
      ) {
        add(exceptions, "source_identity_conflict");
      }

      if (DECISION_GRADE_ONLY_FIELDS.some((field) => Object.hasOwn(rawCourse, field))) {
        add(exceptions, "normalization_conflict");
      }

      if (pricingResult.success) {
        const pricing = pricingResult.data;
        const optionIds = pricing.map((option) => option.id);
        if (new Set(optionIds).size !== optionIds.length) {
          add(exceptions, "pricing_conflict");
        }

        const hasPaid = pricing.some(
          (option) => option.model !== "free" && option.model !== "free_audit"
        );
        const hasFree = pricing.some((option) => option.model === "free");
        if (
          (course.priceModel === "free" && hasPaid) ||
          (course.priceModel !== "free" && hasFree) ||
          (course.priceModel !== "free" && course.priceAmount === 0) ||
          (pricing.some((option) => option.qualifier === "starting_at") &&
            !pricing.some((option) => option.qualifier === "exact" && option.amount > 0) &&
            course.priceAmount != null)
        ) {
          add(exceptions, "pricing_conflict");
        }

        if (!pricing.some((option) => isActionablePricingOption(option))) {
          add(exceptions, "pricing_unactionable");
        }

        if (
          pricing.some(
            (option) =>
              option.qualifier === "starting_at" && option.conditions == null
          )
        ) {
          add(exceptions, "pricing_unactionable");
        }

        if (
          pricing.some(
            (option) =>
              (option.model === "platform_subscription" || option.model === "free") &&
              option.conditions == null
          )
        ) {
          add(exceptions, "entitlement_unclear");
        }

        if (
          pricing.some(
            (option) =>
              !isDate(option.observedAt) ||
              daysBetween(option.observedAt, asOf) < 0 ||
              daysBetween(option.observedAt, asOf) > staleAfterDays
          )
        ) {
          add(exceptions, "stale_commercial_evidence");
        }
      }
    }

    if (!pricingResult.success) {
      const pricingIssue = pricingResult.error.issues.some(
        (issue) => issue.path.includes("amount") || issue.path.includes("model")
      );
      add(exceptions, pricingIssue ? "pricing_conflict" : "normalization_conflict");
      add(exceptions, "pricing_unactionable");
    }

    if (!metadataResult.success) add(exceptions, "missing_required_evidence");

    const evidenceByField = new Map(
      candidate.fieldEvidence.map((item) => [item.field, item])
    );
    const missingEvidence = REQUIRED_EVIDENCE_FIELDS.some((field) => {
      const evidence = evidenceByField.get(field);
      return (
        !evidence ||
        !isHttpUrl(evidence.sourceUrl) ||
        !isDate(evidence.observedAt)
      );
    });
    const requiredMetadataFields = ["title", "platform", "sourceUrl", "price", "pricingOptions"];
    if (
      missingEvidence ||
      requiredMetadataFields.some(
        (field) => candidate.sourceMetadata.verifiedFields[field] !== true
      ) ||
      candidate.sourceMetadata.verificationStatus === "pending"
    ) {
      add(exceptions, "missing_required_evidence");
    }

    if (
      !isDate(candidate.discoveredAt) ||
      !isDate(candidate.observedAt) ||
      !isDate(candidate.availability.observedAt) ||
      candidate.availability.evidenceUrls.length === 0 ||
      candidate.availability.evidenceUrls.some((url) => !isHttpUrl(url))
    ) {
      add(exceptions, "missing_required_evidence");
    }

    if (candidate.availability.status === "conflicting") {
      add(exceptions, "availability_conflict");
    } else if (candidate.availability.status === "unavailable") {
      add(exceptions, "unsupported_offering");
    } else if (candidate.availability.status === "unknown") {
      add(exceptions, "missing_required_evidence");
    }

    if (candidate.sourceMetadata.publicationStatus == null) {
      add(exceptions, "missing_required_evidence");
    } else if (candidate.sourceMetadata.publicationStatus === "source_blocked") {
      add(exceptions, "unsupported_offering");
    } else if (candidate.sourceMetadata.publicationStatus !== "published") {
      add(exceptions, "normalization_conflict");
    }

    const exceptionCodes = orderedExceptions(exceptions);
    const humanReview =
      exceptionCodes.length === 0 &&
      candidate.humanReview?.candidateDigest === candidateContentDigest(candidate)
        ? candidate.humanReview
        : null;
    const decisionDigest = candidateContentDigest(candidate);
    const machineDecision =
      candidate.machineDecision?.candidateDigest === decisionDigest &&
      ((exceptionCodes.length === 0 &&
        candidate.machineDecision.outcome === "publish") ||
        (exceptionCodes.length > 0 &&
          candidate.machineDecision.outcome === "quarantine"))
        ? candidate.machineDecision
        : null;
    return {
      ...candidate,
      exceptionCodes,
      disposition:
        exceptionCodes.length === 0
          ? ("review_ready" as const)
          : ("quarantined" as const),
      humanReview,
      machineDecision
    };
  });

  return {
    batch: { ...batch, candidates },
    normalized
  };
};

export const applyMachinePublicationPolicy = (
  input: unknown,
  options: ValidationOptions & {
    decidedAt: string;
    policy: MachinePublicationPolicy;
  }
): CandidateStagingFile => {
  if (Number.isNaN(Date.parse(options.decidedAt))) {
    throw new Error(`Invalid policy decision timestamp: ${options.decidedAt}`);
  }
  const validated = validateCandidateBatch(input, options).batch;
  return {
    ...validated,
    candidates: validated.candidates.map((candidate) => {
      let sourceHost = "";
      try {
        sourceHost = new URL(candidate.canonicalSourceUrl).hostname.toLowerCase();
      } catch {
        sourceHost = "";
      }
      const sourceAllowed =
        candidate.sourceIdentity.sourceId === options.policy.sourceId &&
        options.policy.allowedSourceHosts.includes(sourceHost) &&
        candidate.sourceMetadata.sourceType === "official_provider_api";
      const canPublish =
        sourceAllowed && candidate.disposition === "review_ready";
      const reasons = canPublish
        ? [
            "authorized_source_identity",
            "deterministic_validation_passed",
            "actionable_pricing_confirmed"
          ]
        : [
            ...(sourceAllowed ? [] : ["source_not_authorized_by_policy"]),
            ...candidate.exceptionCodes
          ];
      return {
        ...candidate,
        machineDecision: {
          actor: options.policy.actor,
          policyId: options.policy.policyId,
          policyVersion: options.policy.policyVersion,
          decidedAt: options.decidedAt,
          candidateDigest: candidateContentDigest(candidate),
          outcome: canPublish ? ("publish" as const) : ("quarantine" as const),
          reasons: reasons.length > 0 ? reasons : ["policy_rejected"]
        }
      };
    })
  };
};

export const markCandidatesReviewed = (
  input: unknown,
  options: ValidationOptions & {
    candidateIds: string[];
    reviewedAt: string;
    note: string;
  }
): CandidateStagingFile => {
  if (
    !isDate(options.reviewedAt) ||
    daysBetween(options.reviewedAt, options.asOf) < 0
  ) {
    throw new Error(`Invalid or future review date: ${options.reviewedAt}`);
  }
  if (options.note.trim().length === 0) {
    throw new Error("Human review requires a non-empty note.");
  }
  if (
    options.candidateIds.length === 0 ||
    new Set(options.candidateIds).size !== options.candidateIds.length
  ) {
    throw new Error("Human review requires unique explicit candidate IDs.");
  }

  const validated = validateCandidateBatch(input, options).batch;
  for (const candidateId of options.candidateIds) {
    const matches = validated.candidates.filter(
      (candidate) => candidate.candidateId === candidateId
    );
    if (matches.length !== 1 || matches[0].disposition !== "review_ready") {
      throw new Error(
        `Only one review-ready candidate may be reviewed: ${candidateId}`
      );
    }
  }

  const selected = new Set(options.candidateIds);
  return {
    ...validated,
    candidates: validated.candidates.map((candidate) =>
      selected.has(candidate.candidateId)
        ? {
            ...candidate,
            humanReview: {
              reviewedAt: options.reviewedAt,
              note: options.note.trim(),
              candidateDigest: candidateContentDigest(candidate)
            }
          }
        : candidate
    )
  };
};

export const buildBatchReport = (
  input: unknown,
  options: ValidationOptions,
  receipt?: PromotionReceipt
): CandidateBatchReport => {
  const { batch, normalized } = validateCandidateBatch(input, options);
  const exceptionCounts: Partial<Record<CandidateExceptionCode, number>> = {};
  for (const candidate of batch.candidates) {
    for (const code of candidate.exceptionCodes) {
      exceptionCounts[code] = (exceptionCounts[code] ?? 0) + 1;
    }
  }
  const duplicatesConflicts = batch.candidates.filter((candidate) =>
    candidate.exceptionCodes.some(
      (code) => code === "duplicate_identity" || code.endsWith("_conflict")
    )
  ).length;
  const matchingReceipt = receipt?.batchId === batch.batchId ? receipt : undefined;

  return {
    batchId: batch.batchId,
    candidatesReceived: batch.candidates.length,
    normalized,
    reviewReady: batch.candidates.filter(
      (candidate) => candidate.disposition === "review_ready"
    ).length,
    quarantined: batch.candidates.filter(
      (candidate) => candidate.disposition === "quarantined"
    ).length,
    promoted: matchingReceipt?.promoted ?? 0,
    exceptionCounts,
    duplicatesConflicts,
    acceptedSemanticChanges: matchingReceipt?.acceptedSemanticChanges ?? 0
  };
};

const buildAcceptedMetadata = (
  batchId: string,
  candidate: CandidateEnvelope
): AcceptedSourceMetadata =>
  AcceptedSourceMetadataSchema.parse({
    ...candidate.sourceMetadata,
    courseId: candidate.proposedCourseId,
    sourceUrl: candidate.canonicalSourceUrl,
    publicationStatus: "published",
    ingestionCandidateId: candidate.candidateId,
    pricingEvidence: PricingOptionSchema.array().parse(candidate.pricingEvidence),
    fieldEvidence: candidate.fieldEvidence,
    humanReview: candidate.humanReview ?? undefined,
    machineDecision: candidate.machineDecision ?? undefined,
    ingestion: {
      batchId,
      platform: candidate.platform,
      provider: candidate.provider,
      sourceIdentity: candidate.sourceIdentity,
      discoveredAt: candidate.discoveredAt,
      observedAt: candidate.observedAt,
      availability: candidate.availability
    }
  });

const replaceAcceptedFiles = (
  catalogPath: string,
  metadataPath: string,
  catalog: unknown,
  metadata: unknown
) => {
  const resolvedCatalog = resolve(catalogPath);
  const resolvedMetadata = resolve(metadataPath);
  const catalogTemp = `${resolvedCatalog}.${process.pid}.tmp`;
  const metadataTemp = `${resolvedMetadata}.${process.pid}.tmp`;
  const catalogBackup = `${resolvedCatalog}.${process.pid}.bak`;
  const metadataBackup = `${resolvedMetadata}.${process.pid}.bak`;
  let catalogBackedUp = false;
  let metadataBackedUp = false;
  let catalogInstalled = false;
  let metadataInstalled = false;

  writeFileSync(catalogTemp, stableJson(catalog), "utf8");
  writeFileSync(metadataTemp, stableJson(metadata), "utf8");

  try {
    CourseSchema.array().parse(parseJsonFile(catalogTemp));
    AcceptedSourceMetadataSchema.array().parse(parseJsonFile(metadataTemp));

    renameSync(resolvedCatalog, catalogBackup);
    catalogBackedUp = true;
    try {
      renameSync(resolvedMetadata, metadataBackup);
      metadataBackedUp = true;
      renameSync(catalogTemp, resolvedCatalog);
      catalogInstalled = true;
      renameSync(metadataTemp, resolvedMetadata);
      metadataInstalled = true;
      CourseSchema.array().parse(parseJsonFile(resolvedCatalog));
      AcceptedSourceMetadataSchema.array().parse(parseJsonFile(resolvedMetadata));
    } catch (error) {
      if (catalogInstalled && existsSync(resolvedCatalog)) rmSync(resolvedCatalog);
      if (metadataInstalled && existsSync(resolvedMetadata)) rmSync(resolvedMetadata);
      if (catalogBackedUp && existsSync(catalogBackup)) {
        renameSync(catalogBackup, resolvedCatalog);
        catalogBackedUp = false;
      }
      if (metadataBackedUp && existsSync(metadataBackup)) {
        renameSync(metadataBackup, resolvedMetadata);
        metadataBackedUp = false;
      }
      throw error;
    }
    try {
      rmSync(catalogBackup);
      catalogBackedUp = false;
    } catch {
      console.warn(`[promote:candidates] Backup retained at ${catalogBackup}.`);
    }
    try {
      rmSync(metadataBackup);
      metadataBackedUp = false;
    } catch {
      console.warn(`[promote:candidates] Backup retained at ${metadataBackup}.`);
    }
  } finally {
    if (existsSync(catalogTemp)) rmSync(catalogTemp);
    if (existsSync(metadataTemp)) rmSync(metadataTemp);
  }
};

export const promoteCandidates = ({
  stagingPath,
  candidateIds,
  catalogPath = resolve("data/normalized/courses.json"),
  metadataPath = resolve("data/normalized/course-source-metadata.json"),
  receiptPath,
  asOf,
  staleAfterDays,
  machinePolicy
}: PromotionOptions): PromotionReceipt => {
  if (candidateIds.length === 0) {
    throw new Error("Promotion requires at least one explicit candidate ID.");
  }
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new Error("Promotion candidate IDs must be unique.");
  }

  const persisted = CandidateStagingFileSchema.parse(parseJsonFile(stagingPath));
  const validated = validateCandidateBatch(persisted, { asOf, staleAfterDays }).batch;
  const selected = candidateIds.map((candidateId) => {
    const persistedMatches = persisted.candidates.filter(
      (candidate) => candidate.candidateId === candidateId
    );
    const validatedMatches = validated.candidates.filter(
      (candidate) => candidate.candidateId === candidateId
    );
    if (persistedMatches.length !== 1 || validatedMatches.length !== 1) {
      throw new Error(`Candidate ID must resolve exactly once: ${candidateId}`);
    }
    const persistedCandidate = persistedMatches[0];
    const validatedCandidate = validatedMatches[0];
    if (
      persistedCandidate.disposition !== "review_ready" ||
      !semanticEqual(
        persistedCandidate.exceptionCodes,
        validatedCandidate.exceptionCodes
      ) ||
      validatedCandidate.disposition !== "review_ready" ||
      validatedCandidate.humanReview == null &&
      !(
        machinePolicy != null &&
        validatedCandidate.machineDecision?.outcome === "publish" &&
        validatedCandidate.machineDecision.actor === machinePolicy.actor &&
        validatedCandidate.machineDecision.policyId === machinePolicy.policyId &&
        validatedCandidate.machineDecision.policyVersion ===
          machinePolicy.policyVersion &&
        validatedCandidate.sourceIdentity.sourceId === machinePolicy.sourceId &&
        machinePolicy.allowedSourceHosts.includes(
          new URL(validatedCandidate.canonicalSourceUrl).hostname.toLowerCase()
        ) &&
        validatedCandidate.machineDecision.candidateDigest ===
          candidateContentDigest(validatedCandidate)
      )
    ) {
      throw new Error(
        `Candidate lacks an eligible human or machine publication decision: ${candidateId}`
      );
    }
    return validatedCandidate;
  });

  const rawCatalog = parseJsonFile(catalogPath);
  const rawMetadata = parseJsonFile(metadataPath);
  CourseSchema.array().parse(rawCatalog);
  AcceptedSourceMetadataSchema.array().parse(rawMetadata);
  const catalog = rawCatalog as Array<Record<string, unknown> & { id: string }>;
  const metadata = rawMetadata as AcceptedSourceMetadata[];
  const catalogById = new Map(catalog.map((course) => [course.id, course]));
  const metadataById = new Map(metadata.map((item) => [item.courseId, item]));
  const metadataByUrl = new Map(
    metadata.map((item) => [normalizeUrl(item.sourceUrl), item.courseId])
  );
  if (
    catalogById.size !== catalog.length ||
    metadataById.size !== metadata.length ||
    metadataByUrl.size !== metadata.length
  ) {
    throw new Error("Accepted catalog/source metadata contains duplicate identities.");
  }
  const catalogIds = [...catalogById.keys()].sort();
  const metadataIds = [...metadataById.keys()].sort();
  if (!semanticEqual(catalogIds, metadataIds)) {
    throw new Error("Accepted catalog/source metadata identity sets do not match.");
  }
  for (const course of catalog) {
    const sourceMetadata = metadataById.get(course.id)!;
    if (
      typeof course.url !== "string" ||
      normalizeUrl(course.url) !== normalizeUrl(sourceMetadata.sourceUrl)
    ) {
      throw new Error(`Accepted source URL mismatch: ${course.id}`);
    }
  }
  const newCourses: Array<Record<string, unknown> & { id: string }> = [];
  const newMetadata: AcceptedSourceMetadata[] = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let acceptedSemanticChanges = 0;

  for (const candidate of selected) {
    CourseSchema.parse(candidate.course);
    const course = candidate.course as Record<string, unknown> & { id: string };
    const sourceMetadata = AcceptedSourceMetadataSchema.parse(
      buildAcceptedMetadata(validated.batchId, candidate)
    );
    const existingCourse = catalogById.get(course.id);
    const existingMetadata = metadataById.get(course.id);
    const sourceOwner = metadataByUrl.get(normalizeUrl(candidate.canonicalSourceUrl));

    if (sourceOwner && sourceOwner !== course.id) {
      throw new Error(
        `Source URL collision: ${candidate.canonicalSourceUrl} belongs to ${sourceOwner}.`
      );
    }

    if (existingCourse || existingMetadata) {
      if (!existingCourse || !existingMetadata) {
        throw new Error(`Accepted ID collision: ${course.id}`);
      }
      const existingIdentity = existingMetadata.ingestion?.sourceIdentity;
      if (
        !existingIdentity ||
        existingIdentity.sourceId !== candidate.sourceIdentity.sourceId ||
        existingIdentity.providerCourseId !==
          candidate.sourceIdentity.providerCourseId
      ) {
        throw new Error(`Accepted ID collision: ${course.id}`);
      }
      if (
        semanticEqual(existingCourse, course) &&
        semanticEqual(existingMetadata, sourceMetadata)
      ) {
        unchanged += 1;
        continue;
      }
      catalogById.set(course.id, course);
      metadataById.set(course.id, sourceMetadata);
      updated += 1;
      acceptedSemanticChanges += 1;
      continue;
    }

    catalogById.set(course.id, course);
    metadataById.set(course.id, sourceMetadata);
    metadataByUrl.set(normalizeUrl(sourceMetadata.sourceUrl), course.id);
    newCourses.push(course);
    newMetadata.push(sourceMetadata);
    inserted += 1;
    acceptedSemanticChanges += 1;
  }

  newCourses.sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  newMetadata.sort((left, right) =>
    left.courseId.localeCompare(right.courseId)
  );
  const nextCatalog = [
    ...catalog.map((course) => catalogById.get(course.id)!),
    ...newCourses
  ];
  const nextMetadata = [
    ...metadata.map((item) => metadataById.get(item.courseId)!),
    ...newMetadata
  ];

  CourseSchema.array().parse(nextCatalog);
  AcceptedSourceMetadataSchema.array().parse(nextMetadata);
  if (acceptedSemanticChanges > 0) {
    replaceAcceptedFiles(
      catalogPath,
      metadataPath,
      nextCatalog,
      nextMetadata
    );
  }

  const receipt: PromotionReceipt = {
    batchId: validated.batchId,
    candidateIds: [...candidateIds].sort(),
    promoted: selected.length,
    inserted,
    updated,
    unchanged,
    acceptedSemanticChanges
  };
  if (receiptPath) {
    assertSafeStagingTarget(receiptPath);
    writeJsonAtomic(receiptPath, receipt);
  }
  return receipt;
};

export const withdrawAcceptedBySourceIdentity = ({
  catalogPath,
  metadataPath,
  sourceId,
  providerCourseIds,
  withdrawnAt
}: {
  catalogPath: string;
  metadataPath: string;
  sourceId: string;
  providerCourseIds: string[];
  withdrawnAt: string;
}) => {
  if (!isDate(withdrawnAt)) {
    throw new Error(`Invalid withdrawal date: ${withdrawnAt}`);
  }
  const requested = new Set(providerCourseIds);
  if (requested.size !== providerCourseIds.length) {
    throw new Error("Withdrawal provider identities must be unique.");
  }
  const catalog = CourseSchema.array().parse(parseJsonFile(catalogPath));
  const metadata = AcceptedSourceMetadataSchema.array().parse(
    parseJsonFile(metadataPath)
  );
  const matched = new Set<string>();
  let changed = 0;
  const nextMetadata = metadata.map((item) => {
    const identity = item.ingestion?.sourceIdentity;
    if (
      identity?.sourceId !== sourceId ||
      !requested.has(identity.providerCourseId)
    ) {
      return item;
    }
    matched.add(identity.providerCourseId);
    if (item.publicationStatus === "source_blocked") return item;
    changed += 1;
    return AcceptedSourceMetadataSchema.parse({
      ...item,
      publicationStatus: "source_blocked",
      lastVerifiedAt: withdrawnAt,
      notes: `${item.notes} Automated withdrawal confirmed on ${withdrawnAt} after the source policy threshold.`
    });
  });
  const missing = providerCourseIds.filter((id) => !matched.has(id));
  if (missing.length > 0) {
    throw new Error(
      `Withdrawal identities not found for source ${sourceId}: ${missing.join(", ")}`
    );
  }
  if (changed > 0) {
    replaceAcceptedFiles(catalogPath, metadataPath, catalog, nextMetadata);
  }
  return { requested: providerCourseIds.length, changed };
};

export const readCandidateFile = (path: string) => parseJsonFile(path);
