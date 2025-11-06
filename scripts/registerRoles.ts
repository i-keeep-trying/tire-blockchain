// scripts/registerRoles.ts
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import addrs from "../deployments/local.json" assert { type: "json" };
const CONTRACT_ADDRESS: string = (addrs as any).TyrePassportV2;

async function main() {
  // Hardhat local node
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Regulator = Account #0 (from `npx hardhat node` output)
  const regulator = new ethers.Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    provider
  );

  // Actor addresses (from your node output)
  const manufacturer = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // #1
  const distributor  = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // #2
  const retailer     = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"; // #3
  const service      = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"; // #4
  const collector    = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"; // #5
  const recycler     = "0x976EA74026E726554dB657fA54763abd0C3a0aa9"; // #6

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, regulator);

  // --- Nonce-managed sends (avoids "nonce too low" on automining) ---
  let nonce = await provider.getTransactionCount(await regulator.getAddress(), "latest");

  async function sendRegister(addr: string, role: string) {
    const tx = await contract.registerRole(addr, role, { nonce });
    await tx.wait();
    nonce++;
    console.log(`Registered ${role} -> ${addr}`);
  }

  await sendRegister(manufacturer, "Manufacturer");
  await sendRegister(distributor,  "Distributor");
  await sendRegister(retailer,     "Retailer");
  await sendRegister(service,      "Service");
  await sendRegister(collector,    "Collector");
  await sendRegister(recycler,     "Recycler");

  // Verify
  const roles: [string, string][] = [
    [manufacturer, "Manufacturer"],
    [distributor,  "Distributor"],
    [retailer,     "Retailer"],
    [service,      "Service"],
    [collector,    "Collector"],
    [recycler,     "Recycler"],
  ];
  for (const [addr, label] of roles) {
    const r: string = await contract.roles(addr);
    console.log(label.padEnd(12), addr, "->", r);
  }

  console.log("Roles registered ✅");
}

main().catch((e) => { console.error(e); process.exit(1); });
