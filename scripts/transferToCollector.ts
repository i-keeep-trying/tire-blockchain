// scripts/transferToCollector.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Service is current owner (Account #4)
  const service = new ethers.Wallet(
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
    provider
  );

  const collector = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"; // Account #5
  const tireId  = tireParam();

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, service);

  const tx = await contract.transferOwnership(tireId, collector);
  console.log("transfer→Collector tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc.blockNumber);

  const [, , owner] = await contract.getPassport(tireId);
  console.log("new owner:", owner);
}

main().catch((e) => { console.error(e); process.exit(1); });
