import { task } from "hardhat/config";

task("input parameters verification", "Validate constructor inputs")
  .addParam("contract", "The address of the contract you want to verify")
  .addParam("abi", "The ABI file path of the contract")
  .addParam("uintFields", "The names of uint variables to check, separated by commas")
  .addOptionalParam("stringFields", "The names of string variables to check, separated by commas", "")
  .setAction(async (taskArgs, hre) => {
    const contractAddress = taskArgs.contract;
    const abiPath = taskArgs.abi;
    const uintFieldNames = taskArgs.uintFields.split(",");
    const stringFieldNames = taskArgs.stringFields ? taskArgs.stringFields.split(",") : [];

    const abi = require(abiPath);
    const contract = new hre.ethers.Contract(contractAddress, abi, hre.ethers.provider);

    let allValid = true;

    // Check uint fields
    for (const field of uintFieldNames) {
      try {
        const value = await contract[field]();
        console.log(`Uint field ${field}: ${value} - ${value !== 0 ? "Not Zero" : "Zero"}`);
        if (value === 0) {
          allValid = false;
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error reading uint field '${field}':`, error.message);
        } else {
          console.error(`Unknown error reading uint field '${field}':`, error);
        }
        allValid = false;
      }
    }

    // Check string fields
    for (const field of stringFieldNames) {
      try {
        const value = await contract[field]();
        console.log(`String field ${field}: "${value}" - ${value.length > 0 ? "Not Empty" : "Empty"}`);
        if (value.length === 0) {
          allValid = false;
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error reading string field '${field}':`, error.message);
        } else {
          console.error(`Unknown error reading string field '${field}':`, error);
        }
        allValid = false;
      }
    }

    if (!allValid) {
      console.error("Error: At least one value is invalid (Zero or Empty)!");
      process.exit(1);
    } else {
      console.log("All specified values are valid!");
    }
  });
