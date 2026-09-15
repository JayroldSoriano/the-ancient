export type Vendor = "claude" | "cursor";
export type ManaStatus = "ready" | "warning" | "empty";

export type ShopSnapshot = {
  provider: Vendor;
  buyback: boolean;
  claude: {
    status: ManaStatus;
    resetsAt: number | null;
    resetsLabel: string | null;
    detail: string | null;
  };
  cursor: {
    ready: boolean;
    via: "env" | "login" | "none";
    email: string | null;
    loginUrl: string | null;
    loggingIn: boolean;
    lastError: string | null;
  };
  note: string;
  error?: string;
};

function graphUrl(apiUrl: string): string {
  return apiUrl.replace(/\/$/, "");
}

export async function fetchShop(apiUrl: string): Promise<ShopSnapshot> {
  const res = await fetch(`${graphUrl(apiUrl)}/beens/shop`);
  if (!res.ok) throw new Error(`Shop ${res.status}`);
  return (await res.json()) as ShopSnapshot;
}

export async function patchShop(
  apiUrl: string,
  body: { provider?: Vendor; buyback?: boolean },
): Promise<ShopSnapshot> {
  const res = await fetch(`${graphUrl(apiUrl)}/beens/shop`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as ShopSnapshot;
  if (!res.ok) throw new Error(data.error || `Shop ${res.status}`);
  return data;
}

export async function loginShop(apiUrl: string): Promise<ShopSnapshot> {
  const res = await fetch(`${graphUrl(apiUrl)}/beens/shop/login`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Shop login ${res.status}`);
  return (await res.json()) as ShopSnapshot;
}

export async function logoutShop(apiUrl: string): Promise<ShopSnapshot> {
  const res = await fetch(`${graphUrl(apiUrl)}/beens/shop/logout`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Shop logout ${res.status}`);
  return (await res.json()) as ShopSnapshot;
}
