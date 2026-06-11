from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Intersection(Base):
    __tablename__ = "intersections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(String, default="active")

    logs = relationship("TrafficLog", back_populates="intersection", cascade="all, delete-orphan")

class TrafficLog(Base):
    __tablename__ = "traffic_logs"

    id = Column(Integer, primary_key=True, index=True)
    intersection_id = Column(Integer, ForeignKey("intersections.id", ondelete="CASCADE"), nullable=False)
    vehicle_count = Column(Integer, nullable=False)
    density = Column(Float, nullable=False)
    density_percentage = Column(Float, nullable=True)
    queue_length_pixels = Column(Float, nullable=True)
    congestion_level = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    intersection = relationship("Intersection", back_populates="logs")


class NetworkPropagationLog(Base):
    __tablename__ = "network_propagation_logs"

    id = Column(Integer, primary_key=True, index=True)
    origin_intersection_id = Column(Integer, ForeignKey("intersections.id", ondelete="CASCADE"), nullable=False)
    target_intersection_id = Column(Integer, ForeignKey("intersections.id", ondelete="CASCADE"), nullable=False)
    predicted_vehicle_count = Column(Float, nullable=False)
    travel_time_seconds = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    origin = relationship("Intersection", foreign_keys=[origin_intersection_id])
    target = relationship("Intersection", foreign_keys=[target_intersection_id])


class EmergencyPreemptionLog(Base):
    __tablename__ = "emergency_preemption_logs"

    id = Column(Integer, primary_key=True, index=True)
    intersection_id = Column(Integer, ForeignKey("intersections.id", ondelete="CASCADE"), nullable=False)
    vehicle_type = Column(String, nullable=False)
    lane = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    intersection = relationship("Intersection")

