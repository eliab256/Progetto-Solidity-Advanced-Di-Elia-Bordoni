import { ethers } from "hardhat";
import { Contract } from "ethers";
import { GovernanceDAO } from "../typechain-types/contracts";

async function main() {
  console.log("Deploying contract...");

  const ContractFactory = await ethers.getContractFactory("GovernanceDAO");

  const constructorArgs = (await import("./arguments")).default;

  const governanceDAO = (await ContractFactory.deploy(...constructorArgs)) as GovernanceDAO & Contract;

  console.log("Waiting for deployment...");
  await governanceDAO.deployed();

  console.log(`✅ Contract deployed at: ${governanceDAO.target}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
