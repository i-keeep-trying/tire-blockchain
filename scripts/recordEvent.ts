// scripts/recordEvent.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;


async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Use Manufacturer (Account #1) as the actor
  const manufacturer = new ethers.Wallet(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    provider
  );

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, manufacturer);

  const tireId  = tireParam();

  const eventType = "SHIPPED_TO_DISTRIBUTOR";

  // Simulate a file by hashing some bytes (you can replace with fs.readFileSync of a real PDF later)
  const buf = new TextEncoder().encode("invoice_MFG01_to_DST01.pdf: demo content");
  const offchainHash = ethers.keccak256(buf);
  const offchainURI = "ipfs://invoice_MFG01_to_DST01.pdf"; // placeholder

  const tx = await contract.recordEvent(tireId, eventType, offchainHash, offchainURI);
  console.log("recordEvent tx:", tx.hash);
  const rc = await tx.wait();
  console.log("Confirmed in block", rc.blockNumber);

  // quick read-back
  const [, , , , len] = await contract.getPassport(tireId);
  console.log("historyLength:", Number(len));
}

main().catch((e) => { console.error(e); process.exit(1); });
