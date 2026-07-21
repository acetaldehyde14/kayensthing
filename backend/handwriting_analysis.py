from io import BytesIO

import numpy as np
from PIL import Image

# Order matches the 5-axis radar chart values already used by PERSONALITIES
# in the frontend: [pressure, size, slant, spacing, consistency].
PERSONALITY_VECTORS = {
    "sketcher": [0.65, 0.55, 0.7, 0.5, 0.6],
    "keeper": [0.85, 0.7, 0.6, 0.8, 0.85],
    "encourager": [0.5, 0.75, 0.55, 0.45, 0.5],
    "thinker": [0.8, 0.85, 0.75, 0.6, 0.7],
    "connector": [0.7, 0.6, 0.65, 0.55, 0.75],
}

NEUTRAL_FEATURES = {"pressure": 0.5, "size": 0.5, "slant": 0.5, "spacing": 0.5, "consistency": 0.5}


def extract_image_features(image_bytes):
    """Derive rough graphology-style signals directly from the handwriting photo.

    This is a lightweight heuristic (ink density, slant, spacing, line
    consistency), not a trained model -- good enough to make the result feel
    grounded in the actual sample rather than random, without pulling in a
    heavy CV/ML dependency.
    """
    img = Image.open(BytesIO(image_bytes)).convert("L")
    img.thumbnail((800, 800))
    arr = np.asarray(img, dtype=np.float32)

    threshold = arr.mean() - arr.std() * 0.5
    ink = arr < threshold
    ys, xs = np.nonzero(ink)

    if len(xs) < 20:
        return dict(NEUTRAL_FEATURES)

    height, width = arr.shape
    y0, y1 = ys.min(), ys.max()
    x0, x1 = xs.min(), xs.max()
    bbox_h = y1 - y0 + 1

    size_score = float(np.clip((bbox_h / height) * 1.4, 0, 1))

    x_centered = xs - xs.mean()
    y_centered = ys - ys.mean()
    denom = (np.sqrt((x_centered ** 2).sum()) * np.sqrt((y_centered ** 2).sum())) or 1.0
    slant_raw = (x_centered * y_centered).sum() / denom
    slant_score = float(np.clip(0.5 + slant_raw, 0, 1))

    bbox = ink[y0:y1 + 1, x0:x1 + 1]
    col_has_ink = bbox.any(axis=0)
    gap_ratio = 1 - col_has_ink.mean()
    spacing_score = float(np.clip(gap_ratio * 2, 0, 1))

    pressure_score = float(np.clip(bbox.mean() * 3, 0, 1))

    row_counts = bbox.sum(axis=1)
    active_rows = row_counts[row_counts > 0]
    if len(active_rows):
        consistency_score = float(np.clip(1 - (active_rows.std() / (active_rows.mean() + 1e-6)), 0, 1))
    else:
        consistency_score = 0.5

    return {
        "pressure": pressure_score,
        "size": size_score,
        "slant": slant_score,
        "spacing": spacing_score,
        "consistency": consistency_score,
    }


def match_personality(features):
    vec = [
        features["pressure"],
        features["size"],
        features["slant"],
        features["spacing"],
        features["consistency"],
    ]

    scores = {}
    for personality_id, target in PERSONALITY_VECTORS.items():
        dot = sum(a * b for a, b in zip(vec, target))
        norm = (sum(a * a for a in vec) ** 0.5) * (sum(b * b for b in target) ** 0.5)
        scores[personality_id] = (dot / norm) if norm else 0.0

    best_id = max(scores, key=scores.get)
    confidence = round(float(scores[best_id]), 3)
    return best_id, confidence, vec, scores
