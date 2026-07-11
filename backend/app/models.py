import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: gen_id("usr"))
    username = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)  # mock only, plaintext
    full_name = Column(String, nullable=False)
    account_id = Column(String, nullable=False, default="123456789012")
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    token = Column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sessions")


class HostedZone(Base):
    __tablename__ = "hosted_zones"

    id = Column(String, primary_key=True, default=lambda: gen_id("zone"))
    name = Column(String, nullable=False, index=True)
    comment = Column(Text, nullable=True, default="")
    private_zone = Column(Boolean, default=False)
    zone_type = Column(String, default="Public")  # Public | Private
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    records = relationship(
        "Record", back_populates="hosted_zone", cascade="all, delete-orphan"
    )


class Record(Base):
    __tablename__ = "records"

    id = Column(String, primary_key=True, default=lambda: gen_id("rrset"))
    hosted_zone_id = Column(String, ForeignKey("hosted_zones.id"), nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    record_type = Column(String, nullable=False, index=True)
    ttl = Column(Integer, default=300)
    routing_policy = Column(String, default="Simple")
    values = Column(Text, nullable=False)  # newline-separated values
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    hosted_zone = relationship("HostedZone", back_populates="records")