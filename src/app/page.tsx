export default function Home() {
  return (
    <main style={{ padding: "var(--inset)" }}>
      <h1
        style={{
          fontSize: "var(--fs-display)",
          fontWeight: 400,
          letterSpacing: "var(--track-display)",
          lineHeight: "var(--lh-display)",
        }}
      >
        Code by Korn Natthanat
      </h1>
      <p style={{ fontFamily: "var(--ff-serif)", fontSize: "var(--fs-lead)", lineHeight: "var(--lh-lead)" }}>
        I graduated in architecture but work in software. ผมเรียนสถาปัตย์แต่ทำงานซอฟต์แวร์
      </p>
      <p style={{ fontFamily: "var(--ff-mono)", fontSize: "var(--fs-meta)", color: "var(--muted)" }}>
        6 SEP 26 · react, events · #134
      </p>
    </main>
  );
}