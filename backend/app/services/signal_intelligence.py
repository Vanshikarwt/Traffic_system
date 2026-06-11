def calculate_priority_score(
    density: float,
    vehicle_count: int,
    waiting_time: float,
    historical_traffic: float,
    predicted_incoming: float = 0.0
) -> float:
    """
    Calculate intersection lane priority score.
    Formula: (0.4 * density) + (0.3 * vehicle_count) + (0.2 * waiting_time) + (0.1 * (historical_traffic + predicted_incoming))
    """
    boosted_historical = historical_traffic + predicted_incoming
    return (0.4 * density) + (0.3 * vehicle_count) + (0.2 * waiting_time) + (0.1 * boosted_historical)


def allocate_green_time(priority_score: float) -> int:
    """
    Allocate dynamic green light time mapped linearly to the priority score.
    Base mapping: 15 + (priority_score * 0.45)
    Capped between 15 seconds and 60 seconds.
    """
    calculated_time = 15.0 + (priority_score * 0.45)
    # Apply safety constraints (min 15s, max 60s)
    capped_time = max(15.0, min(calculated_time, 60.0))
    return int(round(capped_time))
