// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TreasuryDAO is ReentrancyGuard {

//custom errors


//events
    event Deposit(address indexed from, uint256 amount);
    event Withdrawal(address indexed to, uint256 amount);
    
//modifiers


//variables and mappings
    address immutable i_Owner;
    address immutable i_DAOContract;


//constructor
    constructor(address _teamAddress, address _DAOAddress){
        i_Owner = _teamAddress;
        i_DAOContract = _DAOAddress;
    }


//functions

    function getBalance() public view returns (uint256) {
    return address(this).balance;
    }
}

