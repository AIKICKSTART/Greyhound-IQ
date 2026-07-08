import { AdminPageHeader } from "@/app/admin/admin-page-header";
import {
  createFeedTopic,
  moderateFeedPost,
  setFeedTopicActive,
} from "@/app/actions";
import { requireModeratorProfile } from "@/lib/auth";
import {
  getFeedAdminPosts,
  getFeedAdminTopics,
} from "@/lib/feed-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin feed moderation - GreyhoundIQ",
  description: "GreyhoundIQ feed topic and post moderation.",
};

export default async function AdminFeedPage() {
  await requireModeratorProfile();
  const [topics, posts] = await Promise.all([
    getFeedAdminTopics(),
    getFeedAdminPosts(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AdminPageHeader
        title="Feed moderation"
        description="Manage community topics, pinned posts, and public feed visibility."
      />

      <section className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="giq-panel p-5">
            <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
              New topic
            </h2>
            <form action={createFeedTopic} className="mt-4 space-y-3">
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="Topic name"
                className="giq-form-control w-full px-3 py-2 text-[13px]"
              />
              <input
                name="slug"
                maxLength={80}
                placeholder="slug optional"
                className="giq-form-control w-full px-3 py-2 text-[13px]"
              />
              <textarea
                name="rules"
                maxLength={2000}
                rows={4}
                placeholder="Topic rules optional"
                className="giq-form-control giq-textarea w-full px-3 py-2 text-[13px]"
              />
              <input
                name="sortOrder"
                type="number"
                min={0}
                max={9999}
                defaultValue={0}
                className="giq-form-control w-full px-3 py-2 text-[13px]"
              />
              <button className="giq-button giq-button-primary px-4 text-[13px]">
                Create topic
              </button>
            </form>
          </section>

          <section className="giq-panel p-5">
            <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
              Topics
            </h2>
            <div className="mt-4 space-y-3">
              {topics.length === 0 ? (
                <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                  No topics yet.
                </p>
              ) : (
                topics.map((topic) => (
                  <div key={topic.id} className="giq-subpanel p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
                          {topic.name}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-[hsl(var(--subtle-foreground))]">
                          {topic.slug} · {topic._count.posts} posts
                        </p>
                      </div>
                      <span className="giq-badge giq-badge-neutral">
                        {topic.active ? "Active" : "Hidden"}
                      </span>
                    </div>
                    {topic.rules ? (
                      <p className="mt-2 line-clamp-3 text-[12px] text-[hsl(var(--muted-foreground))]">
                        {topic.rules}
                      </p>
                    ) : null}
                    <form
                      action={setFeedTopicActive.bind(null, topic.id, !topic.active)}
                      className="mt-3"
                    >
                      <button className="giq-outline-action min-h-8 px-3 text-[12px]">
                        {topic.active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="giq-panel p-5">
          <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
            Latest posts
          </h2>
          <div className="giq-table-shell mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="giq-table-head">
                  <th className="px-4 py-3 text-left">Post</th>
                  <th className="px-4 py-3 text-left">Author</th>
                  <th className="px-4 py-3 text-left">Topic</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {posts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                    >
                      No posts found.
                    </td>
                  </tr>
                ) : (
                  posts.map((post) => (
                    <tr key={post.id} className="border-t border-white/[0.06]">
                      <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                        <p className="line-clamp-3 max-w-md">{post.body}</p>
                        <p className="mt-1 text-[11px] text-[hsl(var(--subtle-foreground))]">
                          {post._count.comments} comments · {post._count.reactions} reactions
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                        {post.author.displayName}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                        {post.topic?.name ?? "General"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                        {post.status}
                        {post.pinnedAt ? (
                          <span className="giq-badge giq-badge-gold ml-2">
                            Pinned
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                        {formatDateTime(post.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <PostModerationForm postId={post.id} pinned={Boolean(post.pinnedAt)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function PostModerationForm({
  postId,
  pinned,
}: {
  postId: string;
  pinned: boolean;
}) {
  return (
    <form action={moderateFeedPost.bind(null, postId)} className="min-w-[260px] space-y-2">
      <select
        name="action"
        defaultValue={pinned ? "unpin" : "pin"}
        className="giq-form-control w-full px-2 py-1 text-[12px]"
      >
        <option value="pin">Pin</option>
        <option value="unpin">Unpin</option>
        <option value="hide">Hide</option>
        <option value="remove">Remove</option>
        <option value="restore">Restore</option>
      </select>
      <input
        name="reason"
        maxLength={500}
        placeholder="Reason optional"
        className="giq-form-control w-full px-2 py-1 text-[12px]"
      />
      <button className="giq-button giq-button-glass px-3 text-[12px]">
        Apply
      </button>
    </form>
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
