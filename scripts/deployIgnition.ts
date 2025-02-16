import hre from "hardhat";
import GovernanceDAOModule from "../ignition/modules/IgnitionGovernanceDAO";

async function main() {
  console.log("Deploying GovernanceDAO...");
  const { governanceDAO } = await hre.ignition.deploy(GovernanceDAOModule);

  console.log("GovernanceDAO deployed at:", await governanceDAO.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
