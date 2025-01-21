const { ethers } = require("hardhat");
const { expect } = require("chai");
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { GovernanceToken } from "../typechain-types/contracts";
import { Contract } from "ethers";

interface ConstructorStruct {
  name: string;
  symbol: string;
  teamAddress: string;
  treasuryAddress: string;
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
    teamAddress: "0x0000000000000000000000000000000000000000",
    treasuryAddress: "0x0000000000000000000000000000000000000000",
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
  let governanceToken: GovernanceToken & Contract;
  let owner: SignerWithAddress;
  let team: SignerWithAddress;
  let DAO: SignerWithAddress;
  let treasury: SignerWithAddress;
  let numberOfOlderUsers = 10; //process.env.NUMBER_OF_OLDER_USERS;

  beforeEach(async function () {
    const [DAO, team, treasury, ...users] = await ethers.getSigners();
    const olderUsersAddresses = users.slice(0, { numberOfOlderUsers }).map((user: SignerWithAddress) => user.address);

    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");

    const params = getDefaultParams({
      teamAddress: team.address,
      treasuryAddress: treasury.address,
      olderUsersAddresses: olderUsersAddresses,
    });

    governanceToken = (await GovernanceToken.deploy(...Object.values(params))) as GovernanceToken & Contract;
    await governanceToken.deployed();
  });

  it("should deploy the contract with correct parameters", async function () {
    expect(await governanceToken.name()).to.equal("MooveToken");
    expect(await governanceToken.symbol()).to.equal("MOV");
    expect(await governanceToken.cap()).to.equal(ethers.BigNumber.from(5_000_000));
  });
});
