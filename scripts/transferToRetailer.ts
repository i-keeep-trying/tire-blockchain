// scripts/transferToRetailer.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Distributor is current owner (Account #2)
  const distributor = new ethers.Wallet(
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    provider
  );

  const retailer = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"; // Account #3
  const tireId  = tireParam();

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, distributor);

  const tx = await contract.transferOwnership(tireId, retailer);
  console.log("transfer→Retailer tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc.blockNumber);

  const [, , owner] = await contract.getPassport(tireId);
  console.log("new owner:", owner);
}

main().catch((e) => { console.error(e); process.exit(1); });
