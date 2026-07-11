from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ---------- Auth ----------

class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    full_name: str
    account_id: str

    class Config:
        from_attributes = True


# ---------- Hosted Zones ----------
class BulkDeleteRequest(BaseModel):
    ids: List[str]
class HostedZoneCreate(BaseModel):
    name: str = Field(..., description="Domain name, e.g. example.com")
    comment: Optional[str] = ""
    private_zone: bool = False


class HostedZoneUpdate(BaseModel):
    comment: Optional[str] = None


class HostedZoneOut(BaseModel):
    id: str
    name: str
    comment: Optional[str]
    private_zone: bool
    zone_type: str
    record_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HostedZoneListOut(BaseModel):
    items: List[HostedZoneOut]
    total: int
    page: int
    page_size: int


# ---------- Records ----------

class RecordCreate(BaseModel):
    name: str
    record_type: str
    ttl: int = 300
    routing_policy: str = "Simple"
    values: List[str]


class RecordUpdate(BaseModel):
    ttl: Optional[int] = None
    routing_policy: Optional[str] = None
    values: Optional[List[str]] = None


class RecordOut(BaseModel):
    id: str
    hosted_zone_id: str
    name: str
    record_type: str
    ttl: int
    routing_policy: str
    values: List[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RecordListOut(BaseModel):
    items: List[RecordOut]
    total: int
    page: int
    page_size: int