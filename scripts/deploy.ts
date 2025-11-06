// scripts/deploy.ts
import { ethers } from "ethers";
import artifact from "../artifacts/contracts/TyrePassportV2.sol/TyrePassportV2.json" assert { type: "json" };
import fs from "node:fs";

async function main() {
  // Local Hardhat node
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Deployer (Account #0 from `npx hardhat node`)
  const DEPLOYER_PK =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const deployer = new ethers.Wallet(DEPLOYER_PK, provider);
  console.log("Deploying from:", await deployer.getAddress());

  // Deploy
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const contract = await factory.deploy();

  // Wait until mined (ethers v6)
  await contract.waitForDeployment();

  // Address + (optional) block number
  const contractAddress = await contract.getAddress();
  let blockNumber: number | string = "?";
  const depTx = contract.deploymentTransaction();
  if (depTx) {
    const receipt = await provider.getTransactionReceipt(depTx.hash);
    if (receipt) blockNumber = receipt.blockNumber;
  }

  console.log("TyrePassportV2:", contractAddress);
  console.log("Deployed in block:", blockNumber);

  // Persist address for all scripts
  const outDir = "deployments";
  const outFile = `${outDir}/local.json`;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    outFile,
    JSON.stringify({ TyrePassportV2: contractAddress }, null, 2),
    "utf8"
  );
  console.log(`Wrote ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
