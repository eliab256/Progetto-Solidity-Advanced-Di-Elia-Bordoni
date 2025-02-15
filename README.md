# Moove DAO: A Blockchain Solution for Collaborative Micro-Mobility Governance

This project consists of four different Solidity contracts that interact with each other. These contracts are deployed on the Sepolia test network. The project involves the creation of a DAO to allow both Moove users and non-users to participate in decision-making. The project includes:

- **DAO Contract**: Manages governance and is the contract from which all other contracts are deployed.
- **GovernanceToken**: Enables the creation and initial distribution of governance tokens, which will allow users to vote.
- **StakingTokenManager**: Manages staking. Staking will enable users to vote, offer themselves as delegates, and make proposals based on the amount of tokens staked.
- **TreasuryDAO**: Manages the DAO's treasury.
- **GovernanceDelegationLibrary**: A library for some delegatee and delegator functions.

## Index

1. [Description](#1-description)
2. [Contract Address on Sepolia](#2-contract-address-on-sepolia)
3. [Project Structure](#3-project-structure)
4. [Clone and Configuration](#4-clone-and-configuration)
5. [Technical Choices](#5-technical-choices)
6. [Contributing](#6-contributing)
7. [License](#7-license)
8. [Contacts](#8-contacts)

## 1. Description

This protocol aims to include customers and interested individuals in the company's decision-making process. Although a portion of the tokens will always remain with the company, anyone who wishes can buy tokens and stake them to gain voting power equal to the number of tokens staked.

These contracts have been designed to be as flexible as possible, allowing the company to determine the number of tokens created and the portion that will remain in their possession. They can also set the token thresholds that a user must meet to vote, act as a delegate, or make proposals.

Another available option is the **legacy user list**: the company can choose to collect the addresses of former customers interested in the project, and at the time of deployment, each legacy user will receive tokens based on the amount allocated to this list and the total number of participants.

A second option is an **airdrop** for individuals who purchase tokens within a specified timeframe.

The voting system supports both **direct democracy** and **liquid democracy**. In the latter case, only those who explicitly apply can serve as delegates for voters, preventing potential issues.

Additionally, the contract records all proposals along with relevant information and a voting registry.

It is not necessary to deploy the four contracts separately, as the constructor of the GovernanceDAO contract will automatically deploy the other three contracts.

These contracts have been tested with **107 Hardhat tests**, achieving approximately **93% coverage**.

## 2. Contract Address on Sepolia

- **Contract GovernanceDAO**: `[0xDcA1ecf6343117FDeA387c847746Ed299d6d32A1]`
- **Contract GovernanceToken**: `[0xbA8Bb4A4D0C594157C60FE92d8D786BE12F938e2]`
- **Contract StakingTokenManager**: `[0xC6737e38aAAeE984E4ba809F997C4507fB372a57]`
- **Contract TreasuryDAO**: `[0xaB3b83D0F549bE536f443b244B3001EE29bA440c]`

## 3. Project Structure

The project has three main folders:

1. **Contracts**: This folder contains all five contracts.
2. **Artifacts/Contracts**: This folder contains all artifacts and debug files.
3. **Test**: This folder contains all the tests. Each smart contract has its own test file.
4. **Script**: This folder constains two file to deploy the contract. deploy.ts is the deploy script, arguments.ts is the file that pass al the parameters to the constract's constructor.

## 4. Clone and Configuration

1. **Clone the repository**:

   ```bash
   git clone https://github.com/eliab256/Progetto-Solidity-Advanced-Di-Elia-Bordoni.git
   ```

2. **Navigate into the project directory**:

   ```bash
   cd Progetto-Smart-Contract-Con-Solidity-Advanced-Di-Elia-Bordoni
   ```

## 5. Technical Choices

### Languages

- **Solidity**: Chosen as the primary language for developing smart contracts on Ethereum.
- **TypeScript**: Used to test the smart contracts with Hardhat and Ethers.js V6.

### Tools

- **Remix IDE**: Used for writing and testing smart contracts in an online environment.
- **Hardhat**: A development environment for compiling, deploying, testing, and debugging smart contracts.

### Libraries

- **Chainlink**

  - **Purpose**: Fetches Ethereum price via Chainlink oracles, ensuring reliable and decentralized price data.
  - **Installation**:
    ```bash
    npm install @chainlink/contracts
    ```

- **OpenZeppelin**

  - **Purpose**: Provides security mechanisms, including ReentrancyGuard and the standard ERC-20 token contract.
  - **Installation**:
    ```bash
    npm install @openzeppelin/contracts
    ```

- **Ethers.js V6**

  - **Purpose**: A JavaScript library for interacting with the Ethereum blockchain.
  - **Installation**:
    ```bash
    npm install ethers@6
    ```

- **Hardhat**

  - **Purpose**: A development environment for smart contract deployment and testing.
  - **Installation**:
    ```bash
    npm install --save-dev hardhat
    ```

- **Dotenv**
  - **Purpose**: Library to upload variable like API and private key.
  - **Installation**:
    ```bash
    npm install dotenv
    ```

### Hardhat Plugins

- **TypeChain**

  - **Purpose**: Generates TypeScript bindings for smart contracts, improving type safety.
  - **Installation**:
    ```bash
    npm install --save-dev hardhat
    ```

- **Coverage**

  - **Purpose**: Provides test coverage reporting for Hardhat projects.
  - **Installation**:
    ```bash
    npm install --save-dev hardhat-coverage
    ```

- **Ignition**

  - **Purpose**: Automates deployment of smart contracts to different Ethereum networks.
  - **Installation**:
    ```bash
    npm install --save-dev @nomiclabs/hardhat-ignition
    ```

- **Verify**
  - **Purpose**: AThis allows users to interact with the contract directly from the blockchain explorer.
  - **Installation**:
    ```bash
    npm install --save-dev @nomicfoundation/hardhat-verify
    ```

## 6. Contributing

Thank you for your interest in contributing to **Moove DAO**! Every contribution is valuable and helps improve the project. There are various ways you can contribute:

- **Bug Fixes**: If you find a bug, feel free to submit a fix.
- **Adding New Features**: Propose new features or improvements.
- **Documentation**: Help improve the documentation.
- **Fork**: Fork this project onto other chains.
- **Testing and Refactoring**: Run tests on the code and suggest improvements.

### How to Submit a Contribution

1. **Fork the repository**: Click the "Fork" button to create a copy of the repo.
2. **Clone your fork**:

   ```bash
   git clone https://github.com/eliab256/Progetto-Smart-Contract-Con-Solidity-Advanced-Di-Elia-Bordoni.git
   ```

3. **Create a new branch**:

   ```bash
   git checkout -b branch-name
   ```

4. **Commit your changes**:

   ```bash
   git add .
   git commit -m "Modify description"
   ```

5. **Push your branch and create a pull request**:

   ```bash
   git push origin branch-name
   ```

## 7. License

This project is licensed under the **MIT License**.

## 8. Contacts

For more information, you can contact me:

- **Project Link**: [GitHub Repository](https://github.com/eliab256/Progetto-Smart-Contract-Con-Solidity-Advanced-Di-Elia-Bordoni)
- **Website**: [Portfolio](https://elia-bordoni-blockchain-dev.netlify.app/)
- **Email**: bordonielia96@gmail.com
- **LinkedIn**: [Elia Bordoni](https://www.linkedin.com/in/elia-bordoni/)
