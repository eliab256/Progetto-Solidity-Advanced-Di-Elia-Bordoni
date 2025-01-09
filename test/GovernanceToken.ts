const { ethers } = require("hardhat");
const { expect } = require("chai");
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

interface ConstructorStruct {
  name: string;
  symbol: string;
  teamAddress: number;
  DAOAddress: number;
  treasuryAddress: number;
  teamMintSupply: number;
  cap: number;
  olderUsersMintSupply: number;
  earlyAdopterMintSupply: number;
  olderUsersAddresses: string[];
  weeksOfVesting: number;
  tokenPrice: number;
}

function getDefaultParams(overrides: Partial<ConstructorStruct> = {}): ConstructorStruct {
  return {
    name: "MooveToken",
    symbol: "MOV",
    teamAddress: 0,
    DAOAddress: 0,
    treasuryAddress: 0,
    teamMintSupply: 1_000_000,
    cap: 5_000_000,
    olderUsersMintSupply: 500_000,
    earlyAdopterMintSupply: 500_000,
    olderUsersAddresses: [],
    weeksOfVesting: 4,
    tokenPrice: ethers.utils.parseEther("0.001"),
    ...overrides,
  };
}

describe("GovernanceToken", function () {
  let governanceToken;
  let owner;
  let team;
  let numberOfOlderUsers = 10; //process.env.NUMBER_OF_OLDER_USERS;

  beforeEach(async function () {
    const [owner, team, ...users] = await ethers.getSigners();
    const olderUsersAddresses = users.slice(0, { numberOfOlderUsers }).map((user: SignerWithAddress) => user.address);
    //assegnare i vari address team e owner
    const GovernanceToken = await ethers.getConractFactory("GovernanceToken");

    const params = getDefaultParams(olderUsersAddresses);

    governanceToken = await GovernanceToken.deploy(...Object.values(params));
    await governanceToken.deployed();
  });
});
