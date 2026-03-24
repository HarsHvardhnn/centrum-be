# Doctor appointment stats API – Wizyty lekarskie (simplified)

This API powers the **Wizyty lekarskie** section on the doctor stats/dashboard. It returns three numeric counts and a date range only (no chart data). The frontend should display **tiles + date range label** only.

---

## Endpoint

| Method | URL | Auth |
|--------|-----|------|
| GET | `/doctor-stats/:doctorId/appointment-stats` | Bearer (admin, doctor, receptionist) |

**Query**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `timeframe` | string | No (default: `month`) | `day` or `today` = Dzień, `week` = Tydzień, `month` = Miesiąc |

**Example**

```http
GET /doctor-stats/688887149cc810a1bd1d8589/appointment-stats?timeframe=month
Authorization: Bearer <token>
```

---

## Date range logic (backend)

- **Dzień (day / today)**  
  Today from 00:00 to 23:59 (server date).

- **Tydzień (week)**  
  Monday–Sunday of the **current week** (week starts on Monday even if today is e.g. Tuesday).

- **Miesiąc (month)**  
  From the **1st** day of the current month to the **last** day of the current month.

Changing the toggle (Dzień / Tydzień / Miesiąc) should call the API with `timeframe=day`, `timeframe=week`, or `timeframe=month` and then update the UI from the new response.

---

## Response (200)

```json
{
  "success": true,
  "data": {
    "doctorId": "688887149cc810a1bd1d8589",
    "timeframe": "month",
    "rangeStart": "2025-02-01",
    "rangeEnd": "2025-02-28",
    "rangeLabel": "Zakres: 01.02.2025 – 28.02.2025",
    "zarezerwowane": 12,
    "zakończone": 8,
    "anulowane": 1
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.doctorId` | string | Doctor ID. |
| `data.timeframe` | string | Normalized: `day`, `week`, or `month`. |
| `data.rangeStart` | string | ISO date (YYYY-MM-DD) start of range. |
| `data.rangeEnd` | string | ISO date (YYYY-MM-DD) end of range. |
| `data.rangeLabel` | string | Ready-to-display: `"Zakres: dd.mm.rrrr – dd.mm.rrrr"`. |
| `data.zarezerwowane` | number | Count of appointments with status `booked` or `checkedIn`. |
| `data.zakończone` | number | Count of appointments with status `completed`. |
| `data.anulowane` | number | Count of appointments with status `cancelled` or `no-show`. |

---

## How to display on the frontend

### Section structure

1. **Section header**  
   - Text: **Wizyty lekarskie**

2. **Toggle**  
   - Three options: **Dzień** | **Tydzień** | **Miesiąc**  
   - On change: call API with `timeframe=day`, `timeframe=week`, or `timeframe=month` and update the section from the response.

3. **Three statistic tiles (one row)**  
   - **Zarezerwowane** – large number = `data.zarezerwowane`  
   - **Zakończone** – large number = `data.zakończone`  
   - **Anulowane** – large number = `data.anulowane`  

4. **Date range label**  
   - Display: **Zakres: dd.mm.rrrr – dd.mm.rrrr**  
   - Use `data.rangeLabel` as-is (backend returns it in this format), or build from `data.rangeStart` / `data.rangeEnd` in `dd.mm.rrrr` format.

### Interaction rules

- Changing **Dzień / Tydzień / Miesiąc** must:
  - Call `GET /doctor-stats/:doctorId/appointment-stats?timeframe=<day|week|month>`.
  - Update the three numeric counters from `data.zarezerwowane`, `data.zakończone`, `data.anulowane`.
  - Update the displayed Zakres from `data.rangeLabel` (or equivalent from `rangeStart`/`rangeEnd`).
- No chart, no extra filters in this section. Only the toggle, the three tiles, and the range label.

### Example layout (conceptual)

```
Wizyty lekarskie

[ Dzień ] [ Tydzień ] [ Miesiąc ]

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Zarezerwowane   │  │ Zakończone       │  │ Anulowane        │
│      12         │  │       8          │  │       1          │
└─────────────────┘  └─────────────────┘  └─────────────────┘

Zakres: 01.02.2025 – 28.02.2025
```

---

## Errors

| Status | Body | Meaning |
|--------|------|--------|
| 400 | `{ "success": false, "message": "Nieprawidłowy format ID lekarza" }` | Invalid `doctorId`. |
| 400 | `{ "success": false, "message": "Nieprawidłowy parametr timeframe. Dozwolone: day, today, week, month" }` | Invalid or missing `timeframe` (only day/today/week/month allowed). |
| 500 | `{ "success": false, "message": "Nie udało się pobrać statystyk wizyt lekarza", "error": "..." }` | Server error. |

---

## Summary

- **API:** `GET /doctor-stats/:doctorId/appointment-stats?timeframe=day|week|month`
- **Response:** `data.zarezerwowane`, `data.zakończone`, `data.anulowane`, `data.rangeLabel` (and optional `rangeStart`/`rangeEnd`).
- **UI:** Section “Wizyty lekarskie” with toggle (Dzień/Tydzień/Miesiąc), three number tiles, and one Zakres line. No chart.
