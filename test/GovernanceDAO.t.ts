const { ethers } = require("hardhat");
const { expect } = require("chai");
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

function getEtherValue(value: number): bigint {
  return ethers.parseEther(`${value.toString()}`);
}

interface ConstructorStruct {
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
  proposalQuorumPercent: number;
  slashingPercent: number;
  votingPeriodInDays: number;
}

function getDefaultParams(overrides: Partial<ConstructorStruct> = {}): ConstructorStruct {
  return {
    name: "MooveToken",
    symbol: "MOV",
    teamMintSupply: BigInt(2_000_000),
    cap: BigInt(5_000_000),
    olderUsersMintSupply: BigInt(500_000),
    earlyAdopterMintSupply: BigInt(500_000),
    olderUsersAddresses: [],
    weeksOfVesting: 4,
    tokenPrice: getEtherValue(0.001),
    minimumTokenStakedToMakeAProposal: BigInt(50),
    minimumCirculatingSupplyToMakeAProposalInPercent: BigInt(3_500_000),
    proposalQuorumPercent: 20,
    slashingPercent: 10,
    votingPeriodInDays: 14,
    ...overrides,
  };
}

describe("GovernanceDAO", function () {
  let governanceDAO;
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
