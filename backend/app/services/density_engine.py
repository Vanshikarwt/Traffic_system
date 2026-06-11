import numpy as np
import cv2
import math
from typing import List, Dict, Any, Union, Tuple

def calculate_lane_density(
    frame_width: int,
    frame_height: int,
    bounding_boxes: List[Dict[str, Any]],
    lane_polygon: List[List[float]]
) -> Dict[str, Any]:
    """
    Calculate the traffic density of a lane polygon.

    Args:
        frame_width: Width of the frame.
        frame_height: Height of the frame.
        bounding_boxes: A list of dicts, each containing coordinates from YOLO detection.
                        Could be in formats like {"box": [x1, y1, x2, y2]} or {"x1": x1, ...}.
        lane_polygon: A list of 4 coordinate pairs [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
                      marking the boundaries of a single lane.

    Returns:
        A dictionary containing: density_percentage, congestion_level, and vehicle_count_in_lane.
    """
    # Convert lane_polygon to np.float32 for OpenCV functions
    poly_np = np.array(lane_polygon, dtype=np.float32)

    # Calculate total area of the polygon using cv2.contourArea
    # Absolute value is taken because contourArea can return negative values depending on orientation
    polygon_area = abs(float(cv2.contourArea(poly_np)))

    vehicle_count_in_lane = 0
    total_vehicle_area = 0.0

    for bbox in bounding_boxes:
        coords = None
        if isinstance(bbox, dict):
            if "box" in bbox:
                coords = bbox["box"]
            elif "bbox" in bbox:
                coords = bbox["bbox"]
            elif all(k in bbox for k in ("x1", "y1", "x2", "y2")):
                coords = [bbox["x1"], bbox["y1"], bbox["x2"], bbox["y2"]]
        elif isinstance(bbox, (list, tuple)):
            # Fallback for list/tuple coordinates for backward compatibility
            coords = bbox

        if not coords or len(coords) < 4:
            continue

        x1, y1, x2, y2 = coords[:4]

        # Calculate bottom-center coordinate of the vehicle box
        x_center = (x1 + x2) / 2.0
        y_bottom = y2

        # Check if the bottom-center point falls inside the lane polygon
        # cv2.pointPolygonTest returns >= 0 if the point is inside or on the contour
        inside = cv2.pointPolygonTest(poly_np, (float(x_center), float(y_bottom)), False)
        if inside >= 0:
            vehicle_count_in_lane += 1
            width = x2 - x1
            height = y2 - y1
            total_vehicle_area += (width * height)

    if polygon_area > 0:
        density_percentage = (total_vehicle_area / polygon_area) * 100.0
    else:
        density_percentage = 0.0

    # Cap density percentage at 100.0 and keep it non-negative
    density_percentage = min(max(density_percentage, 0.0), 100.0)

    # Assign a congestion level string: 'Low' (<30%), 'Medium' (30%-70%), 'Heavy' (>70%)
    if density_percentage < 30.0:
        congestion_level = "Low"
    elif density_percentage <= 70.0:
        congestion_level = "Medium"
    else:
        congestion_level = "Heavy"

    return {
        "density_percentage": density_percentage,
        "congestion_level": congestion_level,
        "vehicle_count_in_lane": vehicle_count_in_lane
    }

def estimate_queue_length(
    bounding_boxes: List[Union[Dict[str, Any], List[float], Tuple[float, ...]]],
    lane_polygon: List[List[float]]
) -> float:
    """
    Estimate the queue length of vehicles in the lane polygon.

    Args:
        bounding_boxes: List of bounding boxes (as dicts or lists/tuples).
        lane_polygon: List of coordinate points defining the lane boundary.

    Returns:
        Euclidean distance between the highest and lowest y-coordinate vehicles inside the polygon.
    """
    poly_np = np.array(lane_polygon, dtype=np.float32)
    vehicles_inside = []

    for bbox in bounding_boxes:
        coords = None
        if isinstance(bbox, dict):
            if "box" in bbox:
                coords = bbox["box"]
            elif "bbox" in bbox:
                coords = bbox["bbox"]
            elif all(k in bbox for k in ("x1", "y1", "x2", "y2")):
                coords = [bbox["x1"], bbox["y1"], bbox["x2"], bbox["y2"]]
        elif isinstance(bbox, (list, tuple)):
            coords = bbox

        if not coords or len(coords) < 4:
            continue

        x1, y1, x2, y2 = coords[:4]
        x_center = (x1 + x2) / 2.0
        y_bottom = y2

        inside = cv2.pointPolygonTest(poly_np, (float(x_center), float(y_bottom)), False)
        if inside >= 0:
            vehicles_inside.append((x_center, y_bottom))

    if len(vehicles_inside) < 2:
        return 0.0

    # Find the vehicles furthest apart along the queue direction
    highest_y_vehicle = max(vehicles_inside, key=lambda pt: pt[1])
    lowest_y_vehicle = min(vehicles_inside, key=lambda pt: pt[1])

    dx = highest_y_vehicle[0] - lowest_y_vehicle[0]
    dy = highest_y_vehicle[1] - lowest_y_vehicle[1]
    return math.sqrt(dx*dx + dy*dy)
