const { ethers } = require("hardhat");
const { expect } = require("chai");
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TreasuryDAO } from "../typechain-types/contracts";
import { getLatestBlockTimestamp } from "../Utils/getTimeBlockStamp";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";

function getEtherValue(value: number): bigint {
  return ethers.parseEther(`${value.toString()}`);
}

describe("TreasuryDAO", function () {
  let treasuryDAO: TreasuryDAO & Contract;
  let team: SignerWithAddress;
  let DAO: SignerWithAddress;
  let externalUser1: SignerWithAddress;
  let externalUser2: SignerWithAddress;

  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    DAO = signers[0];
    team = signers[1];
    externalUser1 = signers[2];
    externalUser2 = signers[3];

    const TreasuryDAO = await ethers.getContractFactory("TreasuryDAO");
    treasuryDAO = (await TreasuryDAO.deploy(team.address)) as TreasuryDAO & Contract;
    await treasuryDAO.waitForDeployment();
  });

  it("should deploy TreasuryDAO correctly and emit the event", async function () {
    const teamAddress = await treasuryDAO.i_Owner();
    const DAOAddress = await treasuryDAO.i_DAOContract();

    expect(teamAddress).to.be.properAddress;
    expect(DAOAddress).to.be.properAddress;

    await expect(treasuryDAO.target).to.not.equal(0x0000000000000000000000000000000000000000);

    await expect(treasuryDAO)
      .to.emit(treasuryDAO, "TeasuryDAOContractDeployedCorrectly")
      .withArgs(teamAddress, DAOAddress);
  });

  it("should print correct addresses on deploy's event", async function () {
    const teamAddress = await treasuryDAO.i_Owner();
    const DAOAddress = await treasuryDAO.i_DAOContract();

    expect(await teamAddress).to.equal(team.address);
    expect(await DAOAddress).to.equal(DAO.address);
  });

  it("should return the correct  balance of the contract", async function () {
    const balance = await treasuryDAO.getBalance();
    expect(balance).to.equal(0);
  });

  it("should return the correct  balance of the contract with balance more than 0", async function () {
    const addingBalance = 100;
    await setBalance(treasuryDAO.target as string, getEtherValue(addingBalance));

    const newBalance = await treasuryDAO.getBalance();
    expect(await treasuryDAO.getBalance()).to.equal(newBalance);
  });

  describe("Withdraw function", async function () {
    it("should allow the DAO to withdraw funds successfully", async function () {
      const receiver = externalUser1.address;
      const initialContractBalance = getEtherValue(100);
      await setBalance(treasuryDAO.target as string, initialContractBalance);
      await setBalance(DAO.address, initialContractBalance);
      const extUser1InitialBalance = getEtherValue(0);
      await setBalance(externalUser1.address, extUser1InitialBalance);

      const withdrawAmount = getEtherValue(10);
      const tx = await treasuryDAO.connect(DAO).withdraw(withdrawAmount, receiver);
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt is null");

      await expect(tx)
        .to.emit(treasuryDAO, "SuccesfulTWithdraw")
        .withArgs(receiver, withdrawAmount, await getLatestBlockTimestamp());

      const extUser1FinalBalance = extUser1InitialBalance + withdrawAmount;
      const expectedExtUser1Balance: bigint = await ethers.provider.getBalance(receiver);

      const expectedFinalContractBalance = initialContractBalance - withdrawAmount;
      const finalContractBalance: bigint = await ethers.provider.getBalance(treasuryDAO.target);

      expect(extUser1FinalBalance).to.equal(expectedExtUser1Balance);
      expect(finalContractBalance).to.equal(expectedFinalContractBalance);
    });

    it("should revert if other user try to withdraw funds", async function () {
      const receiver = externalUser2.address;
      const initialContractBalance = getEtherValue(100);
      await setBalance(treasuryDAO.target as string, initialContractBalance);

      const withdrawAmount = getEtherValue(10);
      await expect(treasuryDAO.connect(externalUser1).withdraw(withdrawAmount, receiver)).to.be.revertedWithCustomError(
        treasuryDAO,
        "TreasuryDAO__NotDAO"
      );
    });

    it("should revert if amount exceed contract balance", async function () {
      const receiver = externalUser1.address;
      const initialContractBalance = getEtherValue(100);
      await setBalance(treasuryDAO.target as string, initialContractBalance);
      const extUser1InitialBalance = getEtherValue(0);
      await setBalance(externalUser1.address, extUser1InitialBalance);

      const withdrawAmount = getEtherValue(110);
      await expect(treasuryDAO.connect(DAO).withdraw(withdrawAmount, receiver))
        .to.be.revertedWithCustomError(treasuryDAO, "TreasuryDAO__TryingToWithdrawMoreETHThenBalance")
        .withArgs(withdrawAmount, treasuryDAO.getBalance());
    });

    it("should revert if the amount of withdraw is zero", async function () {
      const initialContractBalance = getEtherValue(100);
      await setBalance(treasuryDAO.target as string, initialContractBalance);

      const withdrawAmount = getEtherValue(0);
      await expect(treasuryDAO.connect(DAO).withdraw(withdrawAmount, DAO)).to.be.revertedWithCustomError(
        treasuryDAO,
        "TreasuryDAO__InvalidInputValue"
      );
    });
  });

  describe("emergencyWithdraw function", async function () {
    it("should revert if external user try to call emergency widthraw", async function () {
      const initialContractBalance = getEtherValue(100);
      await setBalance(treasuryDAO.target as string, initialContractBalance);

      const externalUser1Balance = getEtherValue(1);
      await setBalance(externalUser1.address as string, externalUser1Balance);

      await expect(treasuryDAO.connect(externalUser1).emergencyWithdraw()).to.be.revertedWithCustomError(
        treasuryDAO,
        "TreasuryDAO__NotOwner"
      );
    });

    it("emergency widthraw should revert if balance is equal tyo zero", async function () {
      const initialContractBalance = getEtherValue(0);
      await setBalance(treasuryDAO.target as string, initialContractBalance);

      await expect(treasuryDAO.connect(team).emergencyWithdraw()).to.be.revertedWithCustomError(
        treasuryDAO,
        "TreasuryDAO__NothingToWithdraw"
      );
    });

    it("team should allowed to do emergency withdraw", async function () {
      const initialContractBalance = getEtherValue(100);
      await setBalance(treasuryDAO.target as string, initialContractBalance);

      const initialTeamBalance = getEtherValue(1);
      await setBalance(team.address as string, initialTeamBalance);

      const tx = await treasuryDAO.connect(team).emergencyWithdraw();
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt is null");

      await expect(tx)
        .to.emit(treasuryDAO, "EmergencyWithdraw")
        .withArgs(tx.value, await getLatestBlockTimestamp());

      const finalContractBalance = await ethers.provider.getBalance(treasuryDAO.target);
      expect(finalContractBalance).to.equal(0);

      const finalTeamBalance = await ethers.provider.getBalance(team.address);
      expect(finalTeamBalance).to.be.greaterThan(initialContractBalance);
    });
  });

  describe("receive funds", async function () {
    let contractInitialBalance: bigint;
    let extUser1InitialBalance: bigint;
    let DAOInitialBalance: bigint;
    let amountSent: bigint;
    beforeEach(async function () {
      contractInitialBalance = await treasuryDAO.getBalance();
      extUser1InitialBalance = getEtherValue(11);
      DAOInitialBalance = getEtherValue(11);
      amountSent = getEtherValue(10);
    });

    it("should receive funds from DAO contract only", async function () {
      await setBalance(DAO.address as string, DAOInitialBalance);
      const tx = await DAO.sendTransaction({
        to: treasuryDAO.target,
        value: amountSent,
      });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction receipt is null");

      await expect(tx)
        .and.to.emit(treasuryDAO, "Deposit")
        .withArgs(DAO.address, amountSent, await getLatestBlockTimestamp());
      const finalContractBalance = await treasuryDAO.getBalance();
      expect(finalContractBalance).to.equal(contractInitialBalance + amountSent);
      expect(await ethers.provider.getBalance(DAO.address)).to.be.lt(DAOInitialBalance - amountSent);
    });

    it("should revert if someone except DAO try to add funds", async function () {
      await setBalance(externalUser1.address as string, extUser1InitialBalance);
      await expect(
        externalUser1.sendTransaction({
          to: treasuryDAO.target,
          value: amountSent,
        })
      )
        .to.be.revertedWithCustomError(treasuryDAO, "TreasuryDAO__SendETHToGovernanceContractToBuyTokens")
        .withArgs(DAO.address);
      expect(await treasuryDAO.getBalance()).to.equal(contractInitialBalance);
    });

    it("fallback should revert", async function () {
      const randomData = ethers.hexlify(ethers.randomBytes(8));
      await expect(
        externalUser1.sendTransaction({
          to: treasuryDAO,
          value: amountSent,
          data: randomData,
        })
      )
        .and.to.be.revertedWithCustomError(treasuryDAO, `TreasuryDAO__UseGovernanceContractToInteractWithTheDAO`)
        .withArgs(DAO.address);
      expect(await treasuryDAO.getBalance()).to.equal(0);
    });
  });
});
