// scripts/setCollected.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Collector (Account #5) is the current owner
  const collector = new ethers.Wallet(
    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
    provider
  );

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, collector);

  const tireId  = tireParam();
  const COLLECTED = 3;

  const tx = await contract.updateState(tireId, COLLECTED);
  console.log("set COLLECTED tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc.blockNumber);

  const [, , , state, len] = await contract.getPassport(tireId);
  console.log("state:", Number(state), "historyLength:", Number(len));
}

main().catch((e) => { console.error(e); process.exit(1); });
