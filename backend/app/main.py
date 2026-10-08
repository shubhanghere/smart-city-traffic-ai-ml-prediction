from __future__ import annotations

from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .models import PredictionRequest, ControlRequest
from .simulation import simulation
from .intelligence import predict, optimize
from .vision import analyze_image

app = FastAPI(title="Smart City Traffic AI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "smart-city-traffic-ai"}


@app.get("/api/simulation/state")
def state():
    return simulation.snapshot()


@app.post("/api/simulation/tick")
def tick():
    return simulation.tick()


@app.post("/api/simulation/control")
def control(density: float | None = None, incident: bool | None = None, weather: str | None = None, hour: int | None = Query(None, ge=0, le=23)):
    if weather not in (None, "clear", "rain", "fog"):
        raise HTTPException(400, "weather must be clear, rain or fog")
    simulation.set_controls(density=density, incident=incident, weather=weather, hour=hour)
    return simulation.snapshot()


@app.post("/api/simulation/reset")
def reset():
    simulation.reset()
    return simulation.snapshot()


@app.post("/api/predict/congestion")
def congestion(request: PredictionRequest):
    prediction, anomaly = predict(request.model_dump())
    return {"congestion_index": round(prediction, 2), "anomaly": anomaly}


@app.post("/api/control/optimize")
def optimize_control(request: ControlRequest):
    return optimize(request.model_dump())


@app.get("/api/analytics/summary")
def analytics():
    state = simulation.snapshot()
    total = state["north"] + state["south"] + state["east"] + state["west"]
    travel_time = max(1.5, 3.5 + state["queue_length"] * 0.035 + (1.5 if state["incident"] else 0))
    throughput = max(80, int(total * (state["avg_speed"] / 45)))
    return {
        "traffic_volume": total,
        "average_speed": state["avg_speed"],
        "occupancy": state["occupancy"],
        "queue_length": state["queue_length"],
        "travel_time_min": round(travel_time, 1),
        "throughput_vph": throughput * 60,
        "intersection_health": round(max(0, 100 - state["occupancy"] * 0.45 - state["queue_length"] * 0.25), 1),
    }


@app.post("/api/vision/analyze")
async def vision(file: UploadFile = File(...)):
    try:
        content = await file.read()
        return analyze_image(content)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
