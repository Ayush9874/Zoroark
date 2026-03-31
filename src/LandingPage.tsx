import { useEffect, useRef, useState } from "react";

// ── Zoroark sprite animation ──────────────────────────────────────────────────
// We draw Zoroark frame-by-frame using CSS transforms on the actual image.
// idle: gentle float + slight tilt
// active: claw swipe sequence
const FRAMES = [
  { transform: "translateY(0px) rotate(-1deg) scaleX(1)",   filter: "brightness(1)" },
  { transform: "translateY(-6px) rotate(0deg) scaleX(1)",   filter: "brightness(1.05)" },
  { transform: "translateY(-10px) rotate(1deg) scaleX(1)",  filter: "brightness(1.1)" },
  { transform: "translateY(-6px) rotate(0.5deg) scaleX(1)", filter: "brightness(1.05)" },
  { transform: "translateY(0px) rotate(-1deg) scaleX(1)",   filter: "brightness(1)" },
  { transform: "translateY(3px) rotate(-1.5deg) scaleX(1)", filter: "brightness(0.97)" },
];

const ATTACK_FRAMES = [
  { transform: "translateY(-4px) rotate(-3deg) scaleX(1.05)",  filter: "brightness(1.3) contrast(1.1)" },
  { transform: "translateY(-14px) rotate(5deg) scaleX(1.08)",  filter: "brightness(1.6) contrast(1.2)" },
  { transform: "translateY(-18px) rotate(-6deg) scaleX(1.1)",  filter: "brightness(2) contrast(1.3)" },
  { transform: "translateY(-10px) rotate(8deg) scaleX(1.06)",  filter: "brightness(1.4) contrast(1.1)" },
  { transform: "translateY(-4px) rotate(-2deg) scaleX(1.02)",  filter: "brightness(1.1)" },
  { transform: "translateY(0px) rotate(-1deg) scaleX(1)",      filter: "brightness(1)" },
];

export default function LandingPage({ onEnter }: { onEnter: () => void }) {
  const spriteRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef(0);
  const attackRef = useRef(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; vx: number; vy: number; life: number }[]>([]);
  const [scanLine, setScanLine] = useState(0);

  // Idle float animation
  useEffect(() => {
    let frame = 0;
    const interval = setInterval(() => {
      if (attackRef.current) return;
      if (!spriteRef.current) return;
      const f = FRAMES[frame % FRAMES.length];
      spriteRef.current.style.transform = f.transform;
      spriteRef.current.style.filter = f.filter;
      frame++;
    }, 140);
    return () => clearInterval(interval);
  }, []);

  // Scan line
  useEffect(() => {
    const interval = setInterval(() => {
      setScanLine(s => (s + 2) % 110);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  // Random glitch bursts
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 120 + Math.random() * 80);
      }
    }, 2000);
    return () => clearInterval(glitchInterval);
  }, []);

  function triggerAttack() {
    attackRef.current = true;
    let frame = 0;
    setParticles(
      Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: 50, y: 55,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 6 - 2,
        life: 1,
      }))
    );
    const atk = setInterval(() => {
      if (!spriteRef.current) return;
      const f = ATTACK_FRAMES[frame % ATTACK_FRAMES.length];
      spriteRef.current.style.transform = f.transform;
      spriteRef.current.style.filter = f.filter;
      frame++;
      if (frame >= ATTACK_FRAMES.length) {
        clearInterval(atk);
        attackRef.current = false;
        setTimeout(() => setParticles([]), 600);
      }
    }, 80);
  }

  function handleEnter() {
    triggerAttack();
    setTimeout(onEnter, 900);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0008",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Share Tech Mono', monospace",
      }}
    >
      {/* Scan line overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30,
        background: `linear-gradient(to bottom, transparent ${scanLine}%, rgba(139,0,0,0.04) ${scanLine + 2}%, transparent ${scanLine + 4}%)`,
      }} />

      {/* Grid background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(180,0,0,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(180,0,0,0.07) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Red corner accent top-left */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 180, height: 180, pointerEvents: "none",
        background: "radial-gradient(circle at 0 0, rgba(180,0,0,0.18) 0%, transparent 70%)" }} />
      {/* Red corner accent bottom-right */}
      <div style={{ position: "absolute", bottom: 0, right: 0, width: 220, height: 220, pointerEvents: "none",
        background: "radial-gradient(circle at 100% 100%, rgba(180,0,0,0.15) 0%, transparent 70%)" }} />

      {/* TOP LABEL */}
      <div style={{ position: "absolute", top: 28, left: 0, right: 0, textAlign: "center",
        fontSize: 10, letterSpacing: "0.4em", color: "#5a1020", textTransform: "uppercase" }}>
        SOVEREIGN INTELLIGENCE SYSTEM — LOCAL EXECUTION
      </div>

      {/* TEAM TAG */}
      <div style={{ position: "absolute", top: 28, right: 32, fontSize: 9,
        color: "#3a0a18", letterSpacing: "0.2em" }}>
        TEAM ZOROARK • DOUBLESLASH 2025
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, position: "relative", zIndex: 10 }}>

        {/* Sprite container */}
        <div
          style={{ position: "relative", width: 260, height: 300, cursor: "pointer", userSelect: "none" }}
          onClick={triggerAttack}
          title="Click Zoroark"
        >
          {/* Glow behind sprite */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 220, height: 220, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(180,0,0,0.22) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          {/* Zoroark image */}
          <img
            ref={spriteRef}
            src="/zoroark.png"
            alt="Zoroark"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transition: "transform 0.08s ease, filter 0.08s ease",
              imageRendering: "auto",
              filter: "brightness(1)",
              position: "relative",
              zIndex: 2,
            }}
          />

          {/* Glitch effect */}
          {glitchActive && (
            <img src="/zoroark.jpg" alt="" style={{
              position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
              objectFit: "contain", opacity: 0.6,
              transform: `translateX(${Math.random() > 0.5 ? 4 : -4}px) translateY(${Math.random() > 0.5 ? 2 : -2}px)`,
              filter: "hue-rotate(180deg) brightness(1.5)",
              mixBlendMode: "screen",
              zIndex: 3,
            }} />
          )}

          {/* Attack particles */}
          {particles.map(p => (
            <div key={p.id} style={{
              position: "absolute",
              left: `${p.x}%`, top: `${p.y}%`,
              width: 6, height: 6, borderRadius: "50%",
              background: "#ef4444",
              boxShadow: "0 0 8px #ef4444",
              pointerEvents: "none",
              zIndex: 4,
              animation: "particle 0.6s ease-out forwards",
            }} />
          ))}
        </div>

        {/* Title block */}
        <div style={{ textAlign: "center", marginTop: -8 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.5em", color: "#8b1a1a",
            textTransform: "uppercase", marginBottom: 6 }}>
            PROJECT
          </div>
          <h1 style={{
            fontSize: "clamp(48px, 8vw, 80px)",
            fontWeight: 900,
            letterSpacing: "0.12em",
            color: "#ffffff",
            margin: 0,
            lineHeight: 1,
            textTransform: "uppercase",
            textShadow: "0 0 40px rgba(180,0,0,0.6), 0 0 80px rgba(180,0,0,0.3)",
            fontFamily: "'Press Start 2P', monospace",
          }}>
            ZOROARK
          </h1>
          <div style={{
            fontSize: "clamp(10px, 1.5vw, 13px)",
            letterSpacing: "0.3em",
            color: "#8b1a1a",
            marginTop: 10,
            textTransform: "uppercase",
          }}>
            SOVEREIGN INTELLIGENCE
          </div>
        </div>

        {/* Tagline */}
        <p style={{
          marginTop: 20,
          fontSize: "clamp(11px, 1.8vw, 14px)",
          color: "#5a2030",
          letterSpacing: "0.15em",
          textAlign: "center",
          maxWidth: 440,
          lineHeight: 1.8,
        }}>
          LOCAL · PRIVATE · AGENTIC<br />
          The future of AI isn't in the cloud. It's on your desk.
        </p>

        {/* Stat pills */}
        <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            ["100%", "LOCAL"],
            ["0", "CLOUD CALLS"],
            ["∞", "TASKS"],
          ].map(([val, label]) => (
            <div key={label} style={{
              border: "1px solid #3a0a18",
              borderRadius: 4,
              padding: "6px 16px",
              textAlign: "center",
              background: "rgba(139,26,26,0.08)",
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#cc2222",
                fontFamily: "'Press Start 2P', monospace" }}>{val}</div>
              <div style={{ fontSize: 8, color: "#5a1020", letterSpacing: "0.2em", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleEnter}
          style={{
            marginTop: 36,
            padding: "14px 48px",
            background: "transparent",
            border: "2px solid #cc2222",
            borderRadius: 4,
            color: "#ffffff",
            fontSize: 12,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "'Press Start 2P', monospace",
            position: "relative",
            overflow: "hidden",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "#cc2222";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 24px rgba(204,34,34,0.6)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
          }}
        >
          ▶ DEPLOY AGENT
        </button>

        {/* Bottom hint */}
        <div style={{ marginTop: 16, fontSize: 9, color: "#3a0a18", letterSpacing: "0.2em" }}>
          CLICK ZOROARK TO ATTACK • PRESS DEPLOY TO ENTER
        </div>
      </div>

      {/* Bottom border strip */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, #8b1a1a, transparent)" }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Share+Tech+Mono&display=swap');
        @keyframes particle {
          0% { opacity: 1; transform: translate(0,0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx, 40px), var(--ty, -60px)) scale(0); }
        }
      `}</style>
    </div>
  );
}