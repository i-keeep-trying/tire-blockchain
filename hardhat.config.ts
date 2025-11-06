import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-viem";

const config: HardhatUserConfig = {
  solidity: "0.8.21",
  networks: {
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545"
    }
  }
};

export default config;
