# Visit type verification (Rodzaj wizyty – „Do weryfikacji”)

## What „verified” means

- **`consultation.visitTypeVerified`** is a boolean on the appointment.
- **Default is `true`**: New appointments are created with visit type verified, so the visit can be marked **completed** without an extra verification step.
- **`false`**: If set explicitly (e.g. by older data or an update), the visit cannot be closed as **completed** until it is set to `true` (via PATCH consultation or PATCH status with `visitTypeVerified: true`).

So „verified” = **doctor confirmed / accepted the visit type** before closing the visit.

---

## How to verify (two options)

### Option 1: Verify when completing (one request)

When closing the visit, send **`visitTypeVerified: true`** in the same request as `status: "completed"`:

```http
PATCH /appointments/:appointmentId/status
Content-Type: application/json

{
  "status": "completed",
  "visitTypeVerified": true
}
```

The backend will set `consultation.visitTypeVerified = true` and then allow the status to be set to `completed`. Use this when the doctor confirms the visit type at the moment of closing (e.g. in the „Complete visit” screen).

---

### Option 2: Verify earlier via consultation update

The doctor can verify (or change) the visit type **before** closing the visit by updating the consultation:

```http
PATCH /appointments/:id/consultation
Content-Type: application/json

{
  "visitTypeVerified": true,
  "visitReason": "Konsultacja pierwszorazowa"
}
```

- **`visitTypeVerified`**: set to `true` to mark the visit type as confirmed.
- **`visitReason`** (optional): use if the doctor changes the type (e.g. to a different value from the visit-reasons list).

After this, **PATCH …/status** with `"status": "completed"` will succeed without sending `visitTypeVerified` again.

---

## Error when not verified

If you call:

```http
PATCH /appointments/:id/status
{ "status": "completed" }
```

and the appointment has **`consultation.visitTypeVerified !== true`**, the API responds with:

```json
{
  "success": false,
  "message": "Nie można zamknąć wizyty bez weryfikacji rodzaju wizyty. Lekarz musi potwierdzić lub zmienić rodzaj wizyty przed zamknięciem.",
  "code": "VISIT_TYPE_NOT_VERIFIED",
  "visitReasonSet": true,
  "visitTypeVerified": false
}
```

**Fix:** Either:

1. Send the same status request with **`visitTypeVerified: true`** in the body, or  
2. Call **PATCH /appointments/:id/consultation** with `visitTypeVerified: true` (and optional `visitReason`), then call the status endpoint again with `"status": "completed"`.

---

## Summary

| Action | Endpoint | Body |
|--------|----------|------|
| Complete and verify in one go | `PATCH /appointments/:id/status` | `{ "status": "completed", "visitTypeVerified": true }` |
| Verify (or set visit type) before completing | `PATCH /appointments/:id/consultation` | `{ "visitTypeVerified": true, "visitReason": "…" }` (optional) |

„From where to verify”: from the **frontend** – either in the **Complete visit** request (Option 1) or in a separate **Consultation / visit type** screen that calls the consultation endpoint (Option 2).
