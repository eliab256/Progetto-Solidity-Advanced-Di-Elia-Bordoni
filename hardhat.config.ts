import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition";
import "@nomicfoundation/hardhat-ignition-ethers";
//import "hardhat-deploy";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
};

export default config;
