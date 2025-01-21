const { ethers } = require("hardhat");
const { expect } = require("chai");
import { Contract, parseUnits } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TreasuryDAO } from "../typechain-types/contracts";
import { getLatestBlockTimestamp } from "../Utils/getTimeBlockStamp";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";

describe("TreasuryDAO", function () {
  let treasuryDAO: TreasuryDAO & Contract;
  let team: SignerWithAddress;
  let DAO: SignerWithAddress;
  let externalUser1: SignerWithAddress;
  let externalUser2: SignerWithAddress;

  function getEtherValue(value: number) {
    return ethers.utils.parseEther(`${value.toString()}`);
  }

  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    DAO = signers[0];
    team = signers[1];
    externalUser1 = signers[2];
    externalUser2 = signers[3];

    //const DAOBalance = await ethers.provider.getBalance(DAO.address);
    //const teamBalance = await ethers.provider.getBalance(team.address);
    //const extUser1Balance = await ethers.provider.getBalance(externalUser1.address);
    //const extUser2Balance = await ethers.provider.getBalance(externalUser2.address);

    //treasuryDAO = await ethers.deployContract("TreasuryDAO", [team.address]);

    const TreasuryDAO = await ethers.getContractFactory("TreasuryDAO", [team.address]);
    treasuryDAO = await TreasuryDAO.deploy();
    await treasuryDAO.deployed();
  });

  it("should deploy TreasuryDAO correctly", async function () {
    await expect(treasuryDAO)
      .to.emit(treasuryDAO, "TeasuryDAOContractDeployedCorrectly")
      .withArgs(team.address, DAO.address);
  });

  it("should return the correct  balance of the contract", async function () {
    const balance = await treasuryDAO.getBalance();
    expect(balance).to.equal(0);

    const newBalance = 100;
    await setBalance(treasuryDAO.address, getEtherValue(newBalance));
    expect(await treasuryDAO.getBalance()).to.equal(newBalance);
  });

  it("should allow the DAO only to withdraw funds successfully", async function () {
    const receiver = externalUser1.address;
    const initialContractBalance = getEtherValue(100);
    await setBalance(treasuryDAO.address, getEtherValue(initialContractBalance));
    const DAOInitialBalance = getEtherValue(50);
    await setBalance(DAO.address, getEtherValue(initialContractBalance));
    const extUser1InitialBalance = getEtherValue(0);
    await setBalance(externalUser1.address, getEtherValue(initialContractBalance));

    const withdrawAmount = getEtherValue(10);
    const tx = await treasuryDAO.connect(DAO).withdraw(withdrawAmount, receiver);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction receipt is null");

    await expect(tx)
      .to.emit(treasuryDAO, "SuccesfulTWithdraw")
      .withArgs(receiver, initialContractBalance, await getLatestBlockTimestamp());

    const extUser1FinalBalance = extUser1InitialBalance.add(withdrawAmount);
    const expectedExtUser1Balance = await ethers.provider.getBalance(receiver);

    const expectedFinalContractBalance = initialContractBalance.sub(withdrawAmount);
    const finalContractBalance = await ethers.provider.getBalance(treasuryDAO.address);

    expect(await extUser1FinalBalance.to.equal(expectedExtUser1Balance));
    expect(await finalContractBalance.to.equal(expectedFinalContractBalance));

    await expect(
      treasuryDAO.connect(externalUser1).withdraw(withdrawAmount, externalUser2.address)
    ).to.be.revertedWithCustomError(treasuryDAO, "Only DAO can withdraw funds");
  });

  it("only owner should be able to do an emergency widthraw", async function () {
    const initialContractBalance = getEtherValue(100);
    await setBalance(treasuryDAO.address, initialContractBalance);

    await expect(treasuryDAO.connect(externalUser1).emergencyWithdraw()).to.be.revertedWithCustomError(
      treasuryDAO,
      "TreasuryDAO__OnlyOwner"
    );

    const initialTeamBalance = getEtherValue(1);
    await setBalance(team.address, initialTeamBalance);
    const tx = await treasuryDAO.connect(team).emergencyWithdraw();
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction receipt is null");

    await expect(tx)
      .to.emit(treasuryDAO, "EmergencyWithdraw")
      .withArgs(initialContractBalance, await getLatestBlockTimestamp());

    const finalContractBalance = await ethers.provider.getBalance();
    expect(finalContractBalance).to.equal(0);

    const teamFinalBalance = await ethers.provider.getBalance(team.address);
    expect(teamFinalBalance).to.be.gte(initialContractBalance);

    console.log(
      "Initial state Team Balance:",
      initialTeamBalance.toString(),
      "initial state contract Balance:",
      initialContractBalance.toString()
    );
    console.log(
      "Final state Team Balance:",
      teamFinalBalance.toString(),
      "final state contract Balance:",
      finalContractBalance.toString()
    );

    await expect(treasuryDAO.connect(team).emergencyWithdraw()).to.be.revertedWithCustomError(
      treasuryDAO,
      "TreasuryDAO__NothingToWithdraw"
    );
  });

  it("should receive funds from DAO contract only", async function () {
    const initialBalance = await treasuryDAO.getBalance();

    const amountSentFromANonDAOAddress = getEtherValue(10);
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

    const amountSentFromDAO = getEtherValue(10);
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

  it("fallback should revert and emit an event", async function () {
    const amountToSend = getEtherValue(10);
    const randomData = ethers.utils.hexlify(ethers.utils.randomBytes(10));
    await expect(
      externalUser1.sendTransaction({
        to: treasuryDAO,
        value: amountToSend,
        data: randomData,
      })
    )
      .to.emit(treasuryDAO, "FallbackTriggered")
      .withArgs(externalUser1, amountToSend, randomData, await getLatestBlockTimestamp())
      .and.to.be.revertedWith(`TreasuryDAO__UseGovernanceContractToInteractWithTheDAO(${DAO.address})`);
    expect(await treasuryDAO.getBalance()).to.equal(0);
  });
});
