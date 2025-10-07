import { google } from "googleapis";
import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

class MissingColumnsError extends Error {
  constructor(tabName, missingColumns) {
    super(
      `Tab '${tabName}' is missing required columns: ${missingColumns.join(", ")}`
    );
    this.name = "MissingColumnsError";
    this.tabName = tabName;
    this.missingColumns = missingColumns;
  }
}

function getEnvOrThrow(name, { parser = v => v, example } = {}) {
  const raw = process.env[name];
  if (!raw || !String(raw).trim()) {
    const extra = example ? ` (เช่น: ${example})` : "";
    throw new Error(`Missing required environment variable '${name}'${extra}.`);
  }
  try {
    return parser(raw);
  } catch (err) {
    throw new Error(`Invalid value for environment variable '${name}': ${err.message}`);
  }
}

// --- Firestore auth via Service Account (from GitHub Secret) ---
const sa = getEnvOrThrow("FIREBASE_SERVICE_ACCOUNT", {
  parser: value => JSON.parse(value),
  example: '{"project_id":"demo"...}',
});
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// --- Google Sheets client (API key) ---
const googleApiKey = getEnvOrThrow("GOOGLE_API_KEY");
const sheets = google.sheets({ version: "v4", auth: googleApiKey });

// --- Config ---
// Read entire tabs by default. You can override via env if needed.
const SHEET_ID = getEnvOrThrow("SHEET_ID"); // required
const TAB_DRIVERS = process.env.TAB_DRIVERS || "Drivers";
const TAB_ASSIGNMENTS = process.env.TAB_ASSIGNMENTS || "Assignments";
const TAB_PICKUP = process.env.TAB_PICKUP || "Pickup";

function logH(m){ console.log(`\x1b[36m${m}\x1b[0m`); }
function logOK(m){ console.log(`\x1b[32m${m}\x1b[0m`); }
function logW(m){ console.log(`\x1b[33m${m}\x1b[0m`); }
function logE(m){ console.error(`\x1b[31m${m}\x1b[0m`); }

async function readTab(tabName, requiredColumns = []) {
  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: tabName, // full sheet auto-range
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const rows = data.values || [];
    if (rows.length <= 1) return [];
    const headers = rows[0].map(h => String(h || "").trim());
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length) {
      throw new MissingColumnsError(tabName, missingColumns);
    }
    return rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i] ?? "");
      return obj;
    });
  } catch (e) {
    if (e instanceof MissingColumnsError) {
      throw e;
    }
    logW(`Skip '${tabName}': ${e.message}`);
    return [];
  }
}

const toStr = v => (v == null ? "" : String(v).trim());

function mapDriver(r){
  const id = toStr(r["Driver ID"]);
  return id ? {
    __id: id,
    name: toStr(r["Driver Name"]),
    idShift: toStr(r["IDShift"]),
    timeHolidayDate: r["TimeHolidayDate"] ?? null,
  } : null;
}

function mapPickup(r){
  const id = toStr(r["Pickup Point ID"]);
  return id ? {
    __id: id,
    groupName: toStr(r["Group Name"]),
    pickupPointName: toStr(r["Pickup Point Name"]),
    textAddress: toStr(r["Text Address"]),
  } : null;
}

function mapAssignment(r){
  const driverId = toStr(r["Driver ID"]);
  const pickupId = toStr(r["Pickup Point ID"]);
  if(!driverId || !pickupId) return null;
  return {
    __id: `${driverId}__${pickupId}`,
    driverId,
    pickupPointId: pickupId,
  };
}

async function writeCollection(col, list){
  if(list.length === 0){ logW(`No data for '${col}', skip write.`); return; }
  logH(`Writing '${col}' (${list.length} docs)...`);
  const writer = db.bulkWriter({ throttling: true });
  let done = 0;
  for(const item of list){
    const {_id, __id, ...data} = item;
    const id = __id || _id;
    if(!id) continue;
    writer.set(db.collection(col).doc(id), data, { merge: true });
    done++;
    if(done % 200 === 0){
      process.stdout.write(`\r${col}: ${done}/${list.length} (${Math.round(done*100/list.length)}%)   `);
    }
  }
  await writer.close();
  process.stdout.write(`\r${col}: ${list.length}/${list.length} (100%)           \n`);
  logOK(`✔ '${col}' DONE`);
}

async function main(){
  if(!SHEET_ID) throw new Error("Missing SHEET_ID (Google Sheet ID) in env/secrets.");
  logH("=== Google Sheet → Firestore (Multi-Sheet) ===");
  logH(`Sheet: https://docs.google.com/spreadsheets/d/${SHEET_ID}`);

  // Read tabs
  const [driversRaw, assignmentsRaw, pickupRaw] = await Promise.all([
    readTab(TAB_DRIVERS, ["Driver ID", "Driver Name", "IDShift", "TimeHolidayDate"]),
    readTab(TAB_ASSIGNMENTS, ["Driver ID", "Pickup Point ID"]),
    readTab(TAB_PICKUP, ["Group Name", "Pickup Point ID", "Pickup Point Name", "Text Address"]),
  ]);

  logH(`Found: drivers=${driversRaw.length}, assignments=${assignmentsRaw.length}, pickup=${pickupRaw.length}`);

  // Map to Firestore docs
  const drivers = driversRaw.map(mapDriver).filter(Boolean);
  const pickups = pickupRaw.map(mapPickup).filter(Boolean);
  const assignments = assignmentsRaw.map(mapAssignment).filter(Boolean);

  // Write to Firestore (upsert)
  await writeCollection("drivers", drivers);
  await writeCollection("pickups", pickups);
  await writeCollection("assignments", assignments);

  logOK("✅ All collections synced.");
}

main().catch(err => { logE(err.stack || err.message); process.exit(1); });
