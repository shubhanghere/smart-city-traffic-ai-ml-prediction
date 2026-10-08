from __future__ import annotations

import random
import time
from dataclasses import dataclass


@dataclass
class Simulation:
    density: float = 0.55
    incident: bool = False
    weather: str = "clear"
    hour: int = 17
    phase: str = "NS"
    phase_remaining: int = 32
    tick_count: int = 0
    last_traffic: dict | None = None

    def reset(self) -> None:
        self.density = 0.55
        self.incident = False
        self.weather = "clear"
        self.hour = 17
        self.phase = "NS"
        self.phase_remaining = 32
        self.tick_count = 0
        self.last_traffic = None

    def set_controls(self, density: float | None = None, incident: bool | None = None, weather: str | None = None, hour: int | None = None) -> None:
        if density is not None:
            self.density = max(0.1, min(1.5, density))
        if incident is not None:
            self.incident = incident
        if weather is not None:
            self.weather = weather
        if hour is not None:
            self.hour = max(0, min(23, hour))
        self.last_traffic = self._traffic()

    def _traffic(self) -> dict:
        peak = 1.25 if self.hour in (7, 8, 9, 16, 17, 18, 19) else 0.72
        weather_factor = {"clear": 1.0, "rain": 1.18, "fog": 1.28}[self.weather]
        incident_factor = 1.32 if self.incident else 1.0
        base = 22 * self.density * peak * weather_factor
        jitter = lambda: random.uniform(0.75, 1.25)
        north = max(0, int(base * 1.10 * jitter()))
        south = max(0, int(base * 0.95 * jitter()))
        east = max(0, int(base * 0.82 * jitter() * incident_factor))
        west = max(0, int(base * 0.88 * jitter()))
        total = north + south + east + west
        speed = max(8.0, 47 - total * 0.17 - (8 if self.incident else 0) - (4 if self.weather == "rain" else 7 if self.weather == "fog" else 0))
        occupancy = min(98.0, 10 + total * 0.58)
        queue = max(0, int(total * 0.42 + (22 if self.incident else 0)))
        return {
            "north": north,
            "south": south,
            "east": east,
            "west": west,
            "avg_speed": round(speed, 1),
            "occupancy": round(occupancy, 1),
            "queue_length": queue,
        }

    def tick(self) -> dict:
        self.tick_count += 1
        if self.tick_count % 5 == 0:
            self.hour = (self.hour + 1) % 24
        self.phase_remaining -= 1
        if self.phase_remaining <= 0:
            self.phase = "EW" if self.phase == "NS" else "NS"
            self.phase_remaining = 32
        state = self._traffic()
        self.last_traffic = state
        return {
            **state,
            "weather": self.weather,
            "incident": self.incident,
            "hour": self.hour,
            "phase": self.phase,
            "phase_remaining": self.phase_remaining,
            "timestamp": time.time(),
        }

    def snapshot(self) -> dict:
        if self.last_traffic is None:
            self.last_traffic = self._traffic()
        state = self.last_traffic
        return {
            **state,
            "weather": self.weather,
            "incident": self.incident,
            "hour": self.hour,
            "phase": self.phase,
            "phase_remaining": self.phase_remaining,
            "timestamp": time.time(),
        }


simulation = Simulation()
