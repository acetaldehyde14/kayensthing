import React, { useState, useRef, useEffect } from "react";

// Analysis is a Netlify Function (netlify/functions/analyze.mjs), routed to
// /api/analyze -- same-origin in both `netlify dev` and prod, so no host needed.
const API_BASE_URL = "";

// Design tokens pulled from the Figma file (ILAB (Copy) (Copy), fileKey l600l8ZhKnpdxZMfk6GYc2).
// Cards/bars/tags use one fixed palette across every personality -- only the
// screen background changes per archetype.
const CARD_BG = "#FDF3CC";
const BAR_BG = "#0E0E0D";
const BAR_TEXT = "#FFFFFF";
const ACCENT = "#876124";
const TEXT_DARK = "#000000";
const SCREEN_BG = "#FBF3EF";
const FONT_DISPLAY = "'Pixelify Sans',sans-serif";
const FONT_BODY = "'Anonymous Pro',monospace";

// Clockwise from top -- matches the axis order/positions in the Figma "Strengths" hexagon.
const STRENGTH_LABELS = ["Attention to detail", "Observation Skills", "Intuition", "Organisation", "Time Management", "Analytical Thinking"];

const PERSONALITIES = [
  { id: "sketcher", name: "Sketcher", bg: "#F9D143", percent: 83,
    tags: ["Outgoing", "PeoplePerson", "Adventurous", "WarmHeart"],
    values: [0.45, 0.55, 0.75, 0.4, 0.45, 0.5],
    personalityText: "Your handwriting reflects an outgoing, adaptable, and enthusiastic personality. You thrive in interpersonal connections and enjoy forming bonds with others. You tend to be flexible, spontaneous, and often seek new experiences and challenges. Your ability to adapt quickly to changing situations makes you an approachable and engaging individual.",
    emotionalTone: "Your handwriting appears lively, expressive, and emotionally open. You seem comfortable expressing your thoughts and feelings, and your writing openly reflects enthusiasm and a strong desire for social connection.",
    writingCharacteristics: "Your handwriting is often medium to large, with a noticeable rightward slant, connected letters, and a fast writing pace. Variations in pressure and spacing reflect spontaneity and an energetic appearance." },
  { id: "keeper", name: "Keeper", bg: "#62BAFC", percent: 11,
    tags: ["Reliable", "Precise", "WellPrepared", "DetailDriven"],
    values: [0.9, 0.75, 0.55, 0.9, 0.85, 0.8],
    personalityText: "Your handwriting reflects an organised, disciplined, and dependable personality. You value structure, consistency, and precision in both your personal and professional lives. You tend to set high standards for yourself and others, preferring to approach tasks methodically rather than impulsively. Your practical mindset allows you to remain calm under pressure.",
    emotionalTone: "Your handwriting seems controlled and composed. Rather than expressing emotions openly, you may tend to process your feelings internally and moderate writing pressure. Your handwriting reflects emotional stability and a preference for maintaining order.",
    writingCharacteristics: "You have small, neat handwriting with consistent spacing, mostly straight baselines, and moderate writing pressure. Your letters are carefully written and uniform in size, indicating strong self-control and attention to detail." },
  { id: "encourager", name: "Encourager", bg: "#73D5A6", percent: 16,
    tags: ["Imaginative", "Visionary", "DreamBig", "Innovative"],
    values: [0.5, 0.55, 0.85, 0.45, 0.5, 0.55],
    personalityText: "Your handwriting reflects an outgoing, adaptable, and enthusiastic personality. You thrive on interpersonal interactions with others. You may be spontaneous, and often seek new experiences and challenges. Your ability to adapt quickly to changing situations allows you to remain approachable and engaging.",
    emotionalTone: "Your handwriting appears lively, expressive, and intellectually open. You seem to be comfortable expressing your feelings and often wear your emotions openly. Your handwriting reflects confidence and a strong desire for social connection.",
    writingCharacteristics: "Your handwriting is often large, with a noticeable rightward slant and consistent writing speed. The pressure and spacing may vary, reflecting a spontaneous, fluid handwriting that suggests a dynamic personality." },
  { id: "thinker", name: "Thinker", bg: "#DB93F2", percent: 89,
    tags: ["Strategic", "Observant", "Adaptable", "Meticulous"],
    values: [0.85, 0.9, 0.7, 0.75, 0.65, 0.9],
    personalityText: "Your handwriting reflects a logical, observant, and independent personality. You prefer to gather information carefully before making decisions and tend to prioritise objectivity. You are naturally curious and enjoy understanding how things work, often relying on critical thinking rather than emotions. Your reserved nature keeps you focused under pressure.",
    emotionalTone: "Your handwriting appears restrained, focused, and intellectually driven. You tend to regulate your emotions carefully and prioritise rationality over emotional expression. Your handwriting seems to reflect concentration, independence, and self-discipline.",
    writingCharacteristics: "Your handwriting is often medium in size, with angular letters, tight spacing, and firm pressure. Your writing speed may vary, reflecting spontaneity, and fluid handwriting suggests precise, deliberate thought." },
  { id: "connector", name: "Connector", bg: "#FA73AD", percent: 81,
    tags: ["Trustworthy", "Dependable", "TeamPlayer", "WarmHearted"],
    values: [0.6, 0.65, 0.75, 0.6, 0.55, 0.5],
    personalityText: "Your handwriting reflects a compassionate, dependable, and cooperative personality. You tend to prioritise relationships and value trust, loyalty, and emotional connection. You are a patient listener who enjoys helping others and often relies on supportive roles within groups. Your consistent and caring nature makes you a reliable friend and colleague.",
    emotionalTone: "Your handwriting appears warm and reassuring, often emotionally aware, expressing care and understanding through your actions. Your handwriting reflects emotional stability and a desire to maintain harmony.",
    writingCharacteristics: "Your handwriting is often medium in size, with rounded letters, tight spacing, and a slight rightward slant. Writing pressure is steady and consistent, creating a balanced and approachable appearance." },
];

const CHART_CX = 110, CHART_CY = 105, CHART_R = 55;

function radarPoint(v, i, n, radius = CHART_R) {
  const angle = ((-90 + i * (360 / n)) * Math.PI) / 180;
  return { x: CHART_CX + radius * v * Math.cos(angle), y: CHART_CY + radius * v * Math.sin(angle), angle };
}
function radarPoints(values, radius = CHART_R) {
  return values.map((v, i) => radarPoint(v, i, values.length, radius));
}
function pointsToPolygon(points) {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}
const GRID = pointsToPolygon(radarPoints(STRENGTH_LABELS.map(() => 1)));
const LABEL_POINTS = radarPoints(STRENGTH_LABELS.map(() => 1.5));

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*);base64/)[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const barStyle = {
  background: BAR_BG,
  color: BAR_TEXT,
  fontFamily: FONT_DISPLAY,
  fontWeight: 600,
  fontSize: 17,
  padding: "8px 12px",
  borderRadius: 10,
};

const pixelBtn = (bg = "#FF4D00", color = "#000") => ({
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: 15,
  color,
  background: bg,
  border: "none",
  borderRadius: 999,
  padding: "12px 24px",
  cursor: "pointer",
});

const ImagePlaceholder = ({ label, style }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      fontSize: 11,
      color: "#9a8b78",
      border: "2px dashed #d9c9b3",
      background: "#faf3ea",
      borderRadius: 12,
      padding: 8,
      ...style,
    }}
  >
    {label}
  </div>
);

export default function HandwritingAnalysisApp() {
  const [screen, setScreen] = useState("start"); // start | scan | loading | result
  const [resultIdx, setResultIdx] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [liveAnalysis, setLiveAnalysis] = useState(null); // { traitValues, ocrText } from the backend
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const cameraSupported =
    typeof navigator !== "undefined" && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  const openCamera = () => {
    if (!cameraSupported) {
      setCameraError(true);
      return;
    }
    setCapturedPhoto(null);
    setCameraOpen(true);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch(() => {
        setCameraOpen(false);
        setCameraError(true);
      });
  };

  const triggerFileUpload = () => fileInputRef.current && fileInputRef.current.click();

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCapturedPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/png");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCapturedPhoto(dataUrl);
    setCameraOpen(false);
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    if (cameraSupported && !cameraError) openCamera();
    else triggerFileUpload();
  };

  const startLoading = () => {
    if (!capturedPhoto) return;
    clearTimeout(timerRef.current);
    setAnalysisError("");
    setScreen("loading");

    (async () => {
      try {
        const blob = dataUrlToBlob(capturedPhoto);
        const formData = new FormData();
        formData.append("image", blob, "handwriting.png");

        const response = await fetch(`${API_BASE_URL}/api/analyze`, {
          method: "POST",
          body: formData,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Analysis failed (${response.status})`);
        const data = await response.json();

        const matchedIdx = PERSONALITIES.findIndex((x) => x.id === data.personalityId);
        setResultIdx(matchedIdx >= 0 ? matchedIdx : Math.floor(Math.random() * PERSONALITIES.length));
        setLiveAnalysis({ traitValues: data.traitValues, ocrText: data.ocrText });
        setScreen("result");
      } catch (err) {
        setAnalysisError("Couldn't analyze your handwriting. Please try again.");
        setScreen("scan");
      }
    })();
  };

  const p = PERSONALITIES[resultIdx];
  const besties = PERSONALITIES.filter((x) => x.id !== p.id).slice(0, 2);
  const radarData = pointsToPolygon(radarPoints(liveAnalysis?.traitValues || p.values));
  const showUploadArea = !cameraOpen && !capturedPhoto;
  const screenBg = screen === "result" ? p.bg : SCREEN_BG;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        boxSizing: "border-box",
        fontFamily: FONT_BODY,
        background: screenBg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;600;700&family=Anonymous+Pro:wght@400;700&display=swap');
        @keyframes hw-spin { to { transform: rotate(360deg); } }
        .hw-spinner {
          position: relative;
          width: 80px;
          height: 80px;
          animation: hw-spin 0.9s linear infinite;
        }
        .hw-spinner::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #FF4D00 0deg, #FF4D00 64deg, rgba(255, 77, 0, 0) 360deg);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 14px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 14px));
        }
        .hw-spinner::after {
          content: "";
          position: absolute;
          top: 0;
          left: 33px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #FF4D00;
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 600,
          margin: "0 auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {screen === "start" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, padding: 40, textAlign: "center" }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: CARD_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M4 20L14 10M14 10L20 4M14 10L20 16M20 4L16 8" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" />
                <path d="M4 20l3-1 12-12-2-2L5 17l-1 3z" fill="#FF4D00" stroke={TEXT_DARK} strokeWidth="1" />
              </svg>
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: TEXT_DARK, lineHeight: 1.4 }}>
              Handwriting Analysis
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: "#6B5A47", lineHeight: 1.5, maxWidth: 280 }}>
              Scan your handwriting and discover which of the 5 personality types you are.
            </div>
            <button
              onClick={() => setScreen("scan")}
              style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: "#000", background: "#FF4D00", border: "none", borderRadius: 999, padding: "16px 46px", cursor: "pointer" }}
            >
              Start
            </button>
          </div>
        )}

        {screen === "scan" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 36 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: TEXT_DARK, textAlign: "center" }}>
              Scan your handwriting!
            </div>

            {analysisError && (
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: "#B3261E", textAlign: "center", maxWidth: 280 }}>{analysisError}</div>
            )}

            {cameraOpen && (
              <div style={{ width: "100%", maxWidth: 280, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
                <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: 320, objectFit: "cover", borderRadius: 18, background: "#000", boxShadow: "0 8px 24px rgba(60,40,20,0.15)" }} />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={closeCamera} style={{ ...pixelBtn("transparent", TEXT_DARK), border: `2px solid ${TEXT_DARK}` }}>Cancel</button>
                  <button onClick={capturePhoto} style={pixelBtn()}>Capture</button>
                </div>
              </div>
            )}

            {capturedPhoto && (
              <div style={{ width: "100%", maxWidth: 280, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
                <div style={{ width: "100%", height: 320, borderRadius: 18, boxShadow: "0 8px 24px rgba(60,40,20,0.15)", backgroundImage: `url(${capturedPhoto})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={retakePhoto} style={{ ...pixelBtn("transparent", TEXT_DARK), border: `2px solid ${TEXT_DARK}` }}>Retake</button>
                  <button onClick={startLoading} style={pixelBtn()}>Analyze</button>
                </div>
              </div>
            )}

            {showUploadArea && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                {cameraError && (
                  <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: ACCENT, textAlign: "center", maxWidth: 240 }}>
                    Camera unavailable — upload a photo of your handwriting instead.
                  </div>
                )}

                {cameraSupported && !cameraError && (
                  <button
                    onClick={openCamera}
                    style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: "#000", background: "#FF4D00", border: "none", borderRadius: 999, padding: "20px 40px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke="#000" strokeWidth="1.6" fill="none" />
                      <circle cx="12" cy="14" r="3.2" stroke="#000" strokeWidth="1.6" />
                    </svg>
                    Scan
                  </button>
                )}

                <button
                  onClick={triggerFileUpload}
                  style={
                    cameraSupported && !cameraError
                      ? { fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: TEXT_DARK, background: "transparent", border: "none", textDecoration: "underline", cursor: "pointer" }
                      : { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: "#000", background: "#FF4D00", border: "none", borderRadius: 999, padding: "20px 40px", cursor: "pointer" }
                  }
                >
                  {cameraSupported && !cameraError ? "Or upload a photo instead" : "Upload Photo"}
                </button>

                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
              </div>
            )}
          </div>
        )}

        {screen === "loading" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, color: TEXT_DARK }}>Loading...</div>
            <div className="hw-spinner" />
          </div>
        )}

        {screen === "result" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "22px 20px 26px", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
              <div>
                <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 16, color: TEXT_DARK, opacity: 0.75 }}>You are...</div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 34, lineHeight: 1.05, color: TEXT_DARK }}>The {p.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {p.tags.map((tag) => (
                    <div key={tag} style={{ background: ACCENT, color: "#fff", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12, padding: "4px 10px", borderRadius: 999 }}>
                      #{tag}
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: ACCENT, marginTop: 8 }}>
                  {p.percent}%{" "}
                  <span style={{ fontFamily: FONT_BODY, opacity: 0.7, fontWeight: 700, fontSize: 12, color: TEXT_DARK }}>people are also this type</span>
                </div>
              </div>
              <div
                style={{
                  width: 96,
                  height: 96,
                  flex: "none",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: CARD_BG,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={`/images/${p.id}/personality.png`}
                  alt={`${p.name} mascot`}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={barStyle}>Strengths</div>
              <div style={barStyle}>Your Writing Sample</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: CARD_BG, borderRadius: 12, padding: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="150" height="150" viewBox="0 0 220 210">
                  {STRENGTH_LABELS.map((_, i) => {
                    const spoke = radarPoint(1, i, STRENGTH_LABELS.length);
                    return <line key={i} x1={CHART_CX} y1={CHART_CY} x2={spoke.x} y2={spoke.y} stroke={ACCENT} strokeOpacity="0.2" strokeWidth="1" />;
                  })}
                  <polygon points={GRID} fill="none" stroke={ACCENT} strokeOpacity="0.35" strokeWidth="1.5" />
                  <polygon points={radarData} fill={ACCENT} fillOpacity="0.55" stroke={ACCENT} strokeWidth="2" />
                  {STRENGTH_LABELS.map((label, i) => {
                    const pt = LABEL_POINTS[i];
                    const isTopOrBottom = i === 0 || i === 3;
                    const anchor = isTopOrBottom ? "middle" : pt.x > CHART_CX ? "start" : "end";
                    const words = label.split(" ");
                    const lines = !isTopOrBottom && words.length > 1 ? [words.slice(0, -1).join(" "), words[words.length - 1]] : [label];
                    return (
                      <text key={label} x={pt.x} y={pt.y} textAnchor={anchor} fontFamily={FONT_BODY} fontWeight="700" fontSize="9" fill={TEXT_DARK}>
                        {lines.map((line, li) => (
                          <tspan key={li} x={pt.x} dy={li === 0 ? (lines.length > 1 ? -4 : 3) : 11}>
                            {line}
                          </tspan>
                        ))}
                      </text>
                    );
                  })}
                </svg>
              </div>
              {capturedPhoto ? (
                <div
                  style={{
                    width: "100%",
                    height: 150,
                    borderRadius: 12,
                    backgroundImage: `url(${capturedPhoto})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              ) : (
                <ImagePlaceholder label="Drop your handwriting sample" style={{ width: "100%", height: 150 }} />
              )}
            </div>

            <div style={barStyle}>Personality Traits</div>
            <div style={{ background: CARD_BG, borderRadius: 12, padding: "12px 14px", fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.5, color: TEXT_DARK }}>{p.personalityText}</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={barStyle}>Emotional Tone</div>
              <div style={barStyle}>Writing Characteristics</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: CARD_BG, borderRadius: 12, padding: "10px 12px", fontFamily: FONT_BODY, fontSize: 12.5, lineHeight: 1.45, color: TEXT_DARK }}>{p.emotionalTone}</div>
              <div style={{ background: CARD_BG, borderRadius: 12, padding: "10px 12px", fontFamily: FONT_BODY, fontSize: 12.5, lineHeight: 1.45, color: TEXT_DARK }}>{p.writingCharacteristics}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={barStyle}>Letter Besties</div>
              <div style={barStyle}>Download</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "stretch" }}>
              <div style={{ background: CARD_BG, borderRadius: 12, padding: 10, display: "flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
                {besties.map((b) => (
                  <div key={b.id} style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                    <img src={`/images/${b.id}/personality.png`} alt={`${b.name} mascot`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                ))}
              </div>
              <div style={{ background: CARD_BG, borderRadius: 12, padding: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", background: "#FF4D00", border: "none", borderRadius: 999, padding: "9px 22px", cursor: "pointer" }}>
                  Download
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setScreen("start");
                setCapturedPhoto(null);
                setLiveAnalysis(null);
                setCameraError(false);
              }}
              style={{ marginTop: 4, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: TEXT_DARK, background: "transparent", border: `2px solid ${TEXT_DARK}`, borderRadius: 999, padding: "9px 0", cursor: "pointer" }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
