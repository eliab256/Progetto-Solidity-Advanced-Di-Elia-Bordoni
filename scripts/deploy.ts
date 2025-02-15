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

  const governanceToken = await governanceDAO.i_tokenContract();
  const stakingTokenManager = await governanceDAO.i_stakingContract();
  const treasuryDAO = await governanceDAO.i_treasuryContract();

  console.log(`✅ GovernanceDAO Contract deployed at: ${governanceDAO.target}`);
  console.log(`✅ GovernanceToken Contract deployed at: ${governanceToken}`);
  console.log(`✅ StakingTokenManager Contract deployed at: ${stakingTokenManager}`);
  console.log(`✅ TreasuryDAO Contract deployed at: ${treasuryDAO}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
