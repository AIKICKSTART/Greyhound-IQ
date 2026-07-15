import type { ScreenContractCoverageArea } from "../demo-experience-registry";

export type NonEmpty<T> = readonly [T, ...T[]];

export type EvidenceRef =
  | { kind: "source"; path: string }
  | { kind: "test"; path: string; testId: string }
  | { kind: "route-audit"; path: string; route: string }
  | {
      kind: "capture-manifest";
      path: string;
      frameIds: NonEmpty<string>;
    };

export type CoverageClaim =
  | {
      status: "not-started" | "captured";
      evidence: readonly EvidenceRef[];
    }
  | {
      status: "blocked";
      blocker: { owner: string; reason: string };
      evidence: readonly EvidenceRef[];
    }
  | {
      status: "verified" | "tested";
      evidence: NonEmpty<EvidenceRef>;
    }
  | {
      status: "excluded";
      exclusion: {
        kind: "not-applicable";
        owner: string;
        rationale: string;
      };
      evidence: NonEmpty<EvidenceRef>;
    };

export type FamilyScreenManifest = {
  route: string;
  userStories: readonly { id: string; actor: string; outcome: string }[];
  actions: readonly {
    id: string;
    result: string;
    enforcement?: string;
    testIds: readonly string[];
  }[];
  forms: readonly {
    id: string;
    submitsTo: string;
    schema?: string;
    testIds: readonly string[];
  }[];
  permissions: readonly {
    actor: string;
    decision: "allow" | "deny";
    enforcedBy: string;
    testIds: readonly string[];
  }[];
  states: readonly {
    id: string;
    fixtureId?: string;
    recoveryActionId?: string;
    testIds: readonly string[];
  }[];
  designLab: readonly { fixtureId: string; href: string }[];
  onboarding: readonly { tourId: string }[];
  tests: readonly { id: string; path: string }[];
  coverage: Record<ScreenContractCoverageArea, CoverageClaim>;
};
