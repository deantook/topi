const TOKEN_KEY = "token";
const TOKEN_COOKIE = "token";
const COOKIE_MAX_AGE_DAYS = 7;

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
    document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * COOKIE_MAX_AGE_DAYS}; SameSite=Lax`;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function removeToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0`;
  }
}

export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

export function logout(): void {
  removeToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
