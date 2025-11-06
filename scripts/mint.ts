// scripts/mint.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Manufacturer (Account #1 from your node output)
  const manufacturer = new ethers.Wallet(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    provider
  );

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, manufacturer);

  const tireId  = tireParam();

  const batchId = batchParam();

  const tx = await contract.mintTirePassport(tireId, batchId);
  console.log("Mint tx sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("Mint confirmed in block", receipt.blockNumber);

  // Quick read-back
  const [tid, bid, owner, state, len] = await contract.getPassport(tireId);
  console.log({ tid, bid, owner, state: Number(state), historyLength: Number(len) });
}

main().catch((e) => { console.error(e); process.exit(1); });
