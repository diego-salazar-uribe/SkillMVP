export type SourceRecordState = {
  status: "active" | "withdrawn";
  lastSeenAt: string;
  missingConfirmations: number;
};

export type AuthorizedSourceState = {
  sourceId: string;
  totalAvailable: number;
  lastSuccessfulAt: string;
  records: Record<string, SourceRecordState>;
};

export const isSourceWideAnomaly = (
  previousTotal: number | undefined,
  currentTotal: number
) =>
  currentTotal === 0 ||
  (previousTotal != null &&
    previousTotal >= 20 &&
    currentTotal < Math.floor(previousTotal * 0.5));

export const reconcileWithdrawalState = ({
  previous,
  sourceId,
  totalAvailable,
  observedProviderIds,
  observedAt,
  providerHealthy,
  completeSnapshot,
  confirmationsRequired = 2
}: {
  previous?: AuthorizedSourceState;
  sourceId: string;
  totalAvailable: number;
  observedProviderIds: string[];
  observedAt: string;
  providerHealthy: boolean;
  completeSnapshot: boolean;
  confirmationsRequired?: number;
}) => {
  if (confirmationsRequired < 2) {
    throw new Error("Withdrawal confirmation threshold must be at least two.");
  }
  const records = structuredClone(previous?.records ?? {});
  const observed = new Set(observedProviderIds);
  const withdrawn: string[] = [];

  for (const providerCourseId of observed) {
    records[providerCourseId] = {
      status: "active",
      lastSeenAt: observedAt,
      missingConfirmations: 0
    };
  }

  if (providerHealthy && completeSnapshot) {
    for (const [providerCourseId, record] of Object.entries(records)) {
      if (observed.has(providerCourseId) || record.status === "withdrawn") continue;
      const missingConfirmations = record.missingConfirmations + 1;
      const status =
        missingConfirmations >= confirmationsRequired
          ? ("withdrawn" as const)
          : ("active" as const);
      records[providerCourseId] = {
        ...record,
        missingConfirmations,
        status
      };
      if (status === "withdrawn") withdrawn.push(providerCourseId);
    }
  }

  return {
    state: {
      sourceId,
      totalAvailable,
      lastSuccessfulAt: providerHealthy
        ? observedAt
        : previous?.lastSuccessfulAt ?? observedAt,
      records
    } satisfies AuthorizedSourceState,
    withdrawn: withdrawn.sort()
  };
};
