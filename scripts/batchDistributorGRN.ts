// scripts/batchDistributorGRN.ts
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };

const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;
const BATCH_ID = "BATCH-2025-11-05-B";
const DISTRIBUTOR_ADDR = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

// tiny helper just to be safe on Windows loops
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Distributor signer (acct #2) + NonceManager to avoid nonce clashes
  const distributorRaw = new ethers.Wallet(
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    provider
  );
  const distributor = new ethers.NonceManager(distributorRaw);

  const c = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, distributor);

  const tires: string[] = await c.getBatchTires(BATCH_ID);
  console.log(`Posting GRNs for batch ${BATCH_ID} (tyres: ${tires.join(", ")})`);

  const uri = "ipfs://goods_received_note_DST01.pdf";
  const hash32 = ethers.zeroPadValue("0x7f9fe45a", 32); // demo hash prefix

  for (const tid of tires) {
    const snap = await c.getPassport(tid);
    const owner = (snap[2] as string).toLowerCase();
    if (owner !== DISTRIBUTOR_ADDR.toLowerCase()) {
      console.log(`SKIP ${tid}: owner=${snap[2]} (not distributor)`);
      continue;
    }

    // Preflight: ensure it would succeed
    try {
      await c.recordEvent.staticCall(tid, "RECEIVED_FROM_MANUFACTURER", hash32, uri);
    } catch (e: any) {
      console.log(`  PRECHECK FAIL ${tid}: ${e?.shortMessage || e?.message || e}`);
      continue;
    }

    // Send with explicit gas limit; retry once on NONCE_EXPIRED
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const tx = await c.recordEvent(
          tid,
          "RECEIVED_FROM_MANUFACTURER",
          hash32,
          uri,
          { gasLimit: 1_000_000 }
        );
        console.log(`  GRN tx sent for ${tid}: ${tx.hash}`);
        await tx.wait();
        console.log(`  GRN confirmed for ${tid}`);
        break; // success, move on
      } catch (e: any) {
        const msg = e?.shortMessage || e?.message || String(e);
        if (attempt === 1 && /NONCE_EXPIRED|nonce has already been used/i.test(msg)) {
          console.log(`  nonce issue on ${tid}, retrying once...`);
          // give the node a moment to index the prior mined tx
          await sleep(150);
          // NonceManager will pick up the next nonce automatically on retry
          continue;
        }
        console.log(`  GRN FAIL ${tid}: ${msg}`);
        break;
      }
    }

    // small spacing between submits (defensive)
    await sleep(75);
  }

  console.log("Distributor GRNs done.");
}

main().catch((e) => { console.error(e); process.exit(1); });