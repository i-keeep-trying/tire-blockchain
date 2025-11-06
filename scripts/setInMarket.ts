// scripts/setInMarket.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Use the CURRENT OWNER as signer — after mint this is Manufacturer (Account #1)
  const manufacturer = new ethers.Wallet(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    provider
  );

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, manufacturer);

  const tireId  = tireParam();
  const IN_MARKET = 1; // enum: 0 MANUFACTURED, 1 IN_MARKET, 2 IN_SERVICE, 3 COLLECTED, 4 RECYCLED

  const tx = await contract.updateState(tireId, IN_MARKET);
  console.log("set IN_MARKET tx:", tx.hash);
  const rc = await tx.wait();
  console.log("Confirmed in block", rc.blockNumber);

  const [, , , state, len] = await contract.getPassport(tireId);
  console.log("state:", Number(state), "historyLength:", Number(len));
}

main().catch((e) => { console.error(e); process.exit(1); });
