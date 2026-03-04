const TOKEN_KEY = "token";

export function getApiUrl(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:8080";
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

async function request<T = Response>(
  path: string,
  init?: RequestInit & { parseJson?: boolean }
): Promise<T> {
  const { parseJson = false, ...fetchInit } = init ?? {};
  const url = `${getApiUrl()}/api/v1${ensureLeadingSlash(path)}`;
  const headers = new Headers(fetchInit.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  headers.set("X-Timezone", tz);
  const res = await fetch(url, { ...fetchInit, headers });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (parseJson) {
    return res.json() as Promise<T>;
  }
  return res as T;
}

export const apiClient = {
  get<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    return request<T>(path, { ...init, method: "GET", parseJson: true });
  },

  post<T = unknown>(
    path: string,
    body?: unknown,
    init?: Omit<RequestInit & { parseJson?: boolean }, "body">
  ): Promise<T> {
    return request<T>(path, {
      ...init,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      parseJson: init?.parseJson ?? true,
    });
  },

  patch<T = unknown>(
    path: string,
    body?: unknown,
    init?: Omit<RequestInit & { parseJson?: boolean }, "body">
  ): Promise<T> {
    return request<T>(path, {
      ...init,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      parseJson: init?.parseJson ?? true,
    });
  },

  delete(path: string, init?: RequestInit): Promise<void> {
    return request(path, { ...init, method: "DELETE" }).then(() => {});
  },
};
