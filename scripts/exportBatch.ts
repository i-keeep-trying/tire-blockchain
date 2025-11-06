// scripts/exportBatch.ts
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };

// reuse the single exporter to avoid duplication
import "./exportPassport.ts";

const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

function ensureMirrorDir() {
  const outDir = path.join(process.cwd(), "mirror");
  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}

async function main() {
  const batchId = process.env.BATCH_ID;
  if (!batchId) {
    throw new Error("Set BATCH_ID env, e.g.  BATCH_ID=BATCH-2025-11-06-A npx hardhat run --network localhost scripts/exportBatch.ts");
  }

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, provider);

  const tyres: string[] = await contract.getBatchTires(batchId);
  console.log(`Exporting batch ${batchId} with ${tyres.length} tyres…`);

  const summary: Array<{ tireId: string; owner: string; state: number; historyLength: number }> = [];

  for (const tireId of tyres) {
    // Snapshot for summary
    const [tid, bid, owner, state, len] = await contract.getPassport(tireId);
    summary.push({
      tireId: tid,
      owner,
      state: Number(state),
      historyLength: Number(len),
    });

    // Call the single exporter by spawning a new node process OR inline import
    // Inline import (works because scripts/exportPassport.ts has a default runner that uses env vars):
    const { spawnSync } = await import("node:child_process");
    const env = { ...process.env, TIRE_ID: tireId };
    const res = spawnSync(process.execPath, [
      // run via ts-node/register that Hardhat provides – simplest is to call Hardhat again
      // but to keep it simple and consistent with your flow, just shell out to hardhat:
      // (Windows-friendly) - we will just call `npx hardhat run` again for each tyre
    ]);
    // Simpler: just require the module functionally:
    // -> we’ll re-implement a tiny inline exporter here to avoid nested runs.

    // Minimal inline exporter: fetch TyreEvent logs & write JSON
    const iface = new ethers.Interface(artifact.abi);
    const topic = iface.getEvent("TyreEvent")?.topicHash;
    if (!topic) throw new Error("Unable to compute TyreEvent topic hash");

    const logs = await provider.getLogs({ address: CONTRACT_ADDRESS, topics: [topic], fromBlock: 0, toBlock: "latest" });
    const events = [];
    for (const raw of logs) {
      let parsed: ReturnType<typeof iface.parseLog> | null = null;
      try { parsed = iface.parseLog(raw as any); } catch { parsed = null; }
      if (!parsed || parsed.name !== "TyreEvent") continue;
      const args = parsed.args as any;
      if (!args || String(args.tireId) !== tireId) continue;
      const block = await provider.getBlock(raw.blockNumber);
      events.push({
        blockNumber: raw.blockNumber,
        txHash: raw.transactionHash,
        timestamp: block?.timestamp ? new Date(block.timestamp * 1000).toISOString() : null,
        tireId: String(args.tireId),
        batchId: String(args.batchId),
        eventType: String(args.eventType),
        offchainHash: String(args.offchainHash),
        offchainURI: String(args.offchainURI),
        actor: String(args.actor),
        ownerAfter: String(args.currentOwner),
        stateAfter: Number(args.state),
      });
    }

    const outDir = ensureMirrorDir();
    const outPath = path.join(outDir, `passport_${tireId}.json`);
    const payload = {
      contract: CONTRACT_ADDRESS,
      exportedAt: new Date().toISOString(),
      snapshot: { tireId: tid, batchId, owner, state: Number(state), historyLength: Number(len) },
      events,
    };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(`  wrote ${path.basename(outPath)} (events=${events.length})`);
  }

  // Batch index
  const batchIndex = {
    contract: CONTRACT_ADDRESS,
    batchId,
    exportedAt: new Date().toISOString(),
    tyres: summary, // [{tireId, owner, state, historyLength}]
  };
  const outDir = ensureMirrorDir();
  const outIndex = path.join(outDir, `batch_${batchId}.json`);
  fs.writeFileSync(outIndex, JSON.stringify(batchIndex, null, 2));
  console.log(`Wrote JSON: ${outIndex}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
