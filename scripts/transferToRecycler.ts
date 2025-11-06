// scripts/transferToRecycler.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Collector is the current owner (Account #5)
  const collector = new ethers.Wallet(
    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
    provider
  );

  const recycler = "0x976EA74026E726554dB657fA54763abd0C3a0aa9"; // Account #6
  const tireId  = tireParam();

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, collector);

  const tx = await contract.transferOwnership(tireId, recycler);
  console.log("transfer→Recycler tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc.blockNumber);

  const [, , owner] = await contract.getPassport(tireId);
  console.log("new owner:", owner);
}

main().catch((e) => { console.error(e); process.exit(1); });
