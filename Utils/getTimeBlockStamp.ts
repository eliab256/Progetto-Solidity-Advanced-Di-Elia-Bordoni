import { ethers } from "hardhat";

/**
 * Gets the timestamp of the latest block mined.
 * @returns {Promise<number>} The timestamp of the latest block.
 */
export async function getLatestBlockTimestamp(): Promise<number> {
  const latestBlock = await ethers.provider.getBlock("latest");

  if (!latestBlock) {
    throw new Error("Unable to fetch the latest block.");
  }

  return latestBlock.timestamp;
}
