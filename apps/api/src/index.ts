import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createListDraft,
  getActiveOrder,
  getHome,
  getRecentLists,
  type CreateListDraftBody,
} from "./stubs/home.js";

const app = new Hono();

const defaultOrigins = [
  "https://tuma-customer-staging.onrender.com",
  "https://tuma-rider-staging.onrender.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowOrigins = corsOrigins.length > 0 ? corsOrigins : defaultOrigins;

app.use(
  "*",
  cors({
    origin: allowOrigins,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/", (c) =>
  c.json({
    service: "tuma-api",
    message: "bootstrap",
    health: "/health",
    v1: "/v1",
    home: "/v1/home",
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "tuma-api",
    env: process.env.NODE_ENV ?? "development",
  }),
);

app.get("/v1", (c) =>
  c.json({
    name: "tuma-api",
    version: "0.0.2",
    status: "home-stubs",
    note: "Home stubs only — no MoMo/escrow/matching yet",
    endpoints: [
      "GET /v1/home",
      "GET /v1/orders/active",
      "GET /v1/lists/recent",
      "POST /v1/lists",
    ],
  }),
);

/** Customer Home aggregate (greeting + active order + recent lists). */
app.get("/v1/home", (c) => c.json(getHome()));

app.get("/v1/orders/active", (c) => c.json(getActiveOrder()));

app.get("/v1/lists/recent", (c) => {
  const limit = Number(c.req.query("limit") ?? "10");
  return c.json(getRecentLists(Number.isFinite(limit) ? limit : 10));
});

/** Create a draft shopping list for "+ New list". */
app.post("/v1/lists", async (c) => {
  let body: CreateListDraftBody = {};
  try {
    body = (await c.req.json()) as CreateListDraftBody;
  } catch {
    body = {};
  }
  const created = createListDraft(body ?? {});
  return c.json(created, 201);
});

const port = Number(process.env.PORT) || 10000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`tuma-api listening on :${info.port}`);
});

export default app;
