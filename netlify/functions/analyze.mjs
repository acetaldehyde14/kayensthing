// Placeholder analyzer -- picks a random archetype, matching the old
// backend/app.py behaviour (random.choice over the same 5 trait vectors).
// Kept in sync with PERSONALITIES[].values in HandwritingAnalysisApp.jsx.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const PERSONALITY_VALUES = {
  sketcher: [0.45, 0.55, 0.75, 0.4, 0.45, 0.5],
  keeper: [0.9, 0.75, 0.55, 0.9, 0.85, 0.8],
  encourager: [0.5, 0.55, 0.85, 0.45, 0.5, 0.55],
  thinker: [0.85, 0.9, 0.7, 0.75, 0.65, 0.9],
  connector: [0.6, 0.65, 0.75, 0.6, 0.55, 0.5],
};

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let image;
  try {
    const formData = await req.formData();
    image = formData.get("image");
  } catch {
    return new Response(JSON.stringify({ error: "Could not parse upload" }), { status: 400 });
  }

  if (!image || typeof image === "string" || image.size === 0) {
    return new Response(
      JSON.stringify({ error: "No image file provided under the 'image' field" }),
      { status: 400 }
    );
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return new Response(JSON.stringify({ error: "Image is too large (max 8MB)" }), { status: 400 });
  }

  const ids = Object.keys(PERSONALITY_VALUES);
  const personalityId = ids[Math.floor(Math.random() * ids.length)];

  return new Response(
    JSON.stringify({
      personalityId,
      confidence: null,
      traitValues: PERSONALITY_VALUES[personalityId],
      ocrText: "",
      ocrError: null,
    }),
    { headers: { "content-type": "application/json" } }
  );
};

export const config = { path: "/api/analyze" };
