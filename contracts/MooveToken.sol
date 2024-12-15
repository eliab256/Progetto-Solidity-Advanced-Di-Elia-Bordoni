// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20";

contract MooveToken is ERC20Capped {

    address public teamAddress;

    modifier onlyOwner() {
        require(msg.sender == teamAddress, "Not authorized");
        _;
        }

    //minting sessions
    uint256 public teamMint;    
    uint256 public olderUsersMint;    
    uint256 public earlyAdopterMint;    

    constructor(
        string memory name,        // Nome del token
        string memory symbol,      // Simbolo del token
        uint256 initialSupply,     // Supply iniziale
        uint256 cap,                // Massima supply (cap)
        uint256 olderUsersMintSupply,
        uint256 earlyAdopterMintSupply
    ) ERC20(name, symbol) ERC20Capped(cap) {
        require(initialSupply <= cap, "Initial supply exceeds cap");
        teamAddress = msg.sender;
        _mint(msg.sender, initialSupply);
        teamMint = initialSupply;
        olderUsersMint = olderUsersMintSupply;
        earlyAdopterMint = earlyAdopterMintSupply;
    }
}