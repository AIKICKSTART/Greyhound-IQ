import "server-only";

import { cookies } from "next/headers";
import type { DbContextUser } from "@/lib/db-context";
import {
  listCustomPagesForCurrentUser,
  resolveCustomPageMedia,
  type CustomPageMediaUrls,
} from "@/lib/custom-page-service";
import {
  ACTIVE_IDENTITY_COOKIE,
  resolveActiveIdentityCookie,
} from "@/lib/identity-cookie";

export {
  ACTIVE_IDENTITY_COOKIE,
  PERSONAL_IDENTITY,
} from "@/lib/identity-cookie";

// Active posting/acting identity for the member hub. Stored as a plain cookie
// holding "personal" or a CustomPage id — the value is NEVER trusted: every
// read re-validates against the pages the session actually owns and falls
// back to personal. Posting revalidates ownership again in feed-service.
export type OwnedPageIdentity = {
  id: string;
  pageType: string;
  handle: string;
  title: string;
  tagline: string | null;
  accentColor: string | null;
  published: boolean;
  media: CustomPageMediaUrls;
};

export type ActiveIdentity =
  | { kind: "personal" }
  | { kind: "page"; page: OwnedPageIdentity };

export async function getOwnedPageIdentities(
  current: DbContextUser
): Promise<OwnedPageIdentity[]> {
  const pages = await listCustomPagesForCurrentUser(current);
  return Promise.all(
    pages.map(async (page) => ({
      id: page.id,
      pageType: page.pageType,
      handle: page.handle,
      title: page.title,
      tagline: page.tagline,
      accentColor: page.accentColor,
      published: page.published,
      media: await resolveCustomPageMedia(
        page.contentJson,
        page.socialActor?.id ?? ""
      ),
    }))
  );
}

export async function getActiveIdentity(
  ownedPages: OwnedPageIdentity[]
): Promise<ActiveIdentity> {
  const store = await cookies();
  const value = store.get(ACTIVE_IDENTITY_COOKIE)?.value;
  return resolveActiveIdentityCookie(value, ownedPages);
}
