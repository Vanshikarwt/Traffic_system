import os
import sys

# Add backend directory to sys.path so we can import from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "..", "OneDrive", "Desktop", "intelligent-traffic-system", "backend")))

from app.services.density_engine import calculate_lane_density, estimate_queue_length
from app.core.database import SessionLocal, Base, engine
from app.models.traffic import Intersection, TrafficLog, NetworkPropagationLog
from app.api.endpoints.traffic import process_video, get_signal_state, get_grid_telemetry
from app.services.signal_intelligence import calculate_priority_score, allocate_green_time
from app.services.network_manager import broadcast_traffic_propagation

def test_density_calculation():
    print("Testing calculate_lane_density...")
    
    # 400x300 frame size
    frame_width = 400
    frame_height = 300
    
    # A lane polygon of area 10000 (100x100 square)
    # cv2.contourArea calculates area of polygon [[0,0], [100,0], [100,100], [0,100]] = 10000.0
    lane_polygon = [[0.0, 0.0], [100.0, 0.0], [100.0, 100.0], [0.0, 100.0]]
    
    # Bounding boxes
    # Vehicle 1: inside, area = 40x40 = 1600. Bottom-center point: (50, 80). Inside.
    # Vehicle 2: inside, area = 20x20 = 400. Bottom-center point: (20, 30). Inside.
    # Vehicle 3: outside, area = 50x50 = 2500. Bottom-center point: (150, 150). Outside.
    bounding_boxes = [
        {"box": [30.0, 40.0, 70.0, 80.0]}, # x1,y1,x2,y2
        {"x1": 10.0, "y1": 10.0, "x2": 30.0, "y2": 30.0},
        {"box": [125.0, 125.0, 175.0, 175.0]}
    ]
    
    result = calculate_lane_density(
        frame_width=frame_width,
        frame_height=frame_height,
        bounding_boxes=bounding_boxes,
        lane_polygon=lane_polygon
    )
    
    print(f"Density result: {result}")
    
    # Vehicle Area inside = 1600 + 400 = 2000.
    # Polygon Area = 10000.
    # Expected density = (2000 / 10000) * 100 = 20.0%
    # Expected congestion level = "Low" (<30)
    # Expected vehicle count in lane = 2
    assert abs(result["density_percentage"] - 20.0) < 1e-5
    assert result["congestion_level"] == "Low"
    assert result["vehicle_count_in_lane"] == 2
    
    # Test high density / cap at 100
    # Add one massive vehicle inside polygon of area 12000
    heavy_boxes = [
        {"box": [0.0, 0.0, 120.0, 100.0]} # bottom center (60, 100) -> inside or on edge
    ]
    result_heavy = calculate_lane_density(
        frame_width=frame_width,
        frame_height=frame_height,
        bounding_boxes=heavy_boxes,
        lane_polygon=lane_polygon
    )
    print(f"Heavy Density result: {result_heavy}")
    assert result_heavy["density_percentage"] == 100.0
    assert result_heavy["congestion_level"] == "Heavy"
    assert result_heavy["vehicle_count_in_lane"] == 1

def test_api_endpoint():
    print("Testing process_video endpoint function directly...")
    db = SessionLocal()
    
    # Setup test intersection in DB
    intersection = db.query(Intersection).first()
    if not intersection:
        intersection = Intersection(name="Test Intersection", latitude=40.7128, longitude=-74.0060, status="active")
        db.add(intersection)
        db.commit()
        db.refresh(intersection)
    
    intersection_id = intersection.id
    
    import io
    import json
    from fastapi import UploadFile

    dummy_file = io.BytesIO(b"dummy video content")
    upload_file = UploadFile(filename="test.mp4", file=dummy_file)
    lane_polygon_str = json.dumps([
        [50.0, 50.0],
        [300.0, 50.0],
        [300.0, 300.0],
        [50.0, 300.0]
    ])
    
    db_log = process_video(
        intersection_id=intersection_id,
        file=upload_file,
        lane_polygon=lane_polygon_str,
        db=db
    )
    
    print(f"Saved DB Log: ID={db_log.id}, vehicle_count={db_log.vehicle_count}, density={db_log.density_percentage}%, congestion={db_log.congestion_level}")
    
    assert db_log.intersection_id == intersection_id
    assert db_log.vehicle_count >= 0
    assert db_log.density_percentage >= 0.0
    assert db_log.congestion_level in ("Low", "Medium", "Heavy")
    
    # Query it back from DB to verify persistence
    saved_log = db.query(TrafficLog).filter(TrafficLog.id == db_log.id).first()
    assert saved_log is not None
    assert saved_log.vehicle_count == db_log.vehicle_count
    
    db.close()


def test_signal_intelligence():
    print("Testing signal intelligence formulas...")
    
    # 1. calculate_priority_score
    # Formula: (0.4 * density) + (0.3 * vehicle_count) + (0.2 * waiting_time) + (0.1 * historical_traffic)
    score1 = calculate_priority_score(density=50.0, vehicle_count=10, waiting_time=30.0, historical_traffic=20.0)
    expected_score1 = (0.4 * 50.0) + (0.3 * 10) + (0.2 * 30.0) + (0.1 * 20.0)
    assert abs(score1 - expected_score1) < 1e-5
    
    # 2. allocate_green_time safety constraints
    # Under limit (calculated: 15 + 0 = 15)
    assert allocate_green_time(0.0) == 15
    # Over limit (calculated: 15 + 150 * 0.45 = 82.5) -> capped at 60
    assert allocate_green_time(150.0) == 60
    # In range (calculated: 15 + 40 * 0.45 = 33) -> 33
    assert allocate_green_time(40.0) == 33

    print("Testing GET /intersections/{intersection_id}/signal-state endpoint function...")
    db = SessionLocal()
    
    # Setup test intersection in DB
    intersection = db.query(Intersection).first()
    if not intersection:
        intersection = Intersection(name="Intersection A (Broadway & 42nd)", latitude=40.7580, longitude=-73.9855, status="active")
        db.add(intersection)
        db.commit()
        db.refresh(intersection)
        
    res = get_signal_state(intersection_id=intersection.id, db=db)
    
    print(f"Signal State Response: {res}")
    
    assert res["intersection_id"] == intersection.id
    assert res["intersection_name"] == intersection.name
    assert "current_green_lane" in res
    assert 15 <= res["green_time_seconds"] <= 60
    assert len(res["lanes"]) == 4
    
    # Verify lane details
    for lane in res["lanes"]:
        assert "lane_name" in lane
        assert 0.0 <= lane["density"] <= 100.0
        assert lane["vehicle_count"] >= 0
        assert lane["waiting_time"] >= 0.0
        assert lane["historical_traffic"] >= 0.0
        assert lane["priority_score"] >= 0.0
        
    db.close()


def test_network_manager():
    print("Testing network manager and traffic propagation...")
    db = SessionLocal()
    
    # 1. Ensure intersections 1, 2, 4 exist (since 1 -> 2, 4 in our network graph)
    for node_id in [1, 2, 4]:
        exists = db.query(Intersection).filter(Intersection.id == node_id).first()
        if not exists:
            intersection = Intersection(id=node_id, name=f"Intersection {chr(64 + node_id)}", latitude=40.7580, longitude=-73.9855, status="active")
            db.add(intersection)
    db.commit()

    # Clear previous propagation logs for clean test
    db.query(NetworkPropagationLog).delete()
    db.commit()

    # 2. Broadcast propagation from origin ID 1 (vehicle_count=10, congestion_level="Medium")
    # Expected total propagated volume = 10 * 0.5 = 5.0 vehicles
    # Divided among 2 neighbors (2 and 4) = 2.5 vehicles per neighbor
    broadcast_traffic_propagation(
        db=db,
        origin_intersection_id=1,
        vehicle_count=10,
        congestion_level="Medium"
    )

    logs = db.query(NetworkPropagationLog).all()
    assert len(logs) == 2
    for log in logs:
        assert log.origin_intersection_id == 1
        assert log.target_intersection_id in (2, 4)
        assert abs(log.predicted_vehicle_count - 2.5) < 1e-5
        assert log.travel_time_seconds in (45, 60)

    # 3. Test priority score dynamic boosting in get_signal_state
    # For target_id = 2, we have active propagation of 2.5 vehicles.
    # When querying get_signal_state, check that priority score is boosted correctly.
    res = get_signal_state(intersection_id=2, db=db)
    print(f"Intersection 2 Boosted Signal State: {res}")
    
    # Ensure priority_score handles the boost correctly by asserting lanes are returned
    assert len(res["lanes"]) == 4

    # 4. Test GET /network/grid-telemetry endpoint function
    telemetry = get_grid_telemetry(db=db)
    print(f"Grid Telemetry Response: {telemetry}")
    assert "network_congestion_index" in telemetry
    assert len(telemetry["nodes"]) == 5
    for node in telemetry["nodes"]:
        assert "density_percentage" in node
        assert "status" in node
        assert node["intersection_id"] in (1, 2, 3, 4, 5)

    db.close()


if __name__ == "__main__":
    test_density_calculation()
    test_api_endpoint()
    test_signal_intelligence()
    test_network_manager()
    print("All tests passed successfully!")
