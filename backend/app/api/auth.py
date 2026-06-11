import hashlib
import jwt
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Authentication"])

SECRET_KEY = "aecb7f3299719eb793ef1ef868bc22a1b92015fa682a2657e23112837eb8971f"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

ROLE_HIERARCHY = {
    "Admin": 3,
    "Traffic Operator": 2,
    "Viewer": 1
}

def hash_password(password: str) -> str:
    salt = b"traffic_center_shared_salt"
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return key.hex()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

# Pre-seeded users dictionary
USERS = {
    "admin": {
        "username": "admin",
        "password_hash": hash_password("adminpassword"),
        "role": "Admin"
    },
    "operator": {
        "username": "operator",
        "password_hash": hash_password("operatorpassword"),
        "role": "Traffic Operator"
    },
    "viewer": {
        "username": "viewer",
        "password_hash": hash_password("viewerpassword"),
        "role": "Viewer"
    }
}

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest):
    user = USERS.get(request.username)
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user["username"],
        "role": user["role"]
    }

def get_current_active_operator(required_role: str):
    def dependency(request: Request):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header missing",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header must be Bearer token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = parts[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            role: str = payload.get("role")
            if username is None or role is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials payload",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user = USERS.get(username)
        if not user or user["role"] != role:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or invalid role",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        user_clearance = ROLE_HIERARCHY.get(role, 0)
        required_clearance = ROLE_HIERARCHY.get(required_role, 0)
        if user_clearance < required_clearance:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Insufficient privileges",
            )
            
        return user
    return dependency
