export const XSS_SURFACE_REVIEW_REQUIREMENT_IDS = [
  "security.xss-surface.user-posts",
  "security.xss-surface.comments",
  "security.xss-surface.group-content",
  "security.xss-surface.forum-content",
  "security.xss-surface.profiles",
  "security.xss-surface.listings",
  "security.xss-surface.seller-descriptions",
  "security.xss-surface.support-messages",
  "security.xss-surface.administration-notes",
  "security.xss-surface.imported-racing-content",
  "security.xss-surface.rich-text",
  "security.xss-surface.markdown",
  "security.xss-surface.link-previews",
  "security.xss-surface.error-messages",
  "security.xss-surface.ai-generated-output",
] as const;

export const XSS_IMPLEMENTATION_CONTROL_REQUIREMENT_IDS = [
  "security.xss-surface.context-escaping",
  "security.xss-surface.avoid-unsafe-html",
  "security.xss-surface.allowlist-sanitizer",
  "security.xss-surface.stored-render-test",
] as const;

export const XSS_REVIEW_STATUSES = ["source-reviewed"] as const;
export const XSS_PERSISTENCE_CLASSES = [
  "stored",
  "externally-sourced-stored",
  "non-stored",
] as const;
export const XSS_RENDER_MODES = [
  "react-text-node",
  "react-text-and-url-attribute",
  "plain-text-literal",
  "not-rendered",
] as const;
export const XSS_CURRENT_CONTROL_STATUSES = [
  "bounded-plain-text-write-and-react-text-render-observed",
  "react-text-render-observed",
  "external-html-normalized-to-text-before-react-render",
  "validated-url-and-react-text-render-observed",
  "stored-content-not-rendered",
  "raw-error-react-text-render-observed",
  "generic-error-react-text-render-observed",
] as const;
export const XSS_STORED_RENDER_VALIDATION_STATUSES = [
  "required-open",
  "required-before-enablement",
  "not-applicable-non-stored",
] as const;

export type XssSurfaceReviewRequirementId =
  (typeof XSS_SURFACE_REVIEW_REQUIREMENT_IDS)[number];
export type XssImplementationControlRequirementId =
  (typeof XSS_IMPLEMENTATION_CONTROL_REQUIREMENT_IDS)[number];
export type XssReviewStatus = (typeof XSS_REVIEW_STATUSES)[number];
export type XssPersistenceClass =
  (typeof XSS_PERSISTENCE_CLASSES)[number];
export type XssRenderMode = (typeof XSS_RENDER_MODES)[number];
export type XssCurrentControlStatus =
  (typeof XSS_CURRENT_CONTROL_STATUSES)[number];
export type XssStoredRenderValidationStatus =
  (typeof XSS_STORED_RENDER_VALIDATION_STATUSES)[number];

export type XssSurfaceAnchor = {
  readonly path: string;
  readonly needle: string;
  readonly purpose: string;
};

export type XssSurfaceReviewRecord = {
  readonly requirementId: XssSurfaceReviewRequirementId;
  readonly surface: string;
  readonly reviewStatus: XssReviewStatus;
  readonly persistence: XssPersistenceClass;
  readonly renderMode: XssRenderMode;
  readonly currentControlStatus: XssCurrentControlStatus;
  readonly sourceAnchors: readonly XssSurfaceAnchor[];
  readonly renderAnchors: readonly XssSurfaceAnchor[];
  readonly observedControls: readonly string[];
  readonly knownGaps: readonly string[];
  readonly storedRenderValidation: {
    readonly status: XssStoredRenderValidationStatus;
    readonly requiredTest: string;
  };
};

/**
 * Static source-review records for the 15 content surfaces in the immutable
 * security register. A record proves only that the named source and render
 * boundaries were inspected. It does not prove context-wide escaping,
 * absence of every unsafe HTML sink, an allowlist sanitizer, or a browser-level
 * stored-render test. Those four implementation controls remain separate.
 */
export const XSS_SURFACE_REVIEW_RECORDS = [
  {
    requirementId: "security.xss-surface.user-posts",
    surface: "User posts and reshares",
    reviewStatus: "source-reviewed",
    persistence: "stored",
    renderMode: "react-text-node",
    currentControlStatus:
      "bounded-plain-text-write-and-react-text-render-observed",
    sourceAnchors: [
      {
        path: "prisma/schema.prisma",
        needle: "model FeedPost {",
        purpose: "FeedPost is the persisted user-post boundary.",
      },
      {
        path: "src/lib/feed-validation.ts",
        needle:
          "body: z.string().trim().min(2).max(5000).transform(cleanText)",
        purpose: "Post writes are length-bounded and normalized as plain text.",
      },
      {
        path: "src/lib/feed-service.ts",
        needle: "body: input.body,",
        purpose: "The validated body is written to the feed post.",
      },
    ],
    renderAnchors: [
      {
        path: "src/components/feed-post-card.tsx",
        needle: "{post.body}",
        purpose: "The primary post body is rendered as a React text child.",
      },
      {
        path: "src/components/feed-post-card.tsx",
        needle: "{post.reshare.body}",
        purpose: "Optional reshare commentary is rendered as a React text child.",
      },
    ],
    observedControls: [
      "The shared write schema bounds the body and applies cleanText.",
      "The reviewed feed card inserts stored bodies as React children.",
    ],
    knownGaps: [
      "No browser-backed stored payload matrix has proved the rendered result.",
      "This surface record does not close other post-body renderers or non-HTML contexts by implication.",
    ],
    storedRenderValidation: {
      status: "required-open",
      requiredTest:
        "Create and reshare controlled payload fixtures, render the feed in a browser, and assert inert DOM, text preservation, CSP stability, and no executable nodes or attributes.",
    },
  },
  {
    requirementId: "security.xss-surface.comments",
    surface: "Feed comments",
    reviewStatus: "source-reviewed",
    persistence: "stored",
    renderMode: "react-text-node",
    currentControlStatus:
      "bounded-plain-text-write-and-react-text-render-observed",
    sourceAnchors: [
      {
        path: "prisma/schema.prisma",
        needle: "model FeedComment {",
        purpose: "FeedComment is the persisted comment boundary.",
      },
      {
        path: "src/lib/feed-validation.ts",
        needle:
          "body: z.string().trim().min(2).max(2000).transform(cleanText)",
        purpose: "Comment writes are length-bounded and normalized as plain text.",
      },
      {
        path: "src/lib/feed-service.ts",
        needle: "export async function createFeedCommentForCurrentUser(",
        purpose: "The reviewed service owns comment persistence.",
      },
    ],
    renderAnchors: [
      {
        path: "src/components/feed-comments-panel.tsx",
        needle: "{comment.body}",
        purpose: "Stored comment bodies are rendered as React text children.",
      },
      {
        path: "src/components/feed-comments-panel.tsx",
        needle: "defaultValue={comment.body}",
        purpose: "Stored comment bodies also enter the edit input value property.",
      },
    ],
    observedControls: [
      "Create and edit schemas bound the body and apply cleanText.",
      "Display and edit paths use React-managed text/value contexts.",
    ],
    knownGaps: [
      "Nested replies and edited stored fixtures still require rendered-DOM validation.",
    ],
    storedRenderValidation: {
      status: "required-open",
      requiredTest:
        "Persist top-level, nested, and edited comment fixtures, then assert browser DOM and input values stay inert across initial render and hydration.",
    },
  },
  {
    requirementId: "security.xss-surface.group-content",
    surface: "Group category and thread content",
    reviewStatus: "source-reviewed",
    persistence: "stored",
    renderMode: "react-text-node",
    currentControlStatus:
      "bounded-plain-text-write-and-react-text-render-observed",
    sourceAnchors: [
      {
        path: "src/app/groups/page.tsx",
        needle: 'import GroupsPage, { metadata } from "../forum/page";',
        purpose: "The group index delegates to the forum implementation.",
      },
      {
        path: "src/app/actions.ts",
        needle: "title: cleanText(parsed.title),",
        purpose: "Group-thread titles are normalized before persistence.",
      },
      {
        path: "prisma/schema.prisma",
        needle: "model ForumCategory {",
        purpose: "Group categories and their descriptions use the forum model.",
      },
    ],
    renderAnchors: [
      {
        path: "src/app/forum/page.tsx",
        needle: "{category.description}",
        purpose: "Group category descriptions render as React text children.",
      },
      {
        path: "src/app/forum/page.tsx",
        needle: "{thread.title}",
        purpose: "Group thread titles render as React text children.",
      },
    ],
    observedControls: [
      "Group routes are aliases of the reviewed forum pages.",
      "User-created thread titles use cleanText and React text rendering.",
    ],
    knownGaps: [
      "Administrator-seeded category descriptions do not have an independently reviewed mutation boundary in this record.",
    ],
    storedRenderValidation: {
      status: "required-open",
      requiredTest:
        "Seed category descriptions and user thread titles with controlled fixtures, then validate the /groups route DOM and hydration result.",
    },
  },
  {
    requirementId: "security.xss-surface.forum-content",
    surface: "Forum post bodies",
    reviewStatus: "source-reviewed",
    persistence: "stored",
    renderMode: "react-text-node",
    currentControlStatus:
      "bounded-plain-text-write-and-react-text-render-observed",
    sourceAnchors: [
      {
        path: "prisma/schema.prisma",
        needle: "model Post {",
        purpose: "Post is the persisted forum-message boundary.",
      },
      {
        path: "src/app/actions.ts",
        needle: "body: cleanText(parsed.body),",
        purpose: "Thread creation and reply actions normalize forum bodies.",
      },
      {
        path: "src/app/actions.ts",
        needle: "export async function replyToForumThread(",
        purpose: "The reviewed reply action is a forum-content write boundary.",
      },
    ],
    renderAnchors: [
      {
        path: "src/app/forum/threads/[id]/page.tsx",
        needle: "{post.body}",
        purpose: "Stored forum post bodies render as React text children.",
      },
      {
        path: "src/app/groups/threads/[id]/page.tsx",
        needle: "export default GroupThreadPage;",
        purpose: "The group thread alias reaches the same reviewed renderer.",
      },
    ],
    observedControls: [
      "Forum actions apply cleanText before database writes.",
      "The thread page uses a whitespace-preserving React text node.",
    ],
    knownGaps: [
      "Stored first-post, reply, legacy-row, and hydration cases remain untested in a browser.",
    ],
    storedRenderValidation: {
      status: "required-open",
      requiredTest:
        "Persist first-post and reply payload fixtures, exercise both /forum and /groups aliases, and assert inert DOM before and after hydration.",
    },
  },
  {
    requirementId: "security.xss-surface.profiles",
    surface: "Member profile text",
    reviewStatus: "source-reviewed",
    persistence: "stored",
    renderMode: "react-text-node",
    currentControlStatus:
      "bounded-plain-text-write-and-react-text-render-observed",
    sourceAnchors: [
      {
        path: "prisma/schema.prisma",
        needle: "model Profile {",
        purpose: "Profile is the persisted member-profile boundary.",
      },
      {
        path: "src/lib/account-validation.ts",
        needle: "bio: optionalText(1000),",
        purpose: "Profile biographies are bounded and normalized by optionalText.",
      },
      {
        path: "src/app/actions.ts",
        needle: "bio: profileFields.bio,",
        purpose: "The server action persists the validated biography.",
      },
    ],
    renderAnchors: [
      {
        path: "src/app/p/[handle]/page.tsx",
        needle: '{personal.bio ?? "This member has not added a bio yet."}',
        purpose: "The public member biography renders as a React text child.",
      },
      {
        path: "src/app/p/[handle]/page.tsx",
        needle: "{profile.actor.displayName}",
        purpose: "The public profile identity also renders as React text.",
      },
    ],
    observedControls: [
      "Profile text uses a shared bounded cleanText transform.",
      "The reviewed public profile surface uses React text children.",
    ],
    knownGaps: [
      "Profile text appears in additional cards, metadata, and notifications that are not promoted to a global escaping claim by this record.",
    ],
    storedRenderValidation: {
      status: "required-open",
      requiredTest:
        "Persist profile display-name and biography fixtures, visit public/member views, and inspect DOM, document metadata, and hydration for executable output.",
    },
  },
  {
    requirementId: "security.xss-surface.listings",
    surface: "Marketplace listing titles and summary fields",
    reviewStatus: "source-reviewed",
    persistence: "stored",
    renderMode: "react-text-node",
    currentControlStatus:
      "bounded-plain-text-write-and-react-text-render-observed",
    sourceAnchors: [
      {
        path: "prisma/schema.prisma",
        needle: "model Listing {",
        purpose: "Listing is the persisted marketplace boundary.",
      },
      {
        path: "src/lib/listing-validation.ts",
        needle:
          "title: z.string().trim().min(5).max(100).transform(cleanText)",
        purpose: "Listing titles are bounded and normalized as plain text.",
      },
      {
        path: "src/app/actions.ts",
        needle: "title: cleanText(parsed.title),",
        purpose: "The server action preserves the plain-text write contract.",
      },
    ],
    renderAnchors: [
      {
        path: "src/app/listings/page.tsx",
        needle: "{listing.title}",
        purpose: "Marketplace cards render listing titles as React text children.",
      },
      {
        path: "src/app/listings/[id]/page.tsx",
        needle: "{listing.title}",
        purpose: "The listing detail heading renders as a React text child.",
      },
    ],
    observedControls: [
      "Create and patch schemas apply cleanText to bounded listing titles.",
      "List and detail screens use React text nodes for the reviewed title field.",
    ],
    knownGaps: [
      "Listing values also enter aria labels, image alt text, metadata, and generated cards; those contexts need their own runtime assertions.",
    ],
    storedRenderValidation: {
      status: "required-open",
      requiredTest:
        "Persist listing title and summary fixtures, render card/detail/metadata paths, and assert inert DOM and correctly encoded attributes.",
    },
  },
  {
    requirementId: "security.xss-surface.seller-descriptions",
    surface: "Marketplace seller descriptions",
    reviewStatus: "source-reviewed",
    persistence: "stored",
    renderMode: "react-text-node",
    currentControlStatus:
      "bounded-plain-text-write-and-react-text-render-observed",
    sourceAnchors: [
      {
        path: "src/lib/listing-validation.ts",
        needle:
          "description: z.string().trim().min(20).max(5_000).transform(cleanText)",
        purpose: "Seller descriptions are bounded and normalized as plain text.",
      },
      {
        path: "src/app/actions.ts",
        needle: "description: cleanText(parsed.description),",
        purpose: "The server action persists the normalized description.",
      },
      {
        path: "prisma/schema.prisma",
        needle: "description            String",
        purpose: "The listing description is stored for later rendering.",
      },
    ],
    renderAnchors: [
      {
        path: "src/app/listings/page.tsx",
        needle: "{listing.description}",
        purpose: "Marketplace cards render the seller description as React text.",
      },
      {
        path: "src/app/listings/[id]/page.tsx",
        needle: "{listing.description}",
        purpose: "The full seller description renders as a React text child.",
      },
    ],
    observedControls: [
      "Create and patch paths apply a bounded cleanText schema.",
      "The reviewed summary and detail descriptions are React text children.",
    ],
    knownGaps: [
      "Existing legacy rows and every marketplace variant still need browser-level stored rendering tests.",
    ],
    storedRenderValidation: {
      status: "required-open",
      requiredTest:
        "Persist controlled seller-description fixtures and validate list, detail, saved-listing, and design-card render variants in a real browser.",
    },
  },
  {
    requirementId: "security.xss-surface.support-messages",
    surface: "Support ticket messages and replies",
    reviewStatus: "source-reviewed",
    persistence: "stored",
    renderMode: "not-rendered",
    currentControlStatus: "stored-content-not-rendered",
    sourceAnchors: [
      {
        path: "prisma/schema.prisma",
        needle: "model SupportMessage {",
        purpose: "SupportMessage is the persisted support-conversation boundary.",
      },
      {
        path: "src/app/actions.ts",
        needle: "body: cleanText(parsed.body),",
        purpose: "Member-created support messages are normalized before storage.",
      },
      {
        path: "src/lib/admin-service.ts",
        needle: "body: replyBody.slice(0, 2000),",
        purpose: "Administrator replies are bounded before storage.",
      },
    ],
    renderAnchors: [
      {
        path: "src/app/admin/support/page.tsx",
        needle: "support message contents are not displayed.",
        purpose: "The admin screen explicitly limits itself to counts and ticket rows.",
      },
      {
        path: "src/app/account/support/page.tsx",
        needle: "exposing support message contents.",
        purpose: "The member support screen also exposes counts rather than bodies.",
      },
    ],
    observedControls: [
      "Member messages use cleanText and a bounded schema.",
      "Current admin and account screens deliberately do not render stored message bodies.",
    ],
    knownGaps: [
      "Administrator replies are trimmed and sliced but do not use cleanText.",
      "No safe renderer or stored-render test exists for a future support conversation transcript.",
    ],
    storedRenderValidation: {
      status: "required-before-enablement",
      requiredTest:
        "Before exposing support bodies, add a reviewed renderer and browser tests for member messages, administrator replies, legacy rows, and notification/email copies.",
    },
  },
  {
    requirementId: "security.xss-surface.administration-notes",
    surface: "Administration reasons and resolution notes",
    reviewStatus: "source-reviewed",
    persistence: "stored",
    renderMode: "react-text-node",
    currentControlStatus: "react-text-render-observed",
    sourceAnchors: [
      {
        path: "prisma/schema.prisma",
        needle: "model AdminAction {",
        purpose: "AdminAction.reason is a persisted administration-note boundary.",
      },
      {
        path: "src/lib/admin-service.ts",
        needle: "export function cleanAdminReason(",
        purpose: "The shared administration reason boundary trims and length-bounds notes.",
      },
      {
        path: "src/lib/admin-service.ts",
        needle: "reason: input.reason,",
        purpose: "Reviewed admin mutations store the supplied reason in the action record.",
      },
    ],
    renderAnchors: [
      {
        path: "src/app/admin/actions/page.tsx",
        needle: "{action.reason}",
        purpose: "Administration action reasons render as React text children.",
      },
      {
        path: "src/app/admin/reports/page.tsx",
        needle: "{report.resolutionNotes}",
        purpose: "Report resolution notes render as React text children.",
      },
      {
        path: "src/app/admin/safety/page.tsx",
        needle: "{flag.reason}",
        purpose: "Safety-flag reasons render as React text children.",
      },
    ],
    observedControls: [
      "The common admin reason function enforces a non-empty bounded value.",
      "Reviewed admin tables insert notes as React text children.",
    ],
    knownGaps: [
      "cleanAdminReason does not apply cleanText, and not every note-producing workflow shares one schema.",
      "Stored notes have not been rendered with controlled payload fixtures in a browser.",
    ],
    storedRenderValidation: {
      status: "required-open",
      requiredTest:
        "Seed action, report-resolution, safety, retention, and support-note fixtures and assert inert output across every administration table and export.",
    },
  },
  {
    requirementId: "security.xss-surface.imported-racing-content",
    surface: "Imported racing names and descriptive fields",
    reviewStatus: "source-reviewed",
    persistence: "externally-sourced-stored",
    renderMode: "react-text-node",
    currentControlStatus:
      "external-html-normalized-to-text-before-react-render",
    sourceAnchors: [
      {
        path: "src/lib/live/thedogs.ts",
        needle: "function cleanHtml(value = \"\", maxLength = 500) {",
        purpose: "The HTML provider adapter converts selected fields to text.",
      },
      {
        path: "src/lib/live/thedogs.ts",
        needle: '.replace(/<[^>]+>/g, " ")',
        purpose: "Provider tags are removed during field normalization.",
      },
      {
        path: "src/lib/live/thedogs.ts",
        needle: "name: cleanHtml(",
        purpose: "Imported race, venue, dog, and trainer names use the text normalizer.",
      },
    ],
    renderAnchors: [
      {
        path: "src/app/races/[id]/page.tsx",
        needle: "{race.name}",
        purpose: "Imported race names render as React text children.",
      },
      {
        path: "src/app/dogs/[id]/page.tsx",
        needle: "{dog.name}",
        purpose: "Imported dog names render as React text children.",
      },
      {
        path: "src/app/tracks/[id]/page.tsx",
        needle: "{track.name}",
        purpose: "Imported track names render as React text children.",
      },
      {
        path: "src/components/json-ld.tsx",
        needle: "dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}",
        purpose: "Imported names can also reach the separately serialized JSON-LD script context.",
      },
    ],
    observedControls: [
      "The reviewed HTML adapter strips tags and decodes entities into text fields.",
      "Screen text uses React children; JSON-LD uses the dedicated serializeJsonLd boundary.",
    ],
    knownGaps: [
      "cleanHtml is a field normalizer, not a reviewed allowlist HTML sanitizer.",
      "All providers, legacy imported rows, metadata, replay titles, and JSON-LD require stored-render fixtures.",
    ],
    storedRenderValidation: {
      status: "required-open",
      requiredTest:
        "Import controlled provider fixtures through every adapter, persist them, and validate screen text, attributes, metadata, JSON-LD, and hydration in a browser.",
    },
  },
  {
    requirementId: "security.xss-surface.rich-text",
    surface: "Custom-page multiline content (current rich-text substitute)",
    reviewStatus: "source-reviewed",
    persistence: "stored",
    renderMode: "plain-text-literal",
    currentControlStatus:
      "bounded-plain-text-write-and-react-text-render-observed",
    sourceAnchors: [
      {
        path: "prisma/schema.prisma",
        needle: "about            String?",
        purpose: "CustomPage.about persists the current long-form page content.",
      },
      {
        path: "src/lib/custom-page-validation.ts",
        needle: "about: optionalText(4000),",
        purpose: "The long-form field is bounded and normalized as plain text.",
      },
      {
        path: "src/app/account/pages/[id]/page.tsx",
        needle: 'textarea id="page-about" name="about"',
        purpose: "The current editor is a textarea rather than an HTML editor.",
      },
    ],
    renderAnchors: [
      {
        path: "src/app/p/[handle]/page.tsx",
        needle: '{page.about ?? "This page has not added an introduction yet."}',
        purpose: "Long-form custom-page content renders literally as React text.",
      },
      {
        path: "src/app/p/[handle]/page.tsx",
        needle: 'className="whitespace-pre-line text-[14px]',
        purpose: "Whitespace is formatted with CSS rather than an HTML renderer.",
      },
    ],
    observedControls: [
      "The current editor stores bounded plain text after cleanText normalization.",
      "The public page uses a React text child with CSS whitespace formatting.",
    ],
    knownGaps: [
      "There is no reviewed rich-HTML editor, document schema, or HTML sanitizer.",
      "Enabling HTML-rich content requires a new threat model and separate implementation evidence.",
    ],
    storedRenderValidation: {
      status: "required-open",
      requiredTest:
        "Persist multiline and markup-like fixtures through the custom-page editor and assert they remain literal inert text; repeat before any rich-HTML feature is enabled.",
    },
  },
  {
    requirementId: "security.xss-surface.markdown",
    surface: "Markdown-like syntax entered into plain-text community fields",
    reviewStatus: "source-reviewed",
    persistence: "stored",
    renderMode: "plain-text-literal",
    currentControlStatus:
      "bounded-plain-text-write-and-react-text-render-observed",
    sourceAnchors: [
      {
        path: "src/lib/feed-validation.ts",
        needle:
          "body: z.string().trim().min(2).max(5000).transform(cleanText)",
        purpose: "Community post text is accepted through a plain-text schema.",
      },
      {
        path: "src/app/actions.ts",
        needle: "body: cleanText(parsed.body),",
        purpose: "Forum content likewise stores normalized plain text.",
      },
      {
        path: "package.json",
        needle: '"dependencies": {',
        purpose: "The dependency manifest is checked by the evidence test for known Markdown renderers.",
      },
    ],
    renderAnchors: [
      {
        path: "src/components/feed-post-card.tsx",
        needle: "{post.body}",
        purpose: "Markdown-like post syntax renders as a React text child.",
      },
      {
        path: "src/app/forum/threads/[id]/page.tsx",
        needle: "{post.body}",
        purpose: "Markdown-like forum syntax renders as a React text child.",
      },
    ],
    observedControls: [
      "No known Markdown renderer package is present in the reviewed manifest.",
      "Representative community renderers insert bodies directly as React text children.",
    ],
    knownGaps: [
      "The package check is not proof that a custom parser cannot be introduced elsewhere.",
      "If Markdown is enabled later, raw HTML handling, link schemes, image sources, extensions, and sanitizer order require a new review.",
    ],
    storedRenderValidation: {
      status: "required-open",
      requiredTest:
        "Persist Markdown, embedded-HTML, autolink, image, entity, and fence fixtures and prove they remain literal inert text on all current community renderers.",
    },
  },
  {
    requirementId: "security.xss-surface.link-previews",
    surface: "Externally fetched link-preview metadata",
    reviewStatus: "source-reviewed",
    persistence: "externally-sourced-stored",
    renderMode: "react-text-and-url-attribute",
    currentControlStatus: "validated-url-and-react-text-render-observed",
    sourceAnchors: [
      {
        path: "src/lib/link-preview.ts",
        needle: "export function extractLinkPreview(html: string, pageUrl: string): LinkPreview {",
        purpose: "External HTML metadata is parsed into a bounded preview record.",
      },
      {
        path: "src/lib/link-preview.ts",
        needle: 'const cleaned = decodeEntities(value.replace(/<[^>]*>/g, " "))',
        purpose: "Title, description, and site-name metadata is normalized to bounded text.",
      },
      {
        path: "src/lib/link-preview-worker.ts",
        needle: "linkPreviewJson: JSON.stringify(preview),",
        purpose: "Fetched preview metadata is persisted for later rendering.",
      },
    ],
    renderAnchors: [
      {
        path: "src/components/feed-post-card.tsx",
        needle: "href={linkPreview.url}",
        purpose: "The preview URL enters an anchor href after parseLinkPreview validation.",
      },
      {
        path: "src/components/feed-post-card.tsx",
        needle: "{linkPreview.title}",
        purpose: "The external title renders as a React text child.",
      },
      {
        path: "src/components/feed-post-card.tsx",
        needle: "{linkPreview.description}",
        purpose: "The external description renders as a React text child.",
      },
      {
        path: "src/components/feed-post-card.tsx",
        needle: 'previewUrl.protocol !== "http:" && previewUrl.protocol !== "https:"',
        purpose: "Stored preview URLs are revalidated as HTTP(S) before rendering.",
      },
    ],
    observedControls: [
      "External metadata is tag-stripped, decoded, whitespace-normalized, and length-bounded.",
      "The stored URL is reparsed and limited to HTTP(S); metadata uses React text nodes.",
    ],
    knownGaps: [
      "Browser tests have not exercised malicious metadata, redirects, legacy preview JSON, encoded schemes, or hydration.",
      "This XSS review does not replace the separate SSRF and external-image reviews.",
    ],
    storedRenderValidation: {
      status: "required-open",
      requiredTest:
        "Store hostile preview metadata and URL variants through the worker, then assert inert text, safe href values, no opener access, and stable hydration in a browser.",
    },
  },
  {
    requirementId: "security.xss-surface.error-messages",
    surface: "Runtime and third-party error messages",
    reviewStatus: "source-reviewed",
    persistence: "non-stored",
    renderMode: "react-text-node",
    currentControlStatus: "generic-error-react-text-render-observed",
    sourceAnchors: [
      {
        path: "src/app/admin/site-content/page.tsx",
        needle: "return { monthly: null, yearly: null, unavailable: true };",
        purpose: "A third-party Stripe failure is reduced to a boolean UI state without exposing the provider error.",
      },
      {
        path: "src/components/race-replay-player.tsx",
        needle: "setError(\"Replay stream could not be loaded. Try again later.\");",
        purpose: "The replay client maps media failures to a fixed user-safe message.",
      },
    ],
    renderAnchors: [
      {
        path: "src/app/admin/site-content/page.tsx",
        needle: "Could not read Stripe prices. Try again later.",
        purpose: "The fixed Stripe failure message is rendered as a React text child.",
      },
      {
        path: "src/components/race-replay-player.tsx",
        needle: "{error}",
        purpose: "The client replay error is rendered as a React text child.",
      },
    ],
    observedControls: [
      "Reviewed provider and media failures are mapped to fixed messages and enter React text children rather than HTML sinks.",
    ],
    knownGaps: [
      "Other toast, API, server-error, and logging paths require separate inventory before any global control can close.",
    ],
    storedRenderValidation: {
      status: "not-applicable-non-stored",
      requiredTest:
        "Use component/browser error fixtures to verify inert text and redaction; no stored-content claim applies to these reviewed reflected paths.",
    },
  },
  {
    requirementId: "security.xss-surface.ai-generated-output",
    surface: "Stored AI agent output",
    reviewStatus: "source-reviewed",
    persistence: "stored",
    renderMode: "not-rendered",
    currentControlStatus: "stored-content-not-rendered",
    sourceAnchors: [
      {
        path: "prisma/schema.prisma",
        needle: "outputJson       String? // JSON: structured result",
        purpose: "AgentRun.outputJson is the persisted AI-output boundary.",
      },
      {
        path: "src/lib/agent-service.ts",
        needle: "outputJson: JSON.stringify(output),",
        purpose: "Validated structured agent output is stored as JSON text.",
      },
      {
        path: "src/lib/queries.ts",
        needle: "export async function getAgentRuns(current: DbContextUser, limit = 12)",
        purpose: "The current user run query was reviewed for downstream use.",
      },
    ],
    renderAnchors: [
      {
        path: "src/app/agents/page.tsx",
        needle: "{run.status}",
        purpose: "The live run table renders status and metrics, not outputJson.",
      },
      {
        path: "src/app/admin/jobs/page.tsx",
        needle: "Local agent harness run records without prompts or outputs.",
        purpose: "The admin jobs screen explicitly excludes prompts and outputs.",
      },
      {
        path: "src/components/agent-demo-console.tsx",
        needle: ": selected.output}",
        purpose: "The only visible output preview is a static source-authored demo fixture.",
      },
    ],
    observedControls: [
      "Agent output is stored as structured JSON and is not displayed by the live run tables.",
      "The visible demo console selects from source-authored constants rather than AgentRun.outputJson.",
    ],
    knownGaps: [
      "getAgentRuns currently over-selects the full AgentRun row even though the page does not render outputJson.",
      "No reviewed renderer or browser stored-render test exists for future AI output display.",
    ],
    storedRenderValidation: {
      status: "required-before-enablement",
      requiredTest:
        "Before displaying live output, define a typed field allowlist and test hostile model strings in every text, URL, Markdown, chart, tool-result, citation, and export context.",
    },
  },
] as const satisfies readonly XssSurfaceReviewRecord[];

export type XssSourceReader = (path: string) => string | undefined;

export function validateXssSurfaceReview(
  records: readonly XssSurfaceReviewRecord[] = XSS_SURFACE_REVIEW_RECORDS,
  readSource?: XssSourceReader,
) {
  const failures: string[] = [];
  const expectedIds = new Set<string>(XSS_SURFACE_REVIEW_REQUIREMENT_IDS);
  const implementationIds = new Set<string>(
    XSS_IMPLEMENTATION_CONTROL_REQUIREMENT_IDS,
  );
  const seen = new Set<string>();

  for (const record of records) {
    const id = record.requirementId as string;
    if (seen.has(id)) failures.push(`REQUIREMENT_DUPLICATE:${id}`);
    seen.add(id);
    if (!expectedIds.has(id)) {
      failures.push(
        `${implementationIds.has(id) ? "IMPLEMENTATION_CONTROL_INCLUDED" : "REQUIREMENT_UNEXPECTED"}:${id}`,
      );
    }
    if (!(XSS_REVIEW_STATUSES as readonly string[]).includes(record.reviewStatus)) {
      failures.push(`REVIEW_STATUS_UNSUPPORTED:${id}`);
    }
    if (
      !(XSS_PERSISTENCE_CLASSES as readonly string[]).includes(
        record.persistence,
      )
    ) {
      failures.push(`PERSISTENCE_UNSUPPORTED:${id}`);
    }
    if (!(XSS_RENDER_MODES as readonly string[]).includes(record.renderMode)) {
      failures.push(`RENDER_MODE_UNSUPPORTED:${id}`);
    }
    if (
      !(XSS_CURRENT_CONTROL_STATUSES as readonly string[]).includes(
        record.currentControlStatus,
      )
    ) {
      failures.push(`CONTROL_STATUS_UNSUPPORTED:${id}`);
    }
    if (
      !(XSS_STORED_RENDER_VALIDATION_STATUSES as readonly string[]).includes(
        record.storedRenderValidation.status,
      )
    ) {
      failures.push(`STORED_RENDER_STATUS_UNSUPPORTED:${id}`);
    }

    for (const field of ["surface"] as const) {
      if (!record[field].trim()) failures.push(`FIELD_EMPTY:${id}:${field}`);
    }
    if (record.sourceAnchors.length === 0) {
      failures.push(`SOURCE_ANCHORS_EMPTY:${id}`);
    }
    if (record.renderAnchors.length === 0) {
      failures.push(`RENDER_ANCHORS_EMPTY:${id}`);
    }
    if (record.observedControls.length === 0) {
      failures.push(`OBSERVED_CONTROLS_EMPTY:${id}`);
    }
    if (record.knownGaps.length === 0) {
      failures.push(`KNOWN_GAPS_EMPTY:${id}`);
    }
    if (!record.storedRenderValidation.requiredTest.trim()) {
      failures.push(`STORED_RENDER_TEST_EMPTY:${id}`);
    }

    if (record.persistence === "non-stored") {
      if (
        record.storedRenderValidation.status !== "not-applicable-non-stored"
      ) {
        failures.push(`NON_STORED_VALIDATION_MISMATCH:${id}`);
      }
    } else if (record.renderMode === "not-rendered") {
      if (
        record.storedRenderValidation.status !==
        "required-before-enablement"
      ) {
        failures.push(`NOT_RENDERED_VALIDATION_MISMATCH:${id}`);
      }
    } else if (record.storedRenderValidation.status !== "required-open") {
      failures.push(`STORED_RENDER_VALIDATION_NOT_OPEN:${id}`);
    }

    for (const [kind, anchors] of [
      ["SOURCE", record.sourceAnchors],
      ["RENDER", record.renderAnchors],
    ] as const) {
      for (const [index, anchor] of anchors.entries()) {
        if (!anchor.path.trim()) failures.push(`${kind}_PATH_EMPTY:${id}:${index}`);
        if (!anchor.needle.trim()) {
          failures.push(`${kind}_NEEDLE_EMPTY:${id}:${index}`);
        }
        if (!anchor.purpose.trim()) {
          failures.push(`${kind}_PURPOSE_EMPTY:${id}:${index}`);
        }
        if (readSource && anchor.path.trim() && anchor.needle.trim()) {
          const source = readSource(anchor.path);
          if (source === undefined) {
            failures.push(`${kind}_FILE_MISSING:${id}:${anchor.path}`);
          } else if (!source.includes(anchor.needle)) {
            failures.push(`${kind}_NEEDLE_MISSING:${id}:${anchor.path}`);
          }
        }
      }
    }
  }

  for (const requirementId of expectedIds) {
    if (!seen.has(requirementId)) {
      failures.push(`REQUIREMENT_MISSING:${requirementId}`);
    }
  }

  return failures;
}
