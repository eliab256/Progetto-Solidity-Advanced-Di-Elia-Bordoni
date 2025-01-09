const { ethers } = require("hardhat");
const { expect } = require("chai");
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import dotenv from "dotenv";

interface ConstructorStruct {
  name: string;
  symbol: string;
  teamMintSupply: number;
  cap: number;
  olderUsersMintSupply: number;
  earlyAdopterMintSupply: number;
  olderUsersAddresses: string[];
  weeksOfVesting: number;
  tokenPrice: number;
  minimumTokenStakedToMakeAProposal: number;
  minimumCirculatingSupplyToMakeAProposalInPercent: number;
  proposalQuorumPercent: number;
  slashingPercent: number;
  votingPeriodInDays: number;
}

function getDefaultParams(overrides: Partial<ConstructorStruct> = {}): ConstructorStruct {
  return {
    name: "MooveToken",
    symbol: "MOV",
    teamMintSupply: 1_000_000,
    cap: 5_000_000,
    olderUsersMintSupply: 500_000,
    earlyAdopterMintSupply: 500_000,
    olderUsersAddresses: [],
    weeksOfVesting: 4,
    tokenPrice: ethers.utils.parseEther("0.001"),
    minimumTokenStakedToMakeAProposal: 50,
    minimumCirculatingSupplyToMakeAProposalInPercent: 3_500_000,
    proposalQuorumPercent: 20,
    slashingPercent: 10,
    votingPeriodInDays: 14,
    ...overrides,
  };
}

describe("GovernanceDAO", function () {
  let governanceDAO;
  let owner;
  let team;
  let numberOfOlderUsers = 10; //process.env.NUMBER_OF_OLDER_USERS;

  beforeEach(async function () {
    const [owner, team, ...users] = await ethers.getSigners();
    const olderUsersAddresses = users.slice(0, numberOfOlderUsers).map((user: SignerWithAddress) => user.address);

    const GovernanceDAO = await ethers.getContractFactory("GovernanceDAO");

    const params = getDefaultParams({ olderUsersAddresses });
    //assegnare i vari address team e owner

    governanceDAO = await GovernanceDAO.deploy(...Object.values(params));

    await governanceDAO.deployed();
  });
});
