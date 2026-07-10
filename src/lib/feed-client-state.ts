type FeedClientItem = { id: string; feedEntryId?: string };

export function mergeFeedItems<T extends FeedClientItem>(
  current: T[],
  head: T[],
  changedId?: string,
  changedItem?: T | null
) {
  const mergedHead = mergeChangedItem(head, changedId, changedItem);
  const headIds = new Set(mergedHead.map(feedEntryKey));
  const tail = mergeChangedItem(
    current.filter((item) => !headIds.has(feedEntryKey(item))),
    changedId,
    changedItem
  );
  return [...mergedHead, ...tail];
}

function mergeChangedItem<T extends FeedClientItem>(
  items: T[],
  changedId?: string,
  changedItem?: T | null
) {
  return items.flatMap((item) => {
    if (
      !changedId ||
      item.id !== changedId ||
      (item.feedEntryId && item.feedEntryId !== `post:${changedId}`)
    ) return [item];
    if (changedItem === null) return [];
    return [changedItem ?? item];
  });
}

function feedEntryKey(item: FeedClientItem) {
  return item.feedEntryId ?? `post:${item.id}`;
}
