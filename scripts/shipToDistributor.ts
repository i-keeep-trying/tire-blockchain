// scripts/shipToDistributor.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

if (!ethers.isAddress(CONTRACT_ADDRESS)) throw new Error("Bad CONTRACT_ADDRESS");

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Manufacturer (Account #1) is still the owner now
  const manufacturer = new ethers.Wallet(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    provider
  );

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, manufacturer);

  const tireId  = tireParam();
  const eventType = "SHIPPED_TO_DISTRIBUTOR";

  // Simulate a PDF upload by hashing bytes (replace with real file bytes later)
  const buf = new TextEncoder().encode("invoice_MFG01_to_DST01.pdf: demo content");
  const offchainHash = ethers.keccak256(buf);
  const offchainURI = "ipfs://invoice_MFG01_to_DST01.pdf"; // placeholder URI

  const tx = await contract.recordEvent(tireId, eventType, offchainHash, offchainURI);
  console.log("ship→distributor tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc.blockNumber);

  const [, , , , len] = await contract.getPassport(tireId);
  console.log("historyLength:", Number(len));
}

main().catch((e) => { console.error(e); process.exit(1); });
