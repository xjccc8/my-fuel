import type { Expense, FillUp, Vehicle } from "./core";

const STORAGE_KEY = "my-fuel:vehicles:v1";
const FILL_UPS_KEY = "my-fuel:fill-ups:v1";
const EXPENSES_KEY = "my-fuel:expenses:v1";

function load<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try { const parsed: unknown = JSON.parse(raw); return Array.isArray(parsed) ? parsed as T[] : []; }
  catch { throw new Error("Saved local data could not be read. Exported backups are not affected."); }
}

export function loadVehicles(): Vehicle[] {
  return load<Vehicle>(STORAGE_KEY);
}

export function saveVehicles(vehicles: Vehicle[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
}

export function clearVehicles(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export const loadFillUps = (): FillUp[] => load<FillUp>(FILL_UPS_KEY);
export const saveFillUps = (items: FillUp[]): void => { localStorage.setItem(FILL_UPS_KEY, JSON.stringify(items)); };
export const loadExpenses = (): Expense[] => load<Expense>(EXPENSES_KEY);
export const saveExpenses = (items: Expense[]): void => { localStorage.setItem(EXPENSES_KEY, JSON.stringify(items)); };
