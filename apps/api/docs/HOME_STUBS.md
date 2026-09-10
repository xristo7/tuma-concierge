# Customer Home API stubs

In-memory stubs for Home click-throughs. **No auth, MoMo, escrow, matching, or Turso writes.**
All responses include `"stub": true`.

Base: `https://tuma-api-staging.onrender.com` (or local `:10000`).

## `GET /v1/home`

Aggregate for Customer Home.

```json
{
  "stub": true,
  "greetingName": "Sharon",
  "locationLabel": "Kampala · within 5 km",
  "activeOrder": {
    "orderId": "ord_demo",
    "listId": "list_active",
    "title": "Nakasero market run",
    "stage": "Deliver",
    "stageLabel": "En route",
    "progressPct": 75,
    "etaMinutes": 12,
    "pinHint": "••42",
    "riderDisplayName": "Juma",
    "paymentRail": "escrow"
  },
  "recentLists": [
    {
      "listId": "list_weekend",
      "title": "Weekend groceries",
      "status": "DRAFT",
      "itemCount": 8,
      "updatedAt": "2026-09-10T08:00:00.000Z"
    }
  ]
}
```

`activeOrder` may be `null`. `stage` uses UX canonical names (`Create`…`Settle`).

## `GET /v1/orders/active`

```json
{ "stub": true, "activeOrder": { /* same shape or null */ } }
```

## `GET /v1/lists/recent?limit=10`

```json
{ "stub": true, "lists": [ /* HomeListSummary[] */ ] }
```

## `POST /v1/lists`

Body (all optional):

```json
{
  "title": "Weekend groceries",
  "items": [{ "name": "Milk", "quantity": 2, "note": "fresh" }]
}
```

Response `201`:

```json
{
  "stub": true,
  "listId": "list_xxxx",
  "title": "Weekend groceries",
  "status": "DRAFT",
  "itemCount": 1,
  "createdAt": "…",
  "nextPath": "/orders/list_xxxx/create"
}
```

FE can navigate to `nextPath` after create. Draft also appears in subsequent `recent` / `home` calls (process memory only — resets on deploy).

## Shared client

`@tuma/shared` `createApiClient` exposes `getHome`, `getActiveOrder`, `getRecentLists`, `createListDraft`.
