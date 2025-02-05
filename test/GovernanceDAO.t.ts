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

function decimalsDivider(value: number | bigint): bigint {
  return BigInt(value) / BigInt(10 ** 18);
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
    minimumTokenStakedToMakeAProposal: BigInt(20),
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
  let externalUser3: SignerWithAddress;
  let numberOfOlderUsers = 10;

  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    team = signers[0];
    externalUser1 = signers[1];
    externalUser2 = signers[2];
    externalUser3 = signers[3];
    const olderUsersAddresses = signers.slice(4, 4 + numberOfOlderUsers).map((user: SignerWithAddress) => user.address);

    const GovernanceDAO = await ethers.getContractFactory("GovernanceDAO");

    const params = getDefaultParams({ olderUsersAddresses });

    governanceDAO = (await GovernanceDAO.deploy(params)) as GovernanceDAO & Contract;

    await governanceDAO.waitForDeployment();

    governanceToken = await ethers.getContractAt("GovernanceToken", await governanceDAO.MooveToken());
    treasuryDAO = await ethers.getContractAt("TreasuryDAO", await governanceDAO.MooveTreasury());
    stakingTokenManager = await ethers.getContractAt("StakingTokenManager", await governanceDAO.MooveStakingManager());
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
  });

  describe("view functions", async function () {
    let extUser1Proposer: string;
    let extUser2Delegatee: string;
    let extUser3Delegator: string;
    let extUser3TokenBalance: bigint;
    let validProposalId: number;
    let invalidProposalId: number;
    beforeEach(async function () {
      const extUsersETHIntialBalance = getEtherValue(1000);

      extUser1Proposer = externalUser1.address;
      extUser2Delegatee = externalUser2.address;
      extUser3Delegator = externalUser3.address;

      await setBalance(extUser1Proposer, extUsersETHIntialBalance);
      await setBalance(extUser2Delegatee, extUsersETHIntialBalance);
      await setBalance(extUser3Delegator, extUsersETHIntialBalance);

      const tokenBuyAmountInWei = extUsersETHIntialBalance / BigInt(10);

      console.log("inital eth balance in eth:", extUsersETHIntialBalance);
      console.log("token buy in eth          ", decimalsDivider(tokenBuyAmountInWei));
      console.log("token buy in wei          ", tokenBuyAmountInWei);
      console.log("token da stakare in token ", decimalsDivider(await governanceDAO.minimumTokenStakedToMakeAProposal()));
      console.log("user1 address", externalUser1.address);

      await governanceDAO.connect(externalUser1).buyToken({ value: tokenBuyAmountInWei });
      await governanceDAO.connect(externalUser2).buyToken({ value: tokenBuyAmountInWei });
      await governanceDAO.connect(externalUser3).buyToken({ value: tokenBuyAmountInWei });

      console.log("amount to send        ", tokenBuyAmountInWei / (await governanceDAO.tokenPrice()));
      console.log("tokenPrice:           ", await governanceDAO.tokenPrice());
      console.log("tokenPrice in eth:    ", decimalsDivider(await governanceDAO.tokenPrice()));
      console.log("token balance extUser1", await governanceToken.balanceOf(extUser1Proposer));
      console.log("token balance extUser2", await governanceToken.balanceOf(extUser2Delegatee));
      console.log("token balance extUser3", await governanceToken.balanceOf(extUser3Delegator));

      const tokenAmountToStake = await governanceDAO.minimumTokenStakedToMakeAProposal();

      await governanceToken.connect(externalUser1).approve(stakingTokenManager, tokenBuyAmountInWei);
      await stakingTokenManager.connect(externalUser1).stakeTokens(tokenAmountToStake);
      await governanceToken.connect(externalUser2).approve(stakingTokenManager, tokenBuyAmountInWei);
      await stakingTokenManager.connect(externalUser2).stakeTokens(tokenAmountToStake);
      await governanceToken.connect(externalUser3).approve(stakingTokenManager, tokenBuyAmountInWei);
      await stakingTokenManager.connect(externalUser3).stakeTokens(BigInt(2));

      validProposalId = 1;
      invalidProposalId = 100;
    });
    it("should return if vote periodod is active or not on a proposal", async function () {
      expect(await governanceDAO.connect(externalUser1).getVotePeriodActive(validProposalId)).to.equal(true);
    });
    it("should revert if proposal Id is not valid", async function () {
      await expect(governanceDAO.connect(externalUser1).getVotePeriodActive(invalidProposalId)).to.be.revertedWithCustomError(
        governanceDAO,
        "GovernanceDAO__InvalidId"
      );
    });
    it("should return if address is delegator or not", async function () {
      expect(await governanceDAO.connect(externalUser1).checkIfDelegator(extUser2Delegatee)).to.equal(false);
      expect(await governanceDAO.connect(externalUser1).checkIfDelegator(extUser3Delegator)).to.equal(true);
    });
    it("should return if address is delegatee or not", async function () {
      expect(await governanceDAO.connect(externalUser1).checkIfDelegator(extUser2Delegatee)).to.equal(true);
      expect(await governanceDAO.connect(externalUser1).checkIfDelegator(extUser3Delegator)).to.equal(false);
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
      const tokenPrice = await governanceDAO.tokenPrice();
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
      expect(await treasuryDAO.getBalance()).to.equal(extUser1ETHToBuyTokens); //eth used to purchase token are sent to treasury

      expect(await governanceToken.connect(team).getElegibleForClaimsArray(externalUser1.address)).to.equal(true);
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
      const extUser1ETHintialBalance = getEtherValue(10);
      const extUser1ETHToBuyTokens = getEtherValue(1);
      await setBalance(externalUser1.address as string, extUser1ETHintialBalance);
      const extUser2ETHintialBalance = getEtherValue(10);
      const extUser2ETHToBuyTokens = getEtherValue(1);
      await setBalance(externalUser2.address as string, extUser2ETHintialBalance);

      const tx = await governanceDAO.connect(externalUser1).buyToken({ value: extUser1ETHToBuyTokens });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt is null");

      const tx2 = await governanceDAO.connect(externalUser2).buyToken({ value: extUser2ETHToBuyTokens });
      const receipt2 = await tx2.wait();
      if (!receipt2) throw new Error("Transaction receipt is null");
      expect(await governanceToken.elegibleForClaimsArray(0)).to.equal(externalUser1.address);
      expect(await governanceToken.elegibleForClaimsArray(1)).to.equal(externalUser2.address);
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

  // describe("proposals functions", async function () {
  //   beforeEach(async function () {
  //     const minTokenToMakeProp = await governanceDAO.minimumTokenStakedToMakeAProposal();
  //     const extUser1ETHintialBalance = getEtherValue(1000);
  //     const extUser1ETHToBuyTokens = minTokenToMakeProp + getEtherValue(1);
  //     console.log("eth balance user 1", extUser1ETHintialBalance);
  //     console.log("eth to buy token  ", extUser1ETHToBuyTokens);
  //     await setBalance(externalUser1.address as string, extUser1ETHintialBalance);

  //     const tx = await governanceDAO.connect(externalUser1).buyToken({ value: extUser1ETHToBuyTokens });
  //     const receipt = await tx.wait();
  //     if (!receipt) throw new Error("Transaction receipt is null");

  //     console.log("token amount user1:", await governanceToken.balanceOf(externalUser1.address));

  //     await stakingTokenManager.connect(externalUser1).stakeTokens(extUser1ETHToBuyTokens);
  //   });
  //   it("should allow users to make proposals", async function () {
  //     const proposalDescription = "proposal description";
  //     const tx = await governanceDAO.connect(externalUser1).makeProposal(proposalDescription);
  //     const receipt = await tx.wait();
  //     if (!receipt) throw new Error("Transaction receipt is null");

  //     await expect(tx)
  //       .to.emit(governanceDAO, "ProposalCreated")
  //       .withArgs(
  //         externalUser1.address,
  //         0,
  //         proposalDescription,
  //         await getLatestBlockTimestamp(),
  //         BigInt(await getLatestBlockTimestamp()) + (await governanceDAO.daysofVoting())
  //       );
  //   });

  //   it("should revert if proposer has not enough token staked", async function () {
  //     await expect(governanceDAO.connect(externalUser2).makeProposal("proposal description"))
  //       .to.be.revertedWithCustomError(governanceDAO, "GovernanceDAO__NotEnoughtTokenStakedToMakeProposal")
  //       .withArgs(
  //         stakingTokenManager.getUserStakedTokens(externalUser2.address),
  //         governanceDAO.minimumTokenStakedToMakeAProposal()
  //       );
  //   });

  //   it("should revert if proposal has not description", async function () {
  //     await expect(governanceDAO.connect(externalUser2).makeProposal("proposal description")).to.be.revertedWithCustomError(
  //       governanceDAO,
  //       "GovernanceDao__DescriptionCannotBeEmpty"
  //     );

  //     it("should revert if proposer has another active proposal", async function () {
  //       const proposal1Description = "proposal description";
  //       const proposal2Description = "proposal 2 description";
  //       const tx1 = await governanceDAO.connect(externalUser1).makeProposal(proposal1Description);
  //       const receipt1 = await tx1.wait();
  //       if (!receipt1) throw new Error("Transaction receipt is null");

  //       await expect(governanceDAO.connect(externalUser1).makeProposal(proposal2Description)).to.be.revertedWithCustomError(
  //         governanceDAO,
  //         "GovernanceDAO__AnotherProposalStillActive"
  //       );
  //     });
  //   });
  // });

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
