import { ImageResponse } from "next/og";

export const alt = "MusicMixer — private audio conversion and editing in your browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 78px",
        color: "#f4f1e9",
        background: "linear-gradient(135deg, #0d0d13 0%, #171526 55%, #10221f 100%)",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 38, fontWeight: 700 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, height: 48 }}>
          {[18, 34, 48, 34, 18].map((height, index) => (
            <span key={height + index} style={{ width: 8, height, borderRadius: 8, background: index === 2 ? "#65ddc2" : "#8173ff" }} />
          ))}
        </div>
        MusicMixer
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 25 }}>
        <div style={{ display: "flex", fontSize: 78, lineHeight: 1.02, letterSpacing: "-4px", fontWeight: 700, maxWidth: 970 }}>
          Your audio. <span style={{ color: "#a89fff" }}>Your device.</span>
        </div>
        <div style={{ fontSize: 30, lineHeight: 1.35, color: "#c9c5d0", maxWidth: 940 }}>
          Convert, trim, merge, and edit media privately in your browser. No uploads. No sign-up.
        </div>
      </div>
      <div style={{ display: "flex", gap: 32, color: "#8fe5d1", fontSize: 22 }}>
        <span>MP3 · WAV · FLAC · AAC · OGG · M4A</span>
        <span>Powered by FFmpeg</span>
      </div>
    </div>,
    size
  );
}
