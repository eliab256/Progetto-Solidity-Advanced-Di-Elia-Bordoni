// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TreasuryDAO is ReentrancyGuard {

//custom errors
    error TreasuryDAO__SendETHToGovernanceContractToBuyTokens(address _DaoAddress);
    error TreasuryDAO__UseGovernanceContractToInteractWithTheDAO(address _DAOAddress);

//events
    event Deposit(address indexed from, uint256 amount);
    event Withdrawal(address indexed to, uint256 amount);
    event ReceiveTriggered(address sender, uint256 amount, uint256 timestamp);
    event FallbackTriggered(address sender, uint256 amount, bytes data, uint256 timestamp);

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

    receive() external payable{
        emit ReceiveTriggered(msg.sender, msg.value, block.timestamp);
        revert TreasuryDAO__SendETHToGovernanceContractToBuyTokens(i_DAOContract);
    
    }

    fallback() external payable{
        emit FallbackTriggered(msg.sender, msg.value, msg.data, block.timestamp);
        revert TreasuryDAO__UseGovernanceContractToInteractWithTheDAO(i_DAOContract);
        
    }

}

