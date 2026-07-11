import { useEffect, useState, useRef, FormEvent } from "react";
import Head from "next/head";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import Pagination from "../../components/Pagination";
import SearchBar from "../../components/SearchBar";
import { useToast } from "../../components/Toast";
import { useShortcuts } from "../../context/ShortcutsContext";
import { zonesApi, HostedZone, ApiError } from "../../lib/api";

const PAGE_SIZE = 10;

export default function HostedZonesPage() {
  const { notify } = useToast();
  const { registerCreateAction, registerSearchFocus } = useShortcuts();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [zones, setZones] = useState<HostedZone[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newPrivate, setNewPrivate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [zonesToDelete, setZonesToDelete] = useState<HostedZone[]>([]);
  const [deleting, setDeleting] = useState(false);

  const loadZones = () => {
    setLoading(true);
    zonesApi
      .list({ search: search || undefined, page, page_size: PAGE_SIZE })
      .then((res) => {
        setZones(res.items);
        setTotal(res.total);
      })
      .catch(() => notify("Failed to load hosted zones", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadZones();
  }, [page, search]);

  useEffect(() => {
    registerCreateAction(() => setShowCreate(true));
    registerSearchFocus(() => searchInputRef.current?.focus());
    return () => {
      registerCreateAction(null);
      registerSearchFocus(null);
    };
  }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError("Domain name is required");
      return;
    }
    setCreating(true);
    try {
      await zonesApi.create({
        name: newName.trim(),
        comment: newComment.trim(),
        private_zone: newPrivate,
      });
      notify(`Hosted zone "${newName.trim()}" created`, "success");
      setShowCreate(false);
      setNewName("");
      setNewComment("");
      setNewPrivate(false);
      setPage(1);
      loadZones();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create hosted zone");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (zonesToDelete.length === 0) return;
    setDeleting(true);
    try {
      if (zonesToDelete.length === 1) {
        await zonesApi.remove(zonesToDelete[0].id);
      } else {
        await zonesApi.bulkRemove(zonesToDelete.map((z) => z.id));
      }
      notify(
        zonesToDelete.length === 1
          ? `Hosted zone "${zonesToDelete[0].name}" deleted`
          : `${zonesToDelete.length} hosted zones deleted`,
        "success"
      );
      setZonesToDelete([]);
      setSelected(new Set());
      loadZones();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Failed to delete hosted zones", "error");
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <Head>
        <title>Hosted zones - Route 53</title>
      </Head>
      <AppShell>
        <h1 className="page-title">Hosted zones</h1>
        <p className="page-subtitle">
          A hosted zone is a container for records, which include information about how you want to
          route traffic for a domain and its subdomains.
        </p>

        <div className="toolbar">
          <SearchBar
            ref={searchInputRef}
            placeholder="Search hosted zones by name"
            onSearch={handleSearch}
          />
          <div className="toolbar-actions">
            <button className="btn" onClick={loadZones}>
              ⟳ Refresh
            </button>
            <button
              className="btn btn-danger"
              disabled={selected.size === 0}
              onClick={() => {
                const toDelete = zones.filter((z) => selected.has(z.id));
                setZonesToDelete(toDelete);
              }}
            >
              Delete {selected.size > 0 ? `(${selected.size})` : ""}
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Create hosted zone
            </button>
          </div>
        </div>

        <div className="panel">
          {loading ? (
            <p>Loading...</p>
          ) : zones.length === 0 ? (
            <div className="empty-state">
              <p>No hosted zones found.</p>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                Create hosted zone
              </button>
            </div>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}></th>
                    <th>Domain name</th>
                    <th>Type</th>
                    <th>Record count</th>
                    <th>Description</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(z.id)}
                          onChange={() => toggleSelect(z.id)}
                        />
                      </td>
                      <td>
                        <Link href={`/hosted-zones/${z.id}`}>{z.name}</Link>
                      </td>
                      <td>{z.zone_type}</td>
                      <td>{z.record_count}</td>
                      <td>{z.comment || "—"}</td>
                      <td>
                        <button className="btn btn-danger" onClick={() => setZonesToDelete([z])}>
                          Delete
                        </button>
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

      {showCreate && (
        <Modal
          title="Create hosted zone"
          onClose={() => !creating && setShowCreate(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowCreate(false)} disabled={creating}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create hosted zone"}
              </button>
            </>
          }
        >
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <label htmlFor="zone-name">Domain name</label>
              <input
                id="zone-name"
                type="text"
                placeholder="example.com"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <span className="form-hint">
                This is the name that you have registered with your domain registrar.
              </span>
            </div>

            <div className="form-row">
              <label htmlFor="zone-comment">Description - optional</label>
              <textarea
                id="zone-comment"
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
            </div>

            <div className="form-row">
              <label>
                <input
                  type="checkbox"
                  checked={newPrivate}
                  onChange={(e) => setNewPrivate(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Private hosted zone
              </label>
              <span className="form-hint">
                Routes traffic for a domain and its subdomains within one or more VPCs.
              </span>
            </div>

            {createError && <div className="form-error">{createError}</div>}
          </form>
        </Modal>
      )}

      {zonesToDelete.length > 0 && (
        <Modal
          title={zonesToDelete.length === 1 ? "Delete hosted zone" : `Delete ${zonesToDelete.length} hosted zones`}
          onClose={() => !deleting && setZonesToDelete([])}
          footer={
            <>
              <button className="btn" onClick={() => setZonesToDelete([])} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </>
          }
        >
          {zonesToDelete.length === 1 ? (
            <p>
              Are you sure you want to delete <strong>{zonesToDelete[0].name}</strong>? This hosted
              zone has <strong>{zonesToDelete[0].record_count}</strong> record(s), which will also be
              deleted. This action cannot be undone.
            </p>
          ) : (
            <>
              <p>Are you sure you want to delete these {zonesToDelete.length} hosted zones?</p>
              <ul className="delete-list">
                {zonesToDelete.map((z) => (
                  <li key={z.id}>
                    {z.name} <span className="form-hint">({z.record_count} records)</span>
                  </li>
                ))}
              </ul>
              <p className="form-hint">This action cannot be undone.</p>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
