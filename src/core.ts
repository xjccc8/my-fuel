export type Powertrain = "combustion" | "hybrid" | "plug-in-hybrid" | "electric";
export type OilType = "full-synthetic" | "semi-synthetic" | "conventional" | "high-mileage" | "ev-no-engine-oil" | "other";

export interface Vehicle {
  id: string;
  name: string;
  type: string;
  year: number;
  notes: string;
  powertrain: Powertrain;
  tcoEnabled: boolean;
  currentOdometerKm: number;
  latestMaintenanceOdometerKm: number | null;
  latestMaintenanceDate: string | null;
  oilType: OilType | null;
  maintenanceIntervalKm: number;
  createdAt: string;
}

export interface VehicleInput {
  name: string;
  type: string;
  year: number;
  notes: string;
  powertrain: Powertrain;
  tcoEnabled: boolean;
  currentOdometerKm?: number;
  latestMaintenanceOdometerKm?: number | null;
  latestMaintenanceDate?: string | null;
  oilType?: OilType | null;
  maintenanceIntervalKm?: number;
}

export interface FillUp {
  id: string;
  vehicleId: string;
  date: string;
  odometerKm: number;
  liters: number;
  totalAmount: number;
  fullTank: boolean;
  notes: string;
}

export interface Expense {
  id: string;
  vehicleId: string;
  date: string;
  category: string;
  amount: number;
  notes: string;
}

export const powertrainLabels: Record<Powertrain, string> = {
  combustion: "Combustion",
  hybrid: "Hybrid",
  "plug-in-hybrid": "Plug-in hybrid",
  electric: "Electric",
};

export const oilTypeLabels: Record<OilType, string> = {
  "full-synthetic": "Full synthetic",
  "semi-synthetic": "Semi-synthetic",
  conventional: "Conventional / mineral",
  "high-mileage": "High-mileage synthetic",
  "ev-no-engine-oil": "EV / no engine oil",
  other: "Other",
};

export function isPowertrain(value: unknown): value is Powertrain {
  return typeof value === "string" && value in powertrainLabels;
}

export function isOilType(value: unknown): value is OilType {
  return typeof value === "string" && value in oilTypeLabels;
}

export function validateVehicle(input: VehicleInput): string[] {
  const errors: string[] = [];
  const currentYear = new Date().getFullYear();
  if (!input.name.trim()) errors.push("Name is required.");
  if (!input.type.trim()) errors.push("Type is required.");
  if (!Number.isInteger(input.year) || input.year < 1886 || input.year > currentYear + 1) {
    errors.push(`Year must be between 1886 and ${currentYear + 1}.`);
  }
  return errors;
}

export function createVehicle(input: VehicleInput, id: string = crypto.randomUUID()): Vehicle {
  const errors = validateVehicle(input);
  if (errors.length) throw new Error(errors.join(" "));
  const currentOdometerKm = input.currentOdometerKm ?? 0;
  const latestMaintenanceOdometerKm = input.latestMaintenanceOdometerKm ?? null;
  const interval = input.maintenanceIntervalKm ?? 5000;
  if (!Number.isFinite(currentOdometerKm) || currentOdometerKm < 0 || (latestMaintenanceOdometerKm !== null && (!Number.isFinite(latestMaintenanceOdometerKm) || latestMaintenanceOdometerKm < 0))) throw new Error("Odometer values must be valid non-negative numbers.");
  if (latestMaintenanceOdometerKm !== null && latestMaintenanceOdometerKm > currentOdometerKm) throw new Error("Latest maintenance kilometres cannot exceed the current odometer.");
  if (!Number.isFinite(interval) || interval <= 0) throw new Error("Maintenance interval must be greater than zero.");
  return { ...input, id, name: input.name.trim(), type: input.type.trim(), notes: input.notes.trim(), currentOdometerKm, latestMaintenanceOdometerKm, latestMaintenanceDate: input.latestMaintenanceDate || null, oilType: input.oilType || null, maintenanceIntervalKm: interval, createdAt: new Date().toISOString() };
}

export function maintenanceStatus(vehicle: Vehicle): { nextDueKm: number | null; remainingKm: number | null; label: string } {
  if (vehicle.latestMaintenanceOdometerKm === null) return { nextDueKm: null, remainingKm: null, label: "Add latest oil service" };
  const nextDueKm = vehicle.latestMaintenanceOdometerKm + vehicle.maintenanceIntervalKm;
  const remainingKm = nextDueKm - vehicle.currentOdometerKm;
  return { nextDueKm, remainingKm, label: remainingKm <= 0 ? "Maintenance due" : `${remainingKm.toLocaleString()} km remaining` };
}

export function createFillUp(input: Omit<FillUp, "id">, id: string = crypto.randomUUID()): FillUp {
  if (!input.vehicleId || !input.date || !Number.isFinite(input.odometerKm) || input.odometerKm < 0 || !Number.isFinite(input.liters) || input.liters <= 0 || !Number.isFinite(input.totalAmount) || input.totalAmount < 0) {
    throw new Error("Fill-up requires a date, vehicle, positive liters, and valid odometer and amount values.");
  }
  return { ...input, id, notes: input.notes.trim() };
}

export function createExpense(input: Omit<Expense, "id">, id: string = crypto.randomUUID()): Expense {
  if (!input.vehicleId || !input.date || !input.category.trim() || !Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Expense requires a date, vehicle, category, and a valid non-negative amount.");
  }
  return { ...input, id, category: input.category.trim(), notes: input.notes.trim() };
}

export function totalCost(fillUps: FillUp[], expenses: Expense[]): number {
  return [...fillUps.map((item) => item.totalAmount), ...expenses.map((item) => item.amount)].reduce((sum, amount) => sum + amount, 0);
}

export function averageConsumption(fillUps: FillUp[]): number | null {
  const ordered = [...fillUps].sort((a, b) => a.odometerKm - b.odometerKm);
  if (ordered.length < 2) return null;
  const distance = ordered[ordered.length - 1].odometerKm - ordered[0].odometerKm;
  const liters = ordered.slice(1).reduce((sum, item) => sum + item.liters, 0);
  return distance > 0 && liters > 0 ? (liters / distance) * 100 : null;
}

export function currentOdometerKm(vehicle: Vehicle, fillUps: FillUp[]): number {
  return Math.max(vehicle.currentOdometerKm, ...fillUps.filter((item) => item.vehicleId === vehicle.id).map((item) => item.odometerKm));
}

export function syncVehicleOdometers(vehicles: Vehicle[], fillUps: FillUp[]): Vehicle[] {
  return vehicles.map((vehicle) => {
    const current = currentOdometerKm(vehicle, fillUps);
    return current === vehicle.currentOdometerKm ? vehicle : { ...vehicle, currentOdometerKm: current };
  });
}

export function lifetimeMetrics(fillUps: FillUp[], vehicleId?: string): { distanceKm: number; liters: number; kmPerLiter: number | null } {
  const records = fillUps.filter((item) => !vehicleId || item.vehicleId === vehicleId).sort((a, b) => a.odometerKm - b.odometerKm);
  if (records.length < 2) return { distanceKm: 0, liters: 0, kmPerLiter: null };
  const distanceKm = records[records.length - 1].odometerKm - records[0].odometerKm;
  const liters = records.slice(1).reduce((sum, item) => sum + item.liters, 0);
  return { distanceKm, liters, kmPerLiter: distanceKm > 0 && liters > 0 ? distanceKm / liters : null };
}

const fillUpHeaders = ["id", "vehicleId", "date", "odometerKm", "liters", "totalAmount", "fullTank", "notes"];
const expenseHeaders = ["id", "vehicleId", "date", "category", "amount", "notes"];

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"' && csv[index + 1] === '"' && quoted) { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { current.push(cell); cell = ""; }
    else if ((character === "\r" || character === "\n") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      current.push(cell);
      if (current.some((value) => value !== "")) rows.push(current);
      current = [];
      cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted value.");
  current.push(cell);
  if (current.some((value) => value !== "")) rows.push(current);
  return rows;
}

function recordsToCsv<T>(headers: string[], records: T[], read: (record: T, header: string) => string | number | boolean | null): string {
  return [headers.join(","), ...records.map((record) => headers.map((header) => encodeCsvCell(read(record, header))).join(","))].join("\r\n");
}

export function fillUpsToCsv(fillUps: FillUp[]): string {
  return recordsToCsv(fillUpHeaders, fillUps, (record, header) => record[header as keyof FillUp]);
}

export function expensesToCsv(expenses: Expense[]): string {
  return recordsToCsv(expenseHeaders, expenses, (record, header) => record[header as keyof Expense]);
}

export function fillUpsFromCsv(csv: string): FillUp[] {
  const rows = parseCsvRows(csv);
  const headers = rows.shift();
  if (!headers || headers.join(",") !== fillUpHeaders.join(",")) throw new Error("CSV headers do not match the My Fuel fill-up format.");
  if (rows.some((row) => row.length !== headers.length)) throw new Error("CSV contains a row with an unexpected number of columns.");
  return rows.map(([id, vehicleId, date, odometerKm, liters, totalAmount, fullTank, notes]) => {
    if (!id || !vehicleId || !["true", "false"].includes(fullTank)) throw new Error("CSV contains an invalid fill-up.");
    return createFillUp({ vehicleId, date, odometerKm: Number(odometerKm), liters: Number(liters), totalAmount: Number(totalAmount), fullTank: fullTank === "true", notes }, id);
  });
}

export function expensesFromCsv(csv: string): Expense[] {
  const rows = parseCsvRows(csv);
  const headers = rows.shift();
  if (!headers || headers.join(",") !== expenseHeaders.join(",")) throw new Error("CSV headers do not match the My Fuel expense format.");
  if (rows.some((row) => row.length !== headers.length)) throw new Error("CSV contains a row with an unexpected number of columns.");
  return rows.map(([id, vehicleId, date, category, amount, notes]) => {
    if (!id || !vehicleId) throw new Error("CSV contains an invalid expense.");
    return createExpense({ vehicleId, date, category, amount: Number(amount), notes }, id);
  });
}

export function encodeCsvCell(value: string | number | boolean | null): string {
  const text = typeof value === "string" && /^[=+\-@]/.test(value) ? `'${value}` : value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function vehiclesToCsv(vehicles: Vehicle[]): string {
  const headers = ["id", "name", "type", "year", "notes", "powertrain", "tcoEnabled", "createdAt"];
  return [headers.join(","), ...vehicles.map((v) => headers.map((header) => encodeCsvCell(v[header as keyof Vehicle])).join(","))].join("\r\n");
}

export function vehiclesFromCsv(csv: string): Vehicle[] {
  const rows = parseCsvRows(csv);
  const headers = rows.shift();
  if (!headers || headers.join(",") !== "id,name,type,year,notes,powertrain,tcoEnabled,createdAt") throw new Error("CSV headers do not match the My Fuel vehicle format.");
  if (rows.some((row) => row.length !== headers.length)) throw new Error("CSV contains a row with an unexpected number of columns.");
  return rows.map((row) => {
    const [id, name, type, year, notes, powertrain, tcoEnabled, createdAt] = row;
    if (!id || !createdAt || !isPowertrain(powertrain) || !["true", "false"].includes(tcoEnabled)) throw new Error("CSV contains an invalid vehicle record.");
    const input: VehicleInput = { name: name.replace(/^'(?=[=+\-@])/, ""), type: type.replace(/^'(?=[=+\-@])/, ""), year: Number(year), notes: notes.replace(/^'(?=[=+\-@])/, ""), powertrain, tcoEnabled: tcoEnabled === "true" };
    const vehicle = createVehicle(input, id);
    return { ...vehicle, createdAt };
  });
}
