// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20";

contract MooveToken is ERC20Capped {

    uint256 deployTimeStamp;
    uint256 timestampWeek = 604800;

    address public teamAddress;
    mapping(address => bool) public olderUsersAddresses;

    modifier onlyOwner() {
        require(msg.sender == teamAddress, "Not authorized");
        _;
        }

    modifier onlyOlderUsers(){
        require(olderUsersAddresses[msg.sender] == true, "Not an older user");
        _;
    }

    //minting sessions
    uint256 public teamMint;    
    uint256 public olderUsersMintSupply;    
    uint256 public earlyAdopterMintSupply;    

    constructor(
        string memory _name,                // Nome del token
        string memory _symbol,              // Simbolo del token
        uint256 _initialSupply,             // Supply iniziale
        uint256 _cap,                       // Massima supply (cap)
        uint256 _olderUsersMintSupply,
        uint256 _earlyAdopterMintSupply,
        address[] memory _olderUsersAddress
    ) ERC20(_name, _symbol) ERC20Capped(_cap) {
        require(_initialSupply <= _cap, "Initial supply exceeds cap");
        teamAddress = msg.sender;
        _mint(msg.sender, _initialSupply);
        teamMint = _initialSupply;
        olderUsersMintSupply = _olderUsersMintSupply;
        earlyAdopterMintSupply = _earlyAdopterMintSupply;

        for (uint256 i = 0; i < __olderUsersAddresses.length; i++) {
            olderUsersAddresses[_olderUsersAddresses[i]] = true;
        }

        deployTimeStamp = block.timestamp / 86400 * 86400;
    }

    function requireOlderUsersMint() public onlyOlderUsers {
        uint256 tokenForUser = olderUsersMintSupply / olderUsersAddresses.length;

        require(block.timestamp < deployTimeStamp + (timestampWeek * 4), "The claim period has expired");
        require(balanceOf(address(this)) >= tokenForUser, "Not enough tokens in contract");

        _transfer(address(this),msg.sender,tokenForUser);
    }
}