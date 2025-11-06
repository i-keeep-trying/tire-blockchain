// scripts/batchTransferToDistributor.ts
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };

const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;
const BATCH_ID = "BATCH-2025-11-05-B";
const DISTRIBUTOR = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // acct #2
const MANUFACTURER_ADDR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // acct #1

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Manufacturer signer (acct #1) wrapped in NonceManager
  const manufacturer = new ethers.Wallet(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    provider
  );
  const managed = new ethers.NonceManager(manufacturer);

  const c = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, managed);

  const tires: string[] = await c.getBatchTires(BATCH_ID);
  console.log(`Batch ${BATCH_ID} tyres:`, tires);

  // Filter to only those currently owned by Manufacturer
  const toMove: string[] = [];
  for (const tid of tires) {
    const snap = await c.getPassport(tid);
    const owner = (snap[2] as string).toLowerCase();
    if (owner === MANUFACTURER_ADDR.toLowerCase()) {
      toMove.push(tid);
    } else {
      console.log(`SKIP ${tid}: currentOwner=${snap[2]} (not manufacturer)`);
    }
  }

  if (toMove.length === 0) {
    console.log("Nothing to transfer from manufacturer → distributor.");
    return;
  }

  console.log(
    `Transferring ${toMove.length} tyres from ${await manufacturer.getAddress()} -> ${DISTRIBUTOR}`
  );

  for (const tid of toMove) {
    // Pre-flight with staticCall to avoid estimateGas revert
    try {
      await c.transferOwnership.staticCall(tid, DISTRIBUTOR);
    } catch (e: any) {
      console.log(`  WOULD REVERT ${tid}: ${e?.shortMessage || e?.message || e}`);
      continue;
    }

    // Send with explicit gasLimit to bypass estimation path
    try {
      const tx = await c.transferOwnership(tid, DISTRIBUTOR, { gasLimit: 1_000_000 });
      await tx.wait();
      console.log(`  transferred ${tid}`);
    } catch (e: any) {
      console.log(`  FAIL ${tid}: ${e?.shortMessage || e?.message || e}`);
    }
  }

  // Optional: per-tyre shipment document
  const note = "ipfs://dst_dispatch_note_BATCHB.pdf";
  for (const tid of toMove) {
    try {
      await c.recordEvent.staticCall(
        tid,
        "SHIPPED_TO_DISTRIBUTOR",
        ethers.zeroPadValue("0x45c3184b", 32),
        note
      );
      const tx = await c.recordEvent(
        tid,
        "SHIPPED_TO_DISTRIBUTOR",
        ethers.zeroPadValue("0x45c3184b", 32),
        note,
        { gasLimit: 1_000_000 }
      );
      await tx.wait();
      console.log(`  event recorded for ${tid}`);
    } catch (e: any) {
      console.log(`  EVENT FAIL ${tid}: ${e?.shortMessage || e?.message || e}`);
    }
  }

  console.log("Batch transfer attempt complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
