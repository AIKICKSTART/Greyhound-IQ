import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const findings: string[] = [];

const messagesRoute = read("src/app/api/messages/route.ts");
const conversationService = read("src/lib/conversation-service.ts");
must(messagesRoute, "listConversationsForProfile(current)", "messages API must delegate to conversation visibility service");
must(conversationService, "{ senderId: profileId, deletedBySenderAt: null }", "messages API must hide sender-deleted messages");
must(conversationService, "{ recipientId: profileId, deletedByRecipientAt: null }", "messages API must hide recipient-deleted messages");

const mediaService = read("src/lib/media-service.ts");
must(mediaService, 'moderationStatus: "approved"', "public listing media must require approved listings");
must(mediaService, "bucket === SITE_ASSETS_BUCKET ? publicUrlForMedia(bucket, objectPath) : null", "pending user uploads must not store or return public URLs");
must(mediaService, "/quarantine/${input.context}/", "user uploads must use quarantine paths");
const mediaValidation = read("src/lib/media-validation.ts");
must(mediaValidation, "return PRIVATE_USER_MEDIA_BUCKET;", "user upload contexts must resolve to private storage");
const storagePaths = read("src/lib/storage-paths.ts");
if (/PUBLIC_BUCKETS[\s\S]*PUBLIC_USER_MEDIA_BUCKET/.test(storagePaths)) {
  findings.push("public-user-media must not remain a public delivery bucket");
}

const reportService = read("src/lib/report-service.ts");
must(reportService, "recipientId: current.profileId", "message reports must target received messages only");
must(reportService, "deletedByRecipientAt: null", "message reports must ignore recipient-deleted messages");

const feedService = read("src/lib/feed-service.ts");
const feedCommentsService = feedService.slice(
  feedService.indexOf("export async function getFeedCommentsForViewer"),
  feedService.indexOf("async function getFeedAffinity")
);
must(feedCommentsService, "withDbRequestContext(options.current, read)", "signed-in feed comments must receive viewer context");
must(feedCommentsService, "withDbAnonymousContext(read)", "public feed comments must use anonymous database context");
must(feedService, "userBlocksReceived", "feed comment includes must filter blocked authors");

const socialActorService = read("src/lib/social-actor-service.ts");
must(socialActorService, "public.giq_profiles_blocked(", "profile/contact reads must enforce two-way blocks");
must(socialActorService, "if (blockState?.blocked) return null", "blocked viewers must not receive profile/contact data");

if (findings.length > 0) {
  console.error("Visibility policy gate failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Visibility policy gate passed.");

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function must(text: string, needle: string, message: string) {
  if (!text.includes(needle)) findings.push(message);
}
