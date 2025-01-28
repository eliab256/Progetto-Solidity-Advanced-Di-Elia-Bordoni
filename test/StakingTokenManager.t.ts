const { ethers } = require("hardhat");
const { expect } = require("chai");
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { StakingTokenManager } from "../typechain-types/contracts";
import { GovernanceToken } from "../typechain-types/contracts";
import { TreasuryDAO } from "../typechain-types/contracts";

interface ConstructorGovernanceTokenStruct {
  name: string;
  symbol: string;
  teamAddress: string;
  treasuryAddress: string;
  teamMintSupply: bigint;
  cap: bigint;
  olderUsersMintSupply: bigint;
  earlyAdopterMintSupply: bigint;
  olderUsersAddresses: string[];
  weeksOfVesting: number;
}

function getDefaultParams(overrides: Partial<ConstructorGovernanceTokenStruct> = {}): ConstructorGovernanceTokenStruct {
  return {
    name: "MooveToken",
    symbol: "MOV",
    teamAddress: "",
    treasuryAddress: "",
    teamMintSupply: BigInt(4000000),
    cap: BigInt(10000000),
    olderUsersMintSupply: BigInt(1000000),
    earlyAdopterMintSupply: BigInt(1000000),
    olderUsersAddresses: [],
    weeksOfVesting: 4,
    ...overrides,
  };
}
describe("StakingTokenManager", function () {
  let stakingTokenManager: StakingTokenManager & Contract;
  let team: SignerWithAddress;
  let DAO: SignerWithAddress;
  let tokenContract: GovernanceToken;
  let treasuryContract: TreasuryDAO;
  let externalUser1: SignerWithAddress;
  let externalUser2: SignerWithAddress;
  let olderUsersAddresses: string[];
  let slashingPercent: number;
  let numberOfOlderUsers: number;

  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    DAO = signers[0];
    team = signers[1];
    externalUser1 = signers[2];
    externalUser2 = signers[3];
    numberOfOlderUsers = 10;
    const olderUsersAddressesTest = signers
      .slice(4, 4 + numberOfOlderUsers)
      .map((user: SignerWithAddress) => user.address);

    const TreasuryDAO = await ethers.getContractFactory("TreasuryDAO");
    treasuryContract = (await TreasuryDAO.deploy(team.address)) as TreasuryDAO & Contract;
    await treasuryContract.waitForDeployment();

    const params: ConstructorGovernanceTokenStruct = getDefaultParams({
      teamAddress: team.address,
      treasuryAddress: treasuryContract.target as string,
      olderUsersAddresses: olderUsersAddressesTest,
    });

    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
    tokenContract = (await GovernanceToken.deploy(params)) as GovernanceToken & Contract;
    await tokenContract.waitForDeployment();

    slashingPercent = 50;

    stakingTokenManager = await ethers.deployContract("StakingTokenManager", [
      team.address,
      tokenContract.target,
      slashingPercent,
    ]);
    await stakingTokenManager.waitForDeployment();
  });

  describe("constructor and deploy", async function () {
    it("should deploy the contract with correct parameters", async function () {
      expect(await stakingTokenManager.i_Owner()).to.equal(team.address);
      expect(await stakingTokenManager.i_tokenContract()).to.equal(tokenContract.target);
      expect(await stakingTokenManager.i_DAOContract()).to.equal(DAO.address);
      expect(await stakingTokenManager.i_slashingPercent()).to.equal(slashingPercent);
    });

    it("should emit the event of deploy", async function () {});
  });

  // describe("staking and locking functions", async function () {
  //   it("external user should be able to stake his tokens", async function () {});

  //   it("external user should be able to unstake his stokens", async function () {});

  //   it("external user shouldn' t be able to unstake his stokens if they are locked", async function () {});

  //   it("dao should be able to lock his tokens staked", async function () {});

  //   it("dao should be able to unlock his tokens staked", async function () {});

  //   it("user should be able to check if token are staked or not", async function () {});

  //   it("user should be able to check if token are locked or not", async function () {});
  // });

  // it("dao should be able to slash tokens", async function () {});

  // it("receive function should revert and suuggest dao contract to send ETH", async function () {});

  // it("fallback function should revert and suuggest dao contract to send ETH", async function () {});
});
