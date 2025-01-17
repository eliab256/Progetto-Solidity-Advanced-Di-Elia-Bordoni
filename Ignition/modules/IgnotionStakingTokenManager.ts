import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TokenAddress = "0x0000000000000000000000000000000000000000";
const TeamAddress = "0x0000000000000000000000000000000000000000";
const SlashingPercent = 50;

const StakingTokenManagerModule = buildModule("StakingTokenManagerModule", (m) => {
  const tokenAddress = m.getParameter("TokenAddress", TokenAddress);
  const teamAddress = m.getParameter("TeamAddress", TeamAddress);
  const slashingPercent = m.getParameter("SlashingPercent", SlashingPercent);

  const stakingTokenManager = m.contract("StakingTokenManager", [tokenAddress, teamAddress, slashingPercent]);

  return { stakingTokenManager };
});

export default StakingTokenManagerModule;
