import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { zonesApi, HostedZone } from "../lib/api";

export default function DashboardPage() {
  const [zones, setZones] = useState<HostedZone[]>([]);
  const [totalZones, setTotalZones] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    zonesApi
      .list({ page: 1, page_size: 5 })
      .then((res) => {
        setZones(res.items);
        setTotalZones(res.total);
      })
      .catch(() => {
        // RouteGuard handles redirect on auth failure
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Head>
        <title>Route 53 Dashboard</title>
      </Head>
      <AppShell>
        <h1 className="page-title">Route 53 Dashboard</h1>
        <p className="page-subtitle">
          Amazon Route 53 is a scalable Domain Name System (DNS) web service. This clone reproduces
          its console experience for hosted zones and DNS records.
        </p>

        <div className="dashboard-grid">
          <div className="panel">
            <h2>Hosted zones</h2>
            <div className="dashboard-stat">{loading ? "..." : totalZones}</div>
            <Link href="/hosted-zones">View hosted zones →</Link>
          </div>

          <div className="panel">
            <h2>Health checks</h2>
            <div className="dashboard-stat">0</div>
            <Link href="/health-checks">View health checks →</Link>
          </div>

          <div className="panel">
            <h2>Traffic policies</h2>
            <div className="dashboard-stat">0</div>
            <Link href="/traffic-policies">View traffic policies →</Link>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 24 }}>
          <h2>Recent hosted zones</h2>
          {loading ? (
            <p>Loading...</p>
          ) : zones.length === 0 ? (
            <p>No hosted zones yet. <Link href="/hosted-zones">Create one</Link>.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Domain name</th>
                  <th>Type</th>
                  <th>Records</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id}>
                    <td>
                      <Link href={`/hosted-zones/${z.id}`}>{z.name}</Link>
                    </td>
                    <td>{z.zone_type}</td>
                    <td>{z.record_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </AppShell>
    </>
  );
}