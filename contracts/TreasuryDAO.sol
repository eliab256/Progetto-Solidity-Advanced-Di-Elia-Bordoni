// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TreasuryDAO is ReentrancyGuard {

//errors


//modifiers


//variables and mappings
    address immutable i_teamAddress;
    address immutable i_DAOAddress;

//events
    event Deposit(address indexed from, uint256 amount);
    event Withdrawal(address indexed to, uint256 amount);

//constructor
    constructor(address _teamAddress, address _DAOAddress){
        i_teamAddress = _teamAddress;
        i_DAOAddress = _DAOAddress;
    }


//functions

    function getBalance() public view returns (uint256) {
    return address(this).balance;
    }
}

