const { ethers } = require("hardhat");
const { expect } = require("chai");
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

interface ConstructorStruct {
  name: string;
  symbol: string;
  teamMintSupply: bigint;
  cap: bigint;
  olderUsersMintSupply: bigint;
  earlyAdopterMintSupply: bigint;
  olderUsersAddresses: string[];
  weeksOfVesting: number;
  tokenPrice: number;
  minimumTokenStakedToMakeAProposal: bigint;
  minimumCirculatingSupplyToMakeAProposalInPercent: bigint;
  proposalQuorumPercent: number;
  slashingPercent: number;
  votingPeriodInDays: number;
}

function getDefaultParams(overrides: Partial<ConstructorStruct> = {}): ConstructorStruct {
  return {
    name: "MooveToken",
    symbol: "MOV",
    teamMintSupply: 2_000_000n,
    cap: 5_000_000n,
    olderUsersMintSupply: 500_000n,
    earlyAdopterMintSupply: 500_000n,
    olderUsersAddresses: [],
    weeksOfVesting: 4,
    tokenPrice: ethers.parseEther("0.001"),
    minimumTokenStakedToMakeAProposal: 50n,
    minimumCirculatingSupplyToMakeAProposalInPercent: 3_500_000n,
    proposalQuorumPercent: 20,
    slashingPercent: 10,
    votingPeriodInDays: 14,
    ...overrides,
  };
}

describe("GovernanceDAO", function () {
  let governanceDAO;
  let DAO;
  let team;
  let externalUser1;
  let externalUser2;
  let numberOfOlderUsers = 10;

  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    team = signers[0];
    externalUser1 = signers[1];
    externalUser2 = signers[2];
    const olderUsersAddresses = signers.slice(3, 3 + numberOfOlderUsers).map((user: SignerWithAddress) => user.address);

    const GovernanceDAO = await ethers.getContractFactory("GovernanceDAO");

    const params = getDefaultParams({ olderUsersAddresses });
    //assegnare i vari address team e owner

    governanceDAO = await GovernanceDAO.deploy(params);

    await governanceDAO.deployed();
  });
  describe("constructor and deploy", async function () {
    it("should deploy the contract with correct parameters", async function () {});

    it("should deploy token contract correctly", async function () {});

    it("should deploy staking contract correctly", async function () {});

    it("should deploy treasury contract correctly", async function () {});

    it("should emit the event of deploys", async function () {});
  });

  describe("proposals functions", async function () {});
});
