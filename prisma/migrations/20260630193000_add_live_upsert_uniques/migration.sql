CREATE UNIQUE INDEX "Meeting_trackId_meetingDate_key" ON "Meeting"("trackId", "meetingDate");
CREATE UNIQUE INDEX "Race_meetingId_raceNumber_key" ON "Race"("meetingId", "raceNumber");
CREATE UNIQUE INDEX "Runner_raceId_boxNumber_key" ON "Runner"("raceId", "boxNumber");
