import { createHash } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync
} from "node:fs";
import { dirname, resolve } from "node:path";

import { currentDate, getArgument } from "./lib/cli-args";
import {
  applyMachinePublicationPolicy,
  buildBatchReport,
  ingestCandidateInput,
  promoteCandidates,
  withdrawAcceptedBySourceIdentity,
  writeJsonAtomic
} from "./lib/candidate-pipeline";
import {
  AuthorizedSourceState,
  isSourceWideAnomaly,
  reconcileWithdrawalState
} from "./lib/authorized-cycle";
import {
  buildMitOcxCandidateInput,
  categoryCounts,
  fetchMitOcxCourses,
  MIT_OCW_POLICY,
  MIT_OCW_SOURCE_ID
} from "./lib/mit-learn-ocw";

const productionCatalog = resolve("data/normalized/courses.json");
const productionMetadata = resolve(
  "data/normalized/course-source-metadata.json"
);
const productionManifest = resolve("data/decision-grade-manifest.json");

const digestFile = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8")) as T;

const acquireLock = (path: string) => {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    const ageMs = Date.now() - statSync(path).mtimeMs;
    if (ageMs > 30 * 60 * 1000) rmSync(path);
  }
  try {
    return openSync(path, "wx");
  } catch {
    throw new Error(`Another authorized ingestion run holds the lock: ${path}`);
  }
};

const run = async () => {
  const asOf = getArgument("--as-of", { fallback: currentDate() })!;
  const limit = Number(getArgument("--limit", { fallback: "50" }));
  const workspace = resolve(
    getArgument("--workspace", {
      fallback: "data/staging/issue-135-mit-ocw"
    })!
  );
  const evidenceOutputArgument = getArgument("--evidence-output");
  const evidenceOutput = evidenceOutputArgument
    ? resolve(evidenceOutputArgument)
    : undefined;
  const stagingPath = resolve(workspace, "candidates.json");
  const acceptedDirectory = resolve(workspace, "accepted");
  const catalogPath = resolve(acceptedDirectory, "courses.json");
  const metadataPath = resolve(
    acceptedDirectory,
    "course-source-metadata.json"
  );
  const receiptPath = resolve(workspace, "promotion-receipt.json");
  const statePath = resolve(workspace, "source-state.json");
  const auditPath = resolve(workspace, "audit.json");
  const reportPath = resolve(workspace, "report.json");
  const lockPath = resolve(workspace, ".run.lock");

  if ([catalogPath, metadataPath].some((path) =>
    [productionCatalog, productionMetadata, productionManifest].includes(path)
  )) {
    throw new Error("Autonomous ingestion must use isolated accepted-data copies.");
  }

  const productionBefore = {
    catalog: digestFile(productionCatalog),
    metadata: digestFile(productionMetadata),
    manifest: digestFile(productionManifest)
  };
  const lock = acquireLock(lockPath);
  try {
    mkdirSync(acceptedDirectory, { recursive: true });
    if (!existsSync(catalogPath)) copyFileSync(productionCatalog, catalogPath);
    if (!existsSync(metadataPath)) copyFileSync(productionMetadata, metadataPath);

    const discovery = await fetchMitOcxCourses({ limit });
    const previousState = existsSync(statePath)
      ? readJson<AuthorizedSourceState>(statePath)
      : undefined;
    const sourcePaused = isSourceWideAnomaly(
      previousState?.totalAvailable,
      discovery.response.count
    );
    if (sourcePaused) {
      const pausedReport = {
        sourceId: MIT_OCW_SOURCE_ID,
        executedAt: new Date().toISOString(),
        asOf,
        sourcePaused: true,
        reason: "source_wide_count_anomaly",
        previousTotal: previousState?.totalAvailable ?? null,
        observedTotal: discovery.response.count,
        published: 0,
        productionTargetsChanged: false
      };
      writeJsonAtomic(reportPath, pausedReport);
      if (evidenceOutput) writeJsonAtomic(evidenceOutput, pausedReport);
      return pausedReport;
    }

    const decisionTimestamp = `${asOf}T00:00:00.000Z`;
    const batchId = `${MIT_OCW_SOURCE_ID}-${asOf}-limit-${limit}`;
    const rawInput = buildMitOcxCandidateInput(discovery.response.results, {
      asOf,
      receivedAt: decisionTimestamp,
      batchId
    });
    const staged = ingestCandidateInput(rawInput);
    const decided = applyMachinePublicationPolicy(staged, {
      asOf,
      decidedAt: decisionTimestamp,
      policy: MIT_OCW_POLICY
    });
    writeJsonAtomic(stagingPath, decided);

    const publishIds = decided.candidates
      .filter((candidate) => candidate.machineDecision?.outcome === "publish")
      .map((candidate) => candidate.candidateId);
    const receipt =
      publishIds.length > 0
        ? promoteCandidates({
            stagingPath,
            candidateIds: publishIds,
            catalogPath,
            metadataPath,
            receiptPath,
            asOf,
            machinePolicy: MIT_OCW_POLICY
          })
        : {
            batchId,
            candidateIds: [],
            promoted: 0,
            inserted: 0,
            updated: 0,
            unchanged: 0,
            acceptedSemanticChanges: 0
          };
    const batchReport = buildBatchReport(decided, { asOf }, receipt);
    const withdrawal = reconcileWithdrawalState({
      previous: previousState,
      sourceId: MIT_OCW_SOURCE_ID,
      totalAvailable: discovery.response.count,
      observedProviderIds: decided.candidates.map(
        (candidate) => candidate.sourceIdentity.providerCourseId
      ),
      observedAt: asOf,
      providerHealthy: true,
      completeSnapshot: false
    });
    const withdrawalReceipt = withdrawAcceptedBySourceIdentity({
      catalogPath,
      metadataPath,
      sourceId: MIT_OCW_SOURCE_ID,
      providerCourseIds: withdrawal.withdrawn,
      withdrawnAt: asOf
    });
    writeJsonAtomic(statePath, withdrawal.state);

    const audit = {
      sourceId: MIT_OCW_SOURCE_ID,
      batchId,
      requestUrl: discovery.requestUrl,
      observedAt: asOf,
      actor: MIT_OCW_POLICY.actor,
      policyId: MIT_OCW_POLICY.policyId,
      policyVersion: MIT_OCW_POLICY.policyVersion,
      decisions: decided.candidates.map((candidate) => ({
        candidateId: candidate.candidateId,
        providerCourseId: candidate.sourceIdentity.providerCourseId,
        candidateDigest: candidate.machineDecision?.candidateDigest ?? null,
        outcome: candidate.machineDecision?.outcome ?? "quarantine",
        reasons:
          candidate.machineDecision?.reasons ?? candidate.exceptionCodes
      }))
    };
    writeJsonAtomic(auditPath, audit);

    const productionAfter = {
      catalog: digestFile(productionCatalog),
      metadata: digestFile(productionMetadata),
      manifest: digestFile(productionManifest)
    };
    const report = {
      sourceId: MIT_OCW_SOURCE_ID,
      sourceName: "MIT Learn / MIT OpenCourseWare",
      sourceAccess: "official anonymous read-only API",
      requestUrl: discovery.requestUrl,
      executedAt: new Date().toISOString(),
      asOf,
      sourcePaused: false,
      sourceTotalAvailable: discovery.response.count,
      discovered: discovery.response.results.length,
      normalized: batchReport.normalized,
      valid: batchReport.reviewReady,
      quarantined: batchReport.quarantined,
      isolatedPublished: receipt.promoted,
      isolatedInserted: receipt.inserted,
      isolatedUpdated: receipt.updated,
      isolatedUnchanged: receipt.unchanged,
      confirmedWithdrawals: withdrawalReceipt.changed,
      categories: categoryCounts(decided),
      exceptionCounts: batchReport.exceptionCounts,
      policy: {
        actor: MIT_OCW_POLICY.actor,
        id: MIT_OCW_POLICY.policyId,
        version: MIT_OCW_POLICY.policyVersion
      },
      operatingLimits: {
        records: limit,
        requests: 1,
        maxAttempts: 3,
        requestTimeoutMs: 10_000,
        withdrawalConfirmationsRequired: 2
      },
      attemptsUsed: discovery.attempts,
      humanReviews: 0,
      productionTargetsChanged:
        JSON.stringify(productionBefore) !== JSON.stringify(productionAfter),
      productionDigests: productionAfter,
      activation: "isolated_only",
      licensingGate:
        "OCW CC BY-NC-SA 4.0 permits this noncommercial isolated pilot; production monetization requires separate compatibility review or permission.",
      decisionGradeManifestChanged: false,
      seoOutputsChanged: false
    };
    writeJsonAtomic(reportPath, report);
    if (evidenceOutput) writeJsonAtomic(evidenceOutput, report);
    return report;
  } finally {
    closeSync(lock);
    if (existsSync(lockPath)) rmSync(lockPath);
  }
};

run()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error(
      `[run:authorized-ingestion] ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exit(1);
  });
