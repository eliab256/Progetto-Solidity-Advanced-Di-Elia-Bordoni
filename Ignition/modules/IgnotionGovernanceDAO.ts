import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const defaultParams = {
  Name: "Moove",
  Symbol: "MOV",
  TeamMintSupply: 0,
  Cap: 0,
  OlderUsersMintSupply: 0,
  EarlyAdopterMintSupply: 0,
  OlderUsersAddresses: [],
  WeeksOfVesting: 0,
  TokenPrice: 0,
  MinimumTokenStakedToMakeAProposal: 0,
  MinimumCirculatingSupplyToMakeAProposalInPercent: 0,
  ProposalQuorumPercent: 0,
  SlashingPercent: 0,
  VotingPeriodInDays: 0,
};

const GovernanceDAOModule = buildModule("GovernanceDAOModule", (m) => {
  const name = m.getParameter("Name", defaultParams.Name);
  const symbol = m.getParameter("Symbol", defaultParams.Symbol);
  const teamMintSupply = m.getParameter("TeamMintSupply", defaultParams.TeamMintSupply);
  const cap = m.getParameter("Cap", defaultParams.Cap);
  const olderUsersMintSupply = m.getParameter("OlderUsersMintSupply", defaultParams.OlderUsersMintSupply);
  const earlyAdopterMintSupply = m.getParameter("EarlyAdopterMintSupply", defaultParams.EarlyAdopterMintSupply);
  const olderUsersAddresses = m.getParameter("OlderUsersAddresses", defaultParams.OlderUsersAddresses);
  const weeksOfVesting = m.getParameter("WeeksOfVesting", defaultParams.WeeksOfVesting);
  const tokenPrice = m.getParameter("TokenPrice", defaultParams.TokenPrice);
  const minimumTokenStakedToMakeAProposal = m.getParameter("MinimumTokenStakedToMakeAProposal", defaultParams.MinimumTokenStakedToMakeAProposal);
  const minimumCirculatingSupplyToMakeAProposalInPercent = m.getParameter(
    "MinimumCirculatingSupplyToMakeAProposalInPercent",
    defaultParams.MinimumCirculatingSupplyToMakeAProposalInPercent
  );
  const proposalQuorumPercent = m.getParameter("ProposalQuorumPercent", defaultParams.ProposalQuorumPercent);
  const slashingPercent = m.getParameter("SlashingPercent", defaultParams.SlashingPercent);
  const votingPeriodInDays = m.getParameter("VotingPeriodInDays", defaultParams.VotingPeriodInDays);

  const governanceDAO = m.contract("GovernanceDAO", [
    name,
    symbol,
    teamMintSupply,
    cap,
    olderUsersMintSupply,
    earlyAdopterMintSupply,
    olderUsersAddresses,
    weeksOfVesting,
    tokenPrice,
    minimumTokenStakedToMakeAProposal,
    minimumCirculatingSupplyToMakeAProposalInPercent,
    proposalQuorumPercent,
    slashingPercent,
    votingPeriodInDays,
  ]);

  return { governanceDAO };
});

export default GovernanceDAOModule;
