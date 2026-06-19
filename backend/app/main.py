from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.models.traffic import Intersection, TrafficLog, EmergencyPreemptionLog  # Import models to register them

# Create database tables automatically
Base.metadata.create_all(bind=engine)

# Seed database with intersections if empty or missing
from app.core.database import SessionLocal
db = SessionLocal()
try:
    required_intersections = [
        {"id": 1, "name": "Intersection A (Broadway & 42nd)", "latitude": 40.7580, "longitude": -73.9855, "status": "active"},
        {"id": 2, "name": "Intersection B (5th Ave & 34th)", "latitude": 40.7484, "longitude": -73.9857, "status": "active"},
        {"id": 3, "name": "Intersection C (FDR Drive & E 34th)", "latitude": 40.7431, "longitude": -73.9717, "status": "congested"},
        {"id": 4, "name": "Intersection D (Madison Ave & 57th)", "latitude": 40.7624, "longitude": -73.9723, "status": "active"},
        {"id": 5, "name": "Intersection E (Lexington & 86th)", "latitude": 40.7794, "longitude": -73.9556, "status": "maintenance"},
        {"id": 6, "name": "Intersection F (7th Ave & 23rd St)", "latitude": 40.7441, "longitude": -73.9961, "status": "active"},
    ]
    for item in required_intersections:
        exists = db.query(Intersection).filter(Intersection.id == item["id"]).first()
        if not exists:
            new_intersection = Intersection(
                id=item["id"],
                name=item["name"],
                latitude=item["latitude"],
                longitude=item["longitude"],
                status=item["status"]
            )
            db.add(new_intersection)
        else:
            exists.name = item["name"]
            exists.latitude = item["latitude"]
            exists.longitude = item["longitude"]
            exists.status = item["status"]
    db.commit()
except Exception as e:
    print(f"Error seeding database: {e}")
    db.rollback()
finally:
    db.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_STR}/openapi.json"
)

# CORS middleware configuration
import os

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

cors_allowed = os.getenv("CORS_ALLOWED_ORIGINS")
if cors_allowed:
    origins.extend([o.strip() for o in cors_allowed.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.endpoints.traffic import router as traffic_router
from app.api.auth import router as auth_router
app.include_router(traffic_router, prefix=settings.API_STR)
app.include_router(auth_router, prefix=settings.API_STR)

@app.get(f"{settings.API_STR}/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "database": "connected"
    }
