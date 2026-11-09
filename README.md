# My Fuel

Phase 1 local-first vertical slice for the privacy-first vehicle tracker described in `..\MY_FUEL_MASTER_BLUEPRINT.md`.

## Run

```powershell
cd .\my-fuel
npm install
npm test
npm run build
npm run dev
```

Vehicle, fill-up, and expense records are stored in browser `localStorage` only. The app has no account, API, telemetry, or server-side user-data storage. The app supports per-entity CSV export/import and versioned JSON backup/restore for all current local entities.

Current local features:

- Vehicle creation and confirmed deletion.
- Fill-up and expense creation and confirmed deletion.
- Local statistics for total cost, record counts, estimated L/100 km, lifetime distance, and lifetime km/L.
- Controlled oil-service types (full synthetic, semi-synthetic, conventional/mineral, high-mileage, EV/no engine oil, or other).
- Vehicle odometers advance automatically to the highest recorded fill-up kilometre without lowering manual readings.
- Per-vehicle lifetime odometer and economy summaries.
- CSV portability for vehicles, fill-ups, and expenses.
- Versioned JSON backup/restore with local vehicle-reference validation.
