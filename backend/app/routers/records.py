from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session as DBSession

from ..database import get_db
from ..auth import get_current_user
from ..models import HostedZone, Record, User
from ..schemas import RecordCreate, RecordUpdate, RecordOut, RecordListOut

router = APIRouter(tags=["records"])


def _to_out(record: Record) -> RecordOut:
    return RecordOut(
        id=record.id,
        hosted_zone_id=record.hosted_zone_id,
        name=record.name,
        record_type=record.record_type,
        ttl=record.ttl,
        routing_policy=record.routing_policy,
        values=[v for v in record.values.split("\n") if v.strip() != ""],
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _get_zone_or_404(zone_id: str, db: DBSession) -> HostedZone:
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hosted zone not found")
    return zone


VALID_TYPES = {"A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA"}


@router.get("/api/hosted-zones/{zone_id}/records", response_model=RecordListOut)
def list_records(
    zone_id: str,
    search: Optional[str] = Query(None, description="Search by record name"),
    record_type: Optional[str] = Query(None, description="Filter by record type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_zone_or_404(zone_id, db)

    query = db.query(Record).filter(Record.hosted_zone_id == zone_id)

    if search:
        like = f"%{search}%"
        query = query.filter(or_(Record.name.ilike(like), Record.values.ilike(like)))

    if record_type:
        query = query.filter(Record.record_type == record_type.upper())

    total = query.count()
    query = query.order_by(Record.name.asc())
    records = query.offset((page - 1) * page_size).limit(page_size).all()

    return RecordListOut(
        items=[_to_out(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/api/hosted-zones/{zone_id}/records",
    response_model=RecordOut,
    status_code=status.HTTP_201_CREATED,
)
def create_record(
    zone_id: str,
    payload: RecordCreate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    zone = _get_zone_or_404(zone_id, db)

    rtype = payload.record_type.upper()
    if rtype not in VALID_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported record type '{payload.record_type}'",
        )

    if not payload.values or all(v.strip() == "" for v in payload.values):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one value is required")

    # Route53 rule: a name can't have a CNAME alongside any other record type
    existing_same_name = db.query(Record).filter(
        Record.hosted_zone_id == zone_id, Record.name == payload.name
    ).all()
    if existing_same_name:
        types_here = {r.record_type for r in existing_same_name}
        if rtype == "CNAME" or "CNAME" in types_here:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{payload.name}' cannot have a CNAME record alongside other record types",
            )

    record = Record(
        hosted_zone_id=zone.id,
        name=payload.name,
        record_type=rtype,
        ttl=payload.ttl,
        routing_policy=payload.routing_policy,
        values="\n".join(v.strip() for v in payload.values if v.strip() != ""),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_out(record)


@router.get("/api/records/{record_id}", response_model=RecordOut)
def get_record(
    record_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return _to_out(record)


@router.put("/api/records/{record_id}", response_model=RecordOut)
def update_record(
    record_id: str,
    payload: RecordUpdate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    if payload.ttl is not None:
        record.ttl = payload.ttl
    if payload.routing_policy is not None:
        record.routing_policy = payload.routing_policy
    if payload.values is not None:
        cleaned = [v.strip() for v in payload.values if v.strip() != ""]
        if not cleaned:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one value is required")
        record.values = "\n".join(cleaned)

    db.commit()
    db.refresh(record)
    return _to_out(record)


@router.delete("/api/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    record_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    db.delete(record)
    db.commit()
    return None