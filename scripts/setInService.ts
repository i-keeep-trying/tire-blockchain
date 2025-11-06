// scripts/setInService.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Service signer (Account #4) — current owner after transfer
  const service = new ethers.Wallet(
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
    provider
  );

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, service);

  const tireId  = tireParam();
  const IN_SERVICE = 2;

  const tx = await contract.updateState(tireId, IN_SERVICE);
  console.log("set IN_SERVICE tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc.blockNumber);

  const [, , , state, len] = await contract.getPassport(tireId);
  console.log("state:", Number(state), "historyLength:", Number(len));
}

main().catch((e) => { console.error(e); process.exit(1); });
