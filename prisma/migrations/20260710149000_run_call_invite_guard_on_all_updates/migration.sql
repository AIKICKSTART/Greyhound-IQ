-- The response guard also validates status and expiry, so it must run for
-- every invite update rather than only identity-column updates.
DROP TRIGGER IF EXISTS giq_call_invite_identity_immutable ON public."CallInvite";
CREATE TRIGGER giq_call_invite_identity_immutable
BEFORE UPDATE ON public."CallInvite"
FOR EACH ROW EXECUTE FUNCTION public.giq_call_invite_identity_guard();
