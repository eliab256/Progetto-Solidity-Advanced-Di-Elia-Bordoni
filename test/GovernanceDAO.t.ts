const { ethers } = require("hardhat");
const { expect } = require("chai");
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { GovernanceDAO } from "../typechain-types/contracts";
import { GovernanceToken } from "../typechain-types/contracts";
import { TreasuryDAO } from "../typechain-types/contracts";
import { StakingTokenManager } from "../typechain-types/contracts";
import { Contract, ContractTransactionResponse } from "ethers";
import { getLatestBlockTimestamp } from "../Utils/getTimeBlockStamp";
import { setBalance, time, mine } from "@nomicfoundation/hardhat-network-helpers";

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
    minimumCirculatingSupplyToMakeAProposalInPercent: BigInt(50),
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
  let externalUser4: SignerWithAddress;
  let externalUser5: SignerWithAddress;
  let numberOfOlderUsers = 10;
  let extUser1Proposer: string;
  let extUser2Delegatee: string;
  let extUser3Delegator: string;
  let extUser4NormalVoter: string;
  let extUser5SecondDelegatee: string;
  let validProposalId: number;
  let invalidProposalId: number;
  let buyTokenUser1: ContractTransactionResponse;
  let buyTokenUser2: ContractTransactionResponse;
  let buyTokenUser3: ContractTransactionResponse;
  let firstProposal: ContractTransactionResponse;
  let firstApplyForDelegatee: ContractTransactionResponse;
  let firstDelegateVote: ContractTransactionResponse;
  let tokenBuyAmountInWei: bigint;
  let proposalDescription: string;
  beforeEach(async function () {
    //create contracts and addresses
    const signers: SignerWithAddress[] = await ethers.getSigners();
    team = signers[0];
    externalUser1 = signers[1];
    externalUser2 = signers[2];
    externalUser3 = signers[3];
    externalUser4 = signers[4];
    externalUser5 = signers[5];
    const olderUsersAddresses = signers.slice(6, 6 + numberOfOlderUsers).map((user: SignerWithAddress) => user.address);

    const GovernanceDAO = await ethers.getContractFactory("GovernanceDAO");

    const params = getDefaultParams({ olderUsersAddresses });

    governanceDAO = (await GovernanceDAO.deploy(params)) as GovernanceDAO & Contract;

    await governanceDAO.waitForDeployment();

    governanceToken = await ethers.getContractAt("GovernanceToken", await governanceDAO.MooveToken());
    treasuryDAO = await ethers.getContractAt("TreasuryDAO", await governanceDAO.MooveTreasury());
    stakingTokenManager = await ethers.getContractAt("StakingTokenManager", await governanceDAO.MooveStakingManager());
  });

  describe("deploy, proposals and view functions", function () {
    beforeEach(async function () {
      //adding token to each account
      const extUsersETHIntialBalance = getEtherValue(1000);

      extUser1Proposer = externalUser1.address;
      extUser2Delegatee = externalUser2.address;
      extUser3Delegator = externalUser3.address;
      extUser4NormalVoter = externalUser4.address;
      extUser5SecondDelegatee = externalUser5.address;

      await setBalance(extUser1Proposer, extUsersETHIntialBalance);
      await setBalance(extUser2Delegatee, extUsersETHIntialBalance);
      await setBalance(extUser3Delegator, extUsersETHIntialBalance);
      await setBalance(extUser4NormalVoter, extUsersETHIntialBalance);
      await setBalance(extUser5SecondDelegatee, extUsersETHIntialBalance);

      tokenBuyAmountInWei = extUsersETHIntialBalance / BigInt(10);

      buyTokenUser1 = await governanceDAO.connect(externalUser1).buyToken({ value: tokenBuyAmountInWei });
      const receipt = await buyTokenUser1.wait();
      if (!receipt) throw new Error("Transaction receipt is null");
      buyTokenUser2 = await governanceDAO.connect(externalUser2).buyToken({ value: tokenBuyAmountInWei });
      const receipt2 = await buyTokenUser2.wait();
      if (!receipt2) throw new Error("Transaction receipt is null");
      buyTokenUser3 = await governanceDAO.connect(externalUser3).buyToken({ value: tokenBuyAmountInWei });
      const receipt3 = await buyTokenUser3.wait();
      if (!receipt3) throw new Error("Transaction receipt is null");

      const minimimTokenStakedToMakeProposa = await governanceDAO.minimumTokenStakedToMakeAProposal();
      const tokenAmountToStake = minimimTokenStakedToMakeProposa;

      await governanceToken.connect(externalUser1).approve(stakingTokenManager, tokenBuyAmountInWei);
      await stakingTokenManager.connect(externalUser1).stakeTokens(tokenAmountToStake);
      await governanceToken.connect(externalUser2).approve(stakingTokenManager, tokenBuyAmountInWei);
      await stakingTokenManager.connect(externalUser2).stakeTokens(tokenAmountToStake);
      await governanceToken.connect(externalUser3).approve(stakingTokenManager, tokenBuyAmountInWei);
      await stakingTokenManager.connect(externalUser3).stakeTokens(BigInt(2));

      validProposalId = 1;
      invalidProposalId = 100;
      proposalDescription = "proposal description";

      firstProposal = await governanceDAO.connect(externalUser1).makeProposal(proposalDescription);
      const receipt4 = await firstProposal.wait();
      if (!receipt4) throw new Error("Transaction receipt is null");
      firstApplyForDelegatee = await governanceDAO.connect(externalUser2).applyForDelegatee();
      const receipt5 = await firstApplyForDelegatee.wait();
      if (!receipt5) throw new Error("Transaction receipt is null");
      firstDelegateVote = await governanceDAO.connect(externalUser3).delegateVote(extUser2Delegatee);
      const receipt6 = await firstDelegateVote.wait();
      if (!receipt6) throw new Error("Transaction receipt is null");
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
      it("should revert deploy due to empty name section", async function () {
        const params: ConstructorStruct = getDefaultParams({
          name: "",
        });
        const governanceDAOTest = await ethers.getContractFactory("GovernanceDAO");
        await expect(governanceDAOTest.deploy(params)).to.be.revertedWithCustomError(
          governanceDAOTest,
          "GovernanceDAO__NameAndSymbolFieldsCantBeEmpty"
        );
      });
      it("should revert deploy due to empty symbol section", async function () {
        const params: ConstructorStruct = getDefaultParams({
          symbol: "",
        });
        const governanceDAOTest = await ethers.getContractFactory("GovernanceDAO");
        await expect(governanceDAOTest.deploy(params)).to.be.revertedWithCustomError(
          governanceDAOTest,
          "GovernanceDAO__NameAndSymbolFieldsCantBeEmpty"
        );
      });
      it("should revert deploy due to cap equal to zero", async function () {
        const params: ConstructorStruct = getDefaultParams({
          cap: BigInt(0),
        });
        const governanceDAOTest = await ethers.getContractFactory("GovernanceDAO");
        await expect(governanceDAOTest.deploy(params)).to.be.revertedWithCustomError(
          governanceDAOTest,
          "GovernanceDAO__InvalidInputValue"
        );
      });
      it("should revert deploy due to cap equal to zero", async function () {
        const params: ConstructorStruct = getDefaultParams({
          tokenPrice: BigInt(0),
        });
        const governanceDAOTest = await ethers.getContractFactory("GovernanceDAO");
        await expect(governanceDAOTest.deploy(params)).to.be.revertedWithCustomError(
          governanceDAOTest,
          "GovernanceDAO__InvalidInputValue"
        );
      });
      it("should revert deploy due to invalid minimum token staked amount", async function () {
        const params: ConstructorStruct = getDefaultParams({
          minimumTokenStakedToMakeAProposal: BigInt(0),
        });
        const governanceDAOTest = await ethers.getContractFactory("GovernanceDAO");
        await expect(governanceDAOTest.deploy(params)).to.be.revertedWithCustomError(
          governanceDAOTest,
          "GovernanceDAO__InvalidInputValue"
        );
      });
      it("should revert deploy due to invalid percents", async function () {
        const params: ConstructorStruct = getDefaultParams({
          proposalQuorumPercent: 110,
        });
        const governanceDAOTest = await ethers.getContractFactory("GovernanceDAO");
        await expect(governanceDAOTest.deploy(params)).to.be.revertedWithCustomError(
          governanceDAOTest,
          "GovernanceDAO__InvalidInputValue"
        );
        const params2: ConstructorStruct = getDefaultParams({
          slashingPercent: 110,
        });
        const governanceDAOTest2 = await ethers.getContractFactory("GovernanceDAO");
        await expect(governanceDAOTest.deploy(params2)).to.be.revertedWithCustomError(
          governanceDAOTest2,
          "GovernanceDAO__InvalidInputValue"
        );
      });
      it("should revert deploy due to no voting period", async function () {
        const params: ConstructorStruct = getDefaultParams({
          votingPeriodInDays: 0,
        });
        const governanceDAOTest = await ethers.getContractFactory("GovernanceDAO");
        await expect(governanceDAOTest.deploy(params)).to.be.revertedWithCustomError(
          governanceDAOTest,
          "GovernanceDAO__InvalidInputValue"
        );
      });
      it("should revert deploy due to no invalid older mint supply amount", async function () {
        const params: ConstructorStruct = getDefaultParams({
          olderUsersMintSupply: BigInt(1),
          //array of older users is automatically 0
        });
        const governanceDAOTest = await ethers.getContractFactory("GovernanceDAO");
        await expect(governanceDAOTest.deploy(params)).to.be.revertedWithCustomError(
          governanceDAOTest,
          "GovernanceDAO__OlderUsersListMustBeMoreThanZero"
        );
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
      it("should return the struct of proposal by ID", async function () {
        const proposalId = 1;
        const firstProposalCall = await governanceDAO.getProposalById(proposalId);
        expect(firstProposalCall.proposalId).to.equal(proposalId);
        expect(firstProposalCall.description).to.equal(proposalDescription);
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
        expect(await governanceDAO.connect(externalUser1).checkIfDelegatee(extUser2Delegatee)).to.equal(true);
        expect(await governanceDAO.connect(externalUser1).checkIfDelegatee(extUser3Delegator)).to.equal(false);
      });
      it("should check if delegator is on a specific list by delegatee", async function () {
        const result = await governanceDAO.connect(externalUser1).isSenderInDelegators(extUser2Delegatee, extUser3Delegator);
        expect(result[0]).to.equal(true);
        expect(result[1]).to.equal(0);
        const result2 = await governanceDAO.connect(externalUser1).isSenderInDelegators(extUser3Delegator, extUser1Proposer);
        expect(result2[0]).to.equal(false);
        expect(result2[1]).to.equal(0);
      });
      it("should get vote of voter by proposalId and if token staked are locked", async function () {
        const firstProposalCall = await governanceDAO.getProposalById(1);
        const proposalId = firstProposalCall.proposalId;
        await governanceDAO.connect(externalUser1).voteOnProposal(proposalId, 0); //inFavor
        await governanceDAO.connect(externalUser2).delegateeVoteOnProposal(proposalId, 1); //against

        expect(await governanceDAO.connect(externalUser1).checkVoteById(proposalId, extUser4NormalVoter)).to.equal(false);
        expect(await governanceDAO.connect(externalUser1).checkVoteById(proposalId, extUser2Delegatee)).to.equal(true);
        expect(await governanceDAO.connect(externalUser1).checkVoteById(proposalId, extUser3Delegator)).to.equal(false);
        expect(await governanceDAO.connect(externalUser1).checkVoteById(proposalId, extUser1Proposer)).to.equal(true);

        const buyTokenUser4 = await governanceDAO.connect(externalUser4).buyToken({ value: tokenBuyAmountInWei });
        const receipt = await buyTokenUser4.wait();
        if (!receipt) throw new Error("Transaction receipt is null");
        await governanceToken
          .connect(externalUser4)
          .approve(stakingTokenManager, await governanceToken.balanceOf(extUser4NormalVoter));
        await stakingTokenManager.connect(externalUser4).stakeTokens(await governanceToken.balanceOf(extUser4NormalVoter));
        expect(await stakingTokenManager.connect(externalUser1).checkIfTokensAreLocked(extUser4NormalVoter)).to.equal(false);
        await governanceDAO.connect(externalUser4).voteOnProposal(proposalId, 0);
        expect(await stakingTokenManager.connect(externalUser1).checkIfTokensAreLocked(extUser4NormalVoter)).to.equal(true);
      });
    });

    describe("proposals functions", async function () {
      it("should emit the event of proposal", async function () {
        expect(firstProposal)
          .to.emit(governanceDAO, "ProposalCreated")
          .withArgs(
            extUser1Proposer,
            1,
            proposalDescription,
            await getLatestBlockTimestamp(),
            BigInt(await getLatestBlockTimestamp()) + (await governanceDAO.daysofVoting())
          );
      });
      it("except dao should work correctly", async function () {
        const amount = await governanceDAO.minimumTokenStakedToMakeAProposal();
        await governanceToken.approve(stakingTokenManager, await governanceToken.balanceOf(governanceDAO.target));
        await stakingTokenManager.stakeTokens(amount);
        expect(await governanceDAO.makeProposal("proposaldescription")).to.revertedWithCustomError(
          governanceDAO,
          "GovernanceDAO__DAONotAuthorized"
        );
      });
      it("should revert if there isn't enough circulating supply to make a proposal", async function () {
        await governanceToken.connect(team).transfer(governanceDAO.target, decimalsMultiplier(1_700_000)); //now circulating supply is not enough
        const totalSupply = await governanceToken.totalSupply();
        const circSupplyPercentToPropose = await governanceDAO.minimumCirculatingSupplyToMakeAProposalInPercent();
        const minimumCirculatingSupply = (totalSupply * circSupplyPercentToPropose) / BigInt(100);
        const actualCirculatingSupply =
          totalSupply -
          (await governanceToken.balanceOf(governanceDAO.target)) -
          (await governanceToken.balanceOf(governanceToken.target));

        await expect(governanceDAO.connect(externalUser2).makeProposal("proposal2")).to.revertedWithCustomError(
          governanceDAO,
          "GovernanceDAO__NotEnoughtCirculatingSupplyToMakeProposals"
        );
      });
      it("should revert if proposer has not enough token staked to make a proposal", async function () {
        await expect(governanceDAO.connect(externalUser4).makeProposal("proposal description"))
          .to.be.revertedWithCustomError(governanceDAO, "GovernanceDAO__NotEnoughtTokenStakedToMakeProposal")
          .withArgs(stakingTokenManager.getUserStakedTokens(externalUser4), governanceDAO.minimumTokenStakedToMakeAProposal());
      });
      it("should revert if proposal has not description", async function () {
        await expect(governanceDAO.connect(externalUser1).makeProposal("")).to.be.revertedWithCustomError(
          governanceDAO,
          "GovernanceDao__DescriptionCannotBeEmpty"
        );
      });
      it("should revert if proposer has another active proposal", async function () {
        const proposal2Description = "proposal 2 description";
        await expect(governanceDAO.connect(externalUser1).makeProposal(proposal2Description)).to.be.revertedWithCustomError(
          governanceDAO,
          "GovernanceDAO__AnotherProposalStillActive"
        );
      });
      it("should assign correct values on each parameter", async function () {
        const proposalId = 1;
        const firstProposalCall = await governanceDAO.getProposalById(proposalId);
        expect(firstProposalCall.proposalId).to.equal(proposalId);
        expect(firstProposalCall.description).to.equal(proposalDescription);
        expect(firstProposalCall.proposer).to.equal(extUser1Proposer);
        expect(firstProposalCall.forVotes).to.equal(0);
        expect(firstProposalCall.againstVotes).to.equal(0);
        expect(firstProposalCall.abstainVotes).to.equal(0);
        expect(firstProposalCall.totalVotes).to.equal(0);
        expect(firstProposalCall.quorumReached).to.equal(false);
        expect(firstProposalCall.isFinalized).to.equal(false);
        expect(firstProposalCall.isApproved).to.equal(false);
        expect(await governanceDAO.activeProposers(extUser1Proposer)).to.equal(true);
        expect(await stakingTokenManager.checkIfTokensAreLocked(extUser1Proposer)).to.equal(true);
      });
      it("should elegible users able to apply as delegatee", async function () {
        await expect(firstApplyForDelegatee).to.emit(governanceDAO, "NewDelegateeApplied").withArgs(extUser2Delegatee);
        expect(await stakingTokenManager.checkIfTokensAreLocked(extUser2Delegatee)).to.equal(true);
        expect(await governanceDAO.connect(externalUser1).checkIfDelegatee(extUser2Delegatee)).to.equal(true);
      });
      it("should revert if proposer try to apply for delegatee", async function () {
        await expect(governanceDAO.connect(externalUser1).applyForDelegatee()).to.revertedWithCustomError(
          governanceDAO,
          "GovernanceDAO__CantBeProposerAndDelegateeTogether"
        );
      });
      it("should revert if delegator try to apply for delegatee", async function () {
        await stakingTokenManager.connect(externalUser3).stakeTokens(await governanceDAO.minimumTokenStakedToMakeAProposal());
        await expect(governanceDAO.connect(externalUser3).applyForDelegatee()).to.revertedWithCustomError(
          governanceDAO,
          "GovernanceDAO__DelegateeCantBeDelegator"
        );
      });
      it("should revert if delegatee try to apply again for delegatee", async function () {
        await expect(governanceDAO.connect(externalUser2).applyForDelegatee()).to.revertedWithCustomError(
          governanceDAO,
          "GovernanceDAO__AlreadyDelegatee"
        );
      });
      it("should allow delegatee to rejects role and unlock tokens of both delegatee and delegators", async function () {
        expect(await governanceDAO.delegatees(0)).to.equal(extUser2Delegatee);
        expect(await governanceDAO.getDelegatees()).to.have.lengthOf(1);
        await expect(governanceDAO.connect(externalUser2).rejectForDelegatee())
          .to.emit(governanceDAO, "DelegateeRemvedFromAppliedList")
          .withArgs(extUser2Delegatee);
        expect(await governanceDAO.getDelegatees()).to.have.lengthOf(0);
        expect(await stakingTokenManager.checkIfTokensAreLocked(extUser2Delegatee)).to.equal(false);
        expect(await stakingTokenManager.checkIfTokensAreLocked(extUser3Delegator)).to.equal(false);
      });
      it("should rejects role function works with more than 1 delegatee", async function () {
        await governanceDAO.connect(externalUser4).buyToken({ value: tokenBuyAmountInWei });
        await governanceToken.connect(externalUser4).approve(stakingTokenManager, tokenBuyAmountInWei);
        await stakingTokenManager.connect(externalUser4).stakeTokens(await governanceDAO.minimumTokenStakedToMakeAProposal());
        await governanceDAO.connect(externalUser4).applyForDelegatee();
        expect(await governanceDAO.delegatees(1)).to.equal(externalUser4.address);
        expect(await governanceDAO.getDelegatees()).to.have.lengthOf(2);
        await expect(governanceDAO.connect(externalUser4).rejectForDelegatee())
          .to.emit(governanceDAO, "DelegateeRemvedFromAppliedList")
          .withArgs(externalUser4.address);
        expect(await governanceDAO.getDelegatees()).to.have.lengthOf(1);
        expect(await governanceDAO.delegatees(0)).to.equal(extUser2Delegatee);
        expect(await stakingTokenManager.checkIfTokensAreLocked(externalUser4.address)).to.equal(false);
      });
      it("should revert if non-delegatee try to rejects his role", async function () {
        await expect(governanceDAO.connect(externalUser4).rejectForDelegatee()).to.revertedWithCustomError(
          governanceDAO,
          "GovernanceDAO__NotAppliedDelegatee"
        );
      });
      it("should revert if delegatee voted on active proposal and try to reject his role", async function () {
        const firstProposalCall = await governanceDAO.getProposalById(1);
        const proposalId = firstProposalCall.proposalId;
        await governanceDAO.connect(externalUser2).delegateeVoteOnProposal(proposalId, 1);
        await expect(governanceDAO.connect(externalUser2).rejectForDelegatee()).to.revertedWithCustomError(
          governanceDAO,
          "GovernanceDAO__DelegateeVotedAnActiveProposal"
        );
      });
      it("user should be able to delegate his vote", async function () {
        const tokensDelegated = await stakingTokenManager.getUserStakedTokens(extUser3Delegator);
        await expect(firstDelegateVote)
          .to.emit(governanceDAO, "VoteDelegated")
          .withArgs(extUser3Delegator, extUser2Delegatee, tokensDelegated);
        expect(await governanceDAO.delegators(extUser3Delegator)).to.equal(true);
        const delegator = await governanceDAO.delegateeToDelegators(extUser2Delegatee, 0);
        expect(delegator).to.equal(extUser3Delegator);
      });
      it("should revert if unauthorized user try to delegate his vote", async function () {
        const secondDelegation = governanceDAO.connect(externalUser3).delegateVote(extUser2Delegatee);
        await expect(secondDelegation).to.revertedWithCustomError(governanceDAO, "GovernanceDAO__AlreadyDelegator");

        const thirdDelegation = governanceDAO.connect(externalUser2).delegateVote(extUser4NormalVoter);
        await expect(thirdDelegation).to.revertedWithCustomError(governanceDAO, "GovernanceDAO__DelegateeCantBeDelegator");

        const fourthDelegation = governanceDAO.connect(externalUser1).delegateVote(extUser4NormalVoter);
        await expect(fourthDelegation).to.revertedWithCustomError(governanceDAO, "GovernanceDAO__NotAppliedDelegatee");
      });
      it("delegator should be able to undelegate his vote", async function () {
        const undelegation = governanceDAO.connect(externalUser3).undelegateVote(extUser2Delegatee);
        await expect(undelegation).to.emit(governanceDAO, "VoteUndelegated");
        expect(await governanceDAO.delegators(extUser3Delegator)).to.equal(false);
      });
      it("should revert if unauthorized user try to undelegate his vote", async function () {
        const undelegation = governanceDAO.connect(externalUser1).undelegateVote(extUser2Delegatee);
        await expect(undelegation).to.revertedWithCustomError(governanceDAO, "GovernanceDAO__NoDelegationFound");
      });
      it("should revert if try to undelegate his vote during an active proposal", async function () {
        const firstProposalCall = await governanceDAO.getProposalById(1);
        const proposalId = firstProposalCall.proposalId;
        const votation = await governanceDAO.connect(externalUser2).delegateeVoteOnProposal(proposalId, 1);
        const receipt = await votation.wait();
        if (!receipt) throw new Error("Transaction receipt is null");

        const undelegation = governanceDAO.connect(externalUser3).undelegateVote(extUser2Delegatee);
        await expect(undelegation).to.revertedWithCustomError(governanceDAO, "GovernanceDAO__DelegateeVotedAnActiveProposal");
      });
      it("should revert if try to undelegate his vote from a wrong delegatee", async function () {
        await governanceDAO.connect(externalUser5).buyToken({ value: tokenBuyAmountInWei });
        await governanceToken
          .connect(externalUser5)
          .approve(stakingTokenManager, await governanceToken.balanceOf(extUser5SecondDelegatee));
        await stakingTokenManager.connect(externalUser5).stakeTokens(await governanceToken.balanceOf(extUser5SecondDelegatee));
        await governanceDAO.connect(externalUser5).applyForDelegatee();

        const undelegation = governanceDAO.connect(externalUser3).undelegateVote(extUser5SecondDelegatee);
        await expect(undelegation).to.revertedWithCustomError(governanceDAO, "GovernanceDAO__NoDelegationFoundOnThisDelegatee");
      });
      it("delegatee should be able to vote on proposal", async function () {
        const firstProposalCall = await governanceDAO.getProposalById(1);
        const proposalId = firstProposalCall.proposalId;
        const vote = 1;
        const votingPower =
          (await stakingTokenManager.getUserStakedTokens(extUser2Delegatee)) +
          (await stakingTokenManager.getUserStakedTokens(extUser3Delegator));
        const delegators = [extUser3Delegator];
        await expect(governanceDAO.connect(externalUser2).delegateeVoteOnProposal(proposalId, vote))
          .to.emit(governanceDAO, "DelegateeVoteRegistered")
          .withArgs(extUser2Delegatee, vote, votingPower, proposalId, delegators);
      });
      it("should revert if not delegatee try to vote with delegatee vote function", async function () {
        const firstProposalCall = await governanceDAO.getProposalById(1);
        const proposalId = firstProposalCall.proposalId;
        const vote = 1;
        await expect(governanceDAO.connect(externalUser1).delegateeVoteOnProposal(proposalId, vote)).to.revertedWithCustomError(
          governanceDAO,
          "GovernanceDAO__NotAppliedDelegatee"
        );
      });
      it("should revert due to the end of voting period", async function () {
        const firstProposalCall = await governanceDAO.getProposalById(1);
        const proposalId = firstProposalCall.proposalId;
        const vote = 1;
        const newTimestamp = firstProposalCall.endVotingTimestamp + BigInt(1);
        await time.increaseTo(newTimestamp);
        await expect(governanceDAO.connect(externalUser2).delegateeVoteOnProposal(proposalId, vote)).to.revertedWithCustomError(
          governanceDAO,
          "GovernanceDAO__OutOfVotingPeriod"
        );
      });
      it("should revert if vote is already registered", async function () {
        const firstProposalCall = await governanceDAO.getProposalById(1);
        const proposalId = firstProposalCall.proposalId;
        const vote = 1;
        await governanceDAO.connect(externalUser2).delegateeVoteOnProposal(proposalId, vote);
        await expect(governanceDAO.connect(externalUser2).delegateeVoteOnProposal(proposalId, vote)).to.revertedWithCustomError(
          governanceDAO,
          "GovernanceDAO__VoteAlreadyRegistered"
        );
      });
      it("should update correctly the vote register", async function () {
        const firstProposalCall = await governanceDAO.getProposalById(1);
        const proposalId = firstProposalCall.proposalId;
        const User1vote = 0;
        const User2vote = 2;
        const User4vote = 1;
        await governanceDAO.connect(externalUser4).buyToken({ value: tokenBuyAmountInWei });
        await governanceToken
          .connect(externalUser4)
          .approve(stakingTokenManager, await governanceToken.balanceOf(extUser4NormalVoter));
        await stakingTokenManager.connect(externalUser4).stakeTokens(await governanceToken.balanceOf(extUser4NormalVoter));

        const votingPowerExtUser2 =
          (await stakingTokenManager.getUserStakedTokens(extUser2Delegatee)) +
          (await stakingTokenManager.getUserStakedTokens(extUser3Delegator));
        const votingPowerExtUser1 = await stakingTokenManager.getUserStakedTokens(externalUser1);
        const votingPowerExtUser4 = await stakingTokenManager.getUserStakedTokens(externalUser4);

        await governanceDAO.connect(externalUser1).voteOnProposal(proposalId, User1vote);
        await governanceDAO.connect(externalUser2).delegateeVoteOnProposal(proposalId, User2vote);
        await governanceDAO.connect(externalUser4).voteOnProposal(proposalId, User4vote);

        const votingPowerExtUser2Check = await governanceDAO.getVotingPowerOfAddressById(proposalId, extUser2Delegatee);
        const votingPowerExtUser1Check = await governanceDAO.getVotingPowerOfAddressById(proposalId, extUser1Proposer);
        const votingPowerExtUser4Check = await governanceDAO.getVotingPowerOfAddressById(proposalId, extUser4NormalVoter);
        expect(votingPowerExtUser2).to.equal(votingPowerExtUser2Check);
        expect(votingPowerExtUser1).to.equal(votingPowerExtUser1Check);
        const firstProposalSecondCall = await governanceDAO.getProposalById(1);
        expect(firstProposalSecondCall.totalVotes).to.equal(votingPowerExtUser2 + votingPowerExtUser1 + votingPowerExtUser4);
        expect(firstProposalSecondCall.forVotes).to.equal(votingPowerExtUser1);
        expect(firstProposalSecondCall.abstainVotes).to.equal(votingPowerExtUser2);
        expect(firstProposalSecondCall.againstVotes).to.equal(votingPowerExtUser4);
      });

      it("should finalize and approve the proposal after ending voting period", async function () {
        const firstProposalCall = await governanceDAO.getProposalById(1);
        const proposalId = firstProposalCall.proposalId;
        const newTimestamp = firstProposalCall.endVotingTimestamp + BigInt(100);
        await governanceDAO.connect(externalUser1).voteOnProposal(proposalId, 0);
        await governanceDAO.connect(externalUser2).delegateeVoteOnProposal(proposalId, 0);
        await time.increaseTo(newTimestamp);
        const totalVoteFor =
          (await stakingTokenManager.getUserStakedTokens(externalUser1)) +
          (await stakingTokenManager.getUserStakedTokens(externalUser2)) +
          (await stakingTokenManager.getUserStakedTokens(externalUser3));
        const finalizeProp = await governanceDAO.connect(team).finalizeProposal(proposalId);
        const receipt = await finalizeProp.wait();
        if (!receipt) throw new Error("Transaction receipt is null");

        expect(finalizeProp)
          .to.emit(governanceDAO, "ProposalApproved")
          .withArgs(
            proposalId,
            firstProposalCall.forVotes,
            firstProposalCall.againstVotes,
            firstProposalCall.abstainVotes,
            firstProposalCall.proposer
          );

        const firstProposalSecondCall = await governanceDAO.getProposalById(1);
        expect(firstProposalSecondCall.forVotes).to.equal(totalVoteFor);
        expect(firstProposalSecondCall.againstVotes).to.equal(0);
        expect(firstProposalSecondCall.abstainVotes).to.equal(0);
        expect(firstProposalSecondCall.totalVotes).to.equal(totalVoteFor);
        expect(firstProposalSecondCall.quorumReached).to.equal(true);
        expect(firstProposalSecondCall.isApproved).to.equal(true);
        expect(firstProposalSecondCall.isFinalized).to.equal(true);

        const checkIfProposerInactive = await governanceDAO.activeProposers(extUser1Proposer);
        expect(await governanceDAO.activeProposers(extUser1Proposer)).to.equal(false);
      });
      it("should finalize and slashe token if the proposal don't reach quorum", async function () {
        const firstProposalCall = await governanceDAO.getProposalById(1);
        const proposalId = firstProposalCall.proposalId;
        const newTimestamp = firstProposalCall.endVotingTimestamp + BigInt(100);
        await governanceDAO.connect(externalUser1).voteOnProposal(proposalId, 2);
        await governanceDAO.connect(externalUser2).delegateeVoteOnProposal(proposalId, 2);
        await time.increaseTo(newTimestamp);
        const totalVoteAbstained =
          (await stakingTokenManager.getUserStakedTokens(externalUser1)) +
          (await stakingTokenManager.getUserStakedTokens(externalUser2)) +
          (await stakingTokenManager.getUserStakedTokens(externalUser3));
        const proposerTokenStakedBeforeSlashing = await stakingTokenManager.getUserStakedTokens(extUser1Proposer);
        const finalizeProp = await governanceDAO.connect(team).finalizeProposal(proposalId);
        const receipt = await finalizeProp.wait();
        if (!receipt) throw new Error("Transaction receipt is null");

        expect(finalizeProp)
          .to.emit(governanceDAO, "ProposalRefused")
          .withArgs(proposalId, firstProposalCall.totalVotes, firstProposalCall.abstainVotes, firstProposalCall.proposer);

        const firstProposalSecondCall = await governanceDAO.getProposalById(1);
        expect(firstProposalSecondCall.forVotes).to.equal(0);
        expect(firstProposalSecondCall.againstVotes).to.equal(0);
        expect(firstProposalSecondCall.abstainVotes).to.equal(totalVoteAbstained);
        expect(firstProposalSecondCall.totalVotes).to.equal(totalVoteAbstained);
        expect(firstProposalSecondCall.quorumReached).to.equal(false);
        expect(firstProposalSecondCall.isApproved).to.equal(false);
        expect(firstProposalSecondCall.isFinalized).to.equal(true);

        const checkIfProposerInactive = await governanceDAO.activeProposers(extUser1Proposer);
        expect(checkIfProposerInactive).to.equal(false);

        const proposerTokenStakedAfterSlashing = await stakingTokenManager.getUserStakedTokens(extUser1Proposer);
        expect(proposerTokenStakedAfterSlashing).to.equal(
          proposerTokenStakedBeforeSlashing - proposerTokenStakedBeforeSlashing / (await stakingTokenManager.i_slashingPercent())
        );
      });
      it("should finalize and fail the proposal after ending voting period", async function () {
        const firstProposalCall = await governanceDAO.getProposalById(1);
        const proposalId = firstProposalCall.proposalId;
        const newTimestamp = firstProposalCall.endVotingTimestamp + BigInt(100);
        await governanceDAO.connect(externalUser1).voteOnProposal(proposalId, 1);
        await governanceDAO.connect(externalUser2).delegateeVoteOnProposal(proposalId, 1);
        await time.increaseTo(newTimestamp);
        const totalVoteAgainst =
          (await stakingTokenManager.getUserStakedTokens(externalUser1)) +
          (await stakingTokenManager.getUserStakedTokens(externalUser2)) +
          (await stakingTokenManager.getUserStakedTokens(externalUser3));
        const finalizeProp = await governanceDAO.connect(team).finalizeProposal(proposalId);
        const receipt = await finalizeProp.wait();
        if (!receipt) throw new Error("Transaction receipt is null");

        expect(finalizeProp)
          .to.emit(governanceDAO, "ProposalFailed")
          .withArgs(
            proposalId,
            firstProposalCall.forVotes,
            firstProposalCall.againstVotes,
            firstProposalCall.abstainVotes,
            firstProposalCall.proposer
          );

        const firstProposalSecondCall = await governanceDAO.getProposalById(1);
        expect(firstProposalSecondCall.forVotes).to.equal(0);
        expect(firstProposalSecondCall.againstVotes).to.equal(totalVoteAgainst);
        expect(firstProposalSecondCall.abstainVotes).to.equal(0);
        expect(firstProposalSecondCall.totalVotes).to.equal(totalVoteAgainst);
        expect(firstProposalSecondCall.quorumReached).to.equal(true);
        expect(firstProposalSecondCall.isApproved).to.equal(false);
        expect(firstProposalSecondCall.isFinalized).to.equal(true);

        const checkIfProposerInactive = await governanceDAO.activeProposers(extUser1Proposer);
        expect(await governanceDAO.activeProposers(extUser1Proposer)).to.equal(false);
      });
      it("should revert finalization if votation is still active", async function () {
        const firstProposalCall = await governanceDAO.getProposalById(1);
        const proposalId = firstProposalCall.proposalId;
        const newTimestamp = firstProposalCall.endVotingTimestamp - BigInt(100);
        await expect(governanceDAO.connect(team).finalizeProposal(proposalId)).to.revertedWithCustomError(
          governanceDAO,
          "GovernanceDAO__ProposalStillOnVoting"
        );
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
        const tokenBuyAmount = decimalsMultiplier(tokenBuyAmountInWei / tokenPrice);
        const buyTokenUser4 = await governanceDAO.connect(externalUser4).buyToken({ value: tokenBuyAmountInWei });
        const receipt = await buyTokenUser1.wait();
        if (!receipt) throw new Error("Transaction receipt is null");

        expect(buyTokenUser4)
          .to.emit(governanceDAO, "TokenPurchased")
          .withArgs(externalUser1.address, tokenBuyAmount, await getLatestBlockTimestamp());
        expect(await governanceToken.balanceOf(externalUser4.address)).to.equal(tokenBuyAmount);
        expect(await treasuryDAO.getBalance()).to.equal(tokenBuyAmountInWei * BigInt(4)); //eth used to purchase token are sent to treasury
        //*3 because i bought this amount of wei 4 times (one for each account)
        expect(await governanceToken.connect(team).getElegibleForClaimsArray(externalUser4.address)).to.equal(true);
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
    ).to.be.revertedWithCustomError(governanceDAO, `GovernanceDAO__NoFunctionCalled`);
    expect(await ethers.provider.getBalance(governanceDAO.target)).to.equal(contractInitialBalance);
  });
});
