import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const defaultParams = {
  Name: "moove",
  Symbol: "MOV",
  TeamAddress: "0x0000000000000000000000000000000000000000",
  DAOAddress: "0x0000000000000000000000000000000000000000",
  TreasryAddress: "0x0000000000000000000000000000000000000000",
  TeamMintSupply: 0,
  Cap: 0,
  OlderUsersMintSupply: 0,
  EarlyAdopterMintSupply: 0,
  OlderUsersAddresses: [],
  WeeksOfVesting: 0,
  TokenPrice: 0,
};

const GovernanceTokenModule = buildModule("GovernanceTokenModule", (m) => {
  const name = m.getParameter("Name", defaultParams.Name);
  const symbol = m.getParameter("Symbol", defaultParams.Symbol);
  const teamAddress = m.getParameter("TeamAddress", defaultParams.TeamAddress);
  const daoAddress = m.getParameter("DAOAddress", defaultParams.DAOAddress);
  const treasuryAddress = m.getParameter("TreasryAddress", defaultParams.TreasryAddress);
  const teamMintSupply = m.getParameter("TeamMintSupply", defaultParams.TeamMintSupply);
  const cap = m.getParameter("Cap", defaultParams.Cap);
  const olderUsersMintSupply = m.getParameter("OlderUsersMintSupply", defaultParams.OlderUsersMintSupply);
  const earlyAdopterMintSupply = m.getParameter("EarlyAdopterMintSupply", defaultParams.EarlyAdopterMintSupply);
  const olderUsersAddresses = m.getParameter("OlderUsersAddresses", defaultParams.OlderUsersAddresses);
  const weeksOfVesting = m.getParameter("WeeksOfVesting", defaultParams.WeeksOfVesting);
  const tokenPrice = m.getParameter("TokenPrice", defaultParams.TokenPrice);

  const governanceToken = m.contract("GovernanceToken", [
    name,
    symbol,
    daoAddress,
    teamAddress,
    treasuryAddress,
    teamMintSupply,
    cap,
    olderUsersMintSupply,
    earlyAdopterMintSupply,
    olderUsersAddresses,
    weeksOfVesting,
    tokenPrice,
  ]);

  return { governanceToken };
});

export default GovernanceTokenModule;
