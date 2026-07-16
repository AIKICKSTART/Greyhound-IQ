type ReadTask = () => Promise<unknown>;
type ReadResults<T extends readonly ReadTask[]> = {
  [K in keyof T]: T[K] extends () => Promise<infer R> ? R : never;
};

export async function runFeedReadTasks<const T extends readonly ReadTask[]>(
  tasks: T,
  sequential: boolean
): Promise<ReadResults<T>> {
  if (!sequential) {
    return Promise.all(tasks.map((task) => task())) as Promise<ReadResults<T>>;
  }

  const results: unknown[] = [];
  for (const task of tasks) results.push(await task());
  return results as ReadResults<T>;
}
