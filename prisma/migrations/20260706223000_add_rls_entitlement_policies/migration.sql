-- Greyhounds IQ RLS + entitlement guard foundation.
-- App services set app.current_* settings per request; internal jobs set app.system.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    CREATE ROLE greyhoundiq_runtime NOLOGIN NOBYPASSRLS;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping greyhoundiq_runtime role creation; create a NOBYPASSRLS runtime role outside this migration.';
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT USAGE ON SCHEMA public TO greyhoundiq_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO greyhoundiq_runtime;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO greyhoundiq_runtime;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.giq_claim(name text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.' || name, true), '');
$$;

CREATE OR REPLACE FUNCTION public.giq_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT public.giq_claim('current_user_id');
$$;

CREATE OR REPLACE FUNCTION public.giq_current_profile_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT public.giq_claim('current_profile_id');
$$;

CREATE OR REPLACE FUNCTION public.giq_current_tier()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.giq_claim('current_tier'), 'free');
$$;

CREATE OR REPLACE FUNCTION public.giq_current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.giq_claim('current_role'), 'member');
$$;

CREATE OR REPLACE FUNCTION public.giq_is_system()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.giq_claim('system') = 'true';
$$;

CREATE OR REPLACE FUNCTION public.giq_is_pro()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.giq_is_system()
    OR public.giq_current_tier() IN ('pro', 'pro_plus');
$$;

CREATE OR REPLACE FUNCTION public.giq_is_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.giq_is_system()
    OR public.giq_current_role() IN ('admin', 'moderator');
$$;

CREATE OR REPLACE FUNCTION public.giq_require_pro_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.giq_is_pro() OR public.giq_is_moderator() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'payment.required'
    USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.giq_enforce_profile_marketing_tier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.giq_is_pro() OR public.giq_is_moderator() THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW."kennelName", '') <> ''
    OR COALESCE(NEW."kennelPrefix", '') <> ''
    OR COALESCE(NEW."website", '') <> ''
    OR COALESCE(NEW."phone", '') <> '' THEN
    RAISE EXCEPTION 'payment.required'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER giq_profile_marketing_tier
BEFORE INSERT OR UPDATE ON "Profile"
FOR EACH ROW EXECUTE FUNCTION public.giq_enforce_profile_marketing_tier();

CREATE TRIGGER giq_listing_pro_write
BEFORE INSERT OR UPDATE ON "Listing"
FOR EACH ROW EXECUTE FUNCTION public.giq_require_pro_write();

CREATE TRIGGER giq_listing_enquiry_pro_write
BEFORE INSERT OR UPDATE ON "ListingEnquiry"
FOR EACH ROW EXECUTE FUNCTION public.giq_require_pro_write();

CREATE TRIGGER giq_conversation_pro_write
BEFORE INSERT OR UPDATE ON "Conversation"
FOR EACH ROW EXECUTE FUNCTION public.giq_require_pro_write();

CREATE TRIGGER giq_message_pro_write
BEFORE INSERT OR UPDATE ON "Message"
FOR EACH ROW EXECUTE FUNCTION public.giq_require_pro_write();

CREATE TRIGGER giq_feed_post_pro_write
BEFORE INSERT OR UPDATE ON "FeedPost"
FOR EACH ROW EXECUTE FUNCTION public.giq_require_pro_write();

CREATE TRIGGER giq_feed_comment_pro_write
BEFORE INSERT OR UPDATE ON "FeedComment"
FOR EACH ROW EXECUTE FUNCTION public.giq_require_pro_write();

CREATE TRIGGER giq_feed_reaction_pro_write
BEFORE INSERT OR UPDATE ON "FeedReaction"
FOR EACH ROW EXECUTE FUNCTION public.giq_require_pro_write();

CREATE TRIGGER giq_thread_pro_write
BEFORE INSERT OR UPDATE ON "Thread"
FOR EACH ROW EXECUTE FUNCTION public.giq_require_pro_write();

CREATE TRIGGER giq_post_pro_write
BEFORE INSERT OR UPDATE ON "Post"
FOR EACH ROW EXECUTE FUNCTION public.giq_require_pro_write();

CREATE TRIGGER giq_call_room_pro_write
BEFORE INSERT OR UPDATE ON "CallRoom"
FOR EACH ROW EXECUTE FUNCTION public.giq_require_pro_write();

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY giq_user_select ON "User"
FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR id = public.giq_current_user_id()
);
CREATE POLICY giq_user_insert ON "User"
FOR INSERT WITH CHECK (public.giq_is_system());
CREATE POLICY giq_user_update ON "User"
FOR UPDATE USING (
  public.giq_is_system() OR public.giq_is_moderator() OR id = public.giq_current_user_id()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR id = public.giq_current_user_id()
);

ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY giq_profile_select ON "Profile"
FOR SELECT USING (true);
CREATE POLICY giq_profile_insert ON "Profile"
FOR INSERT WITH CHECK (public.giq_is_system() OR "userId" = public.giq_current_user_id());
CREATE POLICY giq_profile_update ON "Profile"
FOR UPDATE USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);

ALTER TABLE "Dog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DogProfileForm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DogProfileArchive" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RaceDayArchive" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trainer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Track" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Meeting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Race" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RaceVideo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Runner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Result" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FormEntry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY giq_dog_read ON "Dog" FOR SELECT USING (true);
CREATE POLICY giq_dog_form_read ON "DogProfileForm" FOR SELECT USING (true);
CREATE POLICY giq_dog_archive_read ON "DogProfileArchive" FOR SELECT USING (true);
CREATE POLICY giq_race_day_archive_read ON "RaceDayArchive" FOR SELECT USING (true);
CREATE POLICY giq_trainer_read ON "Trainer" FOR SELECT USING (true);
CREATE POLICY giq_track_read ON "Track" FOR SELECT USING (true);
CREATE POLICY giq_meeting_read ON "Meeting" FOR SELECT USING (true);
CREATE POLICY giq_race_read ON "Race" FOR SELECT USING (true);
CREATE POLICY giq_race_video_read ON "RaceVideo" FOR SELECT USING (true);
CREATE POLICY giq_runner_read ON "Runner" FOR SELECT USING (true);
CREATE POLICY giq_result_read ON "Result" FOR SELECT USING (true);
CREATE POLICY giq_form_entry_read ON "FormEntry" FOR SELECT USING (true);

CREATE POLICY giq_dog_system_write ON "Dog" FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_dog_form_system_write ON "DogProfileForm" FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_dog_archive_system_write ON "DogProfileArchive" FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_race_day_archive_system_write ON "RaceDayArchive" FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_trainer_system_write ON "Trainer" FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_track_system_write ON "Track" FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_meeting_system_write ON "Meeting" FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_race_system_write ON "Race" FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_race_video_system_write ON "RaceVideo" FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_runner_system_write ON "Runner" FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_result_system_write ON "Result" FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_form_entry_system_write ON "FormEntry" FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());

ALTER TABLE "ForumCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Thread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
CREATE POLICY giq_forum_category_read ON "ForumCategory" FOR SELECT USING (true);
CREATE POLICY giq_forum_category_system_write ON "ForumCategory" FOR ALL USING (public.giq_is_moderator()) WITH CHECK (public.giq_is_moderator());
CREATE POLICY giq_thread_select ON "Thread" FOR SELECT USING (true);
CREATE POLICY giq_thread_insert ON "Thread" FOR INSERT WITH CHECK (public.giq_is_pro() AND "authorId" = public.giq_current_profile_id());
CREATE POLICY giq_thread_update ON "Thread" FOR UPDATE USING (public.giq_is_moderator() OR (public.giq_is_pro() AND "authorId" = public.giq_current_profile_id())) WITH CHECK (public.giq_is_moderator() OR (public.giq_is_pro() AND "authorId" = public.giq_current_profile_id()));
CREATE POLICY giq_post_select ON "Post" FOR SELECT USING (true);
CREATE POLICY giq_post_insert ON "Post" FOR INSERT WITH CHECK (public.giq_is_pro() AND "authorId" = public.giq_current_profile_id());
CREATE POLICY giq_post_update ON "Post" FOR UPDATE USING (public.giq_is_moderator() OR (public.giq_is_pro() AND "authorId" = public.giq_current_profile_id())) WITH CHECK (public.giq_is_moderator() OR (public.giq_is_pro() AND "authorId" = public.giq_current_profile_id()));

ALTER TABLE "MarketplaceCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Listing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingLocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingAttribute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingStatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedListing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingEnquiry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingMedia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingSearchIndex" ENABLE ROW LEVEL SECURITY;

CREATE POLICY giq_marketplace_category_read ON "MarketplaceCategory" FOR SELECT USING (true);
CREATE POLICY giq_marketplace_category_write ON "MarketplaceCategory" FOR ALL USING (public.giq_is_moderator()) WITH CHECK (public.giq_is_moderator());
CREATE POLICY giq_listing_select ON "Listing" FOR SELECT USING (
  public.giq_is_moderator()
  OR "profileId" = public.giq_current_profile_id()
  OR (status = 'active' AND "moderationStatus" = 'approved' AND "archivedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" >= now()))
);
CREATE POLICY giq_listing_insert ON "Listing" FOR INSERT WITH CHECK (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id());
CREATE POLICY giq_listing_update ON "Listing" FOR UPDATE USING (
  public.giq_is_moderator() OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
) WITH CHECK (
  public.giq_is_moderator() OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
);
CREATE POLICY giq_listing_child_select ON "ListingLocation" FOR SELECT USING (
  public.giq_is_moderator()
  OR EXISTS (SELECT 1 FROM "Listing" l WHERE l.id = "listingId")
);
CREATE POLICY giq_listing_child_write ON "ListingLocation" FOR ALL USING (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND EXISTS (SELECT 1 FROM "Listing" l WHERE l.id = "listingId" AND l."profileId" = public.giq_current_profile_id()))
) WITH CHECK (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND EXISTS (SELECT 1 FROM "Listing" l WHERE l.id = "listingId" AND l."profileId" = public.giq_current_profile_id()))
);
CREATE POLICY giq_listing_attr_select ON "ListingAttribute" FOR SELECT USING (
  public.giq_is_moderator()
  OR EXISTS (SELECT 1 FROM "Listing" l WHERE l.id = "listingId")
);
CREATE POLICY giq_listing_attr_write ON "ListingAttribute" FOR ALL USING (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND EXISTS (SELECT 1 FROM "Listing" l WHERE l.id = "listingId" AND l."profileId" = public.giq_current_profile_id()))
) WITH CHECK (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND EXISTS (SELECT 1 FROM "Listing" l WHERE l.id = "listingId" AND l."profileId" = public.giq_current_profile_id()))
);
CREATE POLICY giq_listing_history_select ON "ListingStatusHistory" FOR SELECT USING (
  public.giq_is_moderator()
  OR "actorProfileId" = public.giq_current_profile_id()
  OR EXISTS (SELECT 1 FROM "Listing" l WHERE l.id = "listingId" AND l."profileId" = public.giq_current_profile_id())
);
CREATE POLICY giq_listing_history_insert ON "ListingStatusHistory" FOR INSERT WITH CHECK (
  public.giq_is_moderator() OR (public.giq_is_pro() AND "actorProfileId" = public.giq_current_profile_id())
);
CREATE POLICY giq_saved_listing_select ON "SavedListing" FOR SELECT USING ("profileId" = public.giq_current_profile_id());
CREATE POLICY giq_saved_listing_insert ON "SavedListing" FOR INSERT WITH CHECK ("profileId" = public.giq_current_profile_id());
CREATE POLICY giq_saved_listing_delete ON "SavedListing" FOR DELETE USING ("profileId" = public.giq_current_profile_id());
CREATE POLICY giq_listing_enquiry_select ON "ListingEnquiry" FOR SELECT USING (
  public.giq_is_moderator()
  OR "fromProfileId" = public.giq_current_profile_id()
  OR "toProfileId" = public.giq_current_profile_id()
);
CREATE POLICY giq_listing_enquiry_insert ON "ListingEnquiry" FOR INSERT WITH CHECK (
  public.giq_is_pro() AND "fromProfileId" = public.giq_current_profile_id()
);
CREATE POLICY giq_listing_media_select ON "ListingMedia" FOR SELECT USING (
  public.giq_is_moderator()
  OR EXISTS (SELECT 1 FROM "Listing" l WHERE l.id = "listingId")
);
CREATE POLICY giq_listing_media_write ON "ListingMedia" FOR ALL USING (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND EXISTS (SELECT 1 FROM "Listing" l WHERE l.id = "listingId" AND l."profileId" = public.giq_current_profile_id()))
) WITH CHECK (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND EXISTS (SELECT 1 FROM "Listing" l WHERE l.id = "listingId" AND l."profileId" = public.giq_current_profile_id()))
);
CREATE POLICY giq_listing_search_read ON "ListingSearchIndex" FOR SELECT USING (true);
CREATE POLICY giq_listing_search_write ON "ListingSearchIndex" FOR ALL USING (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND EXISTS (SELECT 1 FROM "Listing" l WHERE l.id = "listingId" AND l."profileId" = public.giq_current_profile_id()))
) WITH CHECK (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND EXISTS (SELECT 1 FROM "Listing" l WHERE l.id = "listingId" AND l."profileId" = public.giq_current_profile_id()))
);

ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageMedia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageDeliveryReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageReadReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPresence" ENABLE ROW LEVEL SECURITY;

CREATE POLICY giq_conversation_select ON "Conversation" FOR SELECT USING (
  public.giq_is_moderator()
  OR "participantAId" = public.giq_current_profile_id()
  OR "participantBId" = public.giq_current_profile_id()
);
CREATE POLICY giq_conversation_insert ON "Conversation" FOR INSERT WITH CHECK (
  public.giq_is_pro()
  AND (public.giq_current_profile_id() IN ("participantAId", "participantBId"))
);
CREATE POLICY giq_conversation_update ON "Conversation" FOR UPDATE USING (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND "participantAId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND "participantBId" = public.giq_current_profile_id())
) WITH CHECK (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND "participantAId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND "participantBId" = public.giq_current_profile_id())
);
CREATE POLICY giq_conversation_participant_select ON "ConversationParticipant" FOR SELECT USING (
  "profileId" = public.giq_current_profile_id()
  OR public.giq_is_moderator()
  OR EXISTS (
    SELECT 1 FROM "Conversation" c
    WHERE c.id = "conversationId"
      AND public.giq_current_profile_id() IN (c."participantAId", c."participantBId")
  )
);
CREATE POLICY giq_conversation_participant_write ON "ConversationParticipant" FOR ALL USING (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND EXISTS (
    SELECT 1 FROM "Conversation" c
    WHERE c.id = "conversationId"
      AND public.giq_current_profile_id() IN (c."participantAId", c."participantBId")
  ))
) WITH CHECK (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND EXISTS (
    SELECT 1 FROM "Conversation" c
    WHERE c.id = "conversationId"
      AND public.giq_current_profile_id() IN (c."participantAId", c."participantBId")
  ))
);
CREATE POLICY giq_message_select ON "Message" FOR SELECT USING (
  public.giq_is_moderator()
  OR "senderId" = public.giq_current_profile_id()
  OR "recipientId" = public.giq_current_profile_id()
);
CREATE POLICY giq_message_insert ON "Message" FOR INSERT WITH CHECK (public.giq_is_pro() AND "senderId" = public.giq_current_profile_id());
CREATE POLICY giq_message_update ON "Message" FOR UPDATE USING (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND "senderId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND "recipientId" = public.giq_current_profile_id())
) WITH CHECK (
  public.giq_is_moderator()
  OR (public.giq_is_pro() AND "senderId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND "recipientId" = public.giq_current_profile_id())
);
CREATE POLICY giq_message_media_select ON "MessageMedia" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Message" m WHERE m.id = "messageId")
);
CREATE POLICY giq_message_media_write ON "MessageMedia" FOR ALL USING (
  public.giq_is_pro() AND EXISTS (SELECT 1 FROM "Message" m WHERE m.id = "messageId")
) WITH CHECK (
  public.giq_is_pro() AND EXISTS (SELECT 1 FROM "Message" m WHERE m.id = "messageId")
);
CREATE POLICY giq_message_delivery_select ON "MessageDeliveryReceipt" FOR SELECT USING ("profileId" = public.giq_current_profile_id() OR public.giq_is_moderator());
CREATE POLICY giq_message_delivery_write ON "MessageDeliveryReceipt" FOR ALL USING (public.giq_is_moderator() OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())) WITH CHECK (public.giq_is_moderator() OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id()));
CREATE POLICY giq_message_read_select ON "MessageReadReceipt" FOR SELECT USING ("profileId" = public.giq_current_profile_id() OR public.giq_is_moderator());
CREATE POLICY giq_message_read_write ON "MessageReadReceipt" FOR ALL USING (public.giq_is_moderator() OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())) WITH CHECK (public.giq_is_moderator() OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id()));
CREATE POLICY giq_message_reaction_select ON "MessageReaction" FOR SELECT USING ("profileId" = public.giq_current_profile_id() OR public.giq_is_moderator());
CREATE POLICY giq_message_reaction_write ON "MessageReaction" FOR ALL USING (public.giq_is_moderator() OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())) WITH CHECK (public.giq_is_moderator() OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id()));
CREATE POLICY giq_user_block_access ON "UserBlock" FOR ALL USING ("blockerProfileId" = public.giq_current_profile_id() OR public.giq_is_moderator()) WITH CHECK ("blockerProfileId" = public.giq_current_profile_id() OR public.giq_is_moderator());
CREATE POLICY giq_user_presence_access ON "UserPresence" FOR ALL USING ("profileId" = public.giq_current_profile_id() OR public.giq_is_moderator()) WITH CHECK ("profileId" = public.giq_current_profile_id() OR public.giq_is_moderator());

ALTER TABLE "FeedTopic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedPostMedia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedReaction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY giq_feed_topic_read ON "FeedTopic" FOR SELECT USING (true);
CREATE POLICY giq_feed_topic_write ON "FeedTopic" FOR ALL USING (public.giq_is_moderator()) WITH CHECK (public.giq_is_moderator());
CREATE POLICY giq_feed_post_select ON "FeedPost" FOR SELECT USING (
  public.giq_is_moderator()
  OR "authorProfileId" = public.giq_current_profile_id()
  OR (status = 'active' AND visibility = 'public')
);
CREATE POLICY giq_feed_post_insert ON "FeedPost" FOR INSERT WITH CHECK (public.giq_is_pro() AND "authorProfileId" = public.giq_current_profile_id());
CREATE POLICY giq_feed_post_update ON "FeedPost" FOR UPDATE USING (public.giq_is_moderator() OR (public.giq_is_pro() AND "authorProfileId" = public.giq_current_profile_id())) WITH CHECK (public.giq_is_moderator() OR (public.giq_is_pro() AND "authorProfileId" = public.giq_current_profile_id()));
CREATE POLICY giq_feed_post_media_select ON "FeedPostMedia" FOR SELECT USING (EXISTS (SELECT 1 FROM "FeedPost" p WHERE p.id = "postId"));
CREATE POLICY giq_feed_post_media_write ON "FeedPostMedia" FOR ALL USING (EXISTS (SELECT 1 FROM "FeedPost" p WHERE p.id = "postId" AND (public.giq_is_moderator() OR (public.giq_is_pro() AND p."authorProfileId" = public.giq_current_profile_id())))) WITH CHECK (EXISTS (SELECT 1 FROM "FeedPost" p WHERE p.id = "postId" AND (public.giq_is_moderator() OR (public.giq_is_pro() AND p."authorProfileId" = public.giq_current_profile_id()))));
CREATE POLICY giq_feed_comment_select ON "FeedComment" FOR SELECT USING (
  public.giq_is_moderator()
  OR "authorProfileId" = public.giq_current_profile_id()
  OR status = 'active'
);
CREATE POLICY giq_feed_comment_insert ON "FeedComment" FOR INSERT WITH CHECK (public.giq_is_pro() AND "authorProfileId" = public.giq_current_profile_id());
CREATE POLICY giq_feed_comment_update ON "FeedComment" FOR UPDATE USING (public.giq_is_moderator() OR (public.giq_is_pro() AND "authorProfileId" = public.giq_current_profile_id())) WITH CHECK (public.giq_is_moderator() OR (public.giq_is_pro() AND "authorProfileId" = public.giq_current_profile_id()));
CREATE POLICY giq_feed_reaction_select ON "FeedReaction" FOR SELECT USING (true);
CREATE POLICY giq_feed_reaction_insert ON "FeedReaction" FOR INSERT WITH CHECK (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id());
CREATE POLICY giq_feed_reaction_delete ON "FeedReaction" FOR DELETE USING (public.giq_is_moderator() OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id()));

ALTER TABLE "CallRoom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallPermission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY giq_call_room_select ON "CallRoom" FOR SELECT USING (
  public.giq_is_moderator()
  OR "createdByProfileId" = public.giq_current_profile_id()
  OR EXISTS (SELECT 1 FROM "CallParticipant" p WHERE p."callRoomId" = id AND p."profileId" = public.giq_current_profile_id())
  OR EXISTS (SELECT 1 FROM "CallPermission" p WHERE p."callRoomId" = id AND p."profileId" = public.giq_current_profile_id())
);
CREATE POLICY giq_call_room_insert ON "CallRoom" FOR INSERT WITH CHECK (
  public.giq_is_pro() AND "createdByProfileId" = public.giq_current_profile_id()
);
CREATE POLICY giq_call_room_update ON "CallRoom" FOR UPDATE USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "createdByProfileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND EXISTS (SELECT 1 FROM "CallPermission" p WHERE p."callRoomId" = id AND p."profileId" = public.giq_current_profile_id() AND p."canJoin" = true))
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "createdByProfileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND EXISTS (SELECT 1 FROM "CallPermission" p WHERE p."callRoomId" = id AND p."profileId" = public.giq_current_profile_id() AND p."canJoin" = true))
);
CREATE POLICY giq_call_participant_access ON "CallParticipant" FOR ALL USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND EXISTS (
    SELECT 1 FROM "CallRoom" r
    WHERE r.id = "callRoomId" AND r."createdByProfileId" = public.giq_current_profile_id()
  ))
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND EXISTS (
    SELECT 1 FROM "CallRoom" r
    WHERE r.id = "callRoomId" AND r."createdByProfileId" = public.giq_current_profile_id()
  ))
);
CREATE POLICY giq_call_invite_access ON "CallInvite" FOR ALL USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "fromProfileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND "toProfileId" = public.giq_current_profile_id())
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "fromProfileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND "toProfileId" = public.giq_current_profile_id())
);
CREATE POLICY giq_call_event_access ON "CallEvent" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator() OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
);
CREATE POLICY giq_call_report_access ON "CallReport" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator() OR (public.giq_is_pro() AND "reporterProfileId" = public.giq_current_profile_id())
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR (public.giq_is_pro() AND "reporterProfileId" = public.giq_current_profile_id())
);
CREATE POLICY giq_call_permission_access ON "CallPermission" FOR ALL USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND EXISTS (
    SELECT 1 FROM "CallRoom" r
    WHERE r.id = "callRoomId" AND r."createdByProfileId" = public.giq_current_profile_id()
  ))
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND EXISTS (
    SELECT 1 FROM "CallRoom" r
    WHERE r.id = "callRoomId" AND r."createdByProfileId" = public.giq_current_profile_id()
  ))
);

ALTER TABLE "MediaAsset" ENABLE ROW LEVEL SECURITY;
CREATE POLICY giq_media_select ON "MediaAsset" FOR SELECT USING (
  public.giq_is_moderator()
  OR "uploaderId" = public.giq_current_user_id()
  OR "storageBucket" IN ('site-assets', 'public-user-media')
);
CREATE POLICY giq_media_insert ON "MediaAsset" FOR INSERT WITH CHECK (
  public.giq_is_system() OR "uploaderId" = public.giq_current_user_id()
);
CREATE POLICY giq_media_update ON "MediaAsset" FOR UPDATE USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "uploaderId" = public.giq_current_user_id()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR "uploaderId" = public.giq_current_user_id()
);
CREATE POLICY giq_media_delete ON "MediaAsset" FOR DELETE USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "uploaderId" = public.giq_current_user_id()
);

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY giq_notification_access ON "Notification" FOR ALL USING ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator());

ALTER TABLE "Plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceCatalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanEntitlement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY giq_plan_read ON "Plan" FOR SELECT USING (true);
CREATE POLICY giq_price_catalog_read ON "PriceCatalog" FOR SELECT USING (true);
CREATE POLICY giq_plan_entitlement_read ON "PlanEntitlement" FOR SELECT USING (true);
CREATE POLICY giq_plan_write ON "Plan" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_price_catalog_write ON "PriceCatalog" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_plan_entitlement_write ON "PlanEntitlement" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());

ALTER TABLE "BillingCustomer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EntitlementSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefundRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditNoteRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageOutbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageAggregate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY giq_billing_customer_read ON "BillingCustomer" FOR SELECT USING ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_billing_customer_write ON "BillingCustomer" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_subscription_read ON "Subscription" FOR SELECT USING ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_subscription_write ON "Subscription" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_entitlement_snapshot_read ON "EntitlementSnapshot" FOR SELECT USING ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_entitlement_snapshot_write ON "EntitlementSnapshot" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_invoice_read ON "InvoiceRecord" FOR SELECT USING ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_invoice_write ON "InvoiceRecord" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_payment_read ON "PaymentRecord" FOR SELECT USING ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_payment_write ON "PaymentRecord" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_refund_read ON "RefundRecord" FOR SELECT USING ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_refund_write ON "RefundRecord" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_credit_note_read ON "CreditNoteRecord" FOR SELECT USING ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_credit_note_write ON "CreditNoteRecord" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_billing_event_read ON "BillingEvent" FOR SELECT USING ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_billing_event_write ON "BillingEvent" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_usage_event_read ON "UsageEvent" FOR SELECT USING ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_usage_event_write ON "UsageEvent" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_usage_outbox_read ON "UsageOutbox" FOR SELECT USING ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_usage_outbox_write ON "UsageOutbox" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_usage_aggregate_read ON "UsageAggregate" FOR SELECT USING ("userId" = public.giq_current_user_id() OR public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_usage_aggregate_write ON "UsageAggregate" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_webhook_event_system ON "WebhookEvent" FOR ALL USING (public.giq_is_system() OR public.giq_is_moderator()) WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY giq_audit_log_select ON "AuditLog" FOR SELECT USING (public.giq_is_system() OR public.giq_is_moderator() OR "actorId" = public.giq_current_user_id());
CREATE POLICY giq_audit_log_insert ON "AuditLog" FOR INSERT WITH CHECK (true);

ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY giq_rate_limit_all ON "RateLimit" FOR ALL USING (true) WITH CHECK (true);
