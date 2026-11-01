import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit & { csrfToken?: string } = {}
): Promise<T> {
  const { csrfToken, headers, ...rest } = options;
  const mergedHeaders = new Headers(headers);
  if (rest.body && !mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }
  if (csrfToken) {
    mergedHeaders.set("X-CSRF-Token", csrfToken);
  }

  const res = await fetch(url, {
    ...rest,
    headers: mergedHeaders,
    credentials: "same-origin",
  });

  if (res.status === 401 && typeof window !== "undefined") {
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string })?.error ||
        `Request failed with status ${res.status}`
    );
  }
  return data as T;
}
