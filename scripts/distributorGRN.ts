// scripts/distributorGRN.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Distributor is now the owner (Account #2)
  const distributor = new ethers.Wallet(
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    provider
  );

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, distributor);

  const tireId  = tireParam();

  const eventType = "RECEIVED_FROM_MANUFACTURER";

  // Simulate a PDF hash + URI
  const buf = new TextEncoder().encode("goods_received_note_DST01.pdf: demo");
  const offchainHash = ethers.keccak256(buf);
  const offchainURI = "ipfs://goods_received_note_DST01.pdf";

  const tx = await contract.recordEvent(tireId, eventType, offchainHash, offchainURI);
  console.log("Distributor GRN tx:", tx.hash);
  const rc = await tx.wait();
  console.log("Confirmed in block", rc.blockNumber);

  const [, , , , len] = await contract.getPassport(tireId);
  console.log("historyLength:", Number(len));
}

main().catch((e) => { console.error(e); process.exit(1); });
