const { ethers } = require("hardhat");
const { expect } = require("chai");
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { StakingTokenManager } from "../typechain-types/contracts";
import { GovernanceToken } from "../typechain-types/contracts";

interface ConstructorTokenStruct {
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

describe("StakingTokenManager", function () {
  let stakingTokenManager: StakingTokenManager & Contract;
  let team: SignerWithAddress;
  let DAO: SignerWithAddress;
  let tokenContract: GovernanceToken;
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
    olderUsersAddresses = signers.slice(4, 4 + numberOfOlderUsers).map((user: SignerWithAddress) => user.address);

    slashingPercent = 50;

    stakingTokenManager = await ethers.deployContract("StakingTokenManager", [
      team.address,
      //tokenContract.target,
      slashingPercent,
    ]);
    await stakingTokenManager.waitForDeployment();
  });

  describe("constructor and deploy", async function () {
    it("should deploy the contract with correct parameters", async function () {});

    it("should emit the event of deploy", async function () {});
  });

  describe("staking and locking functions", async function () {
    it("external user should be able to stake his tokens", async function () {});

    it("external user should be able to unstake his stokens", async function () {});

    it("external user shouldn' t be able to unstake his stokens if they are locked", async function () {});

    it("dao should be able to lock his tokens staked", async function () {});

    it("dao should be able to unlock his tokens staked", async function () {});

    it("user should be able to check if token are staked or not", async function () {});

    it("user should be able to check if token are locked or not", async function () {});
  });

  it("dao should be able to slash tokens", async function () {});

  it("receive function should revert and suuggest dao contract to send ETH", async function () {});

  it("fallback function should revert and suuggest dao contract to send ETH", async function () {});
});
