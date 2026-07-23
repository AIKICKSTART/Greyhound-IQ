-- Private message media stays owner-only unless the current profile is a
-- visible sender/recipient of the attached message. The ownership check stops
-- a forged MessageMedia row from granting access to another user's upload.
ALTER POLICY giq_media_select
ON public."MediaAsset"
USING (
  public.giq_is_moderator()
  OR "uploaderId" = public.giq_current_user_id()
  OR "storageBucket" IN ('site-assets', 'public-user-media')
  OR EXISTS (
    SELECT 1
    FROM public."MessageMedia" attachment
    JOIN public."Message" message ON message.id = attachment."messageId"
    WHERE attachment."mediaId" = "MediaAsset".id
      AND public.giq_media_owned_by_actor(message."senderActorId", "MediaAsset".id)
      AND (
        (message."senderId" = public.giq_current_profile_id()
          AND message."deletedBySenderAt" IS NULL)
        OR (message."recipientId" = public.giq_current_profile_id()
          AND message."deletedByRecipientAt" IS NULL)
      )
  )
);
