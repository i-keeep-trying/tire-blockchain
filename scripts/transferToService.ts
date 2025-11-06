// scripts/transferToService.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Retailer is current owner (Account #3)
  const retailer = new ethers.Wallet(
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    provider
  );
  const serviceAddr = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"; // Account #4

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, retailer);

  const tireId  = tireParam();
  const tx = await contract.transferOwnership(tireId, serviceAddr);
  console.log("transfer→Service tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc.blockNumber);

  const [, , owner] = await contract.getPassport(tireId);
  console.log("new owner:", owner);
}

main().catch((e) => { console.error(e); process.exit(1); });
