import os
import random

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

# Real analysis (image heuristics in handwriting_analysis.py + OCR in
# ocr_client.py) is disabled for now -- /api/analyze below just picks a
# random archetype as a placeholder so the frontend flow can be exercised
# end-to-end. Swap random_result() back out for the real pipeline later.
from handwriting_analysis import PERSONALITY_VECTORS

app = Flask(__name__)
CORS(app)

MAX_IMAGE_BYTES = 8 * 1024 * 1024


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/analyze", methods=["POST"])
def analyze():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided under the 'image' field"}), 400

    image_file = request.files["image"]
    image_bytes = image_file.read()
    if not image_bytes:
        return jsonify({"error": "Uploaded image is empty"}), 400
    if len(image_bytes) > MAX_IMAGE_BYTES:
        return jsonify({"error": "Image is too large (max 8MB)"}), 400

    personality_id = random.choice(list(PERSONALITY_VECTORS.keys()))
    trait_values = PERSONALITY_VECTORS[personality_id]

    return jsonify(
        {
            "personalityId": personality_id,
            "confidence": None,
            "traitValues": trait_values,
            "ocrText": "",
            "ocrError": None,
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
