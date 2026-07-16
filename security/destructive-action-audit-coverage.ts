import ts from "typescript";

import type { AuditEventContract } from "./audit-events";

export const DESTRUCTIVE_ACTION_AUDIT_REQUIREMENT_ID =
  "security.ci.15.destructive-action-no-audit";

type DestructiveActionMethod = "delete" | "deleteMany";

export type DestructiveActionSource = {
  readonly path: string;
  readonly source: string;
};

export type DiscoveredDestructiveAction = {
  readonly actionId: string;
  readonly path: string;
  readonly line: number;
  readonly symbol: string;
  readonly model: string;
  readonly method: DestructiveActionMethod;
  readonly hasAuditWrite: boolean;
};

type DestructiveActionClassification = {
  readonly actionId: string;
  readonly disposition:
    | "audit-required"
    | "derived-replacement"
    | "reversible-association";
  readonly reason: string;
  readonly auditEventId?: string;
};

const DATABASE_ROOTS = new Set(["tx", "db", "prisma"]);
const DESTRUCTIVE_METHODS = new Set<DestructiveActionMethod>([
  "delete",
  "deleteMany",
]);
const AUDIT_WRITER_NAMES = new Set([
  "createAuditLog",
  "writeTeamAudit",
  "logAdminMutation",
  "auditListing",
  "auditListingModeration",
]);

/**
 * Every direct production Prisma hard delete is classified here. Probe and
 * fixture sources are deliberately not production actions.
 */
export const PRODUCTION_DESTRUCTIVE_ACTION_CLASSIFICATIONS = [
  {
    actionId: "src/lib/conversation-service.ts:749:userBlock.deleteMany",
    disposition: "audit-required",
    auditEventId: "AUDIT.PULSE.CONVERSATION.BLOCK",
    reason:
      "Removing a block changes a safety boundary and is recorded as conversation.unblock.",
  },
  {
    actionId: "src/lib/conversation-service.ts:820:messageReaction.delete",
    disposition: "reversible-association",
    reason: "Reaction toggles are user-local associations and can be recreated by the same bounded operation.",
  },
  {
    actionId: "src/lib/custom-page-service.ts:77:actorGalleryMedia.deleteMany",
    disposition: "derived-replacement",
    reason: "Gallery links are replaced atomically from the validated page-media selection; media assets are retained.",
  },
  {
    actionId: "src/lib/custom-page-service.ts:376:conversation.deleteMany",
    disposition: "audit-required",
    auditEventId: "AUDIT.CUSTOM_PAGE.DELETED",
    reason: "Deleting a page removes its actor conversations under the audited page deletion operation.",
  },
  {
    actionId: "src/lib/custom-page-service.ts:385:customPage.delete",
    disposition: "audit-required",
    auditEventId: "AUDIT.CUSTOM_PAGE.DELETED",
    reason: "Owned custom-page deletion is irreversible and requires the page deletion audit event.",
  },
  {
    actionId: "src/lib/feed-service.ts:1069:feedReaction.delete",
    disposition: "reversible-association",
    reason: "Feed reaction toggles are user-local associations and can be recreated by the same bounded operation.",
  },
  {
    actionId: "src/lib/feed-service.ts:1137:feedMention.deleteMany",
    disposition: "derived-replacement",
    reason: "Mention rows are regenerated from the edited comment body in the same operation.",
  },
  {
    actionId: "src/lib/feed-service.ts:1239:feedReaction.delete",
    disposition: "reversible-association",
    reason: "Comment reaction toggles are user-local associations and can be recreated by the same bounded operation.",
  },
  {
    actionId: "src/lib/feed-service.ts:1515:feedMention.deleteMany",
    disposition: "derived-replacement",
    reason: "Mention rows are regenerated from the edited post body in the same operation.",
  },
  {
    actionId: "src/lib/feed-service.ts:1578:savedFeedPost.delete",
    disposition: "reversible-association",
    reason: "Saved-post toggles are user-local associations and can be recreated by the same bounded operation.",
  },
  {
    actionId: "src/lib/feed-service.ts:1673:actorMute.delete",
    disposition: "reversible-association",
    reason: "Mute toggles are user-local associations and can be recreated by the same bounded operation.",
  },
  {
    actionId: "src/lib/feed-service.ts:1706:actorTopicFollow.delete",
    disposition: "reversible-association",
    reason: "Topic-follow toggles are user-local associations and can be recreated by the same bounded operation.",
  },
  {
    actionId: "src/lib/friend-service.ts:273:friendship.delete",
    disposition: "audit-required",
    auditEventId: "AUDIT.FRIENDSHIP.MUTATION",
    reason: "Declining a pending friendship removes a cross-user relationship and is recorded as friend.request.decline.",
  },
  {
    actionId: "src/lib/friend-service.ts:330:friendship.delete",
    disposition: "audit-required",
    auditEventId: "AUDIT.FRIENDSHIP.MUTATION",
    reason: "Removing an accepted friendship removes a cross-user relationship and is recorded as friend.remove.",
  },
  {
    actionId: "src/lib/listing-service.ts:305:listingMedia.deleteMany",
    disposition: "derived-replacement",
    reason: "Listing-media links are replaced from the validated listing update; media assets are retained.",
  },
  {
    actionId: "src/lib/listing-service.ts:792:savedListing.delete",
    disposition: "reversible-association",
    reason: "Saved-listing toggles are user-local associations and can be recreated by the same bounded operation.",
  },
  {
    actionId: "src/lib/listing-service.ts:1203:listingAttribute.deleteMany",
    disposition: "derived-replacement",
    reason: "Listing attributes are replaced from the validated listing update in the same operation.",
  },
  {
    actionId: "src/lib/live/dog-profile-sync.ts:155:dogProfileForm.deleteMany",
    disposition: "derived-replacement",
    reason: "Provider form rows are replaced by the same source snapshot; this is not a user-initiated destruction path.",
  },
  {
    actionId: "src/lib/media-service.ts:659:feedPostMedia.deleteMany",
    disposition: "audit-required",
    auditEventId: "AUDIT.MEDIA.DELETE",
    reason: "Media detachment occurs only inside the audited media tombstone and storage-cleanup operation.",
  },
  {
    actionId: "src/lib/media-service.ts:1871:actorGalleryMedia.deleteMany",
    disposition: "derived-replacement",
    reason: "A ready personal avatar or cover replaces one derived gallery slot; media assets are retained.",
  },
  {
    actionId: "src/lib/social-actor-service.ts:583:actorFollow.delete",
    disposition: "reversible-association",
    reason: "Page-follow toggles are user-local associations and can be recreated by the same bounded operation.",
  },
  {
    actionId: "src/lib/social-actor-service.ts:856:actorGalleryMedia.deleteMany",
    disposition: "derived-replacement",
    reason: "Avatar-slot links are replaced or cleared without deleting the underlying media asset.",
  },
  {
    actionId: "src/lib/social-actor-service.ts:911:actorGalleryMedia.deleteMany",
    disposition: "derived-replacement",
    reason: "Cover-slot links are replaced or cleared without deleting the underlying media asset.",
  },
] as const satisfies readonly DestructiveActionClassification[];

export function auditDestructiveActionCoverage(
  sources: readonly DestructiveActionSource[],
  auditEvents: readonly AuditEventContract[],
) {
  const actions = sources
    .filter((source) => !isNonProductionSource(source.path))
    .flatMap(discoverDestructiveActions)
    .toSorted((left, right) => left.actionId.localeCompare(right.actionId));
  const classifications = new Map<string, DestructiveActionClassification>(
    PRODUCTION_DESTRUCTIVE_ACTION_CLASSIFICATIONS.map((classification) => [
      classification.actionId,
      classification,
    ]),
  );
  const issues: string[] = [];

  for (const action of actions) {
    const classification = classifications.get(action.actionId);
    if (!classification) {
      issues.push(`${action.actionId}:UNCLASSIFIED_DESTRUCTIVE_ACTION`);
      continue;
    }
    if (classification.disposition !== "audit-required") continue;
    if (!classification.auditEventId) {
      issues.push(`${action.actionId}:AUDIT_BINDING_MISSING`);
      continue;
    }

    const event = auditEvents.find(
      (candidate) => candidate.eventId === classification.auditEventId,
    );
    if (!event || event.persistence === "missing") {
      issues.push(`${action.actionId}:AUDIT_EVENT_MISSING`);
      continue;
    }
    if (!event.sourceFiles.includes(action.path)) {
      issues.push(`${action.actionId}:AUDIT_SOURCE_FILE_MISSING`);
    }
    if (!event.sourceSymbols.includes(action.symbol)) {
      issues.push(`${action.actionId}:AUDIT_SOURCE_SYMBOL_MISSING`);
    }
    if (!action.hasAuditWrite) {
      issues.push(`${action.actionId}:AUDIT_WRITE_MISSING`);
    }
  }

  for (const classification of PRODUCTION_DESTRUCTIVE_ACTION_CLASSIFICATIONS) {
    if (!actions.some((action) => action.actionId === classification.actionId)) {
      issues.push(`${classification.actionId}:CLASSIFICATION_SOURCE_MISSING`);
    }
  }

  return {
    actions,
    issues: [...new Set(issues)].toSorted(),
  };
}

export function discoverDestructiveActions(
  source: DestructiveActionSource,
): DiscoveredDestructiveAction[] {
  const sourceFile = ts.createSourceFile(
    source.path,
    source.source,
    ts.ScriptTarget.Latest,
    true,
    source.path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const actions: DiscoveredDestructiveAction[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const match = directDatabaseDelete(node);
      if (match) {
        const line = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        ).line + 1;
        const owner = containingSymbol(node);
        actions.push({
          actionId: `${source.path}:${line}:${match.model}.${match.method}`,
          path: source.path,
          line,
          symbol: owner?.name ?? "<module>",
          model: match.model,
          method: match.method,
          hasAuditWrite: owner ? containsAuditWrite(owner.node) : false,
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return actions;
}

function directDatabaseDelete(node: ts.CallExpression) {
  if (!ts.isPropertyAccessExpression(node.expression)) return null;
  const method = node.expression.name.text;
  if (!DESTRUCTIVE_METHODS.has(method as DestructiveActionMethod)) return null;
  const modelAccess = node.expression.expression;
  if (!ts.isPropertyAccessExpression(modelAccess)) return null;
  if (
    !ts.isIdentifier(modelAccess.expression) ||
    !DATABASE_ROOTS.has(modelAccess.expression.text)
  ) {
    return null;
  }
  return { model: modelAccess.name.text, method: method as DestructiveActionMethod };
}

function containingSymbol(node: ts.Node) {
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return { name: current.name.text, node: current };
    }
    if (ts.isMethodDeclaration(current) && current.name) {
      return { name: current.name.getText(), node: current };
    }
    if (
      ts.isVariableDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      current.initializer &&
      (ts.isArrowFunction(current.initializer) ||
        ts.isFunctionExpression(current.initializer))
    ) {
      return { name: current.name.text, node: current.initializer };
    }
    current = current.parent;
  }
  return null;
}

function containsAuditWrite(node: ts.Node) {
  let found = false;
  const visit = (child: ts.Node) => {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      AUDIT_WRITER_NAMES.has(child.expression.text)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function isNonProductionSource(path: string) {
  return /(?:^|\/)[^/]*(?:\.test|\.spec|-probe|-fixture)\.(?:ts|tsx)$/.test(
    path.replaceAll("\\", "/"),
  );
}
