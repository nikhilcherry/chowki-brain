import fs from "fs";
import { openLedger } from "../../chowki-ledger/src/index.js";

const DB_PATH = process.env.CHOWKI_DB_PATH ?? "../chowki-ledger/chowki-demo.db";
const ledger = openLedger(DB_PATH);

console.log("\n🎒 SEEDING CHOWKI DEMO CHAOS SCENARIOS...");

// 1. Seed Overdue Hiker Nikhil
// ExpectedBy is set to 1 hour in the past to make him overdue
const overdueTime = Date.now() - 3600000; 
const checkinTime = Date.now() - 18000000;

const hiker = {
  hikerId: "H-9999",
  name: "Nikhil (Teammate)",
  plan: "Summitting Parvati Ridge, expected at booth-4 by 14:00.",
  expectedNextBooth: "booth-4",
  expectedBy: overdueTime,
  ts: checkinTime,
  boothId: "booth-3"
};

ledger.checkinHiker(hiker);
console.log(`👤 Checked in overdue hiker: ${hiker.name}`);

// 2. Seed Conflicting Incident Reports
// Report A: Heavy blizzard/ice (reported at booth-3)
const hazardA = {
  id: "hz-01",
  kind: "weather" as const,
  urgency: "urgent" as const,
  persons: null,
  locationHint: "Parvati Ridge Trail km 5",
  rawReport: "Extremely heavy blizzard and freezing storm reported. Visual range less than 2 meters, path completely blocked by solid ice.",
  reportedAtBooth: "booth-3",
  ts: Date.now() - 7200000
};
ledger.recordIncident(hazardA);
console.log(`⚠️  Recorded weather hazard A (Blizzard): ${hazardA.id}`);

// Report B: Clear and sunny (reported at booth-4)
const hazardB = {
  id: "hz-02",
  kind: "weather" as const,
  urgency: "info" as const,
  persons: null,
  locationHint: "Parvati Ridge Trail km 5",
  rawReport: "Trekker passed by and said the mountain storm has cleared completely. The sky is sunny, dry, and wind is very calm.",
  reportedAtBooth: "booth-4",
  ts: Date.now() - 3600000
};
ledger.recordIncident(hazardB);
console.log(`⚠️  Recorded weather hazard B (Sunny): ${hazardB.id}`);

// 3. Write 'dropped' state to transit-state.json to simulate a broken mule sync for this hiker's bundle
const transitState = {
  "bundle-sos-H-9999": "dropped"
};

fs.writeFileSync("transit-state.json", JSON.stringify(transitState, null, 2), "utf8");
console.log("📡 Simulated a broken mule sync state for bundle-sos-H-9999 in transit-state.json");

ledger.close();
console.log("🚀 Chaos scenario seeding complete! Run 'npx tsx src/agent.ts' to start the agent evaluation loop.\n");
