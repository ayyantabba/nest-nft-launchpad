export const backendConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_NEST_API_URL || "http://127.0.0.1:8787/v1",
  authNoncePath: "/auth/nonce",
  authVerifyPath: "/auth/verify",
  collectionsPath: "/collections",
  storagePath: "/storage",
  deploymentsPath: "/deployments",
  mintsPath: "/mints",
  dashboardPath: "/dashboard",
  adminPath: "/admin",
  healthPath: "/health"
} as const;

export type NestApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

export async function nestRequest<T>(path: string, init: RequestInit = {}): Promise<NestApiResponse<T>> {
  const response = await fetch(`${backendConfig.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {})
    }
  });

  return response.json();
}
