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
  applyMachinePublicationPolicy,
  ingestCandidateInput,
  promoteCandidates,
  validateCandidateBatch,
  withdrawAcceptedBySourceIdentity,
  writeJsonAtomic
} from "./lib/candidate-pipeline";
import {
  isSourceWideAnomaly,
  reconcileWithdrawalState
} from "./lib/authorized-cycle";
import {
  buildMitOcxCandidateInput,
  fetchMitOcxCourses,
  MitOcxResource,
  MIT_OCW_POLICY,
  MIT_OCW_SOURCE_ID
} from "./lib/mit-learn-ocw";

const AS_OF = "2026-09-21";
const DECIDED_AT = `${AS_OF}T00:00:00.000Z`;

const resource = (
  id: number,
  overrides: Partial<MitOcxResource> = {}
): MitOcxResource => ({
  id,
  title: `Authorized course ${id}`,
  url: `https://ocw.mit.edu/courses/fixture-${id}/`,
  last_modified: "2026-09-20T12:00:00Z",
  published: true,
  free: true,
  license_cc: true,
  resource_type: "course",
  platform: { code: "ocw", name: "MIT OpenCourseWare" },
  offered_by: { code: "ocw", name: "MIT OpenCourseWare" },
  topics: [
    { id: 1, name: "Business & Management", parent: null }
  ],
  ocw_topics: ["Management"],
  runs: [{ published: true }],
  ...overrides
});

const makeDecidedBatch = (resources: MitOcxResource[]) =>
  applyMachinePublicationPolicy(
    ingestCandidateInput(
      buildMitOcxCandidateInput(resources, {
        asOf: AS_OF,
        receivedAt: DECIDED_AT,
        batchId: "authorized-ingestion-regression"
      })
    ),
    { asOf: AS_OF, decidedAt: DECIDED_AT, policy: MIT_OCW_POLICY }
  );

const taskTemp = mkdtempSync(join(tmpdir(), "skillmvp-authorized-ingestion-"));
const stagingPath = join(taskTemp, "candidates.json");
const catalogPath = join(taskTemp, "courses.json");
const metadataPath = join(taskTemp, "course-source-metadata.json");
const receiptPath = join(taskTemp, "receipt.json");

const main = async () => {
  try {
    copyFileSync(resolve("data/normalized/courses.json"), catalogPath);
    copyFileSync(
      resolve("data/normalized/course-source-metadata.json"),
      metadataPath
    );
    const originalCount = (JSON.parse(readFileSync(catalogPath, "utf8")) as unknown[])
      .length;

    const initial = makeDecidedBatch([resource(9001), resource(9002)]);
    assert.equal(initial.candidates.length, 2);
    assert.ok(
      initial.candidates.every(
        (candidate) =>
          candidate.machineDecision?.outcome === "publish" &&
          candidate.humanReview === null
      )
    );
    writeJsonAtomic(stagingPath, initial);
    const first = promoteCandidates({
      stagingPath,
      candidateIds: initial.candidates.map((candidate) => candidate.candidateId),
      catalogPath,
      metadataPath,
      receiptPath,
      asOf: AS_OF,
      machinePolicy: MIT_OCW_POLICY
    });
    assert.equal(first.inserted, 2);
    assert.equal(first.updated, 0);
    assert.equal(
      (JSON.parse(readFileSync(catalogPath, "utf8")) as unknown[]).length,
      originalCount + 2
    );

    const catalogAfterFirst = readFileSync(catalogPath, "utf8");
    const metadataAfterFirst = readFileSync(metadataPath, "utf8");
    const second = promoteCandidates({
      stagingPath,
      candidateIds: initial.candidates.map((candidate) => candidate.candidateId),
      catalogPath,
      metadataPath,
      asOf: AS_OF,
      machinePolicy: MIT_OCW_POLICY
    });
    assert.equal(second.inserted, 0);
    assert.equal(second.updated, 0);
    assert.equal(second.unchanged, 2);
    assert.equal(readFileSync(catalogPath, "utf8"), catalogAfterFirst);
    assert.equal(readFileSync(metadataPath, "utf8"), metadataAfterFirst);

    const changed = makeDecidedBatch([
      resource(9001, { title: "Authorized course 9001 — updated" })
    ]);
    writeJsonAtomic(stagingPath, changed);
    const update = promoteCandidates({
      stagingPath,
      candidateIds: [changed.candidates[0].candidateId],
      catalogPath,
      metadataPath,
      asOf: AS_OF,
      machinePolicy: MIT_OCW_POLICY
    });
    assert.equal(update.updated, 1);
    assert.equal(update.inserted, 0);
    const updatedCourse = (
      JSON.parse(readFileSync(catalogPath, "utf8")) as Array<{
        id: string;
        title: string;
      }>
    ).find((course) => course.id === "mit-ocw-9001");
    assert.equal(updatedCourse?.title, "Authorized course 9001 — updated");

    const invalid = makeDecidedBatch([resource(9003, { free: false })]);
    assert.equal(invalid.candidates[0].disposition, "quarantined");
    assert.equal(invalid.candidates[0].machineDecision?.outcome, "quarantine");
    assert.ok(
      invalid.candidates[0].exceptionCodes.includes("pricing_unactionable")
    );

    const tampered = structuredClone(makeDecidedBatch([resource(9004)]));
    (tampered.candidates[0].course as { title: string }).title =
      "Changed after automatic decision";
    const revalidated = validateCandidateBatch(tampered, { asOf: AS_OF }).batch;
    assert.equal(revalidated.candidates[0].machineDecision, null);
    writeJsonAtomic(stagingPath, tampered);
    assert.throws(
      () =>
        promoteCandidates({
          stagingPath,
          candidateIds: [tampered.candidates[0].candidateId],
          catalogPath,
          metadataPath,
          asOf: AS_OF,
          machinePolicy: MIT_OCW_POLICY
        }),
      /lacks an eligible human or machine publication decision/
    );

    assert.equal(isSourceWideAnomaly(2_586, 0), true);
    assert.equal(isSourceWideAnomaly(2_586, 1_000), true);
    assert.equal(isSourceWideAnomaly(2_586, 2_500), false);

    const firstMissing = reconcileWithdrawalState({
      previous: {
        sourceId: MIT_OCW_SOURCE_ID,
        totalAvailable: 2,
        lastSuccessfulAt: "2026-09-20",
        records: {
          "9001": {
            status: "active",
            lastSeenAt: "2026-09-20",
            missingConfirmations: 0
          }
        }
      },
      sourceId: MIT_OCW_SOURCE_ID,
      totalAvailable: 1,
      observedProviderIds: [],
      observedAt: AS_OF,
      providerHealthy: true,
      completeSnapshot: true
    });
    assert.equal(firstMissing.withdrawn.length, 0);
    const confirmed = reconcileWithdrawalState({
      previous: firstMissing.state,
      sourceId: MIT_OCW_SOURCE_ID,
      totalAvailable: 1,
      observedProviderIds: [],
      observedAt: "2026-09-22",
      providerHealthy: true,
      completeSnapshot: true
    });
    assert.deepEqual(confirmed.withdrawn, ["9001"]);
    const withdrawalReceipt = withdrawAcceptedBySourceIdentity({
      catalogPath,
      metadataPath,
      sourceId: MIT_OCW_SOURCE_ID,
      providerCourseIds: confirmed.withdrawn,
      withdrawnAt: "2026-09-22"
    });
    assert.equal(withdrawalReceipt.changed, 1);
    const withdrawnMetadata = (
      JSON.parse(readFileSync(metadataPath, "utf8")) as Array<{
        courseId: string;
        publicationStatus?: string;
      }>
    ).find((item) => item.courseId === "mit-ocw-9001");
    assert.equal(withdrawnMetadata?.publicationStatus, "source_blocked");
    const outage = reconcileWithdrawalState({
      previous: firstMissing.state,
      sourceId: MIT_OCW_SOURCE_ID,
      totalAvailable: 0,
      observedProviderIds: [],
      observedAt: "2026-09-22",
      providerHealthy: false,
      completeSnapshot: true
    });
    assert.equal(outage.state.records["9001"].missingConfirmations, 1);
    assert.equal(outage.withdrawn.length, 0);

    let attempts = 0;
    const eventuallySuccessful = (async () => {
      attempts += 1;
      if (attempts < 3) return new Response("temporary", { status: 503 });
      return Response.json({
        count: 1,
        next: null,
        previous: null,
        results: [resource(9005)]
      });
    }) as typeof fetch;
    const retried = await fetchMitOcxCourses({
      limit: 20,
      maxAttempts: 3,
      timeoutMs: 100,
      fetchImpl: eventuallySuccessful
    });
    assert.equal(retried.attempts, 3);
    assert.equal(attempts, 3);

    let failedAttempts = 0;
    const alwaysUnavailable = (async () => {
      failedAttempts += 1;
      return new Response("temporary", { status: 503 });
    }) as typeof fetch;
    await assert.rejects(
      fetchMitOcxCourses({
        limit: 20,
        maxAttempts: 3,
        timeoutMs: 100,
        fetchImpl: alwaysUnavailable
      }),
      /HTTP 503/
    );
    assert.equal(failedAttempts, 3);

    let unauthorizedAttempts = 0;
    const unauthorized = (async () => {
      unauthorizedAttempts += 1;
      return new Response("unauthorized", { status: 401 });
    }) as typeof fetch;
    await assert.rejects(
      fetchMitOcxCourses({
        limit: 20,
        maxAttempts: 3,
        timeoutMs: 100,
        fetchImpl: unauthorized
      }),
      /HTTP 401.*1 attempt/
    );
    assert.equal(unauthorizedAttempts, 1);

    console.log(
      "[check:authorized-ingestion] PASS — machine policy is attributable and digest-bound; inserts are idempotent; stable identities update; invalid records quarantine; retryable failures stop at three while authorization failures stop immediately; anomalies pause; two healthy complete snapshots are required for withdrawal; outages cannot withdraw."
    );
  } finally {
    rmSync(taskTemp, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(
    `[check:authorized-ingestion] ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exit(1);
});
