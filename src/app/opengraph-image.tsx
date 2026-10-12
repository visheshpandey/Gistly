import { ImageResponse } from "next/og";

// The picture shown when a link to InsightFlow is shared in chat apps and social media. Built at build time.
export const alt = "InsightFlow: AI-powered feedback intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const bars = [
    { label: "Fix first", width: 100, color: "#c93a20" },
    { label: "Then", width: 62, color: "#2f4fd8" },
    { label: "Later", width: 38, color: "#f2a81d" },
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#f6f0e4",
          color: "#1c1b2e",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#1c1b2e",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 6,
              padding: 14,
            }}
          >
            <div style={{ width: 9, height: 18, background: "#fff", borderRadius: 3 }} />
            <div style={{ width: 9, height: 28, background: "#fff", borderRadius: 3 }} />
            <div style={{ width: 9, height: 36, background: "#fff", borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>InsightFlow</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>AI-powered feedback intelligence.</div>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#2f4fd8" }}>From raw signal to ranked decisions.</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 760 }}>
          {bars.map((b) => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 130, fontSize: 24, color: "#58566b" }}>{b.label}</div>
              <div style={{ display: "flex", flex: 1, height: 22, background: "#ddd3be", borderRadius: 11 }}>
                <div style={{ width: `${b.width}%`, height: 22, background: b.color, borderRadius: 11 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
