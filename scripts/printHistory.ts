// scripts/printHistory.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };

const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;
// Pass a tyre id with:  npx hardhat run scripts/printHistory.ts --network localhost -- TIREB03
const TIRE_ID = tireParam();

function toIso(ts: bigint) {
  return new Date(Number(ts) * 1000).toISOString().replace(".000Z", "Z");
}

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Any reader account
  const reader = new ethers.Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    provider
  );

  const c = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, reader);
  const iface = new ethers.Interface(artifact.abi);

  // --- Snapshot (will revert if tyre doesn't exist) ---
  try {
    const snap = await c.getPassport(TIRE_ID); // (tireId, batchId, owner, state, historyLength)
    const snapshot = {
      tid: snap[0] as string,
      bid: snap[1] as string,
      owner: snap[2] as string,
      state: Number(snap[3]),
      historyLength: Number(snap[4]),
    };
    console.log("----- PASSPORT SNAPSHOT -----");
    console.log(snapshot);
    console.log("");
  } catch (e: any) {
    console.error(
      `Tyre "${TIRE_ID}" not found on-chain (fresh node? minted only batch B?). ` +
      `Mint it first or pass a valid ID, e.g.: npx hardhat run scripts/printHistory.ts --network localhost -- TIREB01`
    );
    process.exit(1);
  }

  // --- Fetch & pretty print TyreEvent logs for this tyre ---
  const evt = iface.getEvent("TyreEvent");
  if (!evt) {
    throw new Error('ABI missing TyreEvent');
  }
  const tyreEventTopic = evt.topicHash; // now type-safe

  const filter = {
    address: CONTRACT_ADDRESS,
    topics: [tyreEventTopic, null, null, null], // we'll filter by tireId in-code
    fromBlock: 0n,
    toBlock: "latest" as const,
  };

  const logs = await provider.getLogs(filter);

  type Row = {
    timestamp: string;
    eventType: string;
    actor: string;
    offchainHashPrefix: string;
    offchainURI?: string;
  };

  const rows: Row[] = [];
  for (const log of logs) {
    // Parse and guard
    const parsed = iface.parseLog(log);
    if (!parsed || parsed.name !== "TyreEvent") continue;

    const tireId = parsed.args[0] as string;
    if (tireId !== TIRE_ID) continue;

    const eventType = parsed.args[2] as string;
    const offchainHash = parsed.args[3] as string; // bytes32
    const offchainURI = parsed.args[4] as string;
    const actor = parsed.args[5] as string;
    const ts = parsed.args[6] as bigint;

    rows.push({
      timestamp: toIso(ts),
      eventType,
      actor,
      offchainHashPrefix: (offchainHash || "0x").slice(0, 10) + "…",
      offchainURI: offchainURI && offchainURI.length ? offchainURI : undefined,
    });
  }

  console.log("----- FULL HISTORY (pretty) -----");
  for (const r of rows) {
    const extra = r.offchainURI ? ` | ${r.offchainURI}` : "";
    console.log(
      `${r.timestamp} | ${r.eventType.padEnd(21)} | actor ${r.actor} | hash ${r.offchainHashPrefix}${extra}`
    );
  }

  // Also write a CSV (good for thesis appendix)
  const csvHeader = "timestamp,eventType,actor,offchainHashPrefix,offchainURI\n";
  const csvBody = rows
    .map((r) =>
      [
        r.timestamp,
        r.eventType,
        r.actor,
        r.offchainHashPrefix,
        r.offchainURI ?? "",
      ]
        .map((x) => `"${x.replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const out = path.join(process.cwd(), `history_${TIRE_ID}.csv`);
  fs.writeFileSync(out, csvHeader + csvBody);
  console.log(`\nWrote CSV: ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
