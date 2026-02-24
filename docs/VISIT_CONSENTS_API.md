# Get consents by visit – API contract

Use this API to load consents for a single visit (appointment). Consents can come from the **patient** (when the visit is linked to a patient) or from **registration data** (visit-only / to-be-completed).

---

## Endpoint

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/appointments/:visitId/consents` | Required: `doctor`, `receptionist`, or `admin` |

**Path parameter**

- **`visitId`** – Appointment (visit) ID, e.g. `6999b34b6c043f2a3ebd4bcd`.

**Example**

```http
GET /appointments/6999b34b6c043f2a3ebd4bcd/consents
Authorization: Bearer <token>
```

---

## Response

### Success (200)

**When the visit has a linked patient**  
Consents are taken from the patient record (`source: "patient"`).

**When the visit has no patient (visit-only)**  
Consents are taken from the visit’s registration data (`source: "registration"`).

**Body**

```json
{
  "success": true,
  "visitId": "6999b34b6c043f2a3ebd4bcd",
  "source": "patient",
  "consents": [
    {
      "id": 1234567890,
      "text": "Wyrażam zgodę na otrzymywanie powiadomień SMS i e-mail dotyczących mojej wizyty (np. przypomnienia, zmiany terminu).",
      "agreed": true
    },
    {
      "id": 1234567891,
      "text": "Zapoznałem(-am) się z Regulaminem i Polityką Prywatności i akceptuję ich postanowienia.",
      "agreed": true
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` |
| `visitId` | string | The appointment/visit ID requested. |
| `source` | string | `"patient"` if consents come from the linked patient; `"registration"` if from visit-only registration data. |
| `consents` | array | List of consent objects. Each item can have `id`, `text`, `agreed` (and other fields the backend stores). |

If there are no consents (e.g. visit-only with no registration consents saved), `consents` is `[]`.

### Visit not found (404)

```json
{
  "success": false,
  "message": "Visit not found"
}
```

### Invalid visit ID (400)

```json
{
  "success": false,
  "message": "Invalid visit ID format"
}
```

### Server error (500)

```json
{
  "success": false,
  "message": "Failed to fetch visit consents",
  "error": "..."
}
```

---

## Frontend usage

- Call **after** you have a visit/appointment ID (e.g. from list or detail).
- Use **`source`** only if you need to show where consents came from (patient vs registration).
- Use **`consents`** to render the list (e.g. consent text + agreed yes/no).
- Handle **empty `consents`** for visit-only visits that have no stored consents.

**Example (fetch)**

```js
const visitId = "6999b34b6c043f2a3ebd4bcd"; // from your state/route
const res = await fetch(`/appointments/${visitId}/consents`, {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
if (data.success) {
  console.log(data.consents, data.source);
} else {
  console.error(data.message);
}
```

---

## Summary

| Item | Value |
|------|--------|
| **API** | `GET /appointments/:visitId/consents` |
| **Auth** | Doctor, receptionist, or admin |
| **Returns** | `consents` array + `source` (`"patient"` or `"registration"`) |
| **Visit-only** | Uses `registrationData.consents` when no patient is linked. |
