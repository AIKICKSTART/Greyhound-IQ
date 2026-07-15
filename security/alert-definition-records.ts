export type SloAlertPolicySource = {
  runbooks: readonly {
    id: string;
    path: string;
    heading: string;
    ownerRole: string;
  }[];
  alertPolicies: readonly {
    id: string;
    burnRate: number;
    windowsMinutes: readonly number[];
    bothWindowsMustFire: boolean;
    minimumEligibleEvents: number;
    action: string;
    severity: string;
    responseTargetMinutes: number;
    ownerRole: string;
    fallbackOwnerRole: string;
    runbookId: string;
    dedupeKey: string;
    metricBindingStatus: string;
    deliveryTestStatus: string;
  }[];
};

export type AlertDefinitionRecord = {
  id: string;
  owner: string;
  severity: string;
  threshold: string;
  investigationSteps: readonly string[];
  containmentSteps: readonly string[];
  escalationPath: string;
  falsePositiveReview: string;
  testMethod: string;
};

/**
 * Normalizes the source SLO policies into the security alert-record contract.
 * Delivery and metric binding remain explicitly unverified in testMethod.
 */
export function buildAlertDefinitionRecords(
  policy: SloAlertPolicySource,
): readonly AlertDefinitionRecord[] {
  const runbooks = new Map(policy.runbooks.map((runbook) => [runbook.id, runbook]));
  return policy.alertPolicies.map((alert) => {
    const runbook = runbooks.get(alert.runbookId);
    if (!runbook) throw new Error(`alert.runbook_missing:${alert.id}`);
    const runbookReference = `${runbook.path}#${runbook.heading}`;
    return {
      id: alert.id,
      owner: alert.ownerRole,
      severity: alert.severity,
      threshold: `burn=${alert.burnRate}; windows=${alert.windowsMinutes.join("/")}m; minimumEvents=${alert.minimumEligibleEvents}; bothWindows=${alert.bothWindowsMustFire}`,
      investigationSteps: [
        runbookReference,
        "Confirm the affected SLO, region, service, revision, eligible-event volume and current burn window.",
      ],
      containmentSteps: [
        runbookReference,
        "Apply the lowest-risk feature, traffic, deployment or dependency containment defined by the owning runbook.",
      ],
      escalationPath: `${alert.ownerRole} -> ${alert.fallbackOwnerRole} within ${alert.responseTargetMinutes} minutes`,
      falsePositiveReview: `Require both windows, at least ${alert.minimumEligibleEvents} eligible events and dedupe by ${alert.dedupeKey}; review ${alert.action} noise after exercises.`,
      testMethod: `npm run check:slo-alert-policy; metric binding ${alert.metricBindingStatus}; delivery ${alert.deliveryTestStatus}`,
    };
  });
}
