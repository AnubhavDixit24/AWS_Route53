import { useEffect, useState, FormEvent } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import Pagination from "../../components/Pagination";
import SearchBar from "../../components/SearchBar";
import { useToast } from "../../components/Toast";
import {
  zonesApi,
  recordsApi,
  HostedZone,
  DnsRecord,
  ApiError,
} from "../../lib/api";

const PAGE_SIZE = 10;

const RECORD_TYPES = ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"];

const VALUE_PLACEHOLDERS: Record<string, string> = {
  A: "192.0.2.1",
  AAAA: "2001:db8::1",
  CNAME: "target.example.com",
  TXT: '"v=spf1 include:_spf.google.com ~all"',
  MX: "10 mail.example.com",
  NS: "ns1.example.com",
  PTR: "host.example.com",
  SRV: "10 60 5060 target.example.com",
  CAA: '0 issue "letsencrypt.org"',
};

const ROUTING_POLICIES = ["Simple", "Weighted", "Latency", "Failover", "Geolocation", "Multivalue"];

interface RecordFormState {
  name: string;
  record_type: string;
  ttl: number;
  routing_policy: string;
  valuesText: string;
}

const emptyForm = (zoneName: string): RecordFormState => ({
  name: zoneName,
  record_type: "A",
  ttl: 300,
  routing_policy: "Simple",
  valuesText: "",
});

export default function HostedZoneDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const zoneId = typeof id === "string" ? id : undefined;
  const { notify } = useToast();

  const [zone, setZone] = useState<HostedZone | null>(null);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DnsRecord | null>(null);
  const [form, setForm] = useState<RecordFormState>(emptyForm(""));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [recordToDelete, setRecordToDelete] = useState<DnsRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<{ count: number; records: any[] } | null>(null);
    const [importing, setImporting] = useState(false);
  const loadZone = () => {
    if (!zoneId) return;
    zonesApi.get(zoneId).then(setZone).catch(() => notify("Failed to load hosted zone", "error"));
  };

  const loadRecords = () => {
    if (!zoneId) return;
    setLoading(true);
    recordsApi
      .list(zoneId, {
        search: search || undefined,
        record_type: typeFilter || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      .then((res) => {
        setRecords(res.items);
        setTotal(res.total);
      })
      .catch(() => notify("Failed to load records", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadZone();
  }, [zoneId]);

  useEffect(() => {
    loadRecords();
  }, [zoneId, page, search, typeFilter]);

  const openCreateForm = () => {
    setEditingRecord(null);
    setForm(emptyForm(zone?.name ?? ""));
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (record: DnsRecord) => {
    setEditingRecord(record);
    setForm({
      name: record.name,
      record_type: record.record_type,
      ttl: record.ttl,
      routing_policy: record.routing_policy,
      valuesText: record.values.join("\n"),
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const values = form.valuesText
      .split("\n")
      .map((v) => v.trim())
      .filter((v) => v !== "");

    if (values.length === 0) {
      setFormError("At least one value is required");
      return;
    }
    if (!editingRecord && !form.name.trim()) {
      setFormError("Record name is required");
      return;
    }

    setSaving(true);
    try {
      if (editingRecord) {
        await recordsApi.update(editingRecord.id, {
          ttl: form.ttl,
          routing_policy: form.routing_policy,
          values,
        });
        notify(`Record "${editingRecord.name}" updated`, "success");
      } else if (zoneId) {
        await recordsApi.create(zoneId, {
          name: form.name.trim(),
          record_type: form.record_type,
          ttl: form.ttl,
          routing_policy: form.routing_policy,
          values,
        });
        notify(`Record "${form.name.trim()}" created`, "success");
      }
      setShowForm(false);
      loadRecords();
      loadZone(); // refresh record_count on the zone header
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    setDeleting(true);
    try {
      await recordsApi.remove(recordToDelete.id);
      notify(`Record "${recordToDelete.name}" deleted`, "success");
      setRecordToDelete(null);
      loadRecords();
      loadZone();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Failed to delete record", "error");
    } finally {
      setDeleting(false);
    }
  };
  const handleExportFormat = (format: "json" | "bind") => {
  if (!zoneId) return;
  window.open(zonesApi.exportUrl(zoneId, format), "_blank");
  setShowExportMenu(false);
};

const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !zoneId) return;
  setImportFile(file);
  try {
    const preview = await zonesApi.previewImport(zoneId, file);
    setImportPreview(preview);
  } catch {
    notify("Failed to parse zone file", "error");
    setImportPreview(null);
  }
};

const handleConfirmImport = async () => {
  if (!importFile || !zoneId) return;
  setImporting(true);
  try {
    const res = await zonesApi.commitImport(zoneId, importFile);
    notify(`${res.created} record(s) imported`, "success");
    setShowImport(false);
    setImportFile(null);
    setImportPreview(null);
    loadRecords();
    loadZone();
  } catch {
    notify("Failed to import records", "error");
  } finally {
    setImporting(false);
  }
};
  const handleExport = async () => {
    if (!zoneId) return;
    try {
        const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/hosted-zones/${zoneId}/export`,
        { credentials: "include" }
        );
        if (!res.ok) throw new Error("Export failed");

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${zone?.name ?? "zone"}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        notify("Zone exported", "success");
    } catch {
        notify("Failed to export zone", "error");
    }
  };

  if (!zone) {
    return (
      <AppShell>
        <p>Loading hosted zone...</p>
      </AppShell>
    );
  }

  return (
    <>
      <Head>
        <title>{zone.name} - Route 53</title>
      </Head>
      <AppShell>
        <Link href="/hosted-zones">‹ Hosted zones</Link>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          {zone.name}
        </h1>
        <p className="page-subtitle">
          {zone.zone_type} hosted zone · {zone.record_count} record(s)
          {zone.comment ? ` · ${zone.comment}` : ""}
        </p>

        <div className="toolbar">
          <div style={{ display: "flex", gap: 8 }}>
            <SearchBar placeholder="Search records by name or value" onSearch={(v) => { setSearch(v); setPage(1); }} />
            <select
              className="type-filter"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All types</option>
              {RECORD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar-actions" style={{ position: "relative" }}>
            <button className="btn" onClick={loadRecords}>
                ⟳ Refresh
            </button>
            <button className="btn" onClick={() => setShowImport(true)}>
                ⬆ Import
            </button>
            <div style={{ position: "relative" }}>
                <button className="btn" onClick={() => setShowExportMenu((v) => !v)}>
                ⬇ Export ▾
                </button>
                {showExportMenu && (
                <div className="export-menu">
                    <button onClick={() => handleExportFormat("json")}>Export as JSON</button>
                    <button onClick={() => handleExportFormat("bind")}>Export as BIND zone file</button>
                </div>
                )}
            </div>
            <button className="btn btn-primary" onClick={openCreateForm}>
                Create record
            </button>
          </div>
        </div>

        <div className="panel">
          {loading ? (
            <p>Loading...</p>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <p>No records found.</p>
              <button className="btn btn-primary" onClick={openCreateForm}>
                Create record
              </button>
            </div>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Routing policy</th>
                    <th>TTL</th>
                    <th>Value(s)</th>
                    <th style={{ width: 140 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>
                        <span className="type-badge">{r.record_type}</span>
                      </td>
                      <td>{r.routing_policy}</td>
                      <td>{r.ttl}</td>
                      <td>
                        {r.values.map((v, i) => (
                          <div key={i} className="value-line">
                            {v}
                          </div>
                        ))}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn" onClick={() => openEditForm(r)}>
                            Edit
                          </button>
                          <button className="btn btn-danger" onClick={() => setRecordToDelete(r)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </div>
      </AppShell>

      {showForm && (
        <Modal
          title={editingRecord ? "Edit record" : "Create record"}
          onClose={() => !saving && setShowForm(false)}
          width={560}
          footer={
            <>
              <button className="btn" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving..." : editingRecord ? "Save changes" : "Create record"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label htmlFor="rec-name">Record name</label>
              <input
                id="rec-name"
                type="text"
                value={form.name}
                disabled={!!editingRecord}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              {editingRecord && <span className="form-hint">Name and type can't be changed after creation.</span>}
            </div>

            <div className="form-row">
              <label htmlFor="rec-type">Record type</label>
              <select
                id="rec-type"
                value={form.record_type}
                disabled={!!editingRecord}
                onChange={(e) => setForm({ ...form, record_type: e.target.value })}
              >
                {RECORD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="rec-routing">Routing policy</label>
              <select
                id="rec-routing"
                value={form.routing_policy}
                onChange={(e) => setForm({ ...form, routing_policy: e.target.value })}
              >
                {ROUTING_POLICIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="rec-ttl">TTL (seconds)</label>
              <input
                id="rec-ttl"
                type="number"
                min={0}
                value={form.ttl}
                onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) })}
              />
            </div>

            <div className="form-row">
              <label htmlFor="rec-values">Value(s) — one per line</label>
              <textarea
                id="rec-values"
                rows={4}
                placeholder={VALUE_PLACEHOLDERS[form.record_type]}
                value={form.valuesText}
                onChange={(e) => setForm({ ...form, valuesText: e.target.value })}
              />
              <span className="form-hint">
                Example: <code>{VALUE_PLACEHOLDERS[form.record_type]}</code>
              </span>
            </div>

            {formError && <div className="form-error">{formError}</div>}
          </form>
        </Modal>
      )}

      {recordToDelete && (
        <Modal
          title="Delete record"
          onClose={() => !deleting && setRecordToDelete(null)}
          footer={
            <>
              <button className="btn" onClick={() => setRecordToDelete(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </>
          }
        >
          <p>
            Are you sure you want to delete the <strong>{recordToDelete.record_type}</strong> record{" "}
            <strong>{recordToDelete.name}</strong>? This action cannot be undone.
          </p>
        </Modal>
      )}
      {showImport && (
        <Modal
            title="Import records from BIND zone file"
            onClose={() => {
            setShowImport(false);
            setImportFile(null);
            setImportPreview(null);
            }}
            width={600}
            footer={
            <>
                <button
                className="btn"
                onClick={() => {
                    setShowImport(false);
                    setImportFile(null);
                    setImportPreview(null);
                }}
                disabled={importing}
                >
                Cancel
                </button>
                <button
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={!importPreview || importPreview.count === 0 || importing}
                >
                {importing ? "Importing..." : `Import ${importPreview?.count ?? 0} record(s)`}
                </button>
            </>
            }
        >
            <div className="form-row">
            <label htmlFor="import-file">Zone file (.txt or .zone)</label>
            <input id="import-file" type="file" accept=".txt,.zone" onChange={handleFileSelect} />
            </div>

            {importPreview && (
            <>
                <p className="form-hint">Found {importPreview.count} record(s) to import:</p>
                <table className="table" style={{ fontSize: 12 }}>
                <thead>
                    <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>TTL</th>
                    <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    {importPreview.records.slice(0, 20).map((r, i) => (
                    <tr key={i}>
                        <td>{r.name}</td>
                        <td>{r.record_type}</td>
                        <td>{r.ttl}</td>
                        <td>{r.value}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
                {importPreview.count > 20 && (
                <p className="form-hint">...and {importPreview.count - 20} more</p>
                )}
            </>
            )}
        </Modal>
        )}
    </>
  );
}