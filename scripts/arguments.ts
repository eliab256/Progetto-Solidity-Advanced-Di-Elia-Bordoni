const args: [
  {
    name: string;
    symbol: string;
    teamMintSupply: bigint;
    cap: bigint;
    olderUsersMintSupply: bigint;
    earlyAdopterMintSupply: bigint;
    olderUsersAddresses: string[];
    weeksOfVesting: number;
    tokenPrice: bigint;
    minimumTokenStakedToMakeAProposal: bigint;
    minimumCirculatingSupplyToMakeAProposalInPercent: bigint;
    proposalQuorumPercent: bigint;
    slashingPercent: bigint;
    votingPeriodInDays: bigint;
  }
] = [
  {
    name: "Moove DAO",
    symbol: "MOV",
    teamMintSupply: BigInt(1000000),
    cap: BigInt(5000000),
    olderUsersMintSupply: BigInt(0),
    earlyAdopterMintSupply: BigInt(100000),
    olderUsersAddresses: [],
    weeksOfVesting: 12,
    tokenPrice: BigInt(1000000000000000), // 0.001 ETH in wei
    minimumTokenStakedToMakeAProposal: BigInt(5000),
    minimumCirculatingSupplyToMakeAProposalInPercent: BigInt(10),
    proposalQuorumPercent: BigInt(20),
    slashingPercent: BigInt(5),
    votingPeriodInDays: BigInt(7),
  },
];

export default args;
