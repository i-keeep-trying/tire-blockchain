// scripts/uploadBatchSupabase.ts
import "dotenv/config"; // loads .env automatically
import { ethers, Log } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
import { createClient } from "@supabase/supabase-js";

const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

/** Recursively convert BigInt -> string so JSON/DB can accept it */
function normalizeForJson<T = any>(value: T): T {
  if (typeof value === "bigint") return (value.toString() as unknown) as T;
  if (Array.isArray(value)) return value.map((v) => normalizeForJson(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      out[k] = normalizeForJson(v);
    }
    return out as T;
  }
  return value;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} (put it in .env or export it)`);
  return v;
}

function makeProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
}

function makeContract(provider: ethers.Provider): ethers.Contract {
  return new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, provider);
}

function makeSupabase() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_KEY"); // service role key
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getBatchTires(contract: ethers.Contract, batchId: string): Promise<string[]> {
  const arr: string[] = await contract.getBatchTires(batchId);
  return arr ?? [];
}

async function getPassport(contract: ethers.Contract, tireId: string) {
  const [tid, bid, owner, state, historyLen] = await contract.getPassport(tireId);
  return {
    tire_id: String(tid),
    batch_id: String(bid),
    owner: String(owner),
    state: Number(state),
    history_len: Number(historyLen),
  };
}

async function fetchTyreEvents(
  provider: ethers.Provider,
  tireId: string
): Promise<
  Array<{
    seq: number;
    event_type: string;
    actor: string;
    offchain_hash?: string | null;
    offchain_uri?: string | null;
    block_time?: string | null;
    tx_hash?: string | null;
    raw: any;
  }>
> {
  const iface = new ethers.Interface(artifact.abi);

  const ev = iface.getEvent("TyreEvent");
  if (!ev) throw new Error(`ABI does not contain event "TyreEvent"`);
  const topic = ev.topicHash;

  const filter = {
    address: CONTRACT_ADDRESS,
    topics: [topic],
    fromBlock: 0n,
    toBlock: "latest" as const,
  };

  const logs: Log[] = await provider.getLogs(filter);

  const out: Array<{
    seq: number;
    event_type: string;
    actor: string;
    offchain_hash?: string | null;
    offchain_uri?: string | null;
    block_time?: string | null;
    tx_hash?: string | null;
    raw: any;
  }> = [];

  let seq = 0;
  for (const log of logs) {
    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
    const args = parsed?.args as any;
    if (!args) continue;

    const parsedTireId = String(args[0]);
    if (parsedTireId !== tireId) continue;

    const eventType = String(args[2]);
    const offHash = args[3] ? String(args[3]) : null;
    const offURI = args[4] ? String(args[4]) : null;
    const actor = String(args[5]);

    let blockTime: string | null = null;
    try {
      const blk = await provider.getBlock(log.blockNumber);
      if (blk && blk.timestamp != null) {
        blockTime = new Date(Number(blk.timestamp) * 1000).toISOString();
      }
    } catch {
      // ignore
    }

    // normalize raw payloads (parsed + log) to avoid BigInt errors
    const raw = normalizeForJson({ parsed, log });

    out.push({
      seq: seq++,
      event_type: eventType,
      actor,
      offchain_hash: offHash,
      offchain_uri: offURI,
      block_time: blockTime,
      tx_hash: log.transactionHash,
      raw,
    });
  }

  return out;
}

async function upsertPassport(
  snapshot: {
    tire_id: string;
    batch_id: string;
    owner: string;
    state: number;
    history_len: number;
  },
  events: any[]
) {
  const sb = makeSupabase();

  // store a normalized raw blob (snapshot + events)
  const rawBlob = normalizeForJson({ snapshot, events });

  const { error: pErr } = await sb.from("passports").upsert({
    tire_id: snapshot.tire_id,
    batch_id: snapshot.batch_id,
    owner: snapshot.owner,
    state: snapshot.state,
    history_len: snapshot.history_len,
    raw: rawBlob,
  });
  if (pErr) throw new Error(`passports upsert failed: ${pErr.message}`);

  // replace events for this tyre
  const { error: delErr } = await sb.from("passport_events").delete().eq("tire_id", snapshot.tire_id);
  if (delErr) throw new Error(`delete old events failed: ${delErr.message}`);

  if (events.length > 0) {
    const rows = events.map((e) =>
      normalizeForJson({
        tire_id: snapshot.tire_id,
        seq: e.seq,
        event_type: e.event_type,
        actor: e.actor,
        offchain_hash: e.offchain_hash ?? null,
        offchain_uri: e.offchain_uri ?? null,
        block_time: e.block_time ?? null,
        tx_hash: e.tx_hash ?? null,
        raw: e.raw ?? {},
      })
    );
    const { error: insErr } = await sb.from("passport_events").insert(rows);
    if (insErr) throw new Error(`insert events failed: ${insErr.message}`);
  }
}

async function mirrorOne(provider: ethers.Provider, contract: ethers.Contract, tireId: string) {
  const snapshot = await getPassport(contract, tireId);
  const events = await fetchTyreEvents(provider, tireId);
  await upsertPassport(snapshot, events);
  console.log(`✔ Mirrored ${tireId} (events=${events.length})`);
}

async function main() {
  const BATCH_ID = requireEnv("BATCH_ID");
  const provider = makeProvider();
  const contract = makeContract(provider);

  const tires = await getBatchTires(contract, BATCH_ID);
  if (!tires.length) {
    console.log(`Batch ${BATCH_ID} has no tyres.`);
    return;
  }

  console.log(`Mirroring batch ${BATCH_ID} with ${tires.length} tyres…`);
  for (const tid of tires) {
    try {
      await mirrorOne(provider, contract, tid);
    } catch (e: any) {
      console.error(`✖ Failed ${tid}:`, e?.message ?? e);
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
