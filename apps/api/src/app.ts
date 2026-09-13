import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./auth/routes.js";
import { callRoutes } from "./calls/routes.js";
import { locationRoutes } from "./locations/routes.js";
import { orderRoutes } from "./orders/routes.js";
import { paymentRoutes } from "./payments/routes.js";
import { riderRoutes } from "./riders/routes.js";

/** Hono app shared by the Node entry (local dev) and the Cloudflare Worker entry. */
const app = new Hono();

const defaultOrigins = [
  "https://tuma-customer-staging.onrender.com",
  "https://tuma-rider-staging.onrender.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

app.use("*", (c, next) => {
  const corsOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigins = corsOrigins.length > 0 ? corsOrigins : defaultOrigins;
  return cors({
    origin: allowOrigins,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })(c, next);
});

app.get("/", (c) =>
  c.json({
    service: "tuma-api",
    message: "bootstrap",
    health: "/health",
    v1: "/v1",
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "tuma-api",
    env: process.env.ENVIRONMENT ?? "development",
  }),
);

app.get("/v1", (c) =>
  c.json({
    name: "tuma-api",
    version: "0.1.0",
    status: "live",
    note: "Auth, orders, matching, MoMo escrow (sandbox-ready), chat, rider verification",
    endpoints: [
      "POST /v1/auth/register",
      "POST /v1/auth/login",
      "GET /v1/auth/me",
      "POST /v1/lists",
      "GET /v1/lists/recent",
      "GET /v1/lists/:id",
      "POST /v1/orders",
      "GET /v1/orders/active",
      "GET /v1/orders/:id",
      "POST /v1/orders/:id/match",
      "POST /v1/orders/:id/fund",
      "POST /v1/orders/:id/substitutions",
      "POST /v1/orders/:id/substitutions/:subId/decision",
      "POST /v1/orders/:id/deliver",
      "POST /v1/orders/:id/handover",
      "POST /v1/orders/:id/settle",
      "GET /v1/orders/:id/chat",
      "POST /v1/orders/:id/chat",
      "GET /v1/payments/:id/refresh",
      "POST /v1/payments/momo/callback",
      "POST /v1/riders/apply",
      "POST /v1/riders/status",
      "GET /v1/riders/me",
      "GET /v1/riders/me/orders",
      "GET /v1/admin/riders",
      "POST /v1/admin/riders/:userId/verify",
      "GET /v1/locations",
      "POST /v1/locations",
      "DELETE /v1/locations/:id",
    ],
  }),
);

app.route("/v1/auth", authRoutes);
// callRoutes first: its one route (/orders/:id/call) needs its own
// query-param auth instead of orderRoutes' blanket requireAuth("*")
// middleware, which — once merged into the shared /v1 router — would
// otherwise run for every /v1/* path regardless of registration order
// within orderRoutes itself.
app.route("/v1", callRoutes);
app.route("/v1", orderRoutes);
app.route("/v1", paymentRoutes);
app.route("/v1", riderRoutes);
app.route("/v1", locationRoutes);

export default app;
