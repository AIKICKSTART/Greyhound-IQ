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
  const originalApproval = process.env.THEDOGS_LICENSED_USE_APPROVED;
  try {
    let fetches = 0;
    delete process.env.THEDOGS_LICENSED_USE_APPROVED;
    await assert.rejects(
      new TheDogsDogProfileProvider(async () => {
        fetches += 1;
        return htmlResponse("not reached");
      }).fetchProfile("/dogs/44887/war-arrow"),
      /licensed_use_not_approved/,
    );
    assert.equal(fetches, 0);

    process.env.THEDOGS_LICENSED_USE_APPROVED = "true";
    await providerResponseBoundaryIsFailClosed();
    console.log("TheDogs profile identity guards passed");
  } finally {
    if (originalApproval === undefined) {
      delete process.env.THEDOGS_LICENSED_USE_APPROVED;
    } else {
      process.env.THEDOGS_LICENSED_USE_APPROVED = originalApproval;
    }
  }
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

  let fullFormRequest = "";
  assert.equal(
    await new TheDogsDogProfileProvider(async (input) => {
      fullFormRequest = String(input);
      return new Response("{}", {
        headers: { "content-type": "application/json" },
      });
    }).fetchFullForm(
      "/dogs/44887/war-arrow/full-form?page=1&profile=true",
    ),
    "{}",
  );
  assert.equal(
    fullFormRequest,
    "https://www.thedogs.com.au/dogs/44887/war-arrow/full-form?page=1&profile=true",
  );
  for (const invalidFullFormUrl of [
    "/dogs/44887/war-arrow/full-form",
    "/dogs/44887/war-arrow/full-form?profile=true&page=1",
    "/dogs/44887/war-arrow/full-form?page=2&profile=true",
    "/dogs/44887/war-arrow/full-form?page=1&profile=true&profile=true",
  ]) {
    await assert.rejects(
      new TheDogsDogProfileProvider(async () => htmlResponse("not reached"))
        .fetchFullForm(invalidFullFormUrl),
      /request_url_invalid/,
    );
  }
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
