const { ethers } = require("hardhat");
const { expect } = require("chai");
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { GovernanceToken } from "../typechain-types/contracts";
import { Contract } from "ethers";
import { getLatestBlockTimestamp } from "../Utils/getTimeBlockStamp";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { ERC20__factory } from "../typechain-types";

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

function getDefaultParams(overrides: Partial<ConstructorTokenStruct> = {}): ConstructorTokenStruct {
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

function getEtherValue(value: number): bigint {
  return ethers.parseEther(`${value.toString()}`);
}

function decimalsMultiplier(value: number | bigint): bigint {
  return BigInt(value) * BigInt(10 ** 18);
}

describe("GovernanceToken", function () {
  let governanceToken: GovernanceToken & Contract;
  let team: SignerWithAddress;
  let DAO: SignerWithAddress;
  let treasury: SignerWithAddress;
  let numberOfOlderUsers: number;
  let externalUser1: SignerWithAddress;
  let externalUser2: SignerWithAddress;
  let externalUser3: SignerWithAddress;
  let externalUser4: SignerWithAddress;
  let externalUser5: SignerWithAddress;
  let olderUsersAddressesTest: string[];

  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    DAO = signers[0];
    team = signers[1];
    treasury = signers[2];
    externalUser1 = signers[3];
    externalUser2 = signers[4];
    externalUser3 = signers[5];
    externalUser4 = signers[6];
    externalUser5 = signers[7];
    numberOfOlderUsers = 10;
    olderUsersAddressesTest = signers.slice(8, 8 + numberOfOlderUsers).map((user: SignerWithAddress) => user.address);

    const params: ConstructorTokenStruct = getDefaultParams({
      teamAddress: team.address,
      treasuryAddress: treasury.address,
      olderUsersAddresses: olderUsersAddressesTest,
    });

    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");

    governanceToken = (await GovernanceToken.deploy(params)) as GovernanceToken & Contract;

    await governanceToken.waitForDeployment();
  });

  describe("Constructor and deploy", async function () {
    it("should deploy the contract with correct parameters", async function () {
      expect(await governanceToken.name()).to.equal("MooveToken");
      expect(await governanceToken.symbol()).to.equal("MOV");
      expect(await governanceToken.i_cap()).to.equal(decimalsMultiplier(getDefaultParams().cap));
      expect(await governanceToken.i_Owner()).to.equal(team.address);
      expect(await governanceToken.i_treasuryContract()).to.equal(treasury.address);
      expect(await governanceToken.i_teamMintSupply()).to.equal(decimalsMultiplier(getDefaultParams().teamMintSupply));
      expect(await governanceToken.i_olderUsersMintSupply()).to.equal(
        decimalsMultiplier(getDefaultParams().olderUsersMintSupply)
      );
      expect(await governanceToken.i_earlyAdopterMintSupply()).to.equal(
        decimalsMultiplier(getDefaultParams().earlyAdopterMintSupply)
      );
      expect(await governanceToken.i_weeksOfVesting()).to.equal(4);
      expect(await governanceToken.i_DAOContract()).to.equal(DAO.address);

      for (let i = 0; i < numberOfOlderUsers; i++) {
        expect(await governanceToken.olderUsersAddresses(i)).to.equal(olderUsersAddressesTest[i]);
      }
    });

    it("should revert if totalInitialMint exceed cap", async function () {
      const params: ConstructorTokenStruct = getDefaultParams({
        teamAddress: team.address,
        treasuryAddress: treasury.address,
        cap: BigInt(4000000),
      });
      const GovernanceTokenTest = await ethers.getContractFactory("GovernanceToken");
      const totalInitialMint = decimalsMultiplier(
        params.teamMintSupply + params.olderUsersMintSupply + params.earlyAdopterMintSupply
      );

      await expect(GovernanceTokenTest.deploy(params))
        .to.be.revertedWithCustomError(GovernanceTokenTest, "GovernanceToken__MaxSupplyReached")
        .withArgs(totalInitialMint, decimalsMultiplier(params.cap));
    });

    it("should revert if cap is equal to 0", async function () {
      const params: ConstructorTokenStruct = getDefaultParams({
        teamAddress: team.address,
        treasuryAddress: treasury.address,
        cap: BigInt(0),
      });
      const GovernanceTokenTest = await ethers.getContractFactory("GovernanceToken");

      await expect(GovernanceTokenTest.deploy(params)).to.be.revertedWithCustomError(
        GovernanceTokenTest,
        "GovernanceToken__CapMustBeGreaterThanZero"
      );
    });

    it("Should mint the correct amount of tokens for the team", async function () {
      expect(await governanceToken.balanceOf(team.address)).to.equal(BigInt(await governanceToken.i_teamMintSupply()));
    });

    it("Should take on the contract tokens evenly to older users", async function () {
      const olderUsersMintSupply = await governanceToken.i_olderUsersMintSupply();
      const olderUsersAddressesLength = numberOfOlderUsers;
      const expectedBalance = olderUsersMintSupply / BigInt(olderUsersAddressesLength);

      for (let i = 0; i < olderUsersAddressesLength; i++) {
        const userAddress = await governanceToken.olderUsersAddresses(i);
        expect(await governanceToken.balanceOf(userAddress)).to.equal(expectedBalance);
      }
    });

    it("Should mint the remaining tokens to the contract address and send to DAO", async function () {
      const teamMintSupply = await governanceToken.i_teamMintSupply();
      const olderUsersMintSupply = await governanceToken.i_olderUsersMintSupply();
      const earlyAdopterMintSupply = await governanceToken.i_earlyAdopterMintSupply();
      const totalInitialMint = teamMintSupply + olderUsersMintSupply + earlyAdopterMintSupply;
      const cap = await governanceToken.i_cap();
      const expectedDAOBalance = cap - totalInitialMint;

      expect(await governanceToken.balanceOf(governanceToken.target)).to.equal(olderUsersMintSupply);
      expect(await governanceToken.balanceOf(DAO.address)).to.equal(expectedDAOBalance);
    });

    it("Should emit the events on deployment contracts", async function () {
      const params: ConstructorTokenStruct = getDefaultParams({
        cap: BigInt(49000000),
      });
      const GovernanceTokenTest = await ethers.getContractFactory("GovernanceToken");

      await expect(GovernanceTokenTest.deploy(params))
        .to.emit(GovernanceTokenTest, "GovernanceTokenContractDeployedCorrectly")
        .withArgs(
          GovernanceTokenTest.tokenName,
          GovernanceTokenTest.tokenSymbol,
          GovernanceTokenTest.i_Owner,
          GovernanceTokenTest.i_treasuryContract,
          GovernanceTokenTest.i_daoAddress,
          GovernanceTokenTest.i_cap
        );
    });
  });

  describe("functions view test", async function () {
    it("should return the decimals", async function () {
      expect(await governanceToken.decimals()).to.equal(18);
    });

    it("should return the cap", async function () {
      expect(await governanceToken.getCap()).to.equal(await governanceToken.i_cap());
    });

    it("should check de elegibility claim for caller", async function () {
      await governanceToken.connect(DAO).sendingToken(externalUser1.address, 100);
      expect(await governanceToken.connect(externalUser1).checkEligibilityClaim()).to.equal(true);
      expect(await governanceToken.connect(externalUser2).checkEligibilityClaim()).to.equal(false);
    });

    it("should return the claim countdown in days", async function () {
      const deployTimestamp = await governanceToken.i_deployTimeStamp();
      const vestingPeriod = BigInt(BigInt(604800) * (await governanceToken.i_weeksOfVesting()));
      const claimexpiration = deployTimestamp + vestingPeriod;
      const actualTime = BigInt(await getLatestBlockTimestamp());
      expect(await governanceToken.claimCountdownInDays()).to.equal((claimexpiration - actualTime) / BigInt(86400));
    });
  });

  describe("earlyadopter functions", async function () {
    it("should DAO be able to update elegible address list during vesting period", async function () {
      await governanceToken.connect(DAO).updateElegibleAdresses(externalUser1.address);
      await governanceToken.connect(DAO).updateElegibleAdresses(externalUser2.address);

      expect(await governanceToken.elegibleForClaimsArray(0)).to.equal(externalUser1.address);
      expect(await governanceToken.elegibleForClaimsArray(1)).to.equal(externalUser2.address);
    });

    it("should revert if try to assign double time an address to elegible addresses array", async function () {
      await governanceToken.connect(DAO).updateElegibleAdresses(externalUser1.address);
      await expect(governanceToken.connect(DAO).updateElegibleAdresses(externalUser1.address)).to.be.revertedWithCustomError(
        governanceToken,
        "GovernanceToken__AddressAlreadyRegistered"
      );
    });

    it("should change the vesting period status", async function () {
      expect(await governanceToken.getVestingPeriodStatus()).to.equal(true);
      await governanceToken.connect(DAO).changeVestingPeriodStatus();
      expect(await governanceToken.getVestingPeriodStatus()).to.equal(false);
    });

    it("should assign claim amount to every elegible address", async function () {
      const totalDistribution = await governanceToken.i_earlyAdopterMintSupply();
      const user1TokenBalance = decimalsMultiplier(100);
      const user2TokenBalance = decimalsMultiplier(100);
      const user3TokenBalance = decimalsMultiplier(50);
      const user4TokenBalance = decimalsMultiplier(200);
      const user5TokenBalance = decimalsMultiplier(0);
      const totalBalances = user1TokenBalance + user2TokenBalance + user3TokenBalance + user4TokenBalance + user5TokenBalance;

      await governanceToken.connect(DAO).updateElegibleAdresses(externalUser1.address);
      await governanceToken.connect(DAO).sendingToken(externalUser1.address, user1TokenBalance);
      await governanceToken.connect(DAO).updateElegibleAdresses(externalUser2.address);
      await governanceToken.connect(DAO).sendingToken(externalUser2.address, user2TokenBalance);
      await governanceToken.connect(DAO).updateElegibleAdresses(externalUser3.address);
      await governanceToken.connect(DAO).sendingToken(externalUser3.address, user3TokenBalance);
      await governanceToken.connect(DAO).updateElegibleAdresses(externalUser4.address);
      await governanceToken.connect(DAO).sendingToken(externalUser4.address, user4TokenBalance);
      await governanceToken.connect(DAO).updateElegibleAdresses(externalUser5.address);
      await governanceToken.connect(DAO).sendingToken(externalUser5.address, user5TokenBalance);

      await governanceToken.connect(DAO).changeVestingPeriodStatus();
      await governanceToken.connect(team).getTotalBalanceClaims();

      const user1ClaimAmount = await governanceToken.connect(team).getClaimsAmountForAddress(externalUser1.address);
      const user2ClaimAmount = await governanceToken.connect(team).getClaimsAmountForAddress(externalUser2.address);
      const user3ClaimAmount = await governanceToken.connect(team).getClaimsAmountForAddress(externalUser3.address);
      const user4ClaimAmount = await governanceToken.connect(team).getClaimsAmountForAddress(externalUser4.address);
      const user5ClaimAmount = await governanceToken.connect(team).getClaimsAmountForAddress(externalUser5.address);

      expect(user1ClaimAmount).to.equal((totalDistribution * user1TokenBalance) / totalBalances);
      expect(user1ClaimAmount).to.equal(user2ClaimAmount);
      expect(user3ClaimAmount).to.equal(user1ClaimAmount / BigInt(2));
      expect(user4ClaimAmount).to.equal(user1ClaimAmount * BigInt(2));
      expect(user5ClaimAmount).to.equal(0);
    });

    it("elegible addresses should be able to claim their tokens", async function () {
      const user1InitialTokenBalance = decimalsMultiplier(100);
      await governanceToken.connect(DAO).updateElegibleAdresses(externalUser1.address);
      await governanceToken.connect(DAO).sendingToken(externalUser1.address, user1InitialTokenBalance);
      await governanceToken.connect(DAO).changeVestingPeriodStatus();
      await governanceToken.connect(team).getTotalBalanceClaims();

      await governanceToken.connect(externalUser1).vestingTokenClaims();
      expect(await governanceToken.balanceOf(externalUser1.address)).to.equal(
        user1InitialTokenBalance + (await governanceToken.i_earlyAdopterMintSupply())
      );
    });

    it("should revert if address has nothing to claim", async function () {
      await governanceToken.connect(DAO).changeVestingPeriodStatus();
      await expect(governanceToken.connect(externalUser1).vestingTokenClaims()).to.be.revertedWithCustomError(
        governanceToken,
        "GovernanceToken__YouAreNotEligibleForTheClaim"
      );
    });
  });

  describe("send and receive functions", async function () {
    it("DAO should be able to send token to other addresses", async function () {
      const amountTransfered = BigInt(await governanceToken.balanceOf(DAO.address));
      const tx = await governanceToken.connect(DAO).sendingToken(externalUser1.address, amountTransfered);
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt is null");

      expect(await governanceToken.balanceOf(externalUser1.address)).to.equal(amountTransfered);
      expect(await governanceToken.balanceOf(DAO.address)).to.equal(0);
    });

    it("should revert is someone exept DAO try to send token to other addresses", async function () {
      const amountTransfered = BigInt(await governanceToken.balanceOf(governanceToken.target));
      await expect(governanceToken.connect(externalUser2).sendingToken(externalUser1.address, amountTransfered)).to.be.reverted;
    });

    it("receive function should revert and suuggest dao contract to send ETH", async function () {
      await setBalance(externalUser1.address as string, getEtherValue(100));
      const amountSent = getEtherValue(50);
      await expect(
        externalUser1.sendTransaction({
          to: governanceToken,
          value: amountSent,
        })
      )
        .to.be.revertedWithCustomError(governanceToken, "GovernanceToken__SendETHToGovernanceContractToBuyTokens")
        .withArgs(DAO.address);
      expect(await ethers.provider.getBalance(governanceToken.target)).to.equal(0);
    });

    it("fallback function should revert and suggest dao contract to send ETH", async function () {
      await setBalance(externalUser1.address as string, getEtherValue(100));
      const amountSent = getEtherValue(50);
      const randomData = ethers.hexlify(ethers.randomBytes(8));
      await expect(
        externalUser1.sendTransaction({
          to: governanceToken,
          value: amountSent,
          data: randomData,
        })
      )
        .and.to.be.revertedWithCustomError(governanceToken, `GovernanceToken__UseGovernanceContractToInteractWithTheDAO`)
        .withArgs(DAO.address);
      expect(await ethers.provider.getBalance(governanceToken.target)).to.equal(0);
    });
  });
});
