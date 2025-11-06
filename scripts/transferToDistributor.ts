// scripts/transferToDistributor.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Current owner is Manufacturer (Account #1)
  const manufacturer = new ethers.Wallet(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    provider
  );

  const distributor = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // Account #2
  const tireId  = tireParam();

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, manufacturer);

  const tx = await contract.transferOwnership(tireId, distributor);
  console.log("transfer→Distributor tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc.blockNumber);

  const [, , owner] = await contract.getPassport(tireId);
  console.log("new owner:", owner);
}

main().catch((e) => { console.error(e); process.exit(1); });
