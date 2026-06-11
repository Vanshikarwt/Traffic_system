from sqlalchemy.orm import Session
from app.models.traffic import NetworkPropagationLog

# Network Adjacency Graph: origin_id -> list of tuples of (target_id, travel_time_seconds)
# Intersection mapping:
# 1: Intersection A (Broadway & 42nd)
# 2: Intersection B (5th Ave & 34th)
# 3: Intersection C (FDR Drive & E 34th)
# 4: Intersection D (Madison Ave & 57th)
# 5: Intersection E (Lexington & 86th)
# 6: Intersection F (7th Ave & 23rd St)
NETWORK_GRAPH = {
    1: [(2, 45), (4, 60)],  # A -> B, D
    2: [(3, 45)],           # B -> C
    3: [(5, 45)],           # C -> E
    4: [(5, 60), (6, 45)],  # D -> E, F
    5: [(6, 45)],           # E -> F
    6: [(1, 45)],           # F -> A
}

# Volume scaling factor depending on the congestion level of the origin node
CONGESTION_PROPAGATION_FACTOR = {
    "Heavy": 0.8,
    "Medium": 0.5,
    "Low": 0.2
}

def broadcast_traffic_propagation(
    db: Session,
    origin_intersection_id: int,
    vehicle_count: int,
    congestion_level: str
):
    """
    Identify downstream neighboring nodes based on the network graph layout,
    calculate the predicted volume of incoming traffic arriving at those neighbor nodes,
    and save these predictions to the database.
    """
    downstream_edges = NETWORK_GRAPH.get(origin_intersection_id, [])
    if not downstream_edges:
        return

    # Calculate propagation volume
    factor = CONGESTION_PROPAGATION_FACTOR.get(congestion_level, 0.3)
    total_propagated_vehicles = vehicle_count * factor
    
    # Divide volume equally among downstream neighbors
    vehicles_per_neighbor = total_propagated_vehicles / len(downstream_edges)

    for target_id, travel_time in downstream_edges:
        log_entry = NetworkPropagationLog(
            origin_intersection_id=origin_intersection_id,
            target_intersection_id=target_id,
            predicted_vehicle_count=round(vehicles_per_neighbor, 2),
            travel_time_seconds=travel_time
        )
        db.add(log_entry)
    db.commit()
