import asyncio
from datetime import datetime
from sqlalchemy.orm import Session

# Global dictionary to store emergency overrides
# Key: intersection_id (int) -> Value: dict with keys "target_lane", "vehicle_type", "timestamp"
EMERGENCY_OVERRIDES = {}

def activate_emergency_override(db: Session, intersection_id: int, target_lane: str, vehicle_type: str):
    """
    Override current signal state for the given intersection.
    Set target_lane to green, force all conflicting lanes to red, and log to DB.
    """
    from app.models.traffic import EmergencyPreemptionLog
    
    # Store in the global override dictionary
    EMERGENCY_OVERRIDES[intersection_id] = {
        "target_lane": target_lane,
        "vehicle_type": vehicle_type,
        "timestamp": datetime.utcnow()
    }
    
    # Write log entry to database
    log_entry = EmergencyPreemptionLog(
        intersection_id=intersection_id,
        vehicle_type=vehicle_type,
        lane=target_lane,
        timestamp=datetime.utcnow()
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    
    return log_entry

def get_edge_weight(source: int, target: int) -> int:
    graph = {
        1: [(2, 45), (4, 60)],
        2: [(3, 45)],
        3: [(5, 45)],
        4: [(5, 60), (6, 45)],
        5: [(6, 45)],
        6: [(1, 45)]
    }
    for neighbor, weight in graph.get(source, []):
        if neighbor == target:
            return weight
    return 45

def find_shortest_path(start: int, end: int):
    graph = {
        1: [(2, 45), (4, 60)],
        2: [(3, 45)],
        3: [(5, 45)],
        4: [(5, 60), (6, 45)],
        5: [(6, 45)],
        6: [(1, 45)]
    }
    
    import heapq
    queue = [(0, start, [start])]
    visited = set()
    
    while queue:
        (cost, node, path) = heapq.heappop(queue)
        if node in visited:
            continue
        visited.add(node)
        
        if node == end:
            return path, cost
            
        for neighbor, weight in graph.get(node, []):
            if neighbor not in visited:
                heapq.heappush(queue, (cost + weight, neighbor, path + [neighbor]))
                
    return [], 0

async def trigger_pre_clearance(intersection_id: int):
    """
    Force downstream signal to flush out queues by setting target_lane to green.
    """
    EMERGENCY_OVERRIDES[intersection_id] = {
        "target_lane": "Northbound (L1)", # default corridor lane to flush
        "vehicle_type": "Pre-Clearance Corridor",
        "timestamp": datetime.utcnow()
    }
    print(f"[PRE-CLEARANCE] Flushing queues at intersection {intersection_id}")

async def schedule_pre_clearance(intersection_id: int, delay_seconds: float):
    if delay_seconds > 0:
        await asyncio.sleep(delay_seconds)
    await trigger_pre_clearance(intersection_id)

# Global variables for active green corridor
ACTIVE_CORRIDOR_PATH = None
ACTIVE_CORRIDOR_TIMESTAMP = None

def predict_green_corridor_route(current_intersection_id: int, destination_intersection_id: int):
    """
    Calculate shortest route between two intersections and schedule pre-clearance
    along downstream nodes 30 seconds before expected arrival.
    """
    global ACTIVE_CORRIDOR_PATH, ACTIVE_CORRIDOR_TIMESTAMP
    path, cost = find_shortest_path(current_intersection_id, destination_intersection_id)
    if not path or len(path) <= 1:
        return {
            "path": path,
            "total_travel_time_seconds": cost,
            "scheduled_pre_clearances": []
        }
    
    ACTIVE_CORRIDOR_PATH = path
    ACTIVE_CORRIDOR_TIMESTAMP = datetime.utcnow()
    
    scheduled = []
    accumulated_time = 0
    
    for i in range(1, len(path)):
        node_id = path[i]
        weight = get_edge_weight(path[i-1], node_id)
        accumulated_time += weight
        
        # Schedule 30 seconds before estimated arrival
        trigger_delay = accumulated_time - 30
        
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(schedule_pre_clearance(node_id, max(0.0, trigger_delay)))
        except Exception:
            pass
            
        scheduled.append({
            "intersection_id": node_id,
            "estimated_arrival_seconds": accumulated_time,
            "pre_clearance_trigger_delay_seconds": max(0.0, trigger_delay)
        })
        
    return {
        "path": path,
        "total_travel_time_seconds": cost,
        "scheduled_pre_clearances": scheduled
    }
