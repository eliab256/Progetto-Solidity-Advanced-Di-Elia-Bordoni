import hre from "hardhat";
import GovernanceDAOModule from "../ignition/modules/IgnitionGovernanceDAO";

async function main() {
  const { governanceDAO } = await hre.ignition.deploy(GovernanceDAOModule, {});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
