import math
from typing import Optional
from fastapi.responses import JSONResponse, Response
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session as DBSession
from ..database import get_db
from ..auth import get_current_user
from ..models import HostedZone, Record, User
from ..schemas import (
    HostedZoneCreate,
    HostedZoneUpdate,
    HostedZoneOut,
    HostedZoneListOut,
    BulkDeleteRequest,
)
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File

router = APIRouter(prefix="/api/hosted-zones", tags=["hosted-zones"])


def _to_out(zone: HostedZone, db: DBSession) -> HostedZoneOut:
    count = db.query(Record).filter(Record.hosted_zone_id == zone.id).count()
    return HostedZoneOut(
        id=zone.id,
        name=zone.name,
        comment=zone.comment,
        private_zone=zone.private_zone,
        zone_type=zone.zone_type,
        record_count=count,
        created_at=zone.created_at,
        updated_at=zone.updated_at,
    )


def _seed_default_records(db: DBSession, zone: HostedZone) -> None:
    """Every real Route53 zone auto-creates NS + SOA records. Mirror that here."""
    ns_record = Record(
        hosted_zone_id=zone.id,
        name=zone.name,
        record_type="NS",
        ttl=172800,
        values=(
            "ns-1.awsdns-01.com\n"
            "ns-2.awsdns-02.org\n"
            "ns-3.awsdns-03.net\n"
            "ns-4.awsdns-04.com"
        ),
    )
    soa_record = Record(
        hosted_zone_id=zone.id,
        name=zone.name,
        record_type="SOA",
        ttl=900,
        values="ns-1.awsdns-01.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
    )
    db.add_all([ns_record, soa_record])
    db.commit()

def _to_bind_zone_file(zone: HostedZone, records: list[Record]) -> str:
    lines = [f"$ORIGIN {zone.name}.", "$TTL 300", ""]
    for r in records:
        for value in r.values.split("\n"):
            value = value.strip()
            if not value:
                continue
            name = r.name if r.name.endswith(".") else f"{r.name}."
            if r.record_type in ("CNAME", "NS", "PTR", "MX") and not value.endswith("."):
                # MX values have a priority prefix ("10 mail.example.com") - only dot-terminate the hostname part
                if r.record_type == "MX":
                    parts = value.split(" ", 1)
                    if len(parts) == 2:
                        value = f"{parts[0]} {parts[1]}."
                else:
                    value = f"{value}."
            lines.append(f"{name:<32} {r.ttl:<8} IN  {r.record_type:<6} {value}")
    return "\n".join(lines) + "\n"

@router.get("", response_model=HostedZoneListOut)
def list_zones(
    search: Optional[str] = Query(None, description="Search by domain name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(HostedZone)

    if search:
        like = f"%{search}%"
        query = query.filter(or_(HostedZone.name.ilike(like), HostedZone.comment.ilike(like)))

    total = query.count()
    query = query.order_by(HostedZone.created_at.desc())
    zones = query.offset((page - 1) * page_size).limit(page_size).all()

    return HostedZoneListOut(
        items=[_to_out(z, db) for z in zones],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=HostedZoneOut, status_code=status.HTTP_201_CREATED)
def create_zone(
    payload: HostedZoneCreate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = db.query(HostedZone).filter(HostedZone.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A hosted zone named '{payload.name}' already exists",
        )

    zone = HostedZone(
        name=payload.name,
        comment=payload.comment or "",
        private_zone=payload.private_zone,
        zone_type="Private" if payload.private_zone else "Public",
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)

    _seed_default_records(db, zone)

    return _to_out(zone, db)
@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
def bulk_delete_zones(
    payload: BulkDeleteRequest,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not payload.ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No zone IDs provided")

    zones = db.query(HostedZone).filter(HostedZone.id.in_(payload.ids)).all()
    found_ids = {z.id for z in zones}
    missing = [zid for zid in payload.ids if zid not in found_ids]

    for zone in zones:
        db.delete(zone)  # cascades to records
    db.commit()

    return {
        "deleted": len(zones),
        "missing": missing,
    }

@router.get("/{zone_id}", response_model=HostedZoneOut)
def get_zone(
    zone_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hosted zone not found")
    return _to_out(zone, db)


@router.put("/{zone_id}", response_model=HostedZoneOut)
def update_zone(
    zone_id: str,
    payload: HostedZoneUpdate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hosted zone not found")

    if payload.comment is not None:
        zone.comment = payload.comment

    db.commit()
    db.refresh(zone)
    return _to_out(zone, db)


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(
    zone_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hosted zone not found")

    db.delete(zone)  # cascades to records, thanks to cascade="all, delete-orphan" on the relationship
    db.commit()
    return None
@router.get("/{zone_id}/export")
@router.get("/{zone_id}/export")
def export_zone(
    zone_id: str,
    format: str = Query("json", pattern="^(json|bind)$"),
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hosted zone not found")

    records = db.query(Record).filter(Record.hosted_zone_id == zone_id).order_by(Record.name).all()

    if format == "bind":
        content = _to_bind_zone_file(zone, records)
        headers = {"Content-Disposition": f'attachment; filename="{zone.name}.zone"'}
        return Response(content=content, media_type="text/plain", headers=headers)

    payload = {
        "hostedZone": {
            "name": zone.name,
            "comment": zone.comment,
            "type": zone.zone_type,
            "privateZone": zone.private_zone,
        },
        "recordSets": [
            {
                "name": r.name,
                "type": r.record_type,
                "ttl": r.ttl,
                "routingPolicy": r.routing_policy,
                "values": [v for v in r.values.split("\n") if v.strip() != ""],
            }
            for r in records
        ],
    }
    headers = {"Content-Disposition": f'attachment; filename="{zone.name}.json"'}
    return JSONResponse(content=payload, headers=headers)
import re
from fastapi import UploadFile, File

VALID_IMPORT_TYPES = {"A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"}


def _parse_bind_zone_file(content: str, default_name: str) -> list[dict]:
    parsed: list[dict] = []
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith(";") or line.startswith("$"):
            continue
        # Expected: <name> <ttl> IN <type> <value...>
        match = re.match(r"^(\S+)\s+(\d+)\s+IN\s+(\S+)\s+(.+)$", line, re.IGNORECASE)
        if not match:
            continue
        name, ttl, rtype, value = match.groups()
        rtype = rtype.upper()
        if rtype not in VALID_IMPORT_TYPES:
            continue
        name = name.rstrip(".") or default_name
        value = value.strip().rstrip(".") if rtype not in ("TXT",) else value.strip()
        parsed.append({"name": name, "record_type": rtype, "ttl": int(ttl), "value": value})
    return parsed


@router.post("/{zone_id}/import/preview")
async def preview_import(
    zone_id: str,
    file: UploadFile = File(...),
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hosted zone not found")

    raw = (await file.read()).decode("utf-8", errors="ignore")
    parsed = _parse_bind_zone_file(raw, zone.name)
    return {"count": len(parsed), "records": parsed}


@router.post("/{zone_id}/import/commit")
async def commit_import(
    zone_id: str,
    file: UploadFile = File(...),
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hosted zone not found")

    raw = (await file.read()).decode("utf-8", errors="ignore")
    parsed = _parse_bind_zone_file(raw, zone.name)

    # Group multiple values under the same (name, type) into one record set
    grouped: dict[tuple[str, str], dict] = {}
    for item in parsed:
        key = (item["name"], item["record_type"])
        if key not in grouped:
            grouped[key] = {"ttl": item["ttl"], "values": []}
        grouped[key]["values"].append(item["value"])

    created = 0
    for (name, rtype), data in grouped.items():
        record = Record(
            hosted_zone_id=zone.id,
            name=name,
            record_type=rtype,
            ttl=data["ttl"],
            routing_policy="Simple",
            values="\n".join(data["values"]),
        )
        db.add(record)
        created += 1
    db.commit()

    return {"created": created}