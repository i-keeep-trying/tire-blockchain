// scripts/exportPassport.ts
import fs from "fs";
import path from "path";
import { ethers, Log, EventLog, Interface } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };

const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;
const START_BLOCK: number | undefined = (addrs as any).deployedBlock; // optional if your deploy.ts wrote it

function ensureMirrorDir() {
  const outDir = path.join(process.cwd(), "mirror");
  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}

function short(hash: string) {
  return hash && hash.length > 10 ? `${hash.slice(0, 10)}…` : hash;
}

async function exportOne(tireId: string) {
  if (!CONTRACT_ADDRESS) {
    throw new Error("Missing contract address in deployments/local.json");
  }

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const iface = new Interface(artifact.abi);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, provider);

  // 1) Snapshot (owner, state, history length, batch)
  const [tid, bid, owner, state, histLen] = await contract.getPassport(tireId);
  const snapshot = {
    tireId: tid,
    batchId: bid,
    owner,
    state: Number(state),
    historyLength: Number(histLen),
  };

  // 2) Fetch & decode TyreEvent logs (we can’t topic-filter by tireId since it’s not indexed)
  const fromBlock = typeof START_BLOCK === "number" ? START_BLOCK : 0;
  const toBlock = "latest" as const;

  const topic = iface.getEvent("TyreEvent")?.topicHash;
  if (!topic) throw new Error("Unable to compute TyreEvent topic hash");

  const rawLogs = await provider.getLogs({
    address: CONTRACT_ADDRESS,
    topics: [topic], // all TyreEvent logs
    fromBlock,
    toBlock,
  });

  const events = [];
  for (const raw of rawLogs) {
    let parsed: ReturnType<Interface["parseLog"]> | null = null;
    try {
      parsed = iface.parseLog(raw as Log);
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.name !== "TyreEvent") continue;

    const args = parsed.args as any;
    if (!args) continue;

    // Filter only this tyre
    if (String(args.tireId) !== tireId) continue;

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

  // 3) Write JSON
  const outDir = ensureMirrorDir();
  const outPath = path.join(outDir, `passport_${tireId}.json`);
  const payload = {
    contract: CONTRACT_ADDRESS,
    exportedAt: new Date().toISOString(),
    snapshot,
    events,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote JSON: ${outPath}  (events=${events.length})`);
}

async function main() {
  const tireId = process.env.TIRE_ID;
  if (!tireId) {
    throw new Error("Set TIRE_ID env, e.g.  TIRE_ID=TIREC01 npx hardhat run --network localhost scripts/exportPassport.ts");
  }
  await exportOne(tireId);
}

main().catch((e) => { console.error(e); process.exit(1); });
