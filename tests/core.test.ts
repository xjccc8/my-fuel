import { describe, expect, it } from "vitest";
import { averageConsumption, createExpense, createFillUp, createVehicle, currentOdometerKm, encodeCsvCell, expensesFromCsv, expensesToCsv, fillUpsFromCsv, fillUpsToCsv, lifetimeMetrics, maintenanceStatus, syncVehicleOdometers, validateVehicle, vehiclesFromCsv, vehiclesToCsv } from "../src/core";

describe("vehicle domain", () => {
  it("requires a name and type", () => {
    expect(validateVehicle({ name: "", type: "", year: 2025, notes: "", powertrain: "electric", tcoEnabled: false })).toEqual(["Name is required.", "Type is required."]);
  });
  it("creates a trimmed vehicle", () => {
    const vehicle = createVehicle({ name: "  Daily  ", type: " EV ", year: 2025, notes: "", powertrain: "electric", tcoEnabled: false }, "test-id");
    expect(vehicle).toMatchObject({ id: "test-id", name: "Daily", type: "EV" });
  });
  it("quotes CSV values safely", () => {
    expect(encodeCsvCell("A, B")).toBe('"A, B"');
    expect(encodeCsvCell("=1+1")).toBe("'=1+1");
    expect(vehiclesToCsv([])).toBe("id,name,type,year,notes,powertrain,tcoEnabled,createdAt");
  });
  it("round-trips vehicle CSV", () => {
    const original = createVehicle({ name: "Family, car", type: "EV", year: 2025, notes: "Home\ncharger", powertrain: "electric", tcoEnabled: true }, "csv-id");
    expect(vehiclesFromCsv(vehiclesToCsv([original]))).toEqual([original]);
  });
  it("calculates consumption only with usable distance", () => {
    const records = [
      createFillUp({ vehicleId: "v", date: "2026-01-01", odometerKm: 1000, liters: 20, totalAmount: 100, fullTank: true, notes: "" }, "a"),
      createFillUp({ vehicleId: "v", date: "2026-01-10", odometerKm: 1200, liters: 18, totalAmount: 90, fullTank: true, notes: "" }, "b"),
    ];
    expect(averageConsumption(records)).toBe(9);
    expect(() => createExpense({ vehicleId: "v", date: "2026-01-01", category: "", amount: 1, notes: "" })).toThrow();
  });
  it("round-trips fill-up and expense CSV records", () => {
    const fillUp = createFillUp({ vehicleId: "v", date: "2026-01-01", odometerKm: 100, liters: 10, totalAmount: 50, fullTank: true, notes: "station" }, "fill-id");
    const expense = createExpense({ vehicleId: "v", date: "2026-01-02", category: "Repair", amount: 25, notes: "brakes" }, "expense-id");
    expect(fillUpsFromCsv(fillUpsToCsv([fillUp]))).toEqual([fillUp]);
    expect(expensesFromCsv(expensesToCsv([expense]))).toEqual([expense]);
  });
  it("calculates the 5000 km maintenance recommendation", () => {
    const vehicle = createVehicle({ name: "Daily", type: "Sedan", year: 2025, notes: "", powertrain: "combustion", tcoEnabled: false, currentOdometerKm: 12400, latestMaintenanceOdometerKm: 10000, latestMaintenanceDate: "2026-01-01", oilType: "full-synthetic" }, "maintenance-id");
    expect(maintenanceStatus(vehicle)).toMatchObject({ nextDueKm: 15000, remainingKm: 2600, label: "2,600 km remaining" });
    expect(maintenanceStatus({ ...vehicle, currentOdometerKm: 15000 }).label).toBe("Maintenance due");
  });
  it("advances the odometer and calculates lifetime economy from fill-ups", () => {
    const vehicle = createVehicle({ name: "Daily", type: "Sedan", year: 2025, notes: "", powertrain: "combustion", tcoEnabled: false, currentOdometerKm: 1000 }, "lifetime-id");
    const records = [
      createFillUp({ vehicleId: vehicle.id, date: "2026-01-01", odometerKm: 1000, liters: 20, totalAmount: 100, fullTank: true, notes: "" }, "first"),
      createFillUp({ vehicleId: vehicle.id, date: "2026-01-10", odometerKm: 1300, liters: 30, totalAmount: 150, fullTank: true, notes: "" }, "second"),
    ];
    expect(currentOdometerKm(vehicle, records)).toBe(1300);
    expect(lifetimeMetrics(records, vehicle.id)).toMatchObject({ distanceKm: 300, liters: 30, kmPerLiter: 10 });
    expect(syncVehicleOdometers([vehicle], records)[0].currentOdometerKm).toBe(1300);
  });
});
