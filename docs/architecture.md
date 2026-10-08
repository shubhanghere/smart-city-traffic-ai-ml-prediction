# Architecture Notes

## Components

### 1. Browser digital twin
Three.js renders a procedural intersection with roads, buildings, bridge geometry, traffic signals and moving vehicles. The browser is responsible for animation; it is not the source of truth for AI decisions.

### 2. Simulation service
FastAPI owns the telemetry state. Every tick produces directional counts, speed, occupancy, queue length, weather, incident status and signal phase.

### 3. ML service
The Random Forest model maps traffic features to a continuous congestion index. Isolation Forest adds an anomaly signal. The service falls back to a deterministic formula if the model artifacts have not yet been trained, so the demo can still be explored.

### 4. Signal policy
The controller computes directional pressure and returns a bounded green duration. This is a policy layer, not reinforcement learning. RL can be added after a simulator such as SUMO is connected.

### 5. Vision prototype
OpenCV provides an intentionally lightweight image-analysis endpoint. It is useful to demonstrate the data path from camera -> vision -> telemetry. A production system should use a trained object detector and tracker.

## Recommended next engineering step

Connect SUMO/TraCI or a real traffic dataset to the backend and train the model on measured traffic states. Keep the API contract stable so the Three.js command center does not need to change.
