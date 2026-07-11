const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore, use statusText
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json();
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  account_id: string;
}

export interface HostedZone {
  id: string;
  name: string;
  comment: string | null;
  private_zone: boolean;
  zone_type: string;
  record_count: number;
  created_at: string;
  updated_at: string;
}

export interface HostedZoneList {
  items: HostedZone[];
  total: number;
  page: number;
  page_size: number;
}

export interface DnsRecord {
  id: string;
  hosted_zone_id: string;
  name: string;
  record_type: string;
  ttl: number;
  routing_policy: string;
  values: string[];
  created_at: string;
  updated_at: string;
}

export interface RecordList {
  items: DnsRecord[];
  total: number;
  page: number;
  page_size: number;
}

export const authApi = {
  login: (username: string, password: string) =>
    request<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),

  me: () => request<User>("/api/auth/me"),
};

export const zonesApi = {
  list: (params: { search?: string; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 10));
    return request<HostedZoneList>(`/api/hosted-zones?${qs.toString()}`);
  },

  get: (id: string) => request<HostedZone>(`/api/hosted-zones/${id}`),

  create: (data: { name: string; comment?: string; private_zone?: boolean }) =>
    request<HostedZone>("/api/hosted-zones", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { comment?: string }) =>
    request<HostedZone>(`/api/hosted-zones/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    request<void>(`/api/hosted-zones/${id}`, { method: "DELETE" }),
  bulkRemove: (ids: string[]) =>
    request<{ deleted: number; missing: string[] }>("/api/hosted-zones/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
    exportUrl: (id: string, format: "json" | "bind") =>
    `${API_BASE}/api/hosted-zones/${id}/export?format=${format}`,

    previewImport: async (id: string, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${API_BASE}/api/hosted-zones/${id}/import/preview`, {
        method: "POST",
        credentials: "include",
        body: formData,
        });
        if (!res.ok) throw new ApiError("Failed to preview import", res.status);
        return res.json() as Promise<{ count: number; records: any[] }>;
    },

    commitImport: async (id: string, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${API_BASE}/api/hosted-zones/${id}/import/commit`, {
        method: "POST",
        credentials: "include",
        body: formData,
        });
        if (!res.ok) throw new ApiError("Failed to import records", res.status);
        return res.json() as Promise<{ created: number }>;
    },
};

export const recordsApi = {
  list: (
    zoneId: string,
    params: { search?: string; record_type?: string; page?: number; page_size?: number } = {}
  ) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.record_type) qs.set("record_type", params.record_type);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 10));
    return request<RecordList>(`/api/hosted-zones/${zoneId}/records?${qs.toString()}`);
  },

  create: (
    zoneId: string,
    data: { name: string; record_type: string; ttl: number; routing_policy: string; values: string[] }
  ) =>
    request<DnsRecord>(`/api/hosted-zones/${zoneId}/records`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    recordId: string,
    data: { ttl?: number; routing_policy?: string; values?: string[] }
  ) =>
    request<DnsRecord>(`/api/records/${recordId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (recordId: string) =>
    request<void>(`/api/records/${recordId}`, { method: "DELETE" }),
};

export { ApiError };