const { ethers } = require("hardhat");
const { expect } = require("chai");
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { StakingTokenManager } from "../typechain-types/contracts";
import { GovernanceToken } from "../typechain-types/contracts";
import { TreasuryDAO } from "../typechain-types/contracts";
import { getLatestBlockTimestamp } from "../Utils/getTimeBlockStamp";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";

function getEtherValue(value: number): bigint {
  return ethers.parseEther(`${value.toString()}`);
}

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
    const olderUsersAddressesTest = signers.slice(4, 4 + numberOfOlderUsers).map((user: SignerWithAddress) => user.address);

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
  });

  describe("staking and locking functions", async function () {
    let extUser1Balance: bigint;
    let extUser1TokenStaked: bigint;
    beforeEach(async function () {
      extUser1Balance = BigInt(1000);
      extUser1TokenStaked = BigInt(400);
      await tokenContract.connect(DAO).sendingToken(externalUser1, extUser1Balance);
      await tokenContract.connect(externalUser1).approve(stakingTokenManager, extUser1Balance);
    });

    it("external user should be able to stake his tokens", async function () {
      expect(await stakingTokenManager.connect(externalUser1).stakeTokens(extUser1TokenStaked))
        .to.emit(stakingTokenManager, "TokensStaked")
        .withArgs(externalUser1.address, extUser1TokenStaked, getLatestBlockTimestamp());

      expect(await stakingTokenManager.connect(DAO).getUserStakedTokens(externalUser1.address)).to.equal(extUser1TokenStaked);
      expect(await tokenContract.balanceOf(externalUser1.address)).to.equal(extUser1Balance - extUser1TokenStaked);
    });
    it("external user should be able to unstake his stokens", async function () {
      await stakingTokenManager.connect(externalUser1).stakeTokens(extUser1TokenStaked);

      expect(await stakingTokenManager.connect(externalUser1).unstakeTokens(extUser1TokenStaked))
        .to.emit(stakingTokenManager, "TokensUnstaked")
        .withArgs(externalUser1.address, extUser1TokenStaked, getLatestBlockTimestamp());
    });

    it("external user shouldn' t be able to unstake his stokens if they are locked", async function () {
      await stakingTokenManager.connect(externalUser1).stakeTokens(extUser1TokenStaked);
      await stakingTokenManager.connect(DAO).lockStakedTokens(externalUser1);
      await expect(stakingTokenManager.connect(externalUser1).unstakeTokens(extUser1TokenStaked)).to.revertedWithCustomError(
        stakingTokenManager,
        "StakingTokenManager__TokensLockedDueToActiveProposal"
      );
    });
    it("dao should be able to lock user tokens staked", async function () {
      await stakingTokenManager.connect(externalUser1).stakeTokens(extUser1TokenStaked);
      expect(await stakingTokenManager.connect(DAO).lockStakedTokens(externalUser1))
        .to.emit(stakingTokenManager, "TokenLocked")
        .withArgs(externalUser1, getLatestBlockTimestamp);
      expect(await stakingTokenManager.connect(DAO).checkIfTokensAreLocked(externalUser1)).to.equal(true);
    });
    it("should revert if tokens are already locked", async function () {
      await stakingTokenManager.connect(externalUser1).stakeTokens(extUser1TokenStaked);
      await stakingTokenManager.connect(DAO).lockStakedTokens(externalUser1);
      await expect(stakingTokenManager.connect(DAO).lockStakedTokens(externalUser1)).to.revertedWithCustomError(
        stakingTokenManager,
        "StakingTokenManager__TokensAlreadyLocked"
      );
    });
    it("should revert if there is no tokens to lock", async function () {
      await expect(stakingTokenManager.connect(DAO).lockStakedTokens(externalUser1)).to.revertedWithCustomError(
        stakingTokenManager,
        "StakingTokenManager__NoTokensToLock"
      );
    });
    it("dao should be able to unlock his tokens staked", async function () {
      await stakingTokenManager.connect(externalUser1).stakeTokens(extUser1TokenStaked);
      await stakingTokenManager.connect(DAO).lockStakedTokens(externalUser1);
      expect(await stakingTokenManager.connect(DAO).unlockStakedTokens(externalUser1))
        .to.emit(stakingTokenManager, "TokenUnlocked")
        .withArgs(externalUser1.address, getLatestBlockTimestamp);
      expect(await stakingTokenManager.connect(DAO).checkIfTokensAreLocked(externalUser1)).to.equal(false);
    });
    it("user should be able to check if token are staked or not", async function () {
      await stakingTokenManager.connect(externalUser1).stakeTokens(extUser1TokenStaked);
      expect(await stakingTokenManager.connect(externalUser2).getUserStakedTokens(externalUser1.address)).to.equal(
        extUser1TokenStaked
      );
    });
    it("user should be able to check if token are locked or not", async function () {
      expect(await stakingTokenManager.connect(externalUser2).checkIfTokensAreLocked(externalUser1.address)).to.equal(false);
    });
  });

  it("dao should be able to slash tokens", async function () {
    const extUser1Balance = BigInt(1000);
    const extUser1TokenStaked = BigInt(400);
    const slashingTarget = externalUser1.address;
    const slashingAmount = (extUser1TokenStaked * BigInt(slashingPercent)) / BigInt(100);
    await tokenContract.connect(DAO).sendingToken(externalUser1, extUser1Balance);
    await tokenContract.connect(externalUser1).approve(stakingTokenManager, extUser1Balance);
    await stakingTokenManager.connect(externalUser1).stakeTokens(extUser1TokenStaked);
    expect(await stakingTokenManager.connect(DAO).tokenSlasher(slashingTarget))
      .to.emit(stakingTokenManager, "TokenSlashed")
      .withArgs(slashingTarget, slashingAmount, getLatestBlockTimestamp);
  });

  it("receive function should revert and suuggest dao contract to send ETH", async function () {
    await setBalance(externalUser1.address as string, getEtherValue(100));
    const amountSent = getEtherValue(50);
    await expect(
      externalUser1.sendTransaction({
        to: stakingTokenManager,
        value: amountSent,
      })
    )
      .to.be.revertedWithCustomError(stakingTokenManager, "StakingTokenManager__SendETHToGovernanceContractToBuyTokens")
      .withArgs(DAO.address);
    expect(await ethers.provider.getBalance(stakingTokenManager.target)).to.equal(0);
  });

  it("fallback function should revert and suggest dao contract to send ETH", async function () {
    await setBalance(externalUser1.address as string, getEtherValue(100));
    const amountSent = getEtherValue(50);
    const randomData = ethers.hexlify(ethers.randomBytes(8));
    await expect(
      externalUser1.sendTransaction({
        to: stakingTokenManager,
        value: amountSent,
        data: randomData,
      })
    )
      .to.be.revertedWithCustomError(stakingTokenManager, `StakingTokenManager__UseGovernanceContractToInteractWithTheDAO`)
      .withArgs(DAO.address);
    expect(await ethers.provider.getBalance(stakingTokenManager.target)).to.equal(0);
  });
});
