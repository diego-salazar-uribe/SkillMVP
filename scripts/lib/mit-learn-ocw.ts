import type { CandidateStagingFile } from "../../src/lib/schema/candidate";

export const MIT_OCW_SOURCE_ID = "mit-learn-ocw";
export const MIT_OCW_LIST_URL =
  "https://api.learn.mit.edu/api/v1/learning_resources/";

export const MIT_OCW_POLICY = {
  actor: "skillmvp:authorized-source-policy",
  policyId: "authorized-source-publication",
  policyVersion: "1.0.0",
  sourceId: MIT_OCW_SOURCE_ID,
  allowedSourceHosts: ["ocw.mit.edu"]
} as const;

type NamedCode = { code?: string; name?: string };
type Topic = { id?: number; name?: string; parent?: number | null };

export type MitOcxResource = {
  id?: number;
  title?: string;
  url?: string;
  description?: string | null;
  last_modified?: string | null;
  published?: boolean;
  free?: boolean;
  license_cc?: boolean;
  resource_type?: string;
  topics?: Topic[];
  ocw_topics?: string[];
  platform?: NamedCode;
  offered_by?: NamedCode;
  runs?: Array<{
    level?: NamedCode[];
    published?: boolean;
    url?: string;
  }>;
};

type MitOcxListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: MitOcxResource[];
};

export type DiscoveryResult = {
  response: MitOcxListResponse;
  attempts: number;
  requestUrl: string;
};

type FetchLike = typeof fetch;

class NonRetryableDiscoveryError extends Error {}

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const fetchMitOcxCourses = async ({
  limit,
  maxAttempts = 3,
  timeoutMs = 10_000,
  fetchImpl = fetch
}: {
  limit: number;
  maxAttempts?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<DiscoveryResult> => {
  if (!Number.isInteger(limit) || limit < 20 || limit > 50) {
    throw new Error("MIT OCW pilot limit must be an integer from 20 through 50.");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new Error("MIT OCW discovery allows one through three attempts.");
  }

  const requestUrl = new URL(MIT_OCW_LIST_URL);
  requestUrl.searchParams.set("platform", "ocw");
  requestUrl.searchParams.set("resource_type", "course");
  requestUrl.searchParams.set("limit", String(limit));
  requestUrl.searchParams.set("offset", "0");

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(requestUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "SkillMVP/1.0 (+https://github.com/diegosalazaru/SkillMVP)"
        },
        signal: controller.signal
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === maxAttempts) {
          const ErrorType = retryable ? Error : NonRetryableDiscoveryError;
          throw new ErrorType(
            `MIT Learn API returned HTTP ${response.status} after ${attempt} attempt(s).`
          );
        }
        lastError = new Error(`Retryable HTTP ${response.status}.`);
      } else {
        const body = (await response.json()) as MitOcxListResponse;
        if (
          !Number.isInteger(body.count) ||
          !Array.isArray(body.results) ||
          body.results.length > limit
        ) {
          throw new NonRetryableDiscoveryError(
            "MIT Learn API returned an invalid bounded catalog response."
          );
        }
        return { response: body, attempts: attempt, requestUrl: requestUrl.toString() };
      }
    } catch (error) {
      if (error instanceof NonRetryableDiscoveryError) throw error;
      lastError = error;
      if (attempt === maxAttempts) break;
    } finally {
      clearTimeout(timeout);
    }
    await wait(250 * 2 ** (attempt - 1));
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("MIT Learn API discovery failed within retry limits.");
};

const sourceCategory = (resource: MitOcxResource) => {
  const terms = [
    resource.title ?? "",
    ...(resource.ocw_topics ?? []),
    ...(resource.topics ?? []).map((topic) => topic.name ?? "")
  ].join(" ");
  if (
    /\b(language|linguistic|chinese|spanish|french|german|japanese|russian|arabic|italian|portuguese)\b/i.test(
      terms
    )
  ) {
    return "languages";
  }
  if (/Art, Design & Architecture/i.test(terms)) return "design-creativity";
  if (/Business & Management|Innovation & Entrepreneurship|Education & Teaching/i.test(terms)) {
    return "business-professional";
  }
  if (/Data Science, Analytics & Computer Technology/i.test(terms)) {
    return "technology-data";
  }
  if (/Engineering|Science & Math|Energy, Climate & Sustainability/i.test(terms)) {
    return "science-engineering";
  }
  if (/Humanities/i.test(terms)) return "humanities";
  return "society-other";
};

const asDateTimeOrNull = (value: string | null | undefined) => {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
};

export const buildMitOcxCandidateInput = (
  resources: MitOcxResource[],
  { asOf, receivedAt, batchId }: { asOf: string; receivedAt: string; batchId: string }
) => ({
  batchId,
  receivedAt,
  candidates: resources.map((resource) => {
    const providerCourseId = String(resource.id ?? "missing");
    const proposedCourseId = `mit-ocw-${providerCourseId}`;
    const sourceUrl = resource.url ?? "";
    const category = sourceCategory(resource);
    const sourceIsCurrent =
      resource.published === true &&
      resource.runs?.some((run) => run.published === true) !== false;
    const freeLicensedCourse =
      resource.free === true && resource.license_cc === true;
    const evidenceUrl = sourceUrl || MIT_OCW_LIST_URL;
    const pricing = freeLicensedCourse
      ? [
          {
            id: `${proposedCourseId}-free-access`,
            model: "free" as const,
            amount: 0,
            currency: "USD",
            normalizedUsdAmount: 0,
            qualifier: "exact" as const,
            cadence: "other" as const,
            scope: "Self-guided MIT OpenCourseWare materials",
            normalizationBasis: "provider_published_usd" as const,
            actionUrl: sourceUrl,
            evidenceUrls: [sourceUrl],
            observedAt: asOf,
            referenceMarket: null,
            accessContext: "public_provider_page" as const,
            conditions:
              "Free self-guided OCW materials; no enrollment, academic credit, or certificate."
          }
        ]
      : [];

    return {
      candidateId: `${MIT_OCW_SOURCE_ID}:${providerCourseId}`,
      proposedCourseId,
      sourceIdentity: {
        sourceId: MIT_OCW_SOURCE_ID,
        providerCourseId
      },
      platform: "MIT OpenCourseWare",
      provider: "Massachusetts Institute of Technology",
      canonicalSourceUrl: sourceUrl,
      discoveredAt: asOf,
      observedAt: asOf,
      course: {
        id: proposedCourseId,
        platform: "MIT OpenCourseWare",
        title: resource.title ?? "",
        url: sourceUrl,
        skillSlug: category,
        level: "unknown" as const,
        durationHours: null,
        language: "unknown",
        priceModel: "free" as const,
        priceAmount: 0,
        currency: "USD",
        priceInterval: null,
        rating: null,
        reviewCount: null,
        certificate: false,
        lastUpdatedAt: asDateTimeOrNull(resource.last_modified),
        shortDescription: null,
        syllabusBullets: [],
        prerequisitesBullets: [],
        source: "other" as const
      },
      fieldEvidence: [
        "title",
        "platform",
        "sourceUrl",
        "availability",
        "pricingOptions"
      ].map((field) => ({ field, sourceUrl: evidenceUrl, observedAt: asOf })),
      pricingEvidence: pricing,
      availability: {
        status: sourceIsCurrent ? ("current" as const) : ("unavailable" as const),
        evidenceUrls: [evidenceUrl],
        observedAt: asOf
      },
      sourceMetadata: {
        courseId: proposedCourseId,
        sourceUrl,
        sourceType: "official_provider_api",
        verificationStatus: "partially_verified",
        publicationStatus: "published",
        lastVerifiedAt: asOf,
        verifiedFields: {
          title: Boolean(resource.title),
          platform: resource.platform?.code === "ocw",
          sourceUrl: sourceUrl.startsWith("https://ocw.mit.edu/"),
          availability: sourceIsCurrent,
          price: freeLicensedCourse,
          pricingOptions: freeLicensedCourse,
          certificate: true,
          language: false,
          level: false,
          duration: false
        },
        sourceCategory: category,
        sourceLastModified: resource.last_modified ?? null,
        license: "CC BY-NC-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
        notes:
          "Official MIT Learn API metadata for MIT OpenCourseWare. Factual listing fields only; no image or course-body reuse. OCW attribution and noncommercial activation constraint retained."
      }
    };
  })
});

export const categoryCounts = (batch: CandidateStagingFile) => {
  const counts: Record<string, number> = {};
  for (const candidate of batch.candidates) {
    const category = String(candidate.sourceMetadata.sourceCategory ?? "unknown");
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
};
