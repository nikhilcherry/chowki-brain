import fs from "fs";
import { openLedger } from "../../chowki-ledger/src/index.js";
import { judgeOverdue } from "./functions/judgeOverdue.js";
import type { Bundle, HikerCheckin } from "../../chowki-ledger/src/types.js";

// Load configuration
const DB_PATH = process.env.CHOWKI_DB_PATH ?? "../chowki-ledger/chowki-demo.db";
const ledger = openLedger(DB_PATH);

console.log("\n🌲 CHOWKI SOLAR AI AGENT DAEMON INITIALIZED 🌲");
console.log(`Connected to Offline Booth SQLite Ledger: ${DB_PATH}`);

// Map to track simulated sync progress of bundles
// If marked as 'dropped', the next agent cycle triggers self-healing recovery
const transitTracker = new Map<string, { status: "syncing" | "dropped" | "success"; timestamp: number }>();

function loadTransitState() {
  try {
    if (fs.existsSync("transit-state.json")) {
      const raw = fs.readFileSync("transit-state.json", "utf8");
      const data = JSON.parse(raw) as Record<string, "syncing" | "dropped" | "success">;
      for (const [bundleId, status] of Object.entries(data)) {
        transitTracker.set(bundleId, { status, timestamp: Date.now() });
      }
    }
  } catch (err) {
    // Ignore errors in reading transit state
  }
}

export function recordMuleTransmissionState(bundleId: string, status: "syncing" | "dropped" | "success") {
  transitTracker.set(bundleId, { status, timestamp: Date.now() });
}

async function senseDecideActCheck() {
  loadTransitState();
  const now = Date.now();
  console.log(`\n======================================================================`);
  console.log(`🔍 [1. SENSE] Scanning SQLite ledger for overdue candidates...`);
  
  // 1. SENSE: Look for candidates who are overdue
  const candidates = ledger.overdueCandidates(now);
  console.log(`Candidates found: ${candidates.length}`);

  // 2. DECIDE & ACT: Run local Gemma 4 for decisions
  for (const hiker of candidates) {
    console.log(`🤖 [2. DECIDE] Querying local Gemma 4 for overdue Hiker: "${hiker.name}"...`);
    const ledgerContext = ledger.evidenceFor(hiker.hikerId, now);

    try {
      const verdict = await judgeOverdue({ hiker, ledgerContext });
      
      // --- HUMAN DEFERRAL GATEWAY ---
      if (verdict.status === "defer_to_human") {
        console.log(`\n🚨 [HUMAN DEFERRAL GATEWAY TRIGGERED] 🚨`);
        console.log(`⚠️  Safety contradiction or extreme risk detected. Automated routing suspended.`);
        console.log(`REASONING:      ${verdict.reasoning}`);
        console.log(`RECOMMENDED OPERATOR ACTION: ${verdict.recommendAction}`);
        console.log(`[STATUS]: DEFER_TO_HUMAN (Local Alarm Activated)\n`);
        continue;
      }

      console.log(`✨ [DECIDED] Status: ${verdict.status.toUpperCase()}`);
      console.log(`Reasoning: ${verdict.reasoning}`);
      console.log(`Action:    ${verdict.recommendAction}`);

      // ACT: Write decisions to bundles and queues
      const isCritical = verdict.status === "escalate";
      const bundleId = `bundle-sos-${hiker.hikerId}`;
      
      const updatedBundle: Bundle = {
        id: bundleId,
        incident: {
          id: `hz-auto-${hiker.hikerId}`,
          kind: isCritical ? "injury" : "lost",
          urgency: isCritical ? "sos" : "urgent",
          persons: 1,
          locationHint: hiker.expectedNextBooth ?? "unknown vicinity",
          rawReport: `AUTOMATED SYSTEM ALERT: Hiker ${hiker.name} is overdue at ${hiker.expectedNextBooth}. Reasoning: ${verdict.reasoning}`,
          reportedAtBooth: hiker.boothId,
          ts: now
        },
        direction: "downhill",
        ttlHops: 5,
        replicationFactor: isCritical ? 3 : 2,
        passport: [
          {
            boothId: hiker.boothId,
            ts: now,
            decision: "created",
            reasoning: `Local Gemma 4 diagnosed overdue as ${verdict.status}. Action: ${verdict.recommendAction}`
          }
        ]
      };

      // Put the rescue bundle into the outgoing queue
      ledger.upsertBundle(updatedBundle, "pending");
      console.log(`💾 [ACT] Queued emergency outbound bundle: ${bundleId} (Replication factor: ${updatedBundle.replicationFactor})`);

    } catch (err) {
      console.error(`Error analyzing hiker ${hiker.name}:`, err);
    }
  }

  // 3. CHECK & RECOVERY (Local Error Recovery Loop)
  console.log("\n🔄 [3. CHECK & RECOVER] Monitoring active data-mule transmissions...");
  const pendingBundles = ledger.pendingBundles();

  for (const b of pendingBundles) {
    const transitInfo = transitTracker.get(b.id);
    
    // Check if a transfer was dropped mid-way (Mule walked out of range)
    if (transitInfo && transitInfo.status === "dropped") {
      console.log(`\n🚨 [LOCAL ERROR RECOVERY ENFORCED] 🚨`);
      console.log(`Bundle ${b.id} got stuck mid-sync (mule connection broken)!`);
      console.log(`Action: Escalating priority to CRITICAL & increasing replication density to 3.`);

      const updatedBundle: Bundle = {
        ...b,
        replicationFactor: 3,
        incident: {
          ...b.incident,
          urgency: "sos"
        },
        passport: [
          ...b.passport,
          {
            boothId: b.passport[0]?.boothId ?? "unknown",
            ts: now,
            decision: "replicated",
            reasoning: "Local recovery triggered: Previous transfer interrupted. Upgrading priority and replication factor."
          }
        ]
      };

      // Resubmit back to ledger queue with upgraded priority and replication factor
      ledger.upsertBundle(updatedBundle, "pending");
      console.log(`🔄 Self-healed: Upgraded ${b.id} to replicationFactor: 3, priority: SOS.`);
      
      // Reset the tracking status so it doesn't loop forever
      transitTracker.set(b.id, { status: "syncing", timestamp: now });
      try {
        if (fs.existsSync("transit-state.json")) {
          fs.unlinkSync("transit-state.json");
        }
      } catch (err) {}
    }
  }
  console.log("======================================================================\n");
}

// Tick the agent cycle every 10 seconds
setInterval(senseDecideActCheck, 10000);
