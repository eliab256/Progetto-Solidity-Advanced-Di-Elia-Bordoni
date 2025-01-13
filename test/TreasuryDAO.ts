const { ethers } = require("hardhat");
const { expect } = require("chai");
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TreasuryDAO } from "../typechain-types/contracts";
import { Contract } from "ethers";
import { getLatestBlockTimestamp } from "../Utils/getTimeBlockStamp";

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
  let externalUser1: SignerWithAddress;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    team = signers[0];
    DAO = signers[1];
    externalUser1 = signers[2];

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

  it("should return the correct  balance of the contract", async function () {
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

  it("should receive funds from DAO contract only", async function () {
    const initialBalance = await treasuryDAO.getBalance();

    const amountSentFromANonDAOAddress = ethers.utils.parseEther("1.0");
    await expect(
      externalUser1.sendTransaction({
        to: treasuryDAO,
        value: amountSentFromANonDAOAddress,
      })
    )
      .to.emit(treasuryDAO, "ReceiveTriggered")
      .withArgs(externalUser1.address, amountSentFromANonDAOAddress, await getLatestBlockTimestamp())
      .and.to.be.revertedWith(`TreasuryDAO__SendETHToGovernanceContractToBuyTokens(${DAO.address})`);
    expect(await treasuryDAO.getBalance()).to.equal(initialBalance);

    const amountSentFromDAO = ethers.utils.parseEther("1.0");
    await expect(
      DAO.sendTransaction({
        to: treasuryDAO,
        value: amountSentFromDAO,
      })
    )
      .to.emit(treasuryDAO, "ReceiveTriggered")
      .withArgs(DAO.address, amountSentFromDAO, await getLatestBlockTimestamp())
      .and.to.emit(treasuryDAO, "Deposit")
      .withArgs(DAO.address, amountSentFromDAO, await getLatestBlockTimestamp());
    expect(await treasuryDAO.getBalance()).to.equal(amountSentFromDAO);
  });
});
