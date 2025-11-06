// scripts/recyclerDocs.ts
import { tireParam, batchParam, uri } from "./lib/params.js";
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Recycler signer (Account #6)
  const recycler = new ethers.Wallet(
    "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
    provider
  );
  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, recycler);

  const addr = await recycler.getAddress();
  let nonce = await provider.getTransactionCount(addr, "latest");

  const tireId  = tireParam();


  // helper to send with explicit nonce and wait
  async function send(p: Promise<ethers.TransactionResponse>) {
    const tx = await p;
    await tx.wait();
    nonce++;
    return tx.hash;
  }

  // 1) Recycling intake (weighbridge ticket)
  {
    const buf = new TextEncoder().encode(`weighbridge_ticket_${tireId}.pdf: demo`);
    const offchainHash = ethers.keccak256(buf);
    const offchainURI = `ipfs://weighbridge_ticket_${tireId}.pdf`;
    const hash = await send(
      contract.recordEvent(tireId, "RECYCLING_INTAKE", offchainHash, offchainURI, { nonce })
    );
    console.log("recycling intake tx:", hash);
  }

  // 2) EPR assertion (proof/cert)
  {
    const buf = new TextEncoder().encode(`EPR_certificate_for_${tireId}.pdf: demo`);
    const offchainHash = ethers.keccak256(buf);
    const offchainURI = `ipfs://EPR_certificate_for_${tireId}.pdf`;
    const hash = await send(
      contract.recordEvent(tireId, "EPR_ASSERTED", offchainHash, offchainURI, { nonce })
    );
    console.log("EPR asserted tx:", hash);
  }

  const [, , , , len] = await contract.getPassport(tireId);
  console.log("historyLength:", Number(len));
}

main().catch((e) => { console.error(e); process.exit(1); });
