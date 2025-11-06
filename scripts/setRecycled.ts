// scripts/setRecycled.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  // Recycler signer (Account #6) — current owner
  const recycler = new ethers.Wallet(
    "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
    provider
  );

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, recycler);

  const tireId  = tireParam();
  const RECYCLED = 4;

  const tx = await contract.updateState(tireId, RECYCLED);
  console.log("set RECYCLED tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc.blockNumber);

  const [, , , state, len] = await contract.getPassport(tireId);
  console.log("state:", Number(state), "historyLength:", Number(len));
}

main().catch((e) => { console.error(e); process.exit(1); });
