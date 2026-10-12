"use client";

// Last line of defence: shown only if the root layout itself fails, so it cannot rely on the app's styles or fonts.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f0e4", color: "#1c1b2e" }}>
        <div role="alert" style={{ maxWidth: 480, margin: "15vh auto", padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Verdict could not load</h1>
          <p style={{ color: "#58566b" }}>
            Your data is safe in this browser. Please try again.{error.digest ? ` (Reference: ${error.digest})` : ""}
          </p>
          <button
            onClick={() => retry()}
            style={{ marginTop: 16, padding: "8px 16px", borderRadius: 6, border: "1.5px solid #1c1b2e", background: "#c93a20", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
