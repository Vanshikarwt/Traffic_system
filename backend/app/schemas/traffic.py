from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

# Intersection Schemas
class IntersectionBase(BaseModel):
    name: str = Field(..., description="Name of the intersection")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    status: str = Field(default="active", description="Status of intersection (e.g. active, maintenance, congested)")

class IntersectionCreate(IntersectionBase):
    pass

class Intersection(IntersectionBase):
    id: int

    model_config = {
        "from_attributes": True
    }

# TrafficLog Schemas
class TrafficLogBase(BaseModel):
    intersection_id: int = Field(..., description="ID of the associated intersection")
    vehicle_count: int = Field(..., description="Total count of vehicles in the lane")
    density: float = Field(..., description="Fractional density representation")
    density_percentage: float = Field(..., description="Calculated density percentage (0-100%)")
    queue_length_pixels: float = Field(..., description="Euclidean distance representation of the queue in pixels")
    congestion_level: str = Field(..., description="Congestion category: Low, Medium, or Heavy")

class TrafficLogCreate(TrafficLogBase):
    pass

class TrafficLog(TrafficLogBase):
    id: int
    timestamp: datetime

    model_config = {
        "from_attributes": True
    }


# Signal State Schemas (Phase 3)
class LaneState(BaseModel):
    lane_name: str = Field(..., description="Name/direction of the lane")
    density: float = Field(..., description="Traffic density percentage (0-100%)")
    vehicle_count: int = Field(..., description="Number of vehicles in the lane")
    waiting_time: float = Field(..., description="Waiting time of vehicle at the front in seconds")
    historical_traffic: float = Field(..., description="Historical average traffic flow count")
    priority_score: float = Field(..., description="Calculated priority score")

class SignalStateResponse(BaseModel):
    intersection_id: int = Field(..., description="ID of the target intersection")
    intersection_name: str = Field(..., description="Name of the target intersection")
    current_green_lane: str = Field(..., description="Name of the lane selected for green light")
    green_time_seconds: int = Field(..., description="Dynamic green light duration in seconds")
    lanes: List[LaneState] = Field(..., description="Detailed metrics and scores for all evaluated lanes")


# Grid Telemetry Schemas (Phase 4)
class GridNodeTelemetry(BaseModel):
    intersection_id: int = Field(..., description="ID of the intersection")
    name: str = Field(..., description="Name of the intersection")
    density_percentage: float = Field(..., description="Latest density percentage (0-100%)")
    vehicle_count: int = Field(..., description="Latest vehicle count")
    congestion_level: str = Field(..., description="Latest congestion level status")
    status: str = Field(..., description="Intersection operational status")
    predicted_incoming_vehicles: float = Field(..., description="Forecasted incoming vehicle flow count targeting this intersection")

class PreemptionStatus(BaseModel):
    intersection_id: int = Field(..., description="ID of the overridden intersection")
    vehicle_type: str = Field(..., description="Type of the active emergency vehicle")
    lane: str = Field(..., description="The prioritized target green lane")
    timestamp: datetime = Field(..., description="When the override was triggered")

class GridTelemetryResponse(BaseModel):
    nodes: List[GridNodeTelemetry] = Field(..., description="List of all intersection nodes in the grid network")
    network_congestion_index: float = Field(..., description="Average system-wide network congestion index percentage")
    active_preemption: Optional[PreemptionStatus] = Field(default=None, description="Current active emergency preemption override details")
    green_corridor_path: Optional[List[int]] = Field(default=None, description="Sequence of intersection IDs along the active green corridor path")


class AnalyticsDataPoint(BaseModel):
    time: str = Field(..., description="Timestamp of the data point")
    label: Optional[str] = Field(default=None, description="Future step label (e.g. Next 5 Mins)")
    vehicle_count: int = Field(..., description="Number of vehicles")
    density: float = Field(..., description="Density percentage (0-100%)")
    type: str = Field(..., description="Type of data point: history or forecast")


class ForecastAnalyticsResponse(BaseModel):
    intersection_id: int = Field(..., description="Target intersection ID")
    historical: List[AnalyticsDataPoint] = Field(..., description="List of historical data points")
    forecast: List[AnalyticsDataPoint] = Field(..., description="List of future predicted data points")
    combined: List[AnalyticsDataPoint] = Field(..., description="List of historical + predicted data points combined")



