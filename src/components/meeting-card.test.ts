import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MeetingCard } from "./meeting-card";

function renderMeeting(trackName: string) {
  return renderToStaticMarkup(
    createElement(MeetingCard, {
      meeting: {
        id: "meeting-1",
        meetingDate: new Date("2099-01-01T09:00:00Z"),
        track: {
          id: "track-1",
          name: trackName,
          state: "NSW",
          hasIsolynx: false,
        },
        races: [],
      },
    })
  );
}

const mappedTrack = renderMeeting("Wentworth Park");
assert.match(mappedTrack, /images%2Ftracks%2Fwentworth-park%2Fmaster\.webp/);
assert.doesNotMatch(mappedTrack, /Track image unavailable/);

const unmappedTrack = renderMeeting("Unknown Park");
assert.match(unmappedTrack, /Track image unavailable/);
assert.doesNotMatch(unmappedTrack, /<img/);

console.log("meeting card track image tests passed");
