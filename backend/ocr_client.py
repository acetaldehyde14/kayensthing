import json
import os
import time

import requests

JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
MODEL = "PaddleOCR-VL-1.6"
POLL_INTERVAL_SECONDS = 3
POLL_TIMEOUT_SECONDS = 120

OPTIONAL_PAYLOAD = {
    "useDocOrientationClassify": False,
    "useDocUnwarping": False,
    "useChartRecognition": False,
}


class OCRError(Exception):
    pass


def _headers():
    token = os.environ.get("PADDLEOCR_TOKEN")
    if not token:
        raise OCRError("PADDLEOCR_TOKEN environment variable is not set")
    return {"Authorization": f"bearer {token}"}


def submit_job(image_bytes, filename):
    data = {
        "model": MODEL,
        "optionalPayload": json.dumps(OPTIONAL_PAYLOAD),
    }
    files = {"file": (filename, image_bytes)}
    response = requests.post(JOB_URL, headers=_headers(), data=data, files=files, timeout=30)
    if response.status_code != 200:
        raise OCRError(f"Failed to submit OCR job: {response.status_code} {response.text}")
    return response.json()["data"]["jobId"]


def wait_for_result(job_id):
    deadline = time.time() + POLL_TIMEOUT_SECONDS
    while time.time() < deadline:
        response = requests.get(f"{JOB_URL}/{job_id}", headers=_headers(), timeout=30)
        if response.status_code != 200:
            raise OCRError(f"Failed to poll OCR job: {response.status_code} {response.text}")
        payload = response.json()["data"]
        state = payload["state"]
        if state == "done":
            return payload["resultUrl"]["jsonUrl"]
        if state == "failed":
            raise OCRError(f"OCR job failed: {payload.get('errorMsg')}")
        time.sleep(POLL_INTERVAL_SECONDS)
    raise OCRError("Timed out waiting for OCR job to complete")


def fetch_text(jsonl_url):
    response = requests.get(jsonl_url, timeout=30)
    response.raise_for_status()
    texts = []
    for line in response.text.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        result = json.loads(line)["result"]
        for res in result["layoutParsingResults"]:
            texts.append(res["markdown"]["text"])
    return "\n".join(texts).strip()


def extract_text(image_bytes, filename):
    job_id = submit_job(image_bytes, filename)
    jsonl_url = wait_for_result(job_id)
    return fetch_text(jsonl_url)
