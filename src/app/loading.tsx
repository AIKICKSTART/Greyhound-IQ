export default function Loading() {
  return (
    <div className="fade-in mx-auto max-w-7xl px-6 py-20">
      <div className="animate-pulse space-y-6">
        <div className="h-12 w-3/4 rounded-lg bg-white/[0.04]" />
        <div className="h-6 w-1/2 rounded-lg bg-white/[0.04]" />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-white/[0.02] border border-white/[0.04]" />
          ))}
        </div>
      </div>
    </div>
  );
}
