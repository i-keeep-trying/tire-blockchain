// scripts/debugTire.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };

const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const reader = new ethers.Wallet(
    // any account works for read
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    provider
  );
  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, reader);

  const batchId = batchParam();
  const tires: string[] = await contract.getBatchTires(batchId);
  console.log("Batch tyres:", tires);

  const tid = tires[0] ?? "TIREB01";

  const r = await contract.getPassport(tid);
  // r = (tireId, batchId, owner, state, historyLength)
  console.log("getPassport:", {
    tireId: r[0],
    batchId: r[1],
    owner: r[2],
    state: Number(r[3]),
    historyLength: Number(r[4]),
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
