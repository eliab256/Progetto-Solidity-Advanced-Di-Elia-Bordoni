import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DAOAddress = "0x0000000000000000000000000000000000000000";
const TeamAddress = "0x0000000000000000000000000000000000000000";
const ONE_ETH: bigint = 1_000_000_000_000_000_000n;

const TreasuryDAOModule = buildModule("TreasuryDAOModule", (m) => {
  const DaoAddress = m.getParameter("DAOAddress", DAOAddress);
  const teamAddress = m.getParameter("TeamAddress", TeamAddress);
  const balanceAmount = m.getParameter("BalanceAmount", ONE_ETH);

  const treasuryDAO = m.contract("TreasuryDAO", [DaoAddress, teamAddress], {
    value: balanceAmount,
  });

  return { treasuryDAO };
});

export default TreasuryDAOModule;
