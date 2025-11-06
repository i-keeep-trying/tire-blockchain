// scripts/mintBatch.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };

const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Manufacturer (Hardhat account #1)
  const manufacturer = new ethers.Wallet(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    provider
  );

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, manufacturer);

  const batchId = batchParam();;
  const tireIds = ["TIREB01", "TIREB02", "TIREB03", "TIREB04"];

  const tx = await contract.mintBatch(batchId, tireIds);
  console.log("mintBatch tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc.blockNumber);

  // sanity check
  const tires: string[] = await contract.getBatchTires(batchId);
  console.log("Batch", batchId, "contains:", tires);
}

main().catch((e) => { console.error(e); process.exit(1); });
