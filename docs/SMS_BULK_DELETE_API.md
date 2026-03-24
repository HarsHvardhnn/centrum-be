# SMS bulk permanent delete – API for frontend

This document describes the APIs for **permanently** deleting multiple SMS templates and multiple SMS history records in one request. Deletion is irreversible (records are removed from the database).

---

## Authentication

Both endpoints require a valid **Bearer token** (JWT) in the `Authorization` header.  
Allowed roles: **admin**, **receptionist**.

```http
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

---

## 1. Bulk permanent delete – SMS templates

Permanently deletes the given SMS templates by ID. Documents are removed from the database.

### Request

| Method | URL (base) | Path |
|--------|------------|------|
| **POST** | `{BASE_URL}/api/sms-templates` | `/bulk-delete` |

**Full URL example:**  
`POST https://centrum-be.onrender.com/api/sms-templates/bulk-delete`

**Headers:**

| Header | Value |
|--------|--------|
| `Authorization` | `Bearer <jwt>` |
| `Content-Type` | `application/json` |

**Body (JSON):**

```json
{
  "ids": ["template_id_1", "template_id_2", "template_id_3"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ids` | `string[]` | Yes | Array of SMS template MongoDB `_id` values. Non-empty array. |

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Trwale usunięto 3 szablonów SMS",
  "deletedCount": 3
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` |
| `message` | string | Human-readable message (Polish). |
| `deletedCount` | number | Number of templates actually deleted. |

**Validation error (400):**

```json
{
  "success": false,
  "message": "Podaj tablicę identyfikatorów (ids) do usunięcia"
}
```

or

```json
{
  "success": false,
  "message": "Brak prawidłowych identyfikatorów"
}
```

**Server error (500):**

```json
{
  "success": false,
  "message": "Nie udało się trwale usunąć szablonów SMS",
  "error": "..."
}
```

### Example (cURL)

```bash
curl -X POST 'https://centrum-be.onrender.com/api/sms-templates/bulk-delete' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"ids": ["674abc123def456789012345", "674abc123def456789012346"]}'
```

---

## 2. Bulk permanent delete – SMS history

Permanently deletes the given SMS history (message receipt) records by ID. Documents are removed from the database.

### Request

| Method | URL (base) | Path |
|--------|------------|------|
| **POST** | `{BASE_URL}/sms-data` | `/bulk-delete` |

**Full URL example:**  
`POST https://centrum-be.onrender.com/sms-data/bulk-delete`

**Headers:**

| Header | Value |
|--------|--------|
| `Authorization` | `Bearer <jwt>` |
| `Content-Type` | `application/json` |

**Body (JSON):**

```json
{
  "ids": ["receipt_id_1", "receipt_id_2", "receipt_id_3"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ids` | `string[]` | Yes | Array of SMS history (MessageReceipt) MongoDB `_id` values. Non-empty array. |

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Trwale usunięto 5 wpisów historii SMS",
  "deletedCount": 5
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` |
| `message` | string | Human-readable message (Polish). |
| `deletedCount` | number | Number of history records actually deleted. |

**Validation error (400):**

Same shape as SMS templates (missing or invalid `ids`).

**Server error (500):**

```json
{
  "success": false,
  "message": "Nie udało się trwale usunąć wpisów historii SMS",
  "error": "..."
}
```

### Example (cURL)

```bash
curl -X POST 'https://centrum-be.onrender.com/sms-data/bulk-delete' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"ids": ["674abc123def456789012350", "674abc123def456789012351"]}'
```

---

## Frontend integration summary

| Feature | Method | Endpoint | Body |
|---------|--------|----------|------|
| Delete selected SMS templates (permanent) | POST | `/api/sms-templates/bulk-delete` | `{ "ids": ["id1", "id2", ...] }` |
| Delete selected SMS history (permanent) | POST | `/sms-data/bulk-delete` | `{ "ids": ["id1", "id2", ...] }` |

- Use the same JWT as for other admin/receptionist APIs.
- After a successful call, refresh the list (or remove deleted items from local state) and show a success message; optionally use `deletedCount` in the message.
- Invalid or non-existent IDs are simply not deleted; the response reports how many were actually deleted (`deletedCount`).
