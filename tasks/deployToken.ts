import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "hardhat";

// Definire l'interfaccia per i parametri del task
interface DeployTokenTaskArgs {
  name: string;
  symbol: string;
  teamAddress: string;
  DAOAddress: string;
  treasuryAddress: string;
  teamMintSupply: number;
  cap: number;
  olderUsersMintSupply: number;
  earlyAdopterMintSupply: number;
  weeksOfVesting: number;
  tokenPrice: number;
}

task("deploy-token", "Deploy the GovernanceToken contract")
  .addParam("name", "The name of the token")
  .addParam("symbol", "The symbol of the token")
  .addParam("teamAddress", "The address of the team")
  .addParam("DAOAddress", "The address of the DAO")
  .addParam("treasuryAddress", "The address of the treasury")
  .addParam("teamMintSupply", "The team mint supply")
  .addParam("cap", "The cap on the token supply")
  .addParam("olderUsersMintSupply", "The supply for older users")
  .addParam("earlyAdopterMintSupply", "The supply for early adopters")
  .addParam("weeksOfVesting", "The weeks of vesting")
  .addParam("tokenPrice", "The price of the token")
  .setAction(async (taskArgs: DeployTokenTaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre;

    // Prepara i parametri dal terminale
    const params = {
      name: taskArgs.name,
      symbol: taskArgs.symbol,
      teamAddress: taskArgs.teamAddress,
      DAOAddress: taskArgs.DAOAddress,
      treasuryAddress: taskArgs.treasuryAddress,
      teamMintSupply: taskArgs.teamMintSupply,
      cap: taskArgs.cap,
      olderUsersMintSupply: taskArgs.olderUsersMintSupply,
      earlyAdopterMintSupply: taskArgs.earlyAdopterMintSupply,
      olderUsersAddresses: [],
      weeksOfVesting: taskArgs.weeksOfVesting,
      tokenPrice: ethers.utils.parseEther(taskArgs.tokenPrice), // Assicurati che il prezzo sia in formato ether
    };

    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");

    const governanceToken = await GovernanceToken.deploy(...Object.values(params));

    console.log("GovernanceToken deployed to:", governanceToken.address);
  });
