# Customer Home API stubs

In-memory stubs for Home click-throughs. **No auth, MoMo, escrow, matching, or Turso writes.**  
All responses include `"stub": true`.

Base: `https://tuma-api-staging.onrender.com` (after PR merge + redeploy) or local `:10000`.

## `GET /v1/home`

```json
{
  "stub": true,
  "greetingName": "Sharon",
  "locationLabel": "Kampala · within 5 km",
  "activeOrder": {
    "id": "ord_demo",
    "orderId": "ord_demo",
    "listId": "list_active",
    "title": "Nakasero market run",
    "riderName": "Juma",
    "status": "En route",
    "itemCount": 6,
    "etaMinutes": 12,
    "destinationArea": "Kololo",
    "pinReady": true,
    "stage": "Deliver",
    "stageLabel": "En route",
    "progressPct": 75,
    "pinHint": "••42",
    "paymentRail": "escrow"
  },
  "recentLists": [
    {
      "id": "list_weekend",
      "listId": "list_weekend",
      "title": "Weekend groceries",
      "status": "draft",
      "itemCount": 8,
      "updatedAt": "2026-09-10T08:00:00.000Z",
      "updatedLabel": "Today"
    },
    {
      "id": "list_office",
      "listId": "list_office",
      "title": "Office snacks",
      "status": "delivered",
      "itemCount": 5,
      "updatedAt": "2026-09-08T14:30:00.000Z",
      "updatedLabel": "2 days ago"
    }
  ]
}
```

`activeOrder` may be `null`.

## `GET /v1/orders/active`

```json
{ "stub": true, "activeOrder": { /* ActiveOrderSummary | null */ } }
```

## `GET /v1/lists/recent?limit=10`

```json
{ "stub": true, "lists": [ /* HomeListSummary[] */ ] }
```

## `POST /v1/lists`

```json
// request
{ "title": "Weekend groceries", "items": [{ "name": "Milk", "quantity": 2 }] }

// 201
{
  "stub": true,
  "id": "list_xxxx",
  "listId": "list_xxxx",
  "title": "Weekend groceries",
  "status": "draft",
  "itemCount": 1,
  "createdAt": "…",
  "nextPath": "/orders/list_xxxx/create"
}
```

## Shared client

`@tuma/shared` — `createApiClient({ baseUrl }).getHome()`, `.getActiveOrder()`, `.getRecentLists()`, `.createListDraft()`.
