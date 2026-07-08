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
must(mediaService, "publicUrl: cleanPublicUrl", "scanner must publish public URL only after clean scan");

const reportService = read("src/lib/report-service.ts");
must(reportService, "recipientId: current.profileId", "message reports must target received messages only");
must(reportService, "deletedByRecipientAt: null", "message reports must ignore recipient-deleted messages");

const feedService = read("src/lib/feed-service.ts");
must(feedService, "include: feedPostInclude(viewerProfileId)", "feed comments must receive viewer context");
must(feedService, "userBlocksReceived", "feed comment includes must filter blocked authors");

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
