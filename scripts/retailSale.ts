// scripts/retailSale.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Retailer signer (Account #3) — now the current owner
  const retailer = new ethers.Wallet(
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    provider
  );

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, retailer);

  const tireId  = tireParam();

  const eventType = "SOLD_TO_END_USER";

  // Simulate a retail invoice file’s hash + URI
  const buf = new TextEncoder().encode(`retail_invoice_${tireId}.pdf: demo`);
  const offchainHash = ethers.keccak256(buf);
  const offchainURI = `ipfs://retail_invoice_${tireId}.pdf`;

  const tx = await contract.recordEvent(tireId, eventType, offchainHash, offchainURI);
  console.log("Retail sale tx:", tx.hash);
  const rc = await tx.wait();
  console.log("Confirmed in block", rc.blockNumber);

  const [, , , , len] = await contract.getPassport(tireId);
  console.log("historyLength:", Number(len));
}

main().catch((e) => { console.error(e); process.exit(1); });
