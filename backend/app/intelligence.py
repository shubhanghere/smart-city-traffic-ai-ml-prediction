from __future__ import annotations

from pathlib import Path
import joblib
import numpy as np
import pandas as pd

BASE = Path(__file__).resolve().parents[1]
MODEL_PATH = BASE / "data" / "congestion_model.joblib"
ANOMALY_PATH = BASE / "data" / "anomaly_model.joblib"
FEATURES = ["north", "south", "east", "west", "avg_speed", "occupancy", "queue_length", "rain", "fog", "incident", "hour"]


def _vector(payload: dict) -> pd.DataFrame:
    weather = payload.get("weather", "clear")
    values = [[
        payload["north"], payload["south"], payload["east"], payload["west"],
        payload["avg_speed"], payload["occupancy"], payload["queue_length"],
        int(weather == "rain"), int(weather == "fog"), int(payload.get("incident", False)), payload["hour"],
    ]]
    return pd.DataFrame(values, columns=FEATURES, dtype=float)


def load_models():
    if not MODEL_PATH.exists() or not ANOMALY_PATH.exists():
        return None, None
    return joblib.load(MODEL_PATH), joblib.load(ANOMALY_PATH)


def fallback_prediction(payload: dict) -> float:
    volume = payload["north"] + payload["south"] + payload["east"] + payload["west"]
    congestion = 52 + volume * 0.28 + payload["occupancy"] * 0.22 + payload["queue_length"] * 0.35 - payload["avg_speed"] * 0.55
    if payload.get("incident"):
        congestion += 12
    if payload.get("weather") == "rain":
        congestion += 6
    if payload.get("weather") == "fog":
        congestion += 8
    return float(max(0, min(100, congestion)))


def predict(payload: dict) -> tuple[float, bool]:
    model, anomaly_model = load_models()
    if model is None:
        return fallback_prediction(payload), False
    x = _vector(payload)
    prediction = float(np.clip(model.predict(x)[0], 0, 100))
    anomaly = bool(anomaly_model.predict(x)[0] == -1)
    return prediction, anomaly


def optimize(payload: dict) -> dict:
    prediction, anomaly = predict(payload)
    ns = payload["north"] + payload["south"]
    ew = payload["east"] + payload["west"]
    pressure_gap = ns - ew
    if abs(pressure_gap) < 8:
        phase = "BALANCED"
        green = 28
    elif pressure_gap > 0:
        phase = "NS"
        green = int(max(24, min(55, 32 + pressure_gap * 0.45)))
    else:
        phase = "EW"
        green = int(max(24, min(55, 32 + abs(pressure_gap) * 0.45)))

    rationale = [
        f"Predicted congestion is {prediction:.0f}/100.",
        f"Directional pressure: NS={ns} vehicles, EW={ew} vehicles.",
    ]
    if payload.get("incident"):
        rationale.append("Incident detected: congestion control is being prioritized.")
    if payload.get("weather") != "clear":
        rationale.append(f"Weather={payload['weather']}: reduced-speed conditions are included.")
    if anomaly:
        rationale.append("Traffic pattern is anomalous compared with the training distribution.")
    return {
        "recommended_phase": phase,
        "green_seconds": green,
        "predicted_congestion": round(prediction, 2),
        "anomaly": anomaly,
        "rationale": rationale,
    }
