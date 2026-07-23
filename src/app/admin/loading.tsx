export default function AdminLoading() {
  return (
    <main
      className="mx-auto max-w-6xl animate-pulse px-4 py-7 sm:px-6 sm:py-10 lg:px-10"
      aria-label="Loading admin control centre"
      aria-busy="true"
    >
      <div className="mb-7 h-12 w-full max-w-xl rounded-2xl bg-white/[0.07]" />
      <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="giq-panel h-32 bg-white/[0.025]" />
        ))}
      </div>
      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="giq-panel h-28 bg-white/[0.025]" />
        ))}
      </div>
      <span className="sr-only">Loading protected operator data</span>
    </main>
  );
}
