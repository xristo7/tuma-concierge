import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

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
    version: "0.0.1",
    status: "bootstrap",
    note: "Feature routes held until product answers",
  }),
);

const port = Number(process.env.PORT) || 10000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`tuma-api listening on :${info.port}`);
});

export default app;
