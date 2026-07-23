\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

\if :{?GIQ_SNAPSHOT_EXPORT}
\else
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '60min';
SET LOCAL lock_timeout = '5s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle = 'ISO, YMD';
SET LOCAL extra_float_digits = 3;
\endif

\copy (SELECT (to_jsonb(track) || jsonb_build_object('name', CASE WHEN lower(btrim(track.name)) IN ('meadows', 'the meadows') THEN 'The Meadows' WHEN lower(btrim(track.name)) IN ('palmerston - north', 'palmerston north') THEN 'Palmerston North' ELSE btrim(track.name) END, 'state', CASE WHEN lower(btrim(track.name)) = 'canberra' THEN 'ACT' WHEN lower(btrim(track.name)) IN ('ashburton', 'auckland', 'cambridge', 'christchurch', 'manawatu', 'manukau', 'otago', 'palmerston - north', 'palmerston north', 'southland', 'taranaki', 'tokoroa', 'waikato', 'wanganui', 'wellington') THEN 'NZ' ELSE upper(btrim(track.state)) END))::text FROM public."Track" track WHERE lower(btrim(track.name)) <> 'greyhoundiq demo park' ORDER BY track.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/Track.copy.gz'

\copy (SELECT to_jsonb(trainer)::text FROM public."Trainer" trainer ORDER BY trainer.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/Trainer.copy.gz'

\copy (SELECT jsonb_build_object('candidateTrainerId', identity.candidate_trainer_id, 'identityKind', identity.identity_kind, 'identityValue', identity.identity_value)::text FROM (SELECT normalized.target_id AS candidate_trainer_id, 'r2-source-trainer-id'::text AS identity_kind, map.source_id AS identity_value FROM _giq_history_stage.trainer_map map JOIN _giq_history_stage.normalized_trainer normalized ON normalized.natural_key = map.natural_key WHERE map.source_name = 'r2' UNION SELECT normalized.target_id, 'thedogs-provider-id', normalized.source_id FROM _giq_history_stage.normalized_trainer normalized WHERE lower(normalized.source_provider) = 'thedogs' AND nullif(btrim(normalized.source_id), '') IS NOT NULL UNION SELECT runner."trainerId", 'thedogs-provider-id', _giq_history_merge.try_jsonb(runner."sourceRawJson")->>'trainerId' FROM public."Runner" runner WHERE lower(coalesce(runner."sourceProvider", '')) = 'thedogs' AND runner."trainerId" IS NOT NULL AND nullif(_giq_history_merge.try_jsonb(runner."sourceRawJson")->>'trainerId', '') IS NOT NULL) identity ORDER BY identity.candidate_trainer_id, identity.identity_kind, identity.identity_value) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/TrainerIdentityCrosswalk.copy.gz'

\copy (SELECT ((to_jsonb(dog) - 'profileSourceRawJson') || jsonb_build_object('profileUrl', CASE WHEN dog."profileUrl" ~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)' THEN NULL ELSE dog."profileUrl" END))::text FROM public."Dog" dog ORDER BY dog.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/Dog.copy.gz'

\copy (SELECT (to_jsonb(meeting) - 'sourceRawJson')::text FROM public."Meeting" meeting JOIN public."Track" track ON track.id = meeting."trackId" WHERE lower(btrim(track.name)) <> 'greyhoundiq demo park' AND lower(coalesce(meeting."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') ORDER BY meeting.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/Meeting.copy.gz'

\copy (SELECT ((to_jsonb(race) - 'sourceRawJson') || jsonb_build_object('replayUrl', CASE WHEN race."replayUrl" ~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)' THEN NULL ELSE race."replayUrl" END, 'photoFinishUrl', CASE WHEN race."photoFinishUrl" ~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)' THEN NULL ELSE race."photoFinishUrl" END))::text FROM public."Race" race JOIN public."Meeting" meeting ON meeting.id = race."meetingId" JOIN public."Track" track ON track.id = meeting."trackId" WHERE lower(btrim(track.name)) <> 'greyhoundiq demo park' AND lower(coalesce(meeting."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') AND lower(coalesce(race."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') ORDER BY race.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/Race.copy.gz'

\copy (SELECT ((to_jsonb(video) - 'sourceRawJson' - 'streamUrl') || jsonb_build_object('pageUrl', CASE WHEN video."pageUrl" ~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)' THEN NULL ELSE video."pageUrl" END))::text FROM public."RaceVideo" video JOIN public."Race" race ON race.id = video."raceId" JOIN public."Meeting" meeting ON meeting.id = race."meetingId" JOIN public."Track" track ON track.id = meeting."trackId" WHERE lower(btrim(track.name)) <> 'greyhoundiq demo park' AND lower(coalesce(meeting."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') AND lower(coalesce(race."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') AND lower(video."sourceProvider") NOT IN ('demo', 'greyhoundiq-demo') ORDER BY video.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/RaceVideo.copy.gz'

\copy (SELECT (to_jsonb(runner) - 'sourceRawJson')::text FROM public."Runner" runner JOIN public."Race" race ON race.id = runner."raceId" JOIN public."Meeting" meeting ON meeting.id = race."meetingId" JOIN public."Track" track ON track.id = meeting."trackId" WHERE lower(btrim(track.name)) <> 'greyhoundiq demo park' AND lower(coalesce(meeting."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') AND lower(coalesce(race."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') AND lower(coalesce(runner."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') ORDER BY runner.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/Runner.copy.gz'

\copy (SELECT (to_jsonb(result) - 'sourceRawJson')::text FROM public."Result" result JOIN public."Runner" runner ON runner.id = result."runnerId" JOIN public."Race" race ON race.id = runner."raceId" JOIN public."Meeting" meeting ON meeting.id = race."meetingId" JOIN public."Track" track ON track.id = meeting."trackId" WHERE lower(btrim(track.name)) <> 'greyhoundiq demo park' AND lower(coalesce(meeting."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') AND lower(coalesce(race."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') AND lower(coalesce(runner."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') AND lower(coalesce(result."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') ORDER BY result.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/Result.copy.gz'

\copy (SELECT to_jsonb(form)::text FROM public."FormEntry" form JOIN public."Race" race ON race.id = form."raceId" JOIN public."Meeting" meeting ON meeting.id = race."meetingId" JOIN public."Track" track ON track.id = meeting."trackId" WHERE lower(btrim(track.name)) <> 'greyhoundiq demo park' AND lower(coalesce(meeting."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') AND lower(coalesce(race."sourceProvider", '')) NOT IN ('demo', 'greyhoundiq-demo') ORDER BY form.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/FormEntry.copy.gz'

\copy (SELECT (to_jsonb(form) - 'sourceRawJson')::text FROM public."DogProfileForm" form WHERE form."raceUrl" ~ '^/racing/[^?#]+/?$' AND form."raceUrl" !~* '^/(dogs?|greyhounds?|profiles?)(/|[?#]|$)' AND form."raceUrl" !~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)' ORDER BY form.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/DogProfileForm.copy.gz'

\copy (SELECT jsonb_build_object('issueType', 'profile-form-dog-url-excluded', 'reasonCode', 'excluded-dog-profile-url', 'sourceDisposition', resolution.disposition, 'sourceProvider', 'thedogs', 'sourceIdentitySha256', encode(sha256(convert_to(resolution.source_file || ':' || resolution.line_number::text, 'UTF8')), 'hex'), 'observedDate', resolution.payload->>'date', 'trackCode', resolution.payload->>'trackCode', 'trackName', resolution.payload->>'trackName')::text FROM _giq_history_stage.profile_form_resolution resolution WHERE resolution.url_class = 'dog-url-recovery-only' ORDER BY resolution.source_file, resolution.line_number) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/unresolved-identities.copy.gz'

\copy (SELECT ((to_jsonb(archive) - 'candidateJson' - 'parsedJson' - 'profileHtml' - 'fullFormHtml') || jsonb_build_object('profileUrl', CASE WHEN archive."profileUrl" ~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)' THEN NULL ELSE archive."profileUrl" END, 'showMorePath', CASE WHEN archive."showMorePath" ~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)' THEN NULL ELSE archive."showMorePath" END))::text FROM public."DogProfileArchive" archive WHERE archive."dogId" IS NOT NULL ORDER BY archive.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/DogProfileArchive.copy.gz'

\copy (SELECT ((to_jsonb(archive) - 'rawPath' - 'rawJson') || jsonb_build_object('rawPath', NULL, 'rawJson', jsonb_build_object('payloadCopied', false, 'sourceProvider', archive."sourceProvider", 'sourceDate', archive.date)::text))::text FROM public."RaceDayArchive" archive WHERE lower(archive."sourceProvider") NOT IN ('demo', 'greyhoundiq-demo') ORDER BY archive.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/RaceDayArchive.copy.gz'

\copy (SELECT ((to_jsonb(run) - 'artifactUri') || jsonb_build_object('artifactUri', 'sha256:' || run."artifactSha256"))::text FROM public."PedigreeImportRun" run ORDER BY run.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/PedigreeImportRun.copy.gz'

\copy (SELECT to_jsonb(identity)::text FROM public."DogSourceIdentity" identity ORDER BY identity.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/DogSourceIdentity.copy.gz'

\copy (SELECT to_jsonb(assertion)::text FROM public."PedigreeAssertion" assertion ORDER BY assertion.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/PedigreeAssertion.copy.gz'

\copy (SELECT to_jsonb(ledger)::text FROM public."PedigreeMergeLedger" ledger ORDER BY ledger.id) TO PROGRAM 'gzip -n > /tmp/giq-normalized-local-copy/data/PedigreeMergeLedger.copy.gz'

\if :{?GIQ_SNAPSHOT_EXPORT}
\else
COMMIT;
\endif
