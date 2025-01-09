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

describe("GovernanceDAO", function () {
  let governanceDAO;
  let owner;
  let numberOfOlderUsers = process.env.NUMBER_OF_OLDER_USERS;

  beforeEach(async function () {
    const [owner, ...users] = await ethers.getSigners();
    const olderUsersAddresses = users.slice(0, { numberOfOlderUsers }).map((user: SignerWithAddress) => user.address);

    const GovernanceDAO = await ethers.getConractFactory("GovernanceDAO");

    const params: ConstructorStruct = {
      name: "MooveToken",
      symbol: "MOV",
      teamMintSupply: 2_000_000,
      cap: 5_000_000,
      olderUsersMintSupply: 500_000,
      earlyAdopterMintSupply: 500_000,
      olderUsersAddresses: olderUsersAddresses,
      weeksOfVesting: 4,
      tokenPrice: ethers.utils.parseEther("0.001"),
      minimumTokenStakedToMakeAProposal: 50,
      minimumCirculatingSupplyToMakeAProposalInPercent: 3_500_000,
      proposalQuorumPercent: 20,
      slashingPercent: 25,
      votingPeriodInDays: 14,
    };

    governanceDAO = await GovernanceDAO.deploy(
      params.name,
      params.symbol,
      params.teamMintSupply,
      params.cap,
      params.olderUsersMintSupply,
      params.earlyAdopterMintSupply,
      params.olderUsersAddresses,
      params.weeksOfVesting,
      params.tokenPrice,
      params.minimumTokenStakedToMakeAProposal,
      params.minimumCirculatingSupplyToMakeAProposalInPercent,
      params.proposalQuorumPercent,
      params.slashingPercent,
      params.votingPeriodInDays
    );

    await governanceDAO.deployed();
  });
});
