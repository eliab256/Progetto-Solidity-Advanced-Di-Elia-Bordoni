const { ethers } = require("hardhat");
const { expect } = require("chai");
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { GovernanceToken } from "../typechain-types/contracts";
import { Contract } from "ethers";
import { getLatestBlockTimestamp } from "../Utils/getTimeBlockStamp";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";

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

describe("GovernanceToken", function () {
  let governanceToken: GovernanceToken & Contract;
  let team: SignerWithAddress;
  let DAO: SignerWithAddress;
  let treasury: SignerWithAddress;
  let numberOfOlderUsers: number;
  let externalUser1: SignerWithAddress;
  let externalUser2: SignerWithAddress;
  let olderUsersAddressesTest: string[];

  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    DAO = signers[0];
    team = signers[1];
    treasury = signers[2];
    externalUser1 = signers[3];
    externalUser2 = signers[4];
    numberOfOlderUsers = 10;
    olderUsersAddressesTest = signers.slice(5, 5 + numberOfOlderUsers).map((user: SignerWithAddress) => user.address);

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
      expect(await governanceToken.i_cap()).to.equal(10000000);
      expect(await governanceToken.i_Owner()).to.equal(team.address);
      expect(await governanceToken.i_treasuryContract()).to.equal(treasury.address);
      expect(await governanceToken.i_teamMintSupply()).to.equal(4000000);
      expect(await governanceToken.i_olderUsersMintSupply()).to.equal(1000000);
      expect(await governanceToken.i_earlyAdopterMintSupply()).to.equal(1000000);
      expect(await governanceToken.i_weeksOfVesting()).to.equal(4);
      expect(await governanceToken.i_DAOContract()).to.equal(DAO.address);

      for (let i = 0; i < numberOfOlderUsers; i++) {
        expect(await governanceToken.olderUsersAddresses(i)).to.equal(olderUsersAddressesTest[i]);
      }
    });

    // it("should emit the event of deploy", async function () {});

    it("should revert if totalInitialMint exceed cap", async function () {
      const params: ConstructorTokenStruct = getDefaultParams({
        teamAddress: team.address,
        treasuryAddress: treasury.address,
        cap: BigInt(4000000),
      });
      const GovernanceTokenTest = await ethers.getContractFactory("GovernanceToken");
      const totalInitialMint = params.teamMintSupply + params.olderUsersMintSupply + params.earlyAdopterMintSupply;

      await expect(GovernanceTokenTest.deploy(params))
        .to.be.revertedWithCustomError(GovernanceTokenTest, "GovernanceToken__MaxSupplyReached")
        .withArgs(totalInitialMint, params.cap);
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
      expect(await governanceToken.balanceOf(team.address)).to.equal(
        BigInt((await governanceToken.i_teamMintSupply()) * BigInt(10 ** 18))
      );
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
      const decimalsMultiplier = BigInt(10 ** 18);

      const teamMintSupply = (await governanceToken.i_teamMintSupply()) * decimalsMultiplier;
      const olderUsersMintSupply = (await governanceToken.i_olderUsersMintSupply()) * decimalsMultiplier;
      const earlyAdopterMintSupply = (await governanceToken.i_earlyAdopterMintSupply()) * decimalsMultiplier;
      const totalInitialMint = teamMintSupply + olderUsersMintSupply + earlyAdopterMintSupply;
      const cap = await governanceToken.i_cap();
      const expectedDAOBalance = cap - totalInitialMint;

      expect(await governanceToken.balanceOf(governanceToken.target)).to.equal(earlyAdopterMintSupply);
      expect(await governanceToken.balanceOf(DAO.address)).to.equal(expectedDAOBalance);
    });

    // it("Should emit the events on deployment contracts", async function () {});
  });

  describe("functions test", async function () {
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

    //   it("should owner(team) be able to update elegible address list during vesting period", async function () {});

    //   it("should assign claim amount to every elegible address", async function () {});

    //   it("elegible addresses should be able to claim their tokens", async function () {});

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
      await expect(governanceToken.connect(externalUser2).sendingToken(externalUser1.address, amountTransfered)).to.be
        .reverted;
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
        .and.to.be.revertedWithCustomError(
          governanceToken,
          `GovernanceToken__UseGovernanceContractToInteractWithTheDAO`
        )
        .withArgs(DAO.address);
      expect(await ethers.provider.getBalance(governanceToken.target)).to.equal(0);
    });
  });
});
