from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

Weather = Literal["clear", "rain", "fog"]
Phase = Literal["NS", "EW", "BALANCED"]


class TrafficState(BaseModel):
    north: int = Field(ge=0)
    south: int = Field(ge=0)
    east: int = Field(ge=0)
    west: int = Field(ge=0)
    avg_speed: float = Field(ge=0)
    occupancy: float = Field(ge=0, le=100)
    queue_length: int = Field(ge=0)
    weather: Weather = "clear"
    incident: bool = False
    hour: int = Field(ge=0, le=23)
    phase: Phase = "NS"
    phase_remaining: int = Field(ge=0)


class PredictionRequest(BaseModel):
    north: int = Field(ge=0)
    south: int = Field(ge=0)
    east: int = Field(ge=0)
    west: int = Field(ge=0)
    avg_speed: float = Field(ge=0)
    occupancy: float = Field(ge=0, le=100)
    queue_length: int = Field(ge=0)
    weather: Weather = "clear"
    incident: bool = False
    hour: int = Field(ge=0, le=23)


class ControlRequest(PredictionRequest):
    current_phase: Phase = "NS"


class ControlResponse(BaseModel):
    recommended_phase: Phase
    green_seconds: int
    predicted_congestion: float
    anomaly: bool
    rationale: list[str]
