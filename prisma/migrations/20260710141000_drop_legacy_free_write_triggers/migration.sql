-- Remove insert-only entitlement triggers left behind by an older production
-- bootstrap. The canonical *_pro_write triggers remain in place and enforce
-- the current Free personal-feed and personal-messaging contracts.

DROP TRIGGER IF EXISTS giq_feed_post_pro_insert ON "FeedPost";
DROP TRIGGER IF EXISTS giq_feed_comment_pro_insert ON "FeedComment";
DROP TRIGGER IF EXISTS giq_feed_reaction_pro_insert ON "FeedReaction";
DROP TRIGGER IF EXISTS giq_message_pro_insert ON "Message";
DROP TRIGGER IF EXISTS giq_conversation_pro_insert ON "Conversation";
