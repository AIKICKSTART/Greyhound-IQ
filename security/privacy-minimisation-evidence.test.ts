import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { Prisma } from "@prisma/client";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  buildDatabaseColumnRecords,
  type PrismaModelSource,
} from "./database-column-records";
import {
  buildPersonalInformationRecords,
  type PersonalInformationRecord,
} from "./personal-information-records";
import {
  PRIVACY_MINIMISATION_MASTER_EVIDENCE,
  PRIVACY_MINIMISATION_REQUIREMENT_IDS,
} from "./privacy-minimisation-evidence";
import {
  buildPrivacyMinimisationDecisions,
  validatePrivacyMinimisationDecisions,
} from "./privacy-minimisation";
import { THIRD_PARTIES } from "./third-parties";

const databaseRecords = buildDatabaseColumnRecords(
  Prisma.dmmf.datamodel.models as unknown as PrismaModelSource[],
);
const records = buildPersonalInformationRecords(databaseRecords, THIRD_PARTIES);
const decisions = buildPrivacyMinimisationDecisions(records);

assert.equal(records.length, 150);
assert.equal(decisions.length, records.length);
assert.equal(new Set(decisions.map(({ recordId }) => recordId)).size, records.length);
assert.deepEqual(validatePrivacyMinimisationDecisions(records, decisions), []);
assert.ok(decisions.every(({ futureUsePermitted }) => !futureUsePermitted));
assert.ok(
  decisions.every(
    ({ statedPurpose }) =>
      !/\b(?:future|maybe|potential|later|tbd|unknown|just in case)\b/i.test(
        statedPurpose,
      ),
  ),
);
assert.ok(
  decisions
    .filter(({ collectionRule }) => collectionRule === "optional-feature-value")
    .length > 0,
);
assert.equal(
  decisions.filter(
    ({ collectionRule }) => collectionRule === "provider-feature-invocation-only",
  ).length,
  THIRD_PARTIES.filter(({ personalInformation }) => personalInformation.length > 0)
    .length,
);

const changedPurpose = decisions.map((decision, index) =>
  index === 0 ? { ...decision, statedPurpose: "Maybe useful later" } : decision,
);
assert.ok(
  validatePrivacyMinimisationDecisions(records, changedPurpose).includes(
    `PURPOSE_DRIFT:${records[0].recordId}`,
  ),
);
const futureUseRecord: PersonalInformationRecord = {
  ...records[0],
  purpose: "May be useful in future",
};
const futureUseDecision = buildPrivacyMinimisationDecisions([futureUseRecord]);
assert.ok(
  validatePrivacyMinimisationDecisions(
    [futureUseRecord],
    futureUseDecision,
  ).includes(`FUTURE_USE_PURPOSE:${futureUseRecord.recordId}`),
);

for (const requirementId of PRIVACY_MINIMISATION_REQUIREMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    PRIVACY_MINIMISATION_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of SECURITY_MASTER_EVIDENCE[requirementId].evidence) {
    assert.ok(existsSync(evidencePath), `${requirementId}: missing ${evidencePath}`);
  }
}

console.log(
  `privacy minimisation evidence passed: ${decisions.length} personal-information records have purpose-bound collection rules and future use is prohibited`,
);
