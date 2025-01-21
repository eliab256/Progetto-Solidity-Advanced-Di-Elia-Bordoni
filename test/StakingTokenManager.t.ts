const { ethers } = require("hardhat");
const { expect } = require("chai");
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { StakingTokenManager } from "../typechain-types/contracts";
import { GovernanceToken } from "../typechain-types/contracts";

describe("StakingTokenManager", function () {
  let stakingTokenManager: StakingTokenManager & Contract;
  let team: SignerWithAddress;
  let DAO: SignerWithAddress;
  let token: GovernanceToken;
  let externalUser1: SignerWithAddress;
  let externalUser2: SignerWithAddress;
  let slashingPercent: number;

  this.beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    DAO = signers[0];
    team = signers[1];
    //token = signers[2];
    externalUser1 = signers[3];
    externalUser2 = signers[3];
    slashingPercent = 50;

    stakingTokenManager = await ethers.deployContract("StakingTokenManager", [
      team.address,
      //token.address,
      slashingPercent,
    ]);
    await stakingTokenManager.depolyed();
  });

  it("should deploy StakingTokenManager correctly", async function () {
    const deployedAddress = await stakingTokenManager.address;
    expect(deployedAddress).to.be.properAddress;

    console.log("Contract deployed successfully:", stakingTokenManager.address);
  });
});
