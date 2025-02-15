import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import args from "../../scripts/arguments";

const constructorArgs = args;

const ONE_ETH: bigint = 1_000_000_000_000_000_000n;

const GovernanceDAOModule = buildModule("GovernanceDAOModule", (m) => {
  const initialBalance = m.getParameter("InitialBalance", ONE_ETH);
  //controllare come passare args
  const governanceDAO = m.contract("GovernanceDAO", args, {
    value: initialBalance,
  });

  return { governanceDAO };
});

export default GovernanceDAOModule;
