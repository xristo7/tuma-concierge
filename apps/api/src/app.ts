import { Hono } from "hono";
import { cors } from "hono/cors";
import { adminRoutes } from "./admin/routes.js";
import { authRoutes } from "./auth/routes.js";
import { locationRoutes } from "./locations/routes.js";
import { orderRoutes } from "./orders/routes.js";
import { paymentRoutes } from "./payments/routes.js";
import { riderRoutes } from "./riders/routes.js";
import { settingsRoutes } from "./settings/routes.js";
import { verifyRoutes } from "./verify/routes.js";
import { voiceRoutes } from "./voice/routes.js";

/** Hono app shared by the Node entry (local dev) and the Cloudflare Worker entry. */
const app = new Hono();

const defaultOrigins = [
  "https://tuma-customer-staging.onrender.com",
  "https://tuma-rider-staging.onrender.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002", // apps/admin dev server
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
      "POST /v1/auth/verify/request",
      "POST /v1/auth/verify/confirm",
      "POST /v1/lists",
      "GET /v1/lists/recent",
      "GET /v1/lists/:id",
      "POST /v1/orders",
      "GET /v1/orders/active",
      "GET /v1/orders/:id",
      "POST /v1/orders/:id/match",
      "POST /v1/orders/:id/cancel",
      "POST /v1/orders/:id/fund",
      "POST /v1/orders/:id/substitutions",
      "POST /v1/orders/:id/substitutions/:subId/decision",
      "POST /v1/orders/:id/substitutions/batch",
      "POST /v1/orders/:id/substitutions/batch/:batchId/decision",
      "POST /v1/orders/:id/fee-proposals",
      "POST /v1/orders/:id/fee-proposals/:proposalId/decision",
      "POST /v1/orders/:id/deliver",
      "POST /v1/orders/:id/handover",
      "POST /v1/orders/:id/settle",
      "POST /v1/orders/:id/rate",
      "GET /v1/orders/:id/chat",
      "POST /v1/orders/:id/chat",
      "GET /v1/payments/:id/refresh",
      "POST /v1/payments/momo/callback",
      "POST /v1/riders/apply",
      "POST /v1/riders/status",
      "GET /v1/riders/me",
      "GET /v1/riders/me/orders",
      "GET /v1/admin/riders",
      "GET /v1/admin/riders/:userId/id-document",
      "POST /v1/admin/riders/:userId/verify",
      "GET /v1/admin/stats",
      "GET /v1/admin/integrations",
      "GET /v1/admin/customers",
      "GET /v1/admin/customers/:id",
      "GET /v1/admin/orders",
      "POST /v1/admin/users/:id/status",
      "GET /v1/locations",
      "POST /v1/locations",
      "DELETE /v1/locations/:id",
      "GET /v1/settings",
      "PUT /v1/admin/settings",
      "POST /v1/voice/transcribe",
    ],
  }),
);

app.route("/v1/auth", authRoutes);
app.route("/v1/auth", verifyRoutes);
app.route("/v1", orderRoutes);
app.route("/v1", paymentRoutes);
app.route("/v1", riderRoutes);
app.route("/v1", locationRoutes);
app.route("/v1", settingsRoutes);
// voiceRoutes before adminRoutes: adminRoutes' blanket requireRole("admin")
// middleware is registered as "*" within the shared /v1 router, so it would
// otherwise intercept voiceRoutes' /voice/transcribe too (same Hono gotcha
// documented above for callRoutes vs orderRoutes).
app.route("/v1", voiceRoutes);
app.route("/v1", adminRoutes);

export default app;
