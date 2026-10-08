from __future__ import annotations

import cv2
import numpy as np


def analyze_image(data: bytes) -> dict:
    array = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode the uploaded image")
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 60, 160)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    h, w = gray.shape
    for contour in contours:
        x, y, cw, ch = cv2.boundingRect(contour)
        area = cw * ch
        if area < (w * h) * 0.0005 or area > (w * h) * 0.15:
            continue
        ratio = cw / max(ch, 1)
        if 1.1 <= ratio <= 5.5:
            candidates.append({"x": x, "y": y, "width": cw, "height": ch})
    return {
        "image_width": w,
        "image_height": h,
        "candidate_vehicle_regions": len(candidates),
        "regions": candidates[:50],
        "method": "OpenCV Canny + contour geometry prototype",
        "note": "Use a trained detector and tracker for production vehicle counts.",
    }
