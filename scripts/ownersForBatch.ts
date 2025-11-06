// scripts/ownersForBatch.ts
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };

const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;
const BATCH_ID = process.env.BATCH_ID || "BATCH-2025-11-06-A";

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const reader = new ethers.Wallet(
    // any funded account; read-only is fine but ethers Contract needs a signer for calls in v6
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    provider
  );

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, reader);

  const tyres: string[] = await contract.getBatchTires(BATCH_ID);
  console.log(`Batch ${BATCH_ID} has ${tyres.length} tyres`);
  for (const id of tyres) {
    const [, , owner, state, histLen] = await contract.getPassport(id);
    console.log(`${id} -> owner ${owner} state ${Number(state)} history ${Number(histLen)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
