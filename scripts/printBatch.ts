// scripts/printBatch.ts
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const RAW_ADDRESS: string = (addrs as any).TyrePassportV2;

const CONTRACT_ADDRESS = RAW_ADDRESS.trim();          // remove stray whitespace/newlines
const BATCH_ID = "BATCH-2025-11-05-A";

async function main() {
  if (!ethers.isAddress(CONTRACT_ADDRESS)) {
    throw new Error(`Bad CONTRACT_ADDRESS: "${RAW_ADDRESS}"`);
  }

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Construct the contract with a proper hex address (no ENS lookup)
  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, provider);

  const tires: string[] = await contract.getBatchTires(BATCH_ID);
  console.log("Batch", BATCH_ID, "contains:", tires);
}

main().catch((e) => { console.error(e); process.exit(1); });
