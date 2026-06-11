import cv2
import numpy as np
import time
import logging
from typing import List
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.traffic import TrafficLog, Intersection
from app.services.density_engine import calculate_lane_density, estimate_queue_length

logger = logging.getLogger(__name__)

def run_video_processing(
    intersection_id: int,
    video_path: str,
    lane_polygon: List[List[float]],
    mock_mode: bool = False
):
    """
    Run video processing loop on a video source or mock generator, updating
    lane density, queue length, and congestion levels.
    """
    logger.info(f"Initiating video processing job for Intersection ID {intersection_id} (mock_mode={mock_mode})")
    
    with SessionLocal() as db:
        # 1. Verify intersection exists
        intersection = db.query(Intersection).filter(Intersection.id == intersection_id).first()
        if not intersection:
            logger.error(f"Intersection {intersection_id} not found in database. Aborting.")
            return
            
        poly_np = np.array(lane_polygon, dtype=np.int32)
        
        # 2. Run in mock mode if explicitly requested or if we're simulating a video file
        if mock_mode or not video_path:
            logger.info(f"Running in simulation mode for {intersection.name}")
            
            # Simulate 30 frames of traffic updates
            for frame_idx in range(30):
                # Simulated vehicles (0 to 6 vehicles)
                num_vehicles = np.random.randint(0, 7)
                bounding_boxes = []
                
                # Get bounding box coordinates bounded around the polygon
                x_min, y_min = poly_np.min(axis=0)
                x_max, y_max = poly_np.max(axis=0)
                
                for _ in range(num_vehicles):
                    w = np.random.randint(30, 70)
                    h = np.random.randint(30, 70)
                    x1 = np.random.randint(max(0, x_min - 20), min(640, x_max - w + 20))
                    y1 = np.random.randint(max(0, y_min - 20), min(480, y_max - h + 20))
                    bounding_boxes.append([float(x1), float(y1), float(x1 + w), float(y1 + h)])
                    
                # Create mock frame
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                
                # Compute metrics using the density engine
                frame_height, frame_width = frame.shape[:2]
                density_result = calculate_lane_density(
                    frame_width=frame_width,
                    frame_height=frame_height,
                    bounding_boxes=bounding_boxes,
                    lane_polygon=lane_polygon
                )
                density_percentage = density_result["density_percentage"]
                congestion_level = density_result["congestion_level"]
                verified_count = density_result["vehicle_count_in_lane"]
                queue_length_pixels = estimate_queue_length(bounding_boxes, lane_polygon)
                
                # Commit TrafficLog to DB
                log = TrafficLog(
                    intersection_id=intersection_id,
                    vehicle_count=verified_count,
                    density=density_percentage / 100.0,
                    density_percentage=density_percentage,
                    queue_length_pixels=queue_length_pixels,
                    congestion_level=congestion_level
                )
                db.add(log)
                db.commit()
                
                logger.info(
                    f"Frame {frame_idx + 1}/30 processed: count={verified_count}, "
                    f"density={density_percentage:.2f}%, queue={queue_length_pixels:.2f}px, "
                    f"congestion={congestion_level}"
                )
                time.sleep(0.2)
                
            logger.info(f"Mock video processing completed successfully for {intersection.name}")
            return

        # 3. Real video processing using YOLOv8
        try:
            from ultralytics import YOLO
            logger.info("Loading YOLOv8 object detection model...")
            model = YOLO("yolov8n.pt")
        except Exception as e:
            logger.warning(f"Unable to load YOLOv8 model ({e}). Falling back to simulation mode.")
            db.close()
            run_video_processing(intersection_id, video_path, lane_polygon, mock_mode=True)
            return

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"Failed to open video file source: {video_path}")
            return

        frame_count = 0
        logger.info(f"Starting real video capture processing loop for: {video_path}")
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_count += 1
            
            # Run YOLO detector on current frame
            # COCO classes: 2 = car, 3 = motorcycle, 5 = bus, 7 = truck
            results = model(frame, verbose=False)
            
            bounding_boxes = []
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    cls = int(box.cls[0])
                    if cls in [2, 3, 5, 7]:
                        xyxy = box.xyxy[0].tolist()
                        bounding_boxes.append(xyxy)
            
            # Calculate traffic metrics via our density engine
            frame_height, frame_width = frame.shape[:2]
            density_result = calculate_lane_density(
                frame_width=frame_width,
                frame_height=frame_height,
                bounding_boxes=bounding_boxes,
                lane_polygon=lane_polygon
            )
            density_percentage = density_result["density_percentage"]
            congestion_level = density_result["congestion_level"]
            verified_count = density_result["vehicle_count_in_lane"]
            queue_length_pixels = estimate_queue_length(bounding_boxes, lane_polygon)
                    
            # Commit frame metrics to database
            log = TrafficLog(
                intersection_id=intersection_id,
                vehicle_count=verified_count,
                density=density_percentage / 100.0,
                density_percentage=density_percentage,
                queue_length_pixels=queue_length_pixels,
                congestion_level=congestion_level
            )
            db.add(log)
            db.commit()
            
            logger.debug(f"Frame {frame_count} committed: density={density_percentage:.1f}%, queue={queue_length_pixels:.1f}px")

        cap.release()
        logger.info(f"Real video processing completed. Total frames processed: {frame_count}")
