import { Hono } from "hono";
import { fallbackCounsel, gatherField, saveCounsel } from "./lib/field.js";
import { consultOracle } from "./nodes/oracle.js";
import {
  beginCursorLogin,
  logoutCursor,
  setBuyback,
  setProvider,
  shopSnapshot,
  type Vendor,
} from "./lib/shop.js";

const AGENTS_ROOT = process.cwd();

export const app = new Hono();

app.get("/ancient/field", async (c) => {
  const snapshot = await gatherField(AGENTS_ROOT);
  return c.json(snapshot);
});

app.post("/ancient/field/counsel", async (c) => {
  const force = c.req.query("force") === "1";
  const snapshot = await gatherField(AGENTS_ROOT);
  if (snapshot.counsel && !force) {
    return c.json({ ...snapshot, reused: true });
  }
  try {
    const counsel = await consultOracle(snapshot);
    return c.json({ ...snapshot, counsel, reused: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const counsel = fallbackCounsel(
      snapshot.issues,
      snapshot.leftovers,
      snapshot.fingerprint,
      message,
    );
    await saveCounsel(counsel);
    return c.json(
      {
        ...snapshot,
        counsel,
        oracleError: message,
      },
      200,
    );
  }
});

app.get("/ancient/shop", async (c) => {
  return c.json(await shopSnapshot());
});

app.post("/ancient/shop", async (c) => {
  let body: { provider?: string; buyback?: boolean } = {};
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    body = {};
  }
  try {
    if (body.provider === "claude" || body.provider === "cursor") {
      return c.json(await setProvider(body.provider as Vendor));
    }
    if (typeof body.buyback === "boolean") {
      return c.json(await setBuyback(body.buyback));
    }
    return c.json(await shopSnapshot());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ...(await shopSnapshot()), error: message }, 409);
  }
});

app.post("/ancient/shop/login", async (c) => {
  const started = beginCursorLogin();
  return c.json({ ...(await shopSnapshot()), ...started });
});

app.post("/ancient/shop/logout", async (c) => {
  return c.json(await logoutCursor());
});
