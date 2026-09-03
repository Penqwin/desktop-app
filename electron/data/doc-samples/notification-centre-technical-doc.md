# Real-time Notification Centre

## Overview

The Notification Centre is a real-time in-app notification system that delivers activity updates, mentions, and system alerts to authenticated users without requiring a page refresh. Notifications are streamed to connected clients over Server-Sent Events (SSE), persisted in PostgreSQL for retrieval across sessions, and surfaced in the application shell via a persistent bell icon with an unread count badge.

Prior to this feature, the application had no in-app notification mechanism. Actionable events — such as a comment mention, a task assignment, or a billing alert — were communicated exclusively by email, with no visibility into activity while the user was actively using the application.

---

## Feature scope

This document covers the full vertical slice of the Notification Centre, from event ingestion on the backend through to the rendered UI component on the frontend.

**In scope**

- Real-time delivery of notifications to active browser sessions via SSE
- Persistence of all notifications per user with read/unread state
- REST endpoints for retrieving, marking as read, and dismissing notifications
- Bell icon with live unread count badge in the application shell
- Notification drawer with paginated list, read state, and click-to-navigate behaviour
- Preference controls for notification type opt-out

**Out of scope**

- Push notifications to mobile or browser when the user is not active in the app
- Email digests triggered by notification events (handled separately by `comms-service`)
- Notification grouping or threading
- Admin-side broadcast notifications

---

## Architecture

### System overview

```
Producer services
  └─► notification-service
        ├─ Persists to PostgreSQL (notifications table)
        ├─ Publishes to Redis pub/sub (channel: user:{user_id})
        └─ SSE broker
              └─► GET /v1/notifications/stream  (api-gateway)
                    └─► EventSource (browser)
                          └─► NotificationCentre component (web-app)
```

Notification events originate from producer services (e.g. `collaboration-service`, `billing-service`) via an internal gRPC call to `notification-service`. The service persists the notification, then fans it out to any active SSE connections for the target user via Redis pub/sub. The frontend receives the event, updates the unread count badge in real time, and appends the notification to the drawer list without a full re-fetch.

### Component responsibilities

**`notification-service`**  
Owns all notification state. Accepts inbound delivery requests from producers, writes to PostgreSQL, publishes to Redis, and manages the SSE broker that maintains long-lived connections per user. Also serves the REST read/write API consumed by the frontend.

**`api-gateway`**  
Proxies all `/v1/notifications/*` routes to `notification-service`. Enforces JWT authentication and injects the `X-User-ID` and `X-Tenant-ID` headers before forwarding. No business logic resides in the gateway for this feature.

**`web-app` — `NotificationCentre` component**  
Renders the bell icon, unread count badge, and notification drawer. Opens an `EventSource` connection on mount, maintains local state for the notification list and unread count, and handles navigation on notification click. Preference controls are rendered within the drawer.

---

## Backend

### Data model

#### `notifications` table

```sql
CREATE TABLE notifications (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id    UUID        NOT NULL,
    type         TEXT        NOT NULL,
    title        TEXT        NOT NULL,
    body         TEXT,
    action_url   TEXT,
    metadata     JSONB       NOT NULL DEFAULT '{}',
    read_at      TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
    ON notifications (user_id, created_at DESC)
    WHERE read_at IS NULL AND dismissed_at IS NULL;

CREATE INDEX idx_notifications_user_list
    ON notifications (user_id, created_at DESC)
    WHERE dismissed_at IS NULL;
```

Notifications are soft-deleted via `dismissed_at`. A dismissed notification is excluded from all list and count queries but is retained in the table for audit purposes. The `metadata` column holds producer-supplied context (e.g. the comment ID and thread URL for a mention notification) and is passed through to the client without server-side validation beyond JSON well-formedness.

#### `notification_preferences` table

```sql
CREATE TABLE notification_preferences (
    user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT    NOT NULL,
    in_app      BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (user_id, type)
);
```

When a producer submits a notification, `notification-service` checks this table before persisting. If `in_app = false` for the given user and type, the notification is dropped silently. The preference row is created on first opt-out and deleted on opt-back-in, so the absence of a row is equivalent to `in_app = true`.

---

### Notification types

The following types are defined in the initial release. New types must be registered in the `notification_types` registry table before producers can use them.

| Type                     | Produced by             | Description                                         |
| ------------------------ | ----------------------- | --------------------------------------------------- |
| `mention.comment`        | `collaboration-service` | User was @-mentioned in a comment.                  |
| `mention.document`       | `collaboration-service` | User was @-mentioned in a document body.            |
| `task.assigned`          | `task-service`          | A task was assigned to the user.                    |
| `task.due_soon`          | `task-service`          | A task assigned to the user is due within 24 hours. |
| `billing.payment_failed` | `billing-service`       | A payment attempt for the user's tenant failed.     |
| `billing.trial_expiring` | `billing-service`       | The tenant's trial expires within 3 days.           |
| `system.announcement`    | `notification-service`  | Platform-level announcement (ops use only).         |

---

### Internal delivery API (gRPC)

Producer services submit notifications via gRPC. REST is not supported for inbound delivery; this keeps the delivery path internal and eliminates the need for inbound authentication on the delivery endpoint.

```protobuf
service NotificationService {
    rpc Deliver(DeliverRequest) returns (DeliverResponse);
}

message DeliverRequest {
    string user_id    = 1;
    string tenant_id  = 2;
    string type       = 3;
    string title      = 4;
    string body       = 5;  // optional
    string action_url = 6;  // optional — navigated to on click
    map<string, string> metadata = 7;
}

message DeliverResponse {
    string notification_id = 1;
    bool   delivered       = 2;  // false if suppressed by user preference
}
```

`delivered = false` indicates the notification was accepted but not persisted due to a user preference opt-out. Producers should treat this as a successful call; no retry is warranted.

---

### REST API

All endpoints require a valid JWT. The gateway injects `X-User-ID` from the token before forwarding to `notification-service`; the service uses this header as the authoritative user identity for all queries.

#### List notifications

```
GET /v1/notifications
```

Returns notifications for the authenticated user. Dismissed notifications are excluded.

**Query parameters**

| Parameter     | Type    | Default | Description                                                      |
| ------------- | ------- | ------- | ---------------------------------------------------------------- |
| `cursor`      | string  | —       | Opaque pagination cursor from a previous response.               |
| `limit`       | integer | `20`    | Page size. Maximum `50`.                                         |
| `unread_only` | boolean | `false` | When `true`, returns only notifications where `read_at` is null. |

**Response `200`**

```json
{
  "data": [
    {
      "id": "ntf_01HXK9P2R4QV7ZMJ3YBWF6DN0T",
      "type": "mention.comment",
      "title": "Aisha mentioned you in a comment",
      "body": "Can you take a look at this before EOD?",
      "action_url": "/documents/doc_abc123#comment-42",
      "metadata": { "document_id": "doc_abc123", "comment_id": "42" },
      "read_at": null,
      "created_at": "2026-03-14T09:15:00Z"
    }
  ],
  "next_cursor": "Y3Vyc29yX29mZnNldD0yMA==",
  "unread_count": 7
}
```

`unread_count` reflects the total unread count at the time of the response, not just the count within the current page.

---

#### Get unread count

```
GET /v1/notifications/count
```

Lightweight endpoint polled as a fallback when SSE is unavailable. Returns only the current unread count for the authenticated user.

**Response `200`**

```json
{ "unread_count": 7 }
```

---

#### Mark as read

```
PATCH /v1/notifications/read
```

Marks one or more notifications as read. Sets `read_at` to the current server timestamp.

**Request body**

```json
{
  "ids": ["ntf_01HXK9P2R4QV7ZMJ3YBWF6DN0T"],
  "all": false
}
```

Pass `"all": true` to mark every unread notification as read in a single call. When `all` is `true`, `ids` is ignored. Returns `204 No Content`.

---

#### Dismiss notification

```
DELETE /v1/notifications/{id}
```

Soft-deletes a single notification by setting `dismissed_at`. The notification is immediately excluded from list and count responses. Returns `204 No Content`.

---

#### Get preferences

```
GET /v1/notifications/preferences
```

Returns the user's current notification preferences. Types not present in the response have their default in-app preference (`true`).

**Response `200`**

```json
{
  "preferences": [{ "type": "task.due_soon", "in_app": false }]
}
```

---

#### Update preferences

```
PUT /v1/notifications/preferences
```

Replaces the user's full preference set. Any type not included is reset to the default (`in_app: true`).

**Request body**

```json
{
  "preferences": [
    { "type": "task.due_soon", "in_app": false },
    { "type": "billing.trial_expiring", "in_app": false }
  ]
}
```

Returns `204 No Content`.

---

#### SSE stream

```
GET /v1/notifications/stream
```

Opens a persistent Server-Sent Events connection for the authenticated user. The connection remains open until the client closes it or the server terminates it after the maximum duration of 10 minutes, after which the client is expected to reconnect. The browser `EventSource` API handles reconnection automatically.

**Event: `notification`**

Emitted when a new notification is delivered to the user. The `data` field contains a JSON-serialised notification object in the same shape as list response items.

```
event: notification
data: {"id":"ntf_...","type":"mention.comment","title":"...","unread_count":8}

```

`unread_count` in the SSE payload reflects the new total after including the delivered notification. The frontend uses this value to update the badge rather than incrementing local state, avoiding drift from concurrent sessions.

**Event: `ping`**

Emitted every 30 seconds to keep the connection alive through proxies and load balancers that close idle connections.

```
event: ping
data: {}

```

**Connection limits**

A single user may hold at most 5 concurrent SSE connections (one per active tab or device). Connections beyond this limit are rejected with `429 Too Many Requests`. The limit is configurable via `NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER`.

---

### Configuration

| Environment variable                        | Type     | Default | Description                                                            |
| ------------------------------------------- | -------- | ------- | ---------------------------------------------------------------------- |
| `NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER` | `int`    | `5`     | Maximum concurrent SSE connections per user.                           |
| `NOTIFICATION_SSE_MAX_DURATION_SECONDS`     | `int`    | `600`   | Maximum SSE connection lifetime before forced close.                   |
| `NOTIFICATION_SSE_PING_INTERVAL_SECONDS`    | `int`    | `30`    | Interval between keepalive ping events.                                |
| `NOTIFICATION_RETENTION_DAYS`               | `int`    | `90`    | Number of days to retain dismissed notifications before hard deletion. |
| `REDIS_PUBSUB_CHANNEL_PREFIX`               | `string` | `user:` | Prefix for per-user Redis pub/sub channels.                            |

---

## Frontend

### Component structure

The Notification Centre is implemented as a self-contained React component tree mounted in the application shell. It has no dependency on global application state (Redux/Zustand) and manages all notification state internally via `useReducer`.

```
AppShell
  └─ NotificationCentre          (root — owns SSE connection + state)
        ├─ NotificationBell       (bell icon + unread badge)
        └─ NotificationDrawer     (slide-in panel, rendered when open)
              ├─ DrawerHeader      (title, mark-all-read, close)
              ├─ NotificationList  (virtualised scroll list)
              │     └─ NotificationItem (per-item row)
              └─ PreferencesPanel  (opt-in/out by type, toggled from drawer)
```

---

### State shape

```typescript
interface NotificationState {
  items: Notification[];
  unreadCount: number;
  nextCursor: string | null;
  isLoading: boolean;
  drawerOpen: boolean;
  prefPanelOpen: boolean;
  streamStatus: "connecting" | "connected" | "reconnecting" | "error";
}
```

State transitions are handled by a `notificationReducer`. Direct `setState` calls are not used; all updates dispatch typed actions to keep state transitions predictable and traceable in React DevTools.

---

### SSE connection management

`NotificationCentre` opens an `EventSource` on mount and closes it on unmount. The connection URL includes the JWT as a query parameter, as browser `EventSource` does not support custom headers.

```typescript
const source = new EventSource(`/v1/notifications/stream?token=${accessToken}`);

source.addEventListener("notification", (e) => {
  const notification = JSON.parse(e.data) as Notification;
  dispatch({ type: "NOTIFICATION_RECEIVED", payload: notification });
});

source.addEventListener("error", () => {
  dispatch({ type: "STREAM_ERROR" });
});
```

On `streamStatus === 'error'`, the component falls back to polling `GET /v1/notifications/count` every 30 seconds. This ensures the unread badge remains accurate even when SSE is unavailable, at the cost of up-to-30-second latency on new notifications.

The token passed to the SSE endpoint is the short-lived access token (1 hour). When the token expires, the `EventSource` is closed and reopened with the refreshed token. Token refresh is handled by the existing `useAuth` hook; `NotificationCentre` subscribes to token change events from that hook.

---

### Notification item behaviour

Each `NotificationItem` renders the notification title, a relative timestamp (e.g. "3 minutes ago"), and a visual indicator for unread state. Clicking an item:

1. Calls `PATCH /v1/notifications/read` with the item's ID.
2. Dispatches `MARK_READ` to update local state immediately (optimistic update).
3. Navigates to `notification.action_url` using the router's `navigate()` function.
4. Closes the drawer.

If the `PATCH` call fails, the optimistic read state is rolled back and an inline error is shown without disrupting navigation. The notification remains unread and the badge count is restored.

---

### Unread badge

The bell icon badge displays the `unreadCount` from component state. It is capped at `99+` for display purposes; values above 99 render as the string `"99+"` without overflow.

The badge is hidden entirely when `unreadCount === 0`. It reappears immediately when a new notification arrives via SSE, with a brief scale animation to draw attention.

---

### Accessibility

- The bell button has `aria-label="Notifications"` and `aria-expanded` reflecting drawer state.
- The unread count is announced to screen readers via an `aria-live="polite"` region that updates when `unreadCount` changes.
- The drawer is implemented as a `role="dialog"` with `aria-modal="true"` and traps focus while open.
- All interactive elements within the drawer meet a minimum 44×44px touch target.
- The component respects `prefers-reduced-motion`; the scale animation on the badge and the drawer slide-in are disabled when reduced motion is preferred.

---

### Internationalisation

All user-facing strings are defined in `src/locales/en/notifications.json` and passed through the existing `t()` hook. Relative timestamps use the `Intl.RelativeTimeFormat` API with the user's locale from the auth context. No hardcoded English strings exist in component code.

---

## Observability

### Backend metrics

| Metric                                 | Type      | Labels               | Description                                                                            |
| -------------------------------------- | --------- | -------------------- | -------------------------------------------------------------------------------------- |
| `notification_delivered_total`         | Counter   | `type`, `suppressed` | Incremented on every `Deliver` RPC call. `suppressed=true` when dropped by preference. |
| `notification_sse_connections`         | Gauge     | —                    | Current number of active SSE connections across all instances.                         |
| `notification_sse_events_sent_total`   | Counter   | `event_type`         | Total SSE events emitted, labelled by event type (`notification`, `ping`).             |
| `notification_api_request_duration_ms` | Histogram | `endpoint`, `status` | Latency for all REST endpoints.                                                        |

### Frontend events

The following analytics events are emitted via the existing `analytics.track()` utility.

| Event                                      | Properties                | Trigger                   |
| ------------------------------------------ | ------------------------- | ------------------------- |
| `notification_centre.opened`               | —                         | Drawer opened             |
| `notification_centre.notification_clicked` | `type`, `notification_id` | Notification item clicked |
| `notification_centre.mark_all_read`        | `count`                   | Mark all read triggered   |
| `notification_centre.preference_changed`   | `type`, `in_app`          | Preference toggled        |

---

## Deployment & rollout

### Service dependencies

`notification-service` must be deployed and healthy before `api-gateway` routes are enabled. The gateway routes are gated by the feature flag `notification_centre_enabled`, which defaults to `false`. Enable the flag in LaunchDarkly after confirming the service is healthy in production.

The frontend `NotificationCentre` component is also gated by `notification_centre_enabled` via the `useFeatureFlag` hook. It renders `null` when the flag is off, so it is safe to deploy the frontend release before the backend is ready.

### Rollout order

1. Deploy `notification-service@v2.0.0`. Confirm health at `/healthz`.
2. Run database migrations: `make migrate service=notification-service env=production`.
3. Provision the `payments.charge.dlq` — wait, wrong doc. Provision Redis pub/sub channels (no manual step; channels are created automatically on first publish).
4. Deploy `api-gateway@v3.8.0`. Confirm the `/v1/notifications/*` routes are reachable but the flag is off.
5. Deploy `web-app@v5.3.0`. Confirm the bell icon does not render (flag is off).
6. Enable `notification_centre_enabled` in LaunchDarkly for an internal test cohort (5%).
7. Monitor `notification_sse_connections`, error rates, and `notification_delivered_total` for 30 minutes.
8. Ramp flag to 100% if metrics are nominal.

### Database migrations

Two migrations are included. Both are backward-compatible and safe to run against a live database.

| Migration                                  | Description                                    |
| ------------------------------------------ | ---------------------------------------------- |
| `0042_create_notifications.sql`            | Creates the `notifications` table and indexes. |
| `0043_create_notification_preferences.sql` | Creates the `notification_preferences` table.  |

---

## Security considerations

**SSE token exposure**  
The access token is passed as a query parameter to the SSE endpoint because `EventSource` does not support request headers. This means the token appears in server access logs. The gateway strips the `token` query parameter from forwarded requests and injects `X-User-ID` instead, so the token is not logged by `notification-service`. Access logs on the gateway are considered sensitive and are subject to the standard log retention and access policy.

**Notification content**  
The `title` and `body` fields are rendered as plain text in the UI. No HTML rendering occurs at any layer. The `metadata` object is passed through without server-side sanitisation but is never rendered directly — component code must destructure specific known keys from `metadata` rather than rendering it wholesale.

**Cross-user access**  
All read and write endpoints filter by `X-User-ID` injected by the gateway. It is not possible to read or dismiss another user's notifications through the REST API. The SSE broker routes events exclusively to the connection authenticated with the target user's token.
