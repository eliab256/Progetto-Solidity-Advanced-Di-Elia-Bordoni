const { ethers, hre } = require("hardhat");
const { expect } = require("chai");
import { Contract, parseUnits } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TreasuryDAO } from "../typechain-types/contracts";
import { getLatestBlockTimestamp } from "../Utils/getTimeBlockStamp";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";

describe("test studio", function () {
  let treasuryDAO: TreasuryDAO & Contract;
  let team: SignerWithAddress;
  let DAO: SignerWithAddress;
  let externalUser1: SignerWithAddress;
  let externalUser2: SignerWithAddress;

  function getEtherValue(value: number) {
    return ethers.utils.parseEther(`${value.toString()}`);
  }

  it("test di studio deploy", async function () {
    const [owner] = await ethers.getSigners();

    const TreasuryDAO = await hre.ethers.getContractFactory("TreasuryDAO");
    const treasuryDAO = await TreasuryDAO.deploy([owner]);
    await treasuryDAO.deployed();
    //const treasuryDAO = await ethers.deployContract("TreasuryDAO", [owner.address]);
    console.log("trasuryDAO", treasuryDAO);
    expect(true == true);
  });
});
