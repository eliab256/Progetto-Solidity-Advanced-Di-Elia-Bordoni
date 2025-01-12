const { ethers } = require("hardhat");
const { expect } = require("chai");
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TreasuryDAO } from "../typechain-types/contracts";
import { Contract } from "ethers";

interface TreasuryConstructorStruct {
  teamAddress: string;
  DAOAddress: string;
}

function getDefaultParams(overrides: Partial<TreasuryConstructorStruct> = {}): TreasuryConstructorStruct {
  return {
    teamAddress: "0x0000000000000000000000000000000000000000",
    DAOAddress: "0x0000000000000000000000000000000000000000",
    ...overrides,
  };
}

describe("TreasuryDAO", function () {
  let treasuryDAO: TreasuryDAO & Contract;
  let team: SignerWithAddress;
  let DAO: SignerWithAddress;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    team = signers[0];
    DAO = signers[1];

    const TreasuryDAO = await ethers.getContractFactory("TreasuryDAO");

    const params = getDefaultParams({
      teamAddress: team.address,
      DAOAddress: DAO.address,
    });

    treasuryDAO = (await TreasuryDAO.deploy(...Object.values(params))) as TreasuryDAO & Contract;
    await treasuryDAO.deployed();
  });

  it("should deploy TreasuryDAO correctly", async function () {
    expect(await treasuryDAO.teamAddress()).to.equal(team.address);
    expect(await treasuryDAO.DAOAddress()).to.equal(DAO.address);
  });

  it("should return the correct initial balance of the contract", async function () {
    const balance = await treasuryDAO.getBalance();
    expect(balance).to.equal(0);
    console.log("Initial Balance: ", balance.toString());

    const amountToSend = ethers.utils.parseEther("1.5");
    await DAO.sendTransaction({
      to: treasuryDAO,
      value: amountToSend,
    });

    expect(await treasuryDAO.getBalance()).to.equal(amountToSend);
    console.log("Finale balance: ", ethers.utils.formatEther(balance), "is equal to amount sent:", ethers.utils.formatEther(amountToSend));
  });
});
