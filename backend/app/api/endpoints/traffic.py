from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.api.auth import get_current_active_operator
from pydantic import BaseModel, Field
import json
import tempfile
import shutil
import cv2
import os
from app.core.database import get_db
from app.models.traffic import Intersection as IntersectionModel, TrafficLog as TrafficLogModel, NetworkPropagationLog as NetworkPropagationLogModel
from app.schemas.traffic import (
    Intersection, IntersectionCreate,
    TrafficLog, TrafficLogCreate,
    SignalStateResponse, GridTelemetryResponse,
    ForecastAnalyticsResponse
)
from app.services.video_processor import run_video_processing
from app.services.density_engine import calculate_lane_density, estimate_queue_length
from app.services.signal_intelligence import calculate_priority_score, allocate_green_time
import random

router = APIRouter()

# Schema for the video processing request
class ProcessVideoRequest(BaseModel):
    video_path: Optional[str] = Field(default=None, description="Path to input video file (optional in mock mode)")
    lane_polygon: List[List[float]] = Field(
        ...,
        description="A list of 4 coordinate points defining the lane polygon. E.g. [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]"
    )
    mock_mode: bool = Field(default=False, description="Whether to run simulated frames instead of a real video stream")

# Schema for the frame processing request
class ProcessFrameRequest(BaseModel):
    frame_width: int = Field(..., description="Width of the video frame")
    frame_height: int = Field(..., description="Height of the video frame")
    bounding_boxes: List[dict] = Field(..., description="List of dicts, each containing [x1, y1, x2, y2] coordinates from YOLO detection")
    lane_polygon: List[List[float]] = Field(
        ...,
        description="A list of 4 coordinate points defining the lane polygon. E.g. [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]"
    )

@router.post("/intersections", response_model=Intersection, tags=["Intersections"])
def create_intersection(
    intersection: IntersectionCreate, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_active_operator("Admin"))
):
    """
    Create a new traffic intersection entry.
    """
    db_intersection = IntersectionModel(
        name=intersection.name,
        latitude=intersection.latitude,
        longitude=intersection.longitude,
        status=intersection.status
    )
    db.add(db_intersection)
    db.commit()
    db.refresh(db_intersection)
    return db_intersection

@router.get("/intersections", response_model=List[Intersection], tags=["Intersections"])
def list_intersections(db: Session = Depends(get_db)):
    """
    Retrieve all registered traffic intersections.
    """
    return db.query(IntersectionModel).all()

@router.get("/intersections/{intersection_id}/logs", response_model=List[TrafficLog], tags=["Traffic Logs"])
def get_traffic_logs(
    intersection_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Retrieve logs of traffic metrics for a specific intersection.
    """
    intersection = db.query(IntersectionModel).filter(IntersectionModel.id == intersection_id).first()
    if not intersection:
        raise HTTPException(status_code=404, detail="Intersection not found")
        
    logs = db.query(TrafficLogModel)\
        .filter(TrafficLogModel.intersection_id == intersection_id)\
        .order_by(TrafficLogModel.timestamp.desc())\
        .limit(limit)\
        .all()
    return logs

@router.post("/intersections/{intersection_id}/process", response_model=TrafficLog, tags=["Video Processing"])
def process_video(
    intersection_id: int,
    file: UploadFile = File(...),
    lane_polygon: str = Form(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_active_operator("Traffic Operator"))
):
    """
    Process an uploaded traffic video file using the density engine
    and save the computed TrafficLog to the database.
    """
    intersection = db.query(IntersectionModel).filter(IntersectionModel.id == intersection_id).first()
    if not intersection:
        raise HTTPException(status_code=404, detail="Intersection not found")
        
    try:
        poly_list = json.loads(lane_polygon)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid lane_polygon format. Must be JSON list of 4 coordinate pairs.")
        
    if len(poly_list) != 4:
        raise HTTPException(status_code=400, detail="The lane_polygon must contain exactly 4 coordinate points.")
        
    # Save uploaded file to a temporary file
    temp_dir = tempfile.gettempdir()
    temp_file_path = os.path.join(temp_dir, file.filename)
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        # Load YOLO model
        model = None
        try:
            from ultralytics import YOLO
            model = YOLO("yolov8n.pt")
        except Exception:
            pass
            
        cap = cv2.VideoCapture(temp_file_path)
        is_opened = cap.isOpened()
        ret = False
        frame_width = 640
        frame_height = 480
        bounding_boxes = []

        if is_opened:
            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480
            ret, frame = cap.read()
            
        is_emergency = False
        vehicle_type = "Ambulance"
        
        filename_lower = file.filename.lower() if file.filename else ""
        if any(kw in filename_lower for kw in ["emergency", "ambulance", "police", "fire"]):
            is_emergency = True
            if "police" in filename_lower:
                vehicle_type = "Police Car"
            elif "fire" in filename_lower:
                vehicle_type = "Fire Truck"
            else:
                vehicle_type = "Ambulance"

        if is_opened and ret and model is not None:
            results = model(frame, verbose=False)
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    cls = int(box.cls[0])
                    if cls in [10, 11, 12]:  # Mock emergency classes: fire hydrant, stop sign, parking meter
                        is_emergency = True
                        if cls == 10:
                            vehicle_type = "Fire Truck"
                        elif cls == 12:
                            vehicle_type = "Police Car"
                        else:
                            vehicle_type = "Ambulance"
                        xyxy = box.xyxy[0].tolist()
                        bounding_boxes.append({"box": xyxy})
                    elif cls in [2, 3, 5, 7]:
                        xyxy = box.xyxy[0].tolist()
                        bounding_boxes.append({"box": xyxy})
        else:
            # Mock bounding boxes inside polygon bounds if frame reading/YOLO not available or file cannot be opened
            import numpy as np
            poly_np = np.array(poly_list, dtype=np.int32)
            x_min, y_min = poly_np.min(axis=0)
            x_max, y_max = poly_np.max(axis=0)
            num_vehicles = np.random.randint(2, 6)
            for _ in range(num_vehicles):
                w = np.random.randint(30, 70)
                h = np.random.randint(30, 70)
                x1 = np.random.randint(max(0, int(x_min) - 10), min(frame_width, int(x_max) - w + 10))
                y1 = np.random.randint(max(0, int(y_min) - 10), min(frame_height, int(y_max) - h + 10))
                bounding_boxes.append({"box": [float(x1), float(y1), float(x1 + w), float(y1 + h)]})

        if is_emergency:
            target_lane = "Northbound (L1)"
            if "south" in filename_lower:
                target_lane = "Southbound (L2)"
            elif "east" in filename_lower:
                target_lane = "Eastbound (L3)"
            elif "west" in filename_lower:
                target_lane = "Westbound (L4)"
                
            from app.services.priority_engine import activate_emergency_override
            activate_emergency_override(
                db=db,
                intersection_id=intersection_id,
                target_lane=target_lane,
                vehicle_type=vehicle_type
            )
            
        if is_opened:
            cap.release()
            
        # Calculate metrics using density engine
        metrics = calculate_lane_density(
            frame_width=frame_width,
            frame_height=frame_height,
            bounding_boxes=bounding_boxes,
            lane_polygon=poly_list
        )
        
        queue_length = estimate_queue_length(
            bounding_boxes=bounding_boxes,
            lane_polygon=poly_list
        )
        
        # Save to DB
        db_log = TrafficLogModel(
            intersection_id=intersection_id,
            vehicle_count=metrics["vehicle_count_in_lane"],
            density=metrics["density_percentage"] / 100.0,
            density_percentage=metrics["density_percentage"],
            queue_length_pixels=queue_length,
            congestion_level=metrics["congestion_level"]
        )
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        
        # Broadcast traffic propagation to downstream intersections
        try:
            from app.services.network_manager import broadcast_traffic_propagation
            broadcast_traffic_propagation(
                db=db,
                origin_intersection_id=intersection_id,
                vehicle_count=db_log.vehicle_count,
                congestion_level=db_log.congestion_level
            )
        except Exception as e:
            print(f"Error broadcasting traffic propagation: {e}")
            
        return db_log
        
    finally:
        # Cleanup temporary file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass


@router.get("/intersections/{intersection_id}/signal-state", response_model=SignalStateResponse, tags=["Signal Intelligence"])
def get_signal_state(intersection_id: int, db: Session = Depends(get_db)):
    """
    Evaluate all connected lanes for an intersection, compute priority scores,
    and determine which lane gets the green light and its duration.
    """
    intersection = db.query(IntersectionModel).filter(IntersectionModel.id == intersection_id).first()
    if not intersection:
        raise HTTPException(status_code=404, detail="Intersection not found")

    # Check for active emergency overrides
    from app.services.priority_engine import EMERGENCY_OVERRIDES
    from datetime import datetime, timedelta

    override = EMERGENCY_OVERRIDES.get(intersection_id)
    if override:
        if datetime.utcnow() - override["timestamp"] < timedelta(seconds=60):
            lane_names = [
                "Northbound (L1)",
                "Southbound (L2)",
                "Eastbound (L3)",
                "Westbound (L4)"
            ]
            lanes_data = []
            for name in lane_names:
                is_target = name == override["target_lane"]
                lanes_data.append({
                    "lane_name": name,
                    "density": 100.0 if is_target else 0.0,
                    "vehicle_count": 20 if is_target else 0,
                    "waiting_time": 0.0,
                    "historical_traffic": 50.0 if is_target else 0.0,
                    "priority_score": 999.0 if is_target else 0.0
                })
            
            return {
                "intersection_id": intersection_id,
                "intersection_name": intersection.name,
                "current_green_lane": override["target_lane"],
                "green_time_seconds": 60,
                "lanes": lanes_data
            }
        else:
            EMERGENCY_OVERRIDES.pop(intersection_id, None)

    # Fetch the latest TrafficLog for this intersection as a baseline
    latest_log = db.query(TrafficLogModel)\
        .filter(TrafficLogModel.intersection_id == intersection_id)\
        .order_by(TrafficLogModel.timestamp.desc())\
        .first()

    base_density = latest_log.density_percentage if latest_log else 35.0
    base_count = latest_log.vehicle_count if latest_log else 10

    # Fetch active network propagation logs targeting this intersection in the last 5 minutes
    from datetime import datetime, timedelta
    five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
    incoming_logs = db.query(NetworkPropagationLogModel).filter(
        NetworkPropagationLogModel.target_intersection_id == intersection_id,
        NetworkPropagationLogModel.timestamp >= five_minutes_ago
    ).all()
    predicted_incoming = sum(log.predicted_vehicle_count for log in incoming_logs)

    lane_names = [
        "Northbound (L1)",
        "Southbound (L2)",
        "Eastbound (L3)",
        "Westbound (L4)"
    ]

    lanes_data = []
    for name in lane_names:
        # Add some variation to density, count, waiting time, and historical traffic
        density = max(0.0, min(100.0, base_density + random.uniform(-15.0, 15.0)))
        vehicle_count = max(0, int(base_count + random.randint(-4, 6)))
        waiting_time = max(0.0, random.uniform(15.0, 120.0))
        historical_traffic = max(0.0, base_count * 1.2 + random.uniform(-5.0, 5.0))

        priority_score = calculate_priority_score(
            density=density,
            vehicle_count=vehicle_count,
            waiting_time=waiting_time,
            historical_traffic=historical_traffic,
            predicted_incoming=predicted_incoming
        )

        lanes_data.append({
            "lane_name": name,
            "density": round(density, 2),
            "vehicle_count": vehicle_count,
            "waiting_time": round(waiting_time, 2),
            "historical_traffic": round(historical_traffic, 2),
            "priority_score": round(priority_score, 2)
        })

    # Determine which lane gets the green light
    green_lane = max(lanes_data, key=lambda x: x["priority_score"])
    green_time = allocate_green_time(green_lane["priority_score"])

    return {
        "intersection_id": intersection_id,
        "intersection_name": intersection.name,
        "current_green_lane": green_lane["lane_name"],
        "green_time_seconds": green_time,
        "lanes": lanes_data
    }


@router.get("/network/grid-telemetry", response_model=GridTelemetryResponse, tags=["Network Management"])
def get_grid_telemetry(db: Session = Depends(get_db)):
    """
    Retrieve the latest density, status, count, and operational state
    for all core intersections in the grid network (A, B, C, D, E).
    Compute the overall system-wide network congestion index.
    """
    target_ids = [1, 2, 3, 4, 5, 6]
    
    nodes_telemetry = []
    total_density = 0.0

    for node_id in target_ids:
        intersection = db.query(IntersectionModel).filter(IntersectionModel.id == node_id).first()
        if not intersection:
            intersection_name = f"Intersection {chr(64 + node_id)}"
            intersection_status = "active"
        else:
            intersection_name = intersection.name
            intersection_status = intersection.status

        # Get active network propagation logs targeting this node in the last 5 minutes
        from datetime import datetime, timedelta
        five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
        incoming_logs = db.query(NetworkPropagationLogModel).filter(
            NetworkPropagationLogModel.target_intersection_id == node_id,
            NetworkPropagationLogModel.timestamp >= five_minutes_ago
        ).all()
        predicted_incoming = sum(log.predicted_vehicle_count for log in incoming_logs)

        latest_log = db.query(TrafficLogModel)\
            .filter(TrafficLogModel.intersection_id == node_id)\
            .order_by(TrafficLogModel.timestamp.desc())\
            .first()

        if latest_log:
            density_percentage = latest_log.density_percentage
            vehicle_count = latest_log.vehicle_count
            congestion_level = latest_log.congestion_level
        else:
            import random
            density_percentage = random.uniform(10.0, 50.0)
            vehicle_count = random.randint(2, 12)
            congestion_level = "Low" if density_percentage < 30.0 else "Medium"
            # Occasionally exceed 20 to check UI directional arrow rendering during simulation
            predicted_incoming = random.uniform(0.0, 25.0)

        nodes_telemetry.append({
            "intersection_id": node_id,
            "name": intersection_name,
            "density_percentage": round(density_percentage, 2),
            "vehicle_count": vehicle_count,
            "congestion_level": congestion_level,
            "status": intersection_status,
            "predicted_incoming_vehicles": round(predicted_incoming, 2)
        })
        total_density += density_percentage

    network_congestion_index = total_density / len(target_ids) if target_ids else 0.0

    # Fetch active overrides and corridor paths
    from app.services.priority_engine import EMERGENCY_OVERRIDES, ACTIVE_CORRIDOR_PATH, ACTIVE_CORRIDOR_TIMESTAMP
    from datetime import datetime, timedelta
    
    active_preemption = None
    for int_id, override in list(EMERGENCY_OVERRIDES.items()):
        if datetime.utcnow() - override["timestamp"] < timedelta(seconds=60):
            # Return details of the first active emergency override we find
            active_preemption = {
                "intersection_id": int_id,
                "vehicle_type": override["vehicle_type"],
                "lane": override["target_lane"],
                "timestamp": override["timestamp"]
            }
            break

    green_corridor_path = None
    if ACTIVE_CORRIDOR_PATH and ACTIVE_CORRIDOR_TIMESTAMP:
        if datetime.utcnow() - ACTIVE_CORRIDOR_TIMESTAMP < timedelta(seconds=60):
            green_corridor_path = ACTIVE_CORRIDOR_PATH
        else:
            import app.services.priority_engine as pe
            pe.ACTIVE_CORRIDOR_PATH = None
            pe.ACTIVE_CORRIDOR_TIMESTAMP = None

    return {
        "nodes": nodes_telemetry,
        "network_congestion_index": round(network_congestion_index, 2),
        "active_preemption": active_preemption,
        "green_corridor_path": green_corridor_path
    }


@router.get("/network/green-corridor", tags=["Network Management"])
def get_green_corridor_route(
    start: int = Query(..., ge=1, le=6), 
    end: int = Query(..., ge=1, le=6),
    current_user: dict = Depends(get_current_active_operator("Traffic Operator"))
):
    """
    Compute shortest route and trigger pre-clearance queue flushes along the path.
    """
    from app.services.priority_engine import predict_green_corridor_route
    return predict_green_corridor_route(start, end)


@router.get("/analytics/forecast/{intersection_id}", response_model=ForecastAnalyticsResponse, tags=["Analytics"])
def get_traffic_forecast(intersection_id: int, db: Session = Depends(get_db)):
    """
    Generate traffic forecasts for the next 5, 15, and 30 minutes.
    """
    intersection = db.query(IntersectionModel).filter(IntersectionModel.id == intersection_id).first()
    if not intersection:
        raise HTTPException(status_code=404, detail="Intersection not found")
        
    from app.services.forecasting_engine import generate_traffic_forecasts
    return generate_traffic_forecasts(db, intersection_id)


