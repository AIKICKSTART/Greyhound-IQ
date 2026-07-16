import assert from "node:assert/strict";
import {
  parseTheDogsDogProfile,
  TheDogsDogProfileProvider,
} from "./thedogs-profile";

const profile = parseTheDogsDogProfile(
  `<div class="dog-statistics__name">War Arrow</div>
   <div class="general-information">
     <div class="general-information-cell">
       <div class="cell--heading">BREEDING</div>
       <div>S: <a href="/dogs/44887/war-arrow">War Arrow</a></div>
       <div>D: <a href="/dogs/44887/war-arrow">War Arrow</a></div>
     </div>
   </div>
   <table>
     <tr>${formRow("/racing/temora/2008-10-19/1/valid-race?trial=false", 1)}</tr>
     <tr>${formRow("/racing/temora/2008-10-19/3?trial=false", 2)}</tr>
     <tr>${formRow("/dogs/44887/war-arrow", 3)}</tr>
   </table>`,
  "44887",
  "/dogs/44887/war-arrow"
);

assert.equal(profile.sire, undefined, "a dog cannot be its own sire");
assert.equal(profile.dam, undefined, "a dog cannot be its own dam");
assert.deepEqual(
  profile.formRows.map((row) => row.raceUrl),
  [
    "/racing/temora/2008-10-19/1/valid-race?trial=false",
    "/racing/temora/2008-10-19/3/?trial=false",
  ],
  "only provider race paths may become profile-form race identities"
);

async function main() {
  await providerResponseBoundaryIsFailClosed();
  console.log("TheDogs profile identity guards passed");
}

async function providerResponseBoundaryIsFailClosed() {
  let redirect: RequestRedirect | undefined;
  const provider = new TheDogsDogProfileProvider(async (_input, init) => {
    redirect = init?.redirect;
    return htmlResponse("<html>profile</html>");
  });
  assert.equal(
    await provider.fetchProfile("/dogs/44887/war-arrow"),
    "<html>profile</html>",
  );
  assert.equal(redirect, "error");

  await assert.rejects(
    provider.fetchProfile("https://example.invalid/dogs/44887/war-arrow"),
    /request_url_invalid/,
  );
  await assert.rejects(
    new TheDogsDogProfileProvider(async () =>
      new Response("profile", { headers: { "content-type": "text/plain" } })
    ).fetchProfile("/dogs/44887/war-arrow"),
    /invalid_content_type/,
  );
  await assert.rejects(
    new TheDogsDogProfileProvider(async () =>
      new Response("profile", {
        headers: {
          "content-length": `${5 * 1024 * 1024 + 1}`,
          "content-type": "text/html",
        },
      })
    ).fetchProfile("/dogs/44887/war-arrow"),
    /too_large/,
  );

  const wrongFinalUrl = htmlResponse("profile");
  Object.defineProperty(wrongFinalUrl, "url", {
    value: "https://example.invalid/dogs/44887/war-arrow",
  });
  await assert.rejects(
    new TheDogsDogProfileProvider(async () => wrongFinalUrl).fetchProfile(
      "/dogs/44887/war-arrow",
    ),
    /response_url_mismatch/,
  );

  assert.equal(
    await new TheDogsDogProfileProvider(async () =>
      new Response("{}", { headers: { "content-type": "application/json" } })
    ).fetchFullForm("/dogs/44887/war-arrow/full-form"),
    "{}",
  );
}

function htmlResponse(body: string) {
  return new Response(body, { headers: { "content-type": "text/html" } });
}

function formRow(href: string, timestampOffset: number) {
  return `<td class="runner-form__finish-position">1st/8</td>
    <td class="runner-form__date">
      <a href="${href}">
        <formatted-time data-timestamp="${1_700_000_000 + timestampOffset}">date</formatted-time>
      </a>
    </td>
    <td class="runner-form__track">TEMA</td>`;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
