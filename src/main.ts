import "./styles.css";
import { averageConsumption, createExpense, createFillUp, createVehicle, currentOdometerKm, expensesFromCsv, expensesToCsv, fillUpsFromCsv, fillUpsToCsv, isOilType, isPowertrain, lifetimeMetrics, maintenanceStatus, oilTypeLabels, powertrainLabels, syncVehicleOdometers, totalCost, type Expense, type FillUp, type Powertrain, vehiclesFromCsv, vehiclesToCsv, type VehicleInput } from "./core";
import { loadExpenses, loadFillUps, loadVehicles, saveExpenses, saveFillUps, saveVehicles } from "./storage";

type Tab = "fill-ups" | "expenses" | "stats" | "cars" | "settings";
let activeTab: Tab = "cars";
let fillUps = loadFillUps();
let expenses = loadExpenses();
const storedVehicles = loadVehicles();
let vehicles = syncVehicleOdometers(storedVehicles, fillUps);
if (vehicles.some((vehicle, index) => vehicle.currentOdometerKm !== storedVehicles[index]?.currentOdometerKm)) saveVehicles(vehicles);
const filters: Record<"fill-ups" | "expenses", string> = { "fill-ups": "", expenses: "" };

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Application root is missing.");
const app = root;

function download(filename: string, content: string, type: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function render(): void {
  app.innerHTML = `
    <main class="shell">
      <header class="topbar"><div><p class="eyebrow">MY FUEL</p><h1>${activeTab === "cars" ? "Your cars" : tabLabel(activeTab)}</h1></div><button class="icon-button" aria-label="Export vehicles" data-action="export">⇩</button></header>
      <section class="content">${renderTab()}</section>
      <nav class="tabs" aria-label="Primary navigation">${(["fill-ups", "expenses", "stats", "cars", "settings"] as Tab[]).map((tab) => `<button class="${tab === activeTab ? "active" : ""}" data-tab="${tab}"><span>${tabIcon(tab)}</span>${tabLabel(tab)}</button>`).join("")}</nav>
    </main>`;
  app.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => button.addEventListener("click", () => { activeTab = button.dataset.tab as Tab; render(); }));
  app.querySelectorAll<HTMLButtonElement>("[data-action=add-car]").forEach((button) => button.addEventListener("click", () => showVehicleForm()));
  app.querySelectorAll<HTMLButtonElement>("[data-action=add-fill-up]").forEach((button) => button.addEventListener("click", () => showFillUpForm(undefined, button.dataset.vehicleId)));
  app.querySelectorAll<HTMLButtonElement>("[data-action=add-expense]").forEach((button) => button.addEventListener("click", () => showExpenseForm(undefined, button.dataset.vehicleId)));
  app.querySelectorAll<HTMLButtonElement>("[data-delete-id]").forEach((button) => button.addEventListener("click", () => deleteVehicle(button.dataset.deleteId ?? "")));
  app.querySelectorAll<HTMLButtonElement>("[data-edit-vehicle]").forEach((button) => button.addEventListener("click", () => showVehicleForm(button.dataset.editVehicle)));
  app.querySelectorAll<HTMLButtonElement>("[data-delete-fill-up]").forEach((button) => button.addEventListener("click", () => deleteRecord("fill-ups", button.dataset.deleteFillUp ?? "")));
  app.querySelectorAll<HTMLButtonElement>("[data-delete-expense]").forEach((button) => button.addEventListener("click", () => deleteRecord("expenses", button.dataset.deleteExpense ?? "")));
  app.querySelectorAll<HTMLButtonElement>("[data-edit-fill-up]").forEach((button) => button.addEventListener("click", () => showFillUpForm(button.dataset.editFillUp)));
  app.querySelectorAll<HTMLButtonElement>("[data-edit-expense]").forEach((button) => button.addEventListener("click", () => showExpenseForm(button.dataset.editExpense)));
  app.querySelectorAll<HTMLSelectElement>("[data-filter]").forEach((select) => select.addEventListener("change", () => renderFilteredRecords(select.dataset.filter as "fill-ups" | "expenses", select.value)));
  app.querySelector<HTMLButtonElement>("[data-action=export]")?.addEventListener("click", () => download("my-fuel-vehicles.csv", vehiclesToCsv(vehicles), "text/csv"));
  app.querySelector<HTMLButtonElement>("[data-action=export-fill-ups]")?.addEventListener("click", () => download("my-fuel-fill-ups.csv", fillUpsToCsv(fillUps), "text/csv"));
  app.querySelector<HTMLButtonElement>("[data-action=export-expenses]")?.addEventListener("click", () => download("my-fuel-expenses.csv", expensesToCsv(expenses), "text/csv"));
  app.querySelector<HTMLButtonElement>("[data-action=backup]")?.addEventListener("click", () => download("my-fuel-backup.json", JSON.stringify({ format: "my-fuel-backup", schemaVersion: 1, exportedAt: new Date().toISOString(), data: { vehicles, fillUps, expenses } }, null, 2), "application/json"));
  app.querySelectorAll<HTMLButtonElement>("[data-action=import]").forEach((button) => button.addEventListener("click", () => chooseImport(button.dataset.format as "json" | "csv")));
  app.querySelectorAll<HTMLButtonElement>("[data-action=import-records]").forEach((button) => button.addEventListener("click", () => chooseRecordImport(button.dataset.recordType as "fill-ups" | "expenses")));
}

function renderTab(): string {
  if (activeTab === "fill-ups") return renderRecords("fill-ups");
  if (activeTab === "expenses") return renderRecords("expenses");
  if (activeTab === "stats") return renderStats();
  if (activeTab === "cars") return `<div class="hero"><div><p class="eyebrow">YOUR GARAGE</p><h2>Everything in one place</h2><p class="muted">Track each car, then jump straight into fuel, costs, or insights.</p></div><button class="primary" data-action="add-car">＋ Add car</button></div>${vehicles.length ? `<div class="cards">${vehicles.map((v) => { const maintenance = maintenanceStatus(v); const metrics = lifetimeMetrics(fillUps, v.id); const carFillUps = fillUps.filter((item) => item.vehicleId === v.id).length; const carExpenses = expenses.filter((item) => item.vehicleId === v.id).length; return `<article class="card vehicle-card"><div class="vehicle-main"><div class="vehicle-title"><span class="vehicle-mark">🚙</span><div><h2>${escapeHtml(v.name)}</h2><p>${escapeHtml(v.type)} · ${v.year}</p></div></div><div class="vehicle-metrics"><span><strong>${currentOdometerKm(v, fillUps).toLocaleString()}</strong> km</span><span><strong>${metrics.kmPerLiter ? metrics.kmPerLiter.toFixed(1) : "—"}</strong> km/L</span><span><strong>${maintenance.remainingKm !== null && maintenance.remainingKm <= 0 ? "Due" : maintenance.nextDueKm ? maintenance.nextDueKm.toLocaleString() : "—"}</strong> service</span></div><p class="maintenance">${v.oilType ? `${oilTypeLabels[v.oilType] ?? escapeHtml(v.oilType)} oil · ${maintenance.label}` : maintenance.label}</p></div><div class="vehicle-footer"><span class="badge">${powertrainLabels[v.powertrain]}</span><span class="record-count">${carFillUps} fill-ups · ${carExpenses} expenses</span><div class="card-actions"><button class="edit" data-action="add-fill-up" data-vehicle-id="${escapeHtml(v.id)}">＋ Fuel</button><button class="edit" data-action="add-expense" data-vehicle-id="${escapeHtml(v.id)}">＋ Cost</button><button class="edit" data-edit-vehicle="${escapeHtml(v.id)}" aria-label="Edit ${escapeHtml(v.name)}">Edit</button><button class="delete" data-delete-id="${escapeHtml(v.id)}" aria-label="Delete ${escapeHtml(v.name)}">×</button></div></div></article>`; }).join("")}</div>` : `<div class="empty"><div class="empty-icon">🚙</div><h2>Start with your first car</h2><p>Add a car to connect fuel records, expenses, maintenance reminders, and lifetime statistics.</p><button class="primary" data-action="add-car">Add car</button></div>`}`;
  if (activeTab === "settings") return `<div class="panel"><h2>Privacy & data</h2><p class="muted">No account, analytics, or server-side records. Export or restore a portable file whenever you want.</p><button class="secondary" data-action="backup">Create JSON backup</button><button class="secondary" data-action="import" data-format="json">Restore JSON backup</button><button class="secondary" data-action="export">Export vehicles as CSV</button><button class="secondary" data-action="import" data-format="csv">Import vehicles from CSV</button><button class="secondary" data-action="export-fill-ups">Export fill-ups as CSV</button><button class="secondary" data-action="import-records" data-record-type="fill-ups">Import fill-ups from CSV</button><button class="secondary" data-action="export-expenses">Export expenses as CSV</button><button class="secondary" data-action="import-records" data-record-type="expenses">Import expenses from CSV</button></div>`;
  return `<div class="empty"><div class="empty-icon">${tabIcon(activeTab)}</div><h2>${tabLabel(activeTab)} is ready</h2><p>Add a car first, then this area will show your local records and insights.</p><button class="primary" data-tab="cars">Go to Cars</button></div>`;
}

function renderRecords(kind: "fill-ups" | "expenses"): string {
  const allRecords = kind === "fill-ups" ? fillUps : expenses;
  const records = filters[kind] ? allRecords.filter((item) => item.vehicleId === filters[kind]) : allRecords;
  const title = kind === "fill-ups" ? "Fill-ups" : "Expenses";
  const addAction = kind === "fill-ups" ? "add-fill-up" : "add-expense";
  if (!vehicles.length) return `<div class="empty"><div class="empty-icon">${kind === "fill-ups" ? "⛽" : "⚠"}</div><h2>Connect a car first</h2><p>Add your vehicle once, then every ${kind === "fill-ups" ? "fuel entry and economy metric" : "cost and maintenance expense"} stays linked to it.</p><button class="primary" data-action="add-car">Add car</button><button class="secondary" data-tab="cars">View cars</button></div>`;
  return `<div class="section-heading"><div><p class="eyebrow">${kind === "fill-ups" ? "FUEL LOG" : "COST LOG"}</p><p class="muted">${records.length} ${title.toLowerCase()} saved locally.</p></div><button class="primary" data-action="${addAction}">＋ Add ${kind === "fill-ups" ? "fill-up" : "expense"}</button></div><label class="filter-label">Filter by car<select data-filter="${kind}"><option value="">All cars</option>${vehicleOptions(filters[kind])}</select></label>${records.length ? `<div class="cards">${records.map((item) => { const vehicle = vehicles.find((v) => v.id === item.vehicleId); const vehicleName = vehicle ? vehicle.name : "Unknown car"; const fillUp = item as FillUp; const expense = item as Expense; const deleteAttribute = kind === "fill-ups" ? `data-delete-fill-up="${escapeHtml(item.id)}"` : `data-delete-expense="${escapeHtml(item.id)}"`; const editAttribute = kind === "fill-ups" ? `data-edit-fill-up="${escapeHtml(item.id)}"` : `data-edit-expense="${escapeHtml(item.id)}"`; return `<article class="card record"><div><h2>${kind === "fill-ups" ? `${fillUp.liters.toFixed(1)} L · ${formatMoney(fillUp.totalAmount)}` : `${escapeHtml(expense.category)} · ${formatMoney(expense.amount)}`}</h2><p>${formatDate(item.date)} · ${escapeHtml(vehicleName)}${kind === "fill-ups" ? ` · ${fillUp.odometerKm.toLocaleString()} km` : ""}</p></div><div class="card-actions"><button class="edit" ${editAttribute}>Edit</button><button class="delete" ${deleteAttribute} aria-label="Delete record">×</button></div></article>`; }).join("")}</div>` : `<div class="empty compact"><h2>No ${title.toLowerCase()} yet</h2><p>Use the button above to add your first record, then Stats will connect the results.</p><button class="secondary" data-tab="stats">See insights</button></div>`}`;
}

function renderStats(): string {
  const consumption = averageConsumption(fillUps);
  const lifetime = lifetimeMetrics(fillUps);
  const dueMaintenance = vehicles.filter((vehicle) => {
    const status = maintenanceStatus(vehicle);
    return status.remainingKm !== null && status.remainingKm <= 0;
  }).length;
  return `<div class="hero stats-hero"><div><p class="eyebrow">LOCAL INSIGHTS</p><h2>Know what your records are saying</h2><p class="muted">Metrics are calculated only from the data you keep on this device.</p></div><div class="card-actions"><button class="secondary compact-button" data-tab="fill-ups">View fuel</button><button class="secondary compact-button" data-tab="expenses">View costs</button></div></div><div class="stats-grid">${statCard("⛽", String(fillUps.length), "Fill-ups logged")}${statCard("▣", String(expenses.length), "Expenses logged")}${statCard("Σ", formatMoney(totalCost(fillUps, expenses)), "Total costs")}${statCard("◒", consumption ? `${consumption.toFixed(1)} L/100 km` : "—", "Avg consumption")}${statCard("↗", lifetime.distanceKm ? `${lifetime.distanceKm.toLocaleString()} km` : "—", "Lifetime distance")}${statCard("⌁", lifetime.kmPerLiter ? `${lifetime.kmPerLiter.toFixed(1)} km/L` : "—", "Lifetime economy")}${statCard("🔧", String(dueMaintenance), "Services due")}</div><div class="panel insight"><h2>Next best action</h2><p class="muted">${!vehicles.length ? "Add your first car to begin connecting fuel, expenses, and maintenance." : !fillUps.length ? "Log your first fill-up to start measuring distance and fuel economy." : fillUps.length < 2 ? "Add another fill-up with a new odometer reading to unlock lifetime economy." : dueMaintenance ? "A vehicle has reached its maintenance threshold. Review the Cars tab for the next service kilometre." : "Keep recording fill-ups and costs to make your lifetime metrics more useful."}</p><button class="secondary compact-button" data-tab="${!vehicles.length ? "cars" : !fillUps.length || fillUps.length < 2 ? "fill-ups" : dueMaintenance ? "cars" : "expenses"}">${!vehicles.length ? "Add a car" : !fillUps.length || fillUps.length < 2 ? "Add fuel record" : dueMaintenance ? "Review maintenance" : "Add an expense"}</button></div>`;
}

function statCard(icon: string, value: string, label: string): string { return `<article class="stat-card"><span class="stat-icon">${icon}</span><strong>${value}</strong><span>${label}</span></article>`; }
function renderFilteredRecords(kind: "fill-ups" | "expenses", value: string): void { filters[kind] = value; render(); }

function showVehicleForm(vehicleId?: string): void {
  const existing = vehicles.find((vehicle) => vehicle.id === vehicleId);
  app.querySelector(".modal")?.remove();
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `<form class="form panel"><div class="form-header"><div><p class="eyebrow">${existing ? "EDIT CAR" : "NEW CAR"}</p><h2>${existing ? "Edit car" : "Add a car"}</h2></div><button type="button" class="close" aria-label="Close">×</button></div><label>Name<input name="name" required value="${escapeHtml(existing?.name ?? "")}" placeholder="e.g. Daily driver"></label><label>Type<input name="type" required value="${escapeHtml(existing?.type ?? "")}" placeholder="e.g. Toyota Corolla"></label><label>Year<input name="year" required type="number" min="1886" max="${new Date().getFullYear() + 1}" value="${existing?.year ?? new Date().getFullYear()}"></label><label>Drive type<select name="powertrain">${Object.entries(powertrainLabels).map(([value, label]) => `<option value="${value}" ${existing?.powertrain === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>Current odometer (km)<input name="currentOdometerKm" type="number" min="0" step="1" value="${existing ? currentOdometerKm(existing, fillUps) : 0}"></label><fieldset><legend>Latest oil service (optional)</legend><label>Service odometer (km)<input name="latestMaintenanceOdometerKm" type="number" min="0" step="1" value="${existing?.latestMaintenanceOdometerKm ?? ""}"></label><label>Service date<input name="latestMaintenanceDate" type="date" value="${existing?.latestMaintenanceDate ?? ""}"></label><label>Oil type<select name="oilType"><option value="">Not specified</option>${Object.entries(oilTypeLabels).map(([value, label]) => `<option value="${value}" ${existing?.oilType === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><p class="muted">Next service is suggested after 5,000 km from this service.</p></fieldset><label>Notes<textarea name="notes" rows="3" placeholder="Optional notes">${escapeHtml(existing?.notes ?? "")}</textarea></label><label class="toggle"><input name="tcoEnabled" type="checkbox" ${existing?.tcoEnabled ? "checked" : ""}> Include in TCO calculations</label><p class="error" data-error></p><button class="primary" type="submit">Save car</button></form>`;
  document.body.append(modal);
  modal.querySelector<HTMLButtonElement>(".close")?.addEventListener("click", () => modal.remove());
  modal.querySelector("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const maintenanceKm = String(form.get("latestMaintenanceOdometerKm") ?? "");
    const oilValue = String(form.get("oilType") ?? "");
    const input: VehicleInput = { name: String(form.get("name") ?? ""), type: String(form.get("type") ?? ""), year: Number(form.get("year")), notes: String(form.get("notes") ?? ""), powertrain: String(form.get("powertrain")) as Powertrain, tcoEnabled: form.get("tcoEnabled") === "on", currentOdometerKm: Number(form.get("currentOdometerKm") ?? 0), latestMaintenanceOdometerKm: maintenanceKm ? Number(maintenanceKm) : null, latestMaintenanceDate: String(form.get("latestMaintenanceDate") ?? "") || null, oilType: oilValue && isOilType(oilValue) ? oilValue : null };
    try { const saved = createVehicle(input, existing?.id); vehicles = existing ? vehicles.map((item) => item.id === existing.id ? { ...saved, createdAt: existing.createdAt } : item) : [saved, ...vehicles]; vehicles = syncVehicleOdometers(vehicles, fillUps); saveVehicles(vehicles); modal.remove(); render(); } catch (error) { modal.querySelector<HTMLElement>("[data-error]")!.textContent = error instanceof Error ? error.message : "Unable to save car."; }
  });
}

function deleteVehicle(id: string): void {
  const vehicle = vehicles.find((item) => item.id === id);
  if (!vehicle || !window.confirm(`Delete "${vehicle.name}"? This only removes the local record.`)) return;
  vehicles = vehicles.filter((item) => item.id !== id);
  fillUps = fillUps.filter((item) => item.vehicleId !== id);
  expenses = expenses.filter((item) => item.vehicleId !== id);
  saveVehicles(vehicles);
  saveFillUps(fillUps);
  saveExpenses(expenses);
  render();
}

function deleteRecord(kind: "fill-ups" | "expenses", id: string): void {
  const label = kind === "fill-ups" ? "fill-up" : "expense";
  if (!window.confirm(`Delete this ${label}? This only removes the local record.`)) return;
  if (kind === "fill-ups") { fillUps = fillUps.filter((item) => item.id !== id); saveFillUps(fillUps); }
  else { expenses = expenses.filter((item) => item.id !== id); saveExpenses(expenses); }
  render();
}

function vehicleOptions(selectedId?: string): string {
  return vehicles.map((vehicle) => `<option value="${escapeHtml(vehicle.id)}" ${selectedId === vehicle.id ? "selected" : ""}>${escapeHtml(vehicle.name)}</option>`).join("");
}

function showFillUpForm(id?: string, vehicleId?: string): void {
  const existing = fillUps.find((item) => item.id === id);
  showRecordForm("fill-ups", `<label>Car<select name="vehicleId">${vehicleOptions(existing?.vehicleId ?? vehicleId)}</select></label><label>Date<input name="date" type="date" required value="${existing?.date ?? new Date().toISOString().slice(0, 10)}"></label><label>Odometer (km)<input name="odometerKm" type="number" min="0" step="1" required value="${existing?.odometerKm ?? ""}"></label><label>Liters<input name="liters" type="number" min="0.01" step="0.01" required value="${existing?.liters ?? ""}"></label><label>Total paid<input name="totalAmount" type="number" min="0" step="0.01" required value="${existing?.totalAmount ?? ""}"></label><label class="toggle"><input name="fullTank" type="checkbox" ${existing?.fullTank !== false ? "checked" : ""}> Full tank</label><label>Notes<textarea name="notes" rows="2">${escapeHtml(existing?.notes ?? "")}</textarea></label>`, id);
}

function showExpenseForm(id?: string, vehicleId?: string): void {
  const existing = expenses.find((item) => item.id === id);
  showRecordForm("expenses", `<label>Car<select name="vehicleId">${vehicleOptions(existing?.vehicleId ?? vehicleId)}</select></label><label>Date<input name="date" type="date" required value="${existing?.date ?? new Date().toISOString().slice(0, 10)}"></label><label>Category<select name="category">${["Maintenance", "Repair", "Insurance", "Registration", "Parking", "Other"].map((item) => `<option ${existing?.category === item ? "selected" : ""}>${item}</option>`).join("")}</select></label><label>Amount<input name="amount" type="number" min="0" step="0.01" required value="${existing?.amount ?? ""}"></label><label>Notes<textarea name="notes" rows="2">${escapeHtml(existing?.notes ?? "")}</textarea></label>`, id);
}

function showRecordForm(kind: "fill-ups" | "expenses", fields: string, recordId?: string): void {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `<form class="form panel"><div class="form-header"><div><p class="eyebrow">${kind === "fill-ups" ? "NEW FILL-UP" : "NEW EXPENSE"}</p><h2>Add ${kind === "fill-ups" ? "fill-up" : "expense"}</h2></div><button type="button" class="close" aria-label="Close">×</button></div>${fields}<p class="error" data-error></p><button class="primary" type="submit">Save ${kind === "fill-ups" ? "fill-up" : "expense"}</button></form>`;
  document.body.append(modal);
  modal.querySelector<HTMLButtonElement>(".close")?.addEventListener("click", () => modal.remove());
  modal.querySelector("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    try {
      if (kind === "fill-ups") {
        const item = createFillUp({ vehicleId: String(form.get("vehicleId")), date: String(form.get("date")), odometerKm: Number(form.get("odometerKm")), liters: Number(form.get("liters")), totalAmount: Number(form.get("totalAmount")), fullTank: form.get("fullTank") === "on", notes: String(form.get("notes") ?? "") }, recordId);
        fillUps = recordId ? fillUps.map((record) => record.id === recordId ? item : record) : [item, ...fillUps]; vehicles = syncVehicleOdometers(vehicles, fillUps); saveFillUps(fillUps); saveVehicles(vehicles);
      } else {
        const item = createExpense({ vehicleId: String(form.get("vehicleId")), date: String(form.get("date")), category: String(form.get("category")), amount: Number(form.get("amount")), notes: String(form.get("notes") ?? "") }, recordId);
        expenses = recordId ? expenses.map((record) => record.id === recordId ? item : record) : [item, ...expenses]; saveExpenses(expenses);
      }
      modal.remove(); render();
    } catch (error) { modal.querySelector<HTMLElement>("[data-error]")!.textContent = error instanceof Error ? error.message : "Unable to save record."; }
  });
}

function chooseImport(format: "json" | "csv"): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = format === "json" ? ".json,application/json" : ".csv,text/csv";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (format === "csv") {
        const importedVehicles = vehiclesFromCsv(text);
        vehicles = [...importedVehicles, ...vehicles.filter((existing) => !importedVehicles.some((item) => item.id === existing.id))];
      } else {
        const imported = parseBackup(text);
        vehicles = syncVehicleOdometers([...imported.vehicles, ...vehicles.filter((existing) => !imported.vehicles.some((item) => item.id === existing.id))], fillUps);
        fillUps = [...imported.fillUps, ...fillUps.filter((existing) => !imported.fillUps.some((item) => item.id === existing.id))];
        expenses = [...imported.expenses, ...expenses.filter((existing) => !imported.expenses.some((item) => item.id === existing.id))];
        vehicles = syncVehicleOdometers(vehicles, fillUps);
      }
      saveVehicles(vehicles); saveFillUps(fillUps); saveExpenses(expenses);
      render();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The selected file could not be imported.");
    }

  };
  input.click();
}

function chooseRecordImport(kind: "fill-ups" | "expenses"): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const importedFillUps = kind === "fill-ups" ? fillUpsFromCsv(await file.text()) : [];
      const importedExpenses = kind === "expenses" ? expensesFromCsv(await file.text()) : [];
      const imported = kind === "fill-ups" ? importedFillUps : importedExpenses;
      if (imported.some((item) => !vehicles.some((vehicle) => vehicle.id === item.vehicleId))) throw new Error("CSV contains records for vehicles that are not in this device's local data.");
      if (kind === "fill-ups") { fillUps = [...importedFillUps, ...fillUps.filter((item) => !importedFillUps.some((incoming) => incoming.id === item.id))]; vehicles = syncVehicleOdometers(vehicles, fillUps); saveFillUps(fillUps); saveVehicles(vehicles); }
      else { expenses = [...importedExpenses, ...expenses.filter((item) => !importedExpenses.some((incoming) => incoming.id === item.id))]; saveExpenses(expenses); }
      render();
    } catch (error) { window.alert(error instanceof Error ? error.message : "The selected CSV could not be imported."); }
  };
  input.click();
}

function parseBackup(text: string) {
  const backup: unknown = JSON.parse(text);
  if (!backup || typeof backup !== "object" || !("format" in backup) || backup.format !== "my-fuel-backup" || !("schemaVersion" in backup) || backup.schemaVersion !== 1 || !("data" in backup) || !backup.data || typeof backup.data !== "object" || !("vehicles" in backup.data) || !Array.isArray(backup.data.vehicles)) throw new Error("This is not a supported My Fuel backup.");
  const importedVehicles = backup.data.vehicles.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Backup contains an invalid vehicle.");
    const value = item as Record<string, unknown>;
    if (typeof value.id !== "string" || typeof value.createdAt !== "string" || !isPowertrain(value.powertrain) || typeof value.tcoEnabled !== "boolean") throw new Error("Backup contains an invalid vehicle record.");
    const oilType = isOilType(value.oilType) ? value.oilType : null;
    const vehicle = createVehicle({ name: String(value.name ?? ""), type: String(value.type ?? ""), year: Number(value.year), notes: String(value.notes ?? ""), powertrain: value.powertrain, tcoEnabled: value.tcoEnabled, currentOdometerKm: Number(value.currentOdometerKm ?? 0), latestMaintenanceOdometerKm: value.latestMaintenanceOdometerKm === null || value.latestMaintenanceOdometerKm === undefined ? null : Number(value.latestMaintenanceOdometerKm), latestMaintenanceDate: typeof value.latestMaintenanceDate === "string" ? value.latestMaintenanceDate : null, oilType }, value.id);
    return { ...vehicle, createdAt: value.createdAt };
  });
  const importedFillUps = "fillUps" in backup.data && Array.isArray(backup.data.fillUps) ? backup.data.fillUps.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Backup contains an invalid fill-up.");
    const value = item as Record<string, unknown>;
    return createFillUp({ vehicleId: String(value.vehicleId), date: String(value.date), odometerKm: Number(value.odometerKm), liters: Number(value.liters), totalAmount: Number(value.totalAmount), fullTank: value.fullTank === true, notes: String(value.notes ?? "") }, String(value.id));
  }) : [];
  const importedExpenses = "expenses" in backup.data && Array.isArray(backup.data.expenses) ? backup.data.expenses.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Backup contains an invalid expense.");
    const value = item as Record<string, unknown>;
    return createExpense({ vehicleId: String(value.vehicleId), date: String(value.date), category: String(value.category), amount: Number(value.amount), notes: String(value.notes ?? "") }, String(value.id));
  }) : [];
  return { vehicles: importedVehicles, fillUps: importedFillUps, expenses: importedExpenses };
}

function formatMoney(value: number): string { return `₱${value.toFixed(2)}`; }
function formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`)); }
function tabLabel(tab: Tab): string { return tab.replace("-", " ").replace(/^\w/, (c) => c.toUpperCase()); }
function tabIcon(tab: Tab): string { return ({ "fill-ups": "⛽", expenses: "▣", stats: "◒", cars: "🚙", settings: "⚙" })[tab]; }
function escapeHtml(value: string): string {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return value.replace(/[&<>"']/g, (char) => entities[char]);
}

render();
