// scripts/uploadSupabase.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

type AnyJson = any;

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) die(`Missing env ${name}`);
  return v;
}

// ---- Grab and NARROW the TIRE_ID to a definite string ----
const argTireId = process.env.TIRE_ID ?? process.argv[2];
if (typeof argTireId !== 'string' || argTireId.trim().length === 0) {
  die('Usage: TIRE_ID=<id> npx hardhat run --network localhost scripts/uploadSupabase.ts');
}
const tireId: string = argTireId; // <- fully narrowed

// Build Supabase client
const supabaseUrl = env('SUPABASE_URL');
const supabaseKey = env('SUPABASE_SERVICE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

// Try to read exported mirror file
async function loadMirror(tid: string): Promise<AnyJson> {
  const file = path.resolve('mirror', `passport_${tid}.json`);
  try {
    const txt = await fs.readFile(file, 'utf8');
    const j = JSON.parse(txt);
    return j;
  } catch {
    die(`Mirror file not found or invalid JSON: ${file}`);
  }
}

// Normalize various export shapes into a single shape
function normalize(payload: AnyJson) {
  const snap = payload.snapshot ?? payload.passport ?? payload;
  const events = payload.events ?? payload.history ?? payload.logs ?? [];

  const tire_id  = snap.tireId ?? snap.tid;
  const batch_id = snap.batchId ?? snap.bid;
  const owner    = snap.owner;
  const stateNum = typeof snap.state === 'number' ? snap.state : Number(snap.state);
  const history_len = Array.isArray(events) ? events.length : 0;

  if (!tire_id || !batch_id) die('Mirror JSON missing tireId/batchId fields');

  const rows = (events as AnyJson[]).map((e, i) => {
    const event_type   = e.eventType ?? e.type ?? '';
    const actor        = e.actor ?? e.sender ?? '';
    const offchainHash = e.offchainHash ?? null;
    const offchainURI  = e.offchainURI ?? null;
    const tsSec        = typeof e.timestamp === 'number' ? e.timestamp : Number(e.timestamp);
    const block_time   = isFinite(tsSec) && tsSec > 0 ? new Date(tsSec * 1000).toISOString() : null;
    const tx_hash      = e.txHash ?? e.tx_hash ?? null;

    return {
      tire_id,
      seq: i,
      event_type,
      actor,
      offchain_hash: offchainHash,
      offchain_uri: offchainURI,
      block_time,
      tx_hash,
      raw: e,
    };
  });

  return {
    passportRow: {
      tire_id,
      batch_id,
      owner,
      state: stateNum,
      history_len,
      raw: payload,
    },
    eventRows: rows,
  };
}

async function upsertPassport(passportRow: AnyJson) {
  const { error } = await supabase
    .from('passports')
    .upsert(passportRow, { onConflict: 'tire_id' });
  if (error) die(`passports upsert failed: ${error.message}`);
}

async function replaceEvents(tid: string, eventRows: AnyJson[]) {
  const del = await supabase.from('passport_events').delete().eq('tire_id', tid);
  if (del.error) die(`events delete failed: ${del.error.message}`);

  if (eventRows.length === 0) return;

  const chunkSize = 500;
  for (let i = 0; i < eventRows.length; i += chunkSize) {
    const chunk = eventRows.slice(i, i + chunkSize);
    const ins = await supabase.from('passport_events').insert(chunk);
    if (ins.error) die(`events insert failed: ${ins.error.message}`);
  }
}

async function main() {
  const raw = await loadMirror(tireId); // tireId is definitely a string now
  const { passportRow, eventRows } = normalize(raw);

  console.log(`Uploading passport ${passportRow.tire_id} (events=${eventRows.length})…`);
  await upsertPassport(passportRow);
  await replaceEvents(passportRow.tire_id, eventRows);
  console.log('Upload complete ✅');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
