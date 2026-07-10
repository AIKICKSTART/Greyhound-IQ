export function extractMentionHandles(body: string) {
  return [
    ...new Set(
      [...body.matchAll(/(^|[^\w])@([a-z0-9][a-z0-9_-]{1,39})/gi)].map(
        (match) => match[2].toLowerCase()
      )
    ),
  ];
}
