const { ethers } = require("hardhat");
const { expect } = require("chai");
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { GovernanceToken } from "../typechain-types/contracts";
import { Contract } from "ethers";

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

function getEtherValue(value: number): bigint {
  return ethers.parseEther(`${value.toString()}`);
}

describe("GovernanceToken", function () {
  let governanceToken: GovernanceToken & Contract;
  let team: SignerWithAddress;
  let DAO: SignerWithAddress;
  let treasury: SignerWithAddress;
  let numberOfOlderUsers: number;
  let olderUsersAddresses: string[];

  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    DAO = signers[0];
    team = signers[1];
    treasury = signers[2];
    numberOfOlderUsers = 10;
    olderUsersAddresses = signers.slice(3, 3 + numberOfOlderUsers).map((user: SignerWithAddress) => user.address);

    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");

    const params: ConstructorTokenStruct = {
      name: "MooveToken",
      symbol: "MOV",
      teamAddress: team.address,
      treasuryAddress: treasury.address,
      teamMintSupply: 4_000_000n,
      cap: 10_000_000n,
      olderUsersMintSupply: 1_000_000n,
      earlyAdopterMintSupply: 1_000_000n,
      olderUsersAddresses: olderUsersAddresses,
      weeksOfVesting: 4,
    };

    governanceToken = (await GovernanceToken.deploy[
      (params.name,
      params.symbol,
      params.teamAddress,
      params.treasuryAddress,
      params.teamMintSupply,
      params.cap,
      params.olderUsersMintSupply,
      params.earlyAdopterMintSupply,
      params.olderUsersAddresses,
      params.weeksOfVesting)
    ]) as GovernanceToken & Contract;

    await governanceToken.waitForDeployment();
  });

  describe("Constructor and deploy", async function () {
    it("should deploy the contract with correct parameters", async function () {
      expect(await governanceToken.name()).to.equal("MooveToken");
      expect(await governanceToken.symbol()).to.equal("MOV");
      expect(await governanceToken.cap()).to.equal(ethers.BigNumber.from(5_000_000));
      expect(await governanceToken.teamAddress()).to.equal(team.address);
      expect(await governanceToken.treasuryAddress()).to.equal(treasury.address);
      expect(await governanceToken.teamMintSupply()).to.equal(ethers.BigNumber.from(1_000_000));
      expect(await governanceToken.olderUsersMintSupply()).to.equal(ethers.BigNumber.from(500_000));
      expect(await governanceToken.earlyAdopterMintSupply()).to.equal(ethers.BigNumber.from(500_000));
      expect(await governanceToken.weeksOfVesting()).to.equal(4);

      const storedOlderUsersAddresses = await governanceToken.olderUsersAddresses();
      expect(storedOlderUsersAddresses).to.have.lengthOf(olderUsersAddresses.length);
      for (let i = 0; i < numberOfOlderUsers; i++) {
        expect(storedOlderUsersAddresses[i]).to.equal(olderUsersAddresses[i]);
      }
    });

    it("should emit the event of deploy", async function () {});

    it("should revert if totalInitialMint exceed cap", async function () {});

    it("should revert if cap is equal to 0", async function () {});

    it("Should mint the correct amount of tokens for the team", async function () {});

    it("Should distribute tokens evenly to older users", async function () {});

    it("Should mint the remaining tokens to the contract address", async function () {});

    it("Should emit the events on deployment contracts", async function () {});
  });

  describe("functions test", async function () {
    it("should return the cap", async function () {});

    it("should check de elegibility claim for caller", async function () {});

    it("should return the claim countdown in days", async function () {});

    it("should owner(team) be able to update elegible address list during vesting period", async function () {});

    it("should assign claim amount to every elegible address", async function () {});

    it("elegible addresses should be able to claim their tokens", async function () {});

    it("only DAo sgould be able to send token to other addresses", async function () {});

    it("receive function should revert and suuggest dao contract to send ETH", async function () {});

    it("fallback function should revert and suuggest dao contract to send ETH", async function () {});
  });
});
