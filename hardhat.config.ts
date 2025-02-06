import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition";
import "@nomicfoundation/hardhat-ignition-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "solidity-coverage";

//import "hardhat-deploy";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true, //  Abilita l'ottimizzatore Solidity
        runs: 1000, //  Ottimizza per ridurre il bytecode
      },
    },
  },
};

export default config;
