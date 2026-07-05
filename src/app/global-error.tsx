"use client";

// Catches root-layout crashes, so it replaces the root layout entirely: app
// CSS (Tailwind, tokens) is not loaded here. Inline styles only.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0e0d13",
          color: "#f0eff4",
        }}
      >
        <div style={{ maxWidth: 420, padding: "0 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
            Something went wrong.
          </h1>
          <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 8 }}>
            Try again, or contact support if it keeps happening.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                opacity: 0.5,
                marginBottom: 0,
              }}
            >
              REF: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: "1px solid #6d5bd0",
              background: "#55418f",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
