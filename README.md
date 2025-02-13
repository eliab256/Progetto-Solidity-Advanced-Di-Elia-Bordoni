# Moove DAO: A Blockchain Solution for Collaborative Micro-Mobility Governance

This project consists of four different Solidity contracts that interact with each other. These contracts are deployed on the Sepolia test network. The project involves the creation of a DAO to allow both Moove users and non-users to participate in decision-making. The project includes:

- **DAO Contract**: Manages governance and is the contract from which all other contracts are deployed.
- **GovernanceToken**: Enables the creation and initial distribution of governance tokens, which will allow users to vote.
- **StakingTokenManager**: Manages staking. Staking will enable users to vote, offer themselves as delegates, and make proposals based on the amount of tokens staked.
- **TreasuryDAO**: Manages the DAO's treasury.
- **GovernanceDelegationLibrary**: is a library for some delegatee and delegators functions.

## Index

    1. Description
    2. Contract Address on Sepolia
    3. Project Structure
    4. Clone and Configuration
    5. Technical Choices
    6. Contributing
    7. License
    8. Contacts

## 1. Description

This protocol aims to include customers and interested individuals in the company's decision-making process. Although a portion of the tokens will always remain with the company, anyone who wishes can buy tokens and stake them to gain voting power equal to the number of tokens staked.  
These contracts have been designed to be as flexible as possible, allowing the company to determine the number of tokens created and the portion that will remain in their possession. They can also set the token thresholds that a user must meet to vote, act as a delegate, or make proposals.  
Another available option is the **legacy user list**: the company can choose to collect the addresses of former customers interested in the project, and at the time of deployment, each legacy user will receive tokens based on the amount allocated to this list and the total number of participants.  
A second option is an **airdrop** for individuals who purchase tokens within a specified timeframe.  
The voting system supports both **direct democracy** and **liquid democracy**. In the latter case, only those who explicitly apply can serve as delegates for voters, preventing potential issues.  
Additionally, the contract records all proposals along with relevant information and a voting registry.
It is not necessary to deploy the four contracts separately, as the constructor of the GovernanceDAO contract will automatically deploy the other three contracts.
These contracts have been tested with 107 Hardhat tests, achieving approximately 93% coverage.

## 2. Contract Address on Sepolia

    Contract GovernanceDAO:
    Contract GovernanceToken:
    Contract StakingTokenManager:
    Contract TreasuryDAO:
    LibraryGovernanceDelegationLibrary:

## 3. Project structure

    The project has 3 main folders:

    1. Contracts: this folder contains all of 5 contract
    2. Artifact/Contracts: this folder contains all artifacts and debug file
    3. Test: this folder contais all the test. Each smart contract has his own file test.

## 4. Clone and Configuration

    1.  **Clone the repository**:

        ```bash
        git clone https://github.com/eliab256/Progetto-Solidity-Advanced-Di-Elia-Bordoni.git
        ```
    2.  **Navigate into the project directory**:

        ```bash
        cd Progetto-Smart-Contract-Con-Solidity--Advanced-Di-Elia-Bordoni
        ```

## 5. Technical Choices

    Languages
        -- **Solidity**: Solidity was chosen as it is the primary language for developing smart contracts on the Ethereum platform.

        -- **Typescript**: Typescript has been used to test the smart contract using Hardhat with EthersV6.


    Tools
        -- **Remix IDE**: Remix was used to write the contract. It is an online development environment that offers a wide range of tools to facilitate the development process.

        --**Hardhat**: is a development environment designed for Ethereum smart contracts. It provides a powerful and flexible framework for compiling, deploying, testing, and debugging smart contracts.


    Libraries
    This project uses the following libraries to enhance security, functionality, and integration with external data sources. Below is a list of the libraries, their purposes, and installation instructions.

        -- Chainlink
            - Purpose: Used to fetch the Ethereum price via Chainlink oracles, ensuring reliable and decentralized price data.
            - Installation:
            ```bash
            npm install @chainlink/contracts
            ```

        -- openZeppelin
            - Purpose: Provides security mechanisms, including ReentrancyGuard, which protects contracts from reentrancy attacks. Also provides the standard contract for ERC-20 token.
            - Installation:
            ```bash
            npm install @openzeppelin/contracts
            ```

        -- Ethers.js V6
            - Purpose: A JavaScript library for interacting with the Ethereum blockchain, used for contract deployment, transactions, and blockchain queries.
            - Installation:
            ```bash
            npm install ethers@6
            ```

        -- hardhat
            - Purpose: A development environment designed for Ethereum smart contracts. Hardhat is used for compiling, testing, deploying, and debugging smart contracts. It provides a local Ethereum network, automated testing, and detailed debugging.
            - Installation:
            ```bash
            npm --save-dev hardhat
            ```
    Hardhat pug-ins
        -- typechain
            - Purpose: TypeChain is a TypeScript binding generator for Ethereum smart contracts. It generates strongly typed TypeScript bindings for smart contracts, making it easier and safer to interact with your contracts in a TypeScript environment.
            - Installation:
            ```bash
            npm --save-dev hardhat
            ```

        -- coverage
            - Purpose: Hardhat Coverage is a plugin that enables code coverage reporting for Hardhat projects. It helps you track how much of your code is covered by tests.
            - Installation:
            ```bash
            npm install --save-dev hardhat-coverage
            ```

        -- ignition
            - Purpose: Hardhat Ignition is a plugin designed for the automated deployment of smart contracts to various Ethereum networks.
            - Installation:
            ```bash
            npm install --save-dev @nomiclabs/hardhat-ignition
            ```

## 6. Contributing

    Thank you for your interest in contributing to the Environmental Quiz App! Every contribution is valuable and helps improve the project. There are various ways you can contribute:

    - Bug Fixes: If you find a bug, feel free to submit a fix.
    - Adding New Features: Propose new features or improvements.
    - Documentation: Help improve the documentation by writing guides or enhancing existing ones.
    - Fork: fork this project on other chains
    - Testing and Refactoring: Run tests on the code and suggest improvements. How to Submit a Contribution Fork the repository: Click the "Fork" button in the upper right corner to create a copy of the repository in your GitHub account.
    - Clone your fork: git clone https://github.com/eliab256/Progetto-Smart-Contract-Con-Solidity-Advanced-Di-Elia-Bordoni.git
    - Create a Branch: git checkout -b branch-name
    - Add and commit your change: git add . git commit -m "Modify description"
    - Send your branch to the fork: git push origin nome-branch
    - Create a pull request

    Final Tips
    - Clarity: Ensure that the instructions are clear and easy to follow.
    - Test the Process: If possible, test the contribution process from an external perspective to ensure it flows smoothly.
    - Keep It Updated: Update this section if the guidelines change or if the project evolves.

## 7. License

    This project is licensed under the MIT License.

## 8. Contacts

    For more information, you can contact me:

        - Project Link: https://github.com/eliab256/Progetto-Smart-Contract-Con-Solidity-Advanced-Di-Elia-Bordoni
        - Website: https://elia-bordoni-blockchain-dev.netlify.app/
        - Email: bordonielia96@gmail.com
        - Linkedin: https://www.linkedin.com/in/elia-bordoni/
