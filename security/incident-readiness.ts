export const INCIDENT_SCENARIO_PROCEDURES = [
  {
    requirementId: "security.incident-readiness.account-compromise",
    documentLabel: "Account compromise",
  },
  {
    requirementId: "security.incident-readiness.credential-leak",
    documentLabel: "Credential/API-key leak",
  },
  {
    requirementId: "security.incident-readiness.database-exposure",
    documentLabel: "Database exposure",
  },
  {
    requirementId: "security.incident-readiness.object-storage-exposure",
    documentLabel: "Object-storage exposure",
  },
  {
    requirementId: "security.incident-readiness.private-message-exposure",
    documentLabel: "Private-message exposure",
  },
  {
    requirementId: "security.incident-readiness.payment-provider-incident",
    documentLabel: "Payment-provider incident",
  },
  {
    requirementId:
      "security.incident-readiness.third-party-racing-data-incident",
    documentLabel: "Racing-data incident",
  },
  {
    requirementId: "security.incident-readiness.malware-upload",
    documentLabel: "Malware upload",
  },
  {
    requirementId: "security.incident-readiness.administration-compromise",
    documentLabel: "Administrator compromise",
  },
  {
    requirementId: "security.incident-readiness.ai-provider-data-incident",
    documentLabel: "AI-provider data incident",
  },
  {
    requirementId: "security.incident-readiness.lost-signing-key",
    documentLabel: "Lost signing key",
  },
  {
    requirementId: "security.incident-readiness.webhook-secret-compromise",
    documentLabel: "Webhook-secret compromise",
  },
  {
    requirementId: "security.incident-readiness.ransomware",
    documentLabel: "Ransomware",
  },
  {
    requirementId: "security.incident-readiness.accidental-deletion",
    documentLabel: "Accidental deletion",
  },
] as const;

type NdbSectionCheck = {
  sectionHeading: string;
  requiredPatterns: readonly RegExp[];
};

export const NDB_RESPONSIBILITIES = [
  {
    requirementId: "security.incident-readiness.ndb-assessment",
    checks: [
      {
        sectionHeading: "2. Assess and investigate",
        requiredPatterns: [
          /personal-information categories/i,
          /likely serious harm/i,
          /30 calendar days/i,
        ],
      },
    ],
  },
  {
    requirementId: "security.incident-readiness.ndb-containment",
    checks: [
      {
        sectionHeading: "1. Detect and contain",
        requiredPatterns: [
          /isolate affected service\/account\/key\/bucket\/route/i,
          /revoke exposed sessions, keys, webhook secrets and provider tokens/i,
          /remedial action early/i,
        ],
      },
    ],
  },
  {
    requirementId: "security.incident-readiness.ndb-evidence",
    checks: [
      {
        sectionHeading: "Evidence handling",
        requiredPatterns: [
          /immutable\/restricted incident location/i,
          /record hashes/i,
          /record every containment mutation/i,
        ],
      },
    ],
  },
  {
    requirementId: "security.incident-readiness.ndb-notification",
    checks: [
      {
        sectionHeading: "3. Notify and communicate",
        requiredPatterns: [
          /eligible-breach decision/i,
          /prepare the OAIC statement/i,
          /notify affected individuals and the OAIC as soon as practicable/i,
        ],
      },
    ],
  },
  {
    requirementId: "security.incident-readiness.ndb-communications",
    checks: [
      {
        sectionHeading: "Activation and authority",
        requiredPatterns: [
          /\|\s*Communications owner\s*\|\s*Approved messages to affected people, OAIC, providers and public\s*\|/i,
        ],
      },
      {
        sectionHeading: "3. Notify and communicate",
        requiredPatterns: [
          /only the communications owner releases public statements/i,
        ],
      },
    ],
  },
] as const satisfies readonly {
  requirementId: `security.incident-readiness.${string}`;
  checks: readonly NdbSectionCheck[];
}[];

export type IncidentReadinessRequirementId =
  | (typeof INCIDENT_SCENARIO_PROCEDURES)[number]["requirementId"]
  | (typeof NDB_RESPONSIBILITIES)[number]["requirementId"];

export const INCIDENT_READINESS_REQUIREMENT_IDS = [
  ...INCIDENT_SCENARIO_PROCEDURES.map((procedure) => procedure.requirementId),
  ...NDB_RESPONSIBILITIES.map((responsibility) =>
    responsibility.requirementId,
  ),
] as const;

export type IncidentReadinessDocument = {
  sections: ReadonlyMap<string, string>;
  scenarioRows: readonly IncidentScenarioRow[];
  findings: readonly string[];
};

export type IncidentScenarioRow = {
  scenario: string;
  immediateContainment: string;
  evidenceAndRecovery: string;
};

export function parseIncidentReadinessDocument(
  markdown: string,
): IncidentReadinessDocument {
  const findings: string[] = [];
  const sections = parseDocumentSections(markdown, findings);
  const scenarioRows = parseScenarioTable(
    sections.get("Scenario playbooks"),
    findings,
  );

  validateScenarioRows(scenarioRows, findings);
  validateNdbResponsibilities(sections, findings);
  validateEvidenceBoundary(markdown, sections, findings);

  return { sections, scenarioRows, findings };
}

export function validateIncidentReadinessDocument(markdown: string) {
  return parseIncidentReadinessDocument(markdown).findings;
}

function parseDocumentSections(markdown: string, findings: string[]) {
  const headings = [
    ...markdown.matchAll(/^(#{2,3})[ \t]+([^\r\n]+?)[ \t]*\r?$/gm),
  ].map((match) => ({
    depth: match[1].length,
    heading: match[2].trim(),
    index: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
  const sections = new Map<string, string>();

  for (const [index, match] of headings.entries()) {
    const heading = match.heading;
    const contentStart = match.end;
    const contentEnd =
      headings
        .slice(index + 1)
        .find((candidate) => candidate.depth <= match.depth)?.index ??
      markdown.length;
    if (sections.has(heading)) {
      findings.push(`SECTION_DUPLICATE:${heading}`);
      continue;
    }
    sections.set(heading, markdown.slice(contentStart, contentEnd).trim());
  }

  return sections;
}

function parseScenarioTable(
  section: string | undefined,
  findings: string[],
): IncidentScenarioRow[] {
  if (section === undefined) {
    findings.push("SECTION_MISSING:Scenario playbooks");
    return [];
  }

  const lines = section.split(/\r?\n/);
  const expectedHeader = [
    "Scenario",
    "Immediate containment",
    "Evidence and recovery",
  ];
  const headerIndex = lines.findIndex((line) =>
    sameCells(markdownRowCells(line), expectedHeader),
  );
  if (headerIndex < 0) {
    findings.push("SCENARIO_TABLE_HEADER_MISSING");
    return [];
  }

  const divider = markdownRowCells(lines[headerIndex + 1] ?? "");
  if (
    !divider ||
    divider.length !== expectedHeader.length ||
    divider.some((cell) => !/^:?-{3,}:?$/.test(cell))
  ) {
    findings.push("SCENARIO_TABLE_DIVIDER_INVALID");
    return [];
  }

  const rows: IncidentScenarioRow[] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim()) break;
    const cells = markdownRowCells(line);
    if (!cells) break;
    if (cells.length !== expectedHeader.length) {
      findings.push("SCENARIO_TABLE_ROW_INVALID");
      continue;
    }
    rows.push({
      scenario: cells[0],
      immediateContainment: cells[1],
      evidenceAndRecovery: cells[2],
    });
  }

  return rows;
}

function validateScenarioRows(
  rows: readonly IncidentScenarioRow[],
  findings: string[],
) {
  const expectedByLabel: ReadonlyMap<
    string,
    (typeof INCIDENT_SCENARIO_PROCEDURES)[number]
  > = new Map(
    INCIDENT_SCENARIO_PROCEDURES.map((procedure) => [
      procedure.documentLabel,
      procedure,
    ]),
  );
  const seen = new Set<string>();

  for (const row of rows) {
    const procedure = expectedByLabel.get(row.scenario);
    if (!procedure) {
      findings.push(`SCENARIO_UNEXPECTED:${row.scenario || "<empty>"}`);
      continue;
    }
    if (seen.has(row.scenario)) {
      findings.push(`SCENARIO_DUPLICATE:${procedure.requirementId}`);
      continue;
    }
    seen.add(row.scenario);

    if (!isSubstantiveProcedure(row.immediateContainment)) {
      findings.push(
        `SCENARIO_PROCEDURE_INCOMPLETE:${procedure.requirementId}:immediate-containment`,
      );
    }
    if (!isSubstantiveProcedure(row.evidenceAndRecovery)) {
      findings.push(
        `SCENARIO_PROCEDURE_INCOMPLETE:${procedure.requirementId}:evidence-and-recovery`,
      );
    }
  }

  for (const procedure of INCIDENT_SCENARIO_PROCEDURES) {
    if (!seen.has(procedure.documentLabel)) {
      findings.push(`SCENARIO_MISSING:${procedure.requirementId}`);
    }
  }
}

function validateNdbResponsibilities(
  sections: ReadonlyMap<string, string>,
  findings: string[],
) {
  for (const responsibility of NDB_RESPONSIBILITIES) {
    for (const check of responsibility.checks) {
      const section = sections.get(check.sectionHeading);
      if (section === undefined) {
        findings.push(
          `NDB_SECTION_MISSING:${responsibility.requirementId}:${check.sectionHeading}`,
        );
        continue;
      }
      for (const pattern of check.requiredPatterns) {
        if (!pattern.test(section)) {
          findings.push(
            `NDB_RESPONSIBILITY_INCOMPLETE:${responsibility.requirementId}:${check.sectionHeading}`,
          );
          break;
        }
      }
    }
  }
}

function validateEvidenceBoundary(
  markdown: string,
  sections: ReadonlyMap<string, string>,
  findings: string[],
) {
  if (!/^Status:\s*\*\*Operational baseline [—-] drill not verified\*\*\s*$/m.test(markdown)) {
    findings.push("EVIDENCE_BOUNDARY_MISSING:drill-not-verified");
  }
  const exerciseSection = sections.get("Exercises required before release");
  if (!exerciseSection || !/process is \*\*Not verified\*\*/i.test(exerciseSection)) {
    findings.push("EVIDENCE_BOUNDARY_MISSING:operational-readiness-not-verified");
  }
}

function markdownRowCells(line: string) {
  const value = line.trim();
  if (!value.startsWith("|") || !value.endsWith("|")) return null;
  return value
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function sameCells(
  actual: readonly string[] | null,
  expected: readonly string[],
) {
  return (
    actual?.length === expected.length &&
    actual.every((cell, index) => cell === expected[index])
  );
}

function isSubstantiveProcedure(value: string) {
  return (
    value.trim().length >= 20 &&
    !/\b(?:tbd|todo|placeholder|unknown|not documented)\b/i.test(value)
  );
}
