# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```

librerie da installare:

- openzeppelin
- chainlink/contracts

librerie per test:

- dotenv

al momento del deploy i propietari inseriranno nome, simbolo, supply massima, supply da inviare al team e ai vecchi user al momento del deploy, supply da inviare agli utenti che interagiscono con il prootocollo entro un tot tempo e un array di indirizzi dei vecchi utenti. Il contratto invierà i token dove devono andare.

test
controllare i proprietari e i vari indirizzi da mettere in input
