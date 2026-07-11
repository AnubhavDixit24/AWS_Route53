from sqlalchemy.orm import Session as DBSession

from .models import User, HostedZone, Record


def seed_data(db: DBSession) -> None:
    # Only seed once - if a user already exists, assume DB is already populated
    if db.query(User).first():
        return

    # --- Demo login user ---
    demo_user = User(
        username="admin",
        password="admin123",  # mock auth only, plaintext is fine for this demo
        full_name="Anubhav Dixit",
        account_id="123456789012",
    )
    db.add(demo_user)
    db.commit()

    # --- Sample hosted zone: example.com ---
    zone1 = HostedZone(
        name="example.com",
        comment="Primary marketing site",
        private_zone=False,
        zone_type="Public",
    )
    db.add(zone1)
    db.commit()
    db.refresh(zone1)

    default_records_zone1 = [
        Record(
            hosted_zone_id=zone1.id,
            name="example.com",
            record_type="NS",
            ttl=172800,
            values="ns-1.awsdns-01.com\nns-2.awsdns-02.org\nns-3.awsdns-03.net\nns-4.awsdns-04.com",
        ),
        Record(
            hosted_zone_id=zone1.id,
            name="example.com",
            record_type="SOA",
            ttl=900,
            values="ns-1.awsdns-01.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
        ),
        Record(
            hosted_zone_id=zone1.id,
            name="example.com",
            record_type="A",
            ttl=300,
            values="192.0.2.10",
        ),
        Record(
            hosted_zone_id=zone1.id,
            name="www.example.com",
            record_type="CNAME",
            ttl=300,
            values="example.com",
        ),
        Record(
            hosted_zone_id=zone1.id,
            name="example.com",
            record_type="MX",
            ttl=300,
            values="10 mail.example.com",
        ),
        Record(
            hosted_zone_id=zone1.id,
            name="example.com",
            record_type="TXT",
            ttl=300,
            values='"v=spf1 include:_spf.google.com ~all"',
        ),
    ]
    db.add_all(default_records_zone1)

    # --- Sample hosted zone: myapp.io ---
    zone2 = HostedZone(
        name="myapp.io",
        comment="Staging environment for MyApp",
        private_zone=False,
        zone_type="Public",
    )
    db.add(zone2)
    db.commit()
    db.refresh(zone2)

    default_records_zone2 = [
        Record(
            hosted_zone_id=zone2.id,
            name="myapp.io",
            record_type="NS",
            ttl=172800,
            values="ns-11.awsdns-11.com\nns-12.awsdns-12.org\nns-13.awsdns-13.net\nns-14.awsdns-14.com",
        ),
        Record(
            hosted_zone_id=zone2.id,
            name="myapp.io",
            record_type="SOA",
            ttl=900,
            values="ns-11.awsdns-11.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
        ),
        Record(
            hosted_zone_id=zone2.id,
            name="api.myapp.io",
            record_type="A",
            ttl=300,
            values="203.0.113.25",
        ),
        Record(
            hosted_zone_id=zone2.id,
            name="myapp.io",
            record_type="AAAA",
            ttl=300,
            values="2001:db8::1",
        ),
    ]
    db.add_all(default_records_zone2)

    db.commit()