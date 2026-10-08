from __future__ import annotations

from pathlib import Path
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)
FEATURES = ["north", "south", "east", "west", "avg_speed", "occupancy", "queue_length", "rain", "fog", "incident", "hour"]


def build_dataset(n=9000, seed=42):
    rng = np.random.default_rng(seed)
    north = rng.integers(2, 70, n)
    south = rng.integers(2, 70, n)
    east = rng.integers(2, 65, n)
    west = rng.integers(2, 65, n)
    incident = rng.binomial(1, 0.08, n)
    rain = rng.binomial(1, 0.18, n)
    fog = rng.binomial(1, 0.08, n)
    hour = rng.integers(0, 24, n)
    peak = np.where(((hour >= 7) & (hour <= 9)) | ((hour >= 16) & (hour <= 19)), 1.25, 0.75)
    volume = north + south + east + west
    occupancy = np.clip(9 + volume * 0.58 + rain * 7 + fog * 9 + incident * 13 + rng.normal(0, 4, n), 1, 99)
    avg_speed = np.clip(49 - volume * 0.18 - occupancy * 0.12 - rain * 4 - fog * 6 - incident * 8 + rng.normal(0, 2, n), 7, 55)
    queue = np.clip(volume * 0.42 + incident * 24 + rain * 6 + rng.normal(0, 7, n), 0, 180).astype(int)
    congestion = np.clip(100 * (0.38 * occupancy / 100 + 0.26 * queue / 100 + 0.22 * (1 - avg_speed / 55) + 0.08 * incident + 0.04 * rain + 0.04 * fog) * peak, 0, 100)
    df = pd.DataFrame({
        "north": north, "south": south, "east": east, "west": west,
        "avg_speed": avg_speed, "occupancy": occupancy, "queue_length": queue,
        "rain": rain, "fog": fog, "incident": incident, "hour": hour,
        "congestion_index": congestion,
    })
    return df


def main():
    df = build_dataset()
    df.to_csv(DATA / "synthetic_traffic.csv", index=False)
    X = df[FEATURES]
    y = df["congestion_index"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = RandomForestRegressor(n_estimators=240, max_depth=16, min_samples_leaf=3, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    print(f"MAE: {mean_absolute_error(y_test, pred):.3f}")
    print(f"R2 : {r2_score(y_test, pred):.3f}")
    anomaly = IsolationForest(contamination=0.04, random_state=42, n_estimators=180)
    anomaly.fit(X)
    joblib.dump(model, DATA / "congestion_model.joblib")
    joblib.dump(anomaly, DATA / "anomaly_model.joblib")
    print("Saved ML artifacts to backend/data/")


if __name__ == "__main__":
    main()
