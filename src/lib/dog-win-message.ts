// Pure winner-card notification copy. Kept free of "server-only"/DB imports so it
// is unit-testable by the zero-dep runner (dog-win-message.test.ts).

export type DogWinNotification = { title: string; body: string; href: string };

export function buildDogWinNotification(
  dogName: string,
  trackName: string | null,
  href: string
): DogWinNotification {
  const where = trackName ? ` at ${trackName}` : "";
  return {
    title: `🏆 ${dogName} won!`,
    body: `${dogName} finished 1st${where}. Generate a winner card to share the result.`,
    href,
  };
}
