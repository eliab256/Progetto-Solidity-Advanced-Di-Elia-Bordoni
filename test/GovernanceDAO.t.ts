const { ethers } = require("hardhat");
const { expect } = require("chai");
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { GovernanceDAO } from "../typechain-types/contracts";
import { GovernanceToken } from "../typechain-types/contracts";
import { TreasuryDAO } from "../typechain-types/contracts";
import { StakingTokenManager } from "../typechain-types/contracts";
import { Contract } from "ethers";
import { getLatestBlockTimestamp } from "../Utils/getTimeBlockStamp";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";

function getEtherValue(value: number): bigint {
  return ethers.parseEther(`${value.toString()}`);
}

function decimalsMultiplier(value: number | bigint): bigint {
  return BigInt(value) * BigInt(10 ** 18);
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
  let governanceDAO: GovernanceDAO & Contract;
  let governanceToken: GovernanceToken & Contract;
  let stakingTokenManager: StakingTokenManager & Contract;
  let treasuryDAO: TreasuryDAO & Contract;
  let team: SignerWithAddress;
  let externalUser1: SignerWithAddress;
  let externalUser2: SignerWithAddress;
  let numberOfOlderUsers = 10;

  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    team = signers[0];
    externalUser1 = signers[1];
    externalUser2 = signers[2];
    const olderUsersAddresses = signers.slice(3, 3 + numberOfOlderUsers).map((user: SignerWithAddress) => user.address);

    const GovernanceDAO = await ethers.getContractFactory("GovernanceDAO");

    const params = getDefaultParams({ olderUsersAddresses });

    governanceDAO = (await GovernanceDAO.deploy(params)) as GovernanceDAO & Contract;

    await governanceDAO.waitForDeployment();

    governanceToken = await ethers.getContractAt("GovernanceToken", await governanceDAO.MooveToken());
    treasuryDAO = await ethers.getContractAt("GovernanceToken", await governanceDAO.MooveTreasury());
    stakingTokenManager = await ethers.getContractAt("GovernanceToken", await governanceDAO.MooveStakingManager());
  });
  describe("constructor and deploy", async function () {
    it("should deploy the contract with correct parameters", async function () {
      expect(await governanceDAO.i_Owner()).to.equal(team.address);
      expect(await governanceDAO.minimumTokenStakedToMakeAProposal()).to.equal(
        decimalsMultiplier(getDefaultParams().minimumTokenStakedToMakeAProposal)
      );
      expect(await governanceDAO.minimumCirculatingSupplyToMakeAProposalInPercent()).to.equal(
        getDefaultParams().minimumCirculatingSupplyToMakeAProposalInPercent
      );
      expect(await governanceDAO.daysofVoting()).to.equal(getDefaultParams().votingPeriodInDays * 86400);
      expect(await governanceDAO.tokenPrice()).to.equal(getDefaultParams().tokenPrice);
    });

    it("should deploy token contract correctly", async function () {
      await expect(governanceDAO.MooveToken()).to.not.equal(0x0000000000000000000000000000000000000000);

      expect(await governanceToken.i_Owner()).to.equal(team.address);
      expect(await governanceToken.i_DAOContract()).to.equal(governanceDAO.target);
    });

    it("should deploy staking contract correctly", async function () {
      await expect(governanceDAO.MooveTreasury()).to.not.equal(0x0000000000000000000000000000000000000000);

      expect(await treasuryDAO.i_Owner()).to.equal(team.address);
      expect(await treasuryDAO.i_DAOContract()).to.equal(governanceDAO.target);
    });

    it("should deploy treasury contract correctly", async function () {
      await expect(governanceDAO.MooveStakingManager()).to.not.equal(0x0000000000000000000000000000000000000000);

      expect(await stakingTokenManager.i_Owner()).to.equal(team.address);
      expect(await stakingTokenManager.i_DAOContract()).to.equal(governanceDAO.target);
    });

    it("should emit the event of deploys", async function () {
      expect(false).to.equal(true);
    });
  });

  describe("token trading functions", async function () {
    it("team should be to change trading status", async function () {
      expect(await governanceDAO.isTradingAllowed()).to.equal(true);
      expect(await governanceDAO.connect(team).changeTradingStatus())
        .to.emit(governanceDAO, "TradingStatusChanged")
        .withArgs(false, getLatestBlockTimestamp);
      expect(await governanceDAO.isTradingAllowed()).to.equal(false);
    });
    it("users should be able to buy tokens", async function () {
      const tokenPrice = decimalsMultiplier(await governanceDAO.tokenPrice());
      const extUser1ETHintialBalance = getEtherValue(10);
      const extUser1ETHToBuyTokens = getEtherValue(1);
      const tokenBuyAmount = extUser1ETHToBuyTokens / tokenPrice;
      await setBalance(externalUser1.address as string, extUser1ETHintialBalance);

      const tx = await governanceDAO.connect(externalUser1).buyToken({ value: extUser1ETHToBuyTokens });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt is null");

      await expect(tx)
        .to.emit(governanceDAO, "TokenPurchased")
        .withArgs(externalUser1.address, tokenBuyAmount, await getLatestBlockTimestamp());
      expect(await governanceToken.balanceOf(externalUser1.address)).to.equal(tokenBuyAmount);
      expect(await ethers.provider.getBalance(treasuryDAO.target)).to.equal(extUser1ETHToBuyTokens);
    });

    it("should revert if try to buy token when trading is not allowed", async function () {
      const extUser1ETHintialBalance = getEtherValue(10);
      const extUser1ETHToBuyTokens = getEtherValue(1);
      await setBalance(externalUser1.address as string, extUser1ETHintialBalance);
      await governanceDAO.connect(team).changeTradingStatus(); //trading status set on false
      await expect(
        governanceDAO.connect(externalUser1).buyToken({ value: extUser1ETHToBuyTokens })
      ).to.be.revertedWithCustomError(governanceDAO, "GovernanceDAO__TradingIsNotAllowed");
    });
    it("should revert if try to buy more tokens than contract balance", async function () {
      const extUser1ETHintialBalance = getEtherValue(10000000);
      const contractBalance = await governanceToken.balanceOf(governanceDAO.target);
      const extUser1ETHToBuyTokens = contractBalance + getEtherValue(1);
      await setBalance(externalUser1.address as string, extUser1ETHintialBalance);
      await expect(
        governanceDAO.connect(externalUser1).buyToken({ value: extUser1ETHToBuyTokens })
      ).to.be.revertedWithCustomError(governanceDAO, "GovernanceDAO__InsufficientAmountOfTokenOnContract");
    });

    it("buy token should update elegibleAddress on token contract", async function () {
      expect(true).to.equal(false);
    });

    it("should allow users to deposit ETH", async function () {
      const extUser1ETHIntialBalance = getEtherValue(10);
      const depositAmount = getEtherValue(6);
      await setBalance(externalUser1.address as string, extUser1ETHIntialBalance);

      const tx = await governanceDAO.connect(externalUser1).depositETH({ value: depositAmount });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt is null");
      await expect(tx)
        .to.emit(governanceDAO, "ETHDeposit")
        .withArgs(depositAmount, externalUser1.address, await getLatestBlockTimestamp());
    });

    it("should revert if user try to deposit 0 ETH", async function () {
      const extUser1ETHIntialBalance = getEtherValue(10);
      const depositAmount = getEtherValue(0);
      await setBalance(externalUser1.address as string, extUser1ETHIntialBalance);

      await expect(governanceDAO.connect(externalUser1).depositETH({ value: depositAmount })).to.revertedWithCustomError(
        governanceDAO,
        "GovernanceDAO__InvalidInputValue"
      );
    });

    it("team should be able to send ETH to the treasury", async function () {
      const governancDaoInitialBalance = getEtherValue(10);
      const amountToTransferToTheTreasury = getEtherValue(8);
      await setBalance(governanceDAO.target as string, governancDaoInitialBalance);

      const tx = await governanceDAO.connect(team).sendETHToTreasuryAsOwner(amountToTransferToTheTreasury);
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt is null");
      await expect(tx)
        .to.emit(governanceDAO, "SuccesfulTransferToTreasury")
        .withArgs(amountToTransferToTheTreasury, await getLatestBlockTimestamp());
    });
  });

  describe("proposals functions", async function () {
    it("should allow users to make proposals", async function () {});
  });

  it("should revert if someone except DAO try to add funds", async function () {
    const contractInitialBalance = await ethers.provider.getBalance(governanceDAO.target);
    const extUser1InitialBalance = getEtherValue(11);
    const amountSent = getEtherValue(10);
    await setBalance(externalUser1.address as string, extUser1InitialBalance);
    await expect(
      externalUser1.sendTransaction({
        to: governanceDAO.target,
        value: amountSent,
      })
    ).to.be.revertedWithCustomError(governanceDAO, "GovernanceDAO__ToSendETHUseDepositFunction");
    expect(await ethers.provider.getBalance(governanceDAO.target)).to.equal(contractInitialBalance);
  });

  it("fallback should revert", async function () {
    const contractInitialBalance = await ethers.provider.getBalance(governanceDAO.target);
    const extUser1InitialBalance = getEtherValue(11);
    const amountSent = getEtherValue(10);
    const randomData = ethers.hexlify(ethers.randomBytes(8));
    await setBalance(externalUser1.address as string, extUser1InitialBalance);
    await expect(
      externalUser1.sendTransaction({
        to: governanceDAO.target,
        value: amountSent,
        data: randomData,
      })
    ).and.to.be.revertedWithCustomError(governanceDAO, `GovernanceDAO__NoFunctionCalled`);
    expect(await ethers.provider.getBalance(governanceDAO.target)).to.equal(contractInitialBalance);
  });
});
