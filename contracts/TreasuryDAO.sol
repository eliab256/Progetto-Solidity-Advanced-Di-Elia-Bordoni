// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TreasuryDAO is ReentrancyGuard {

//custom errors
    error TreasuryDAO__SendETHToGovernanceContractToBuyTokens(address _DaoAddress);
    error TreasuryDAO__UseGovernanceContractToInteractWithTheDAO(address _DAOAddress);
    error TreasuryDAO__NotOwner();
    error TreasuryDAO__NotDAO();
    error TreasuryDAO__InvalidInputValue();
    error TreasuryDAO__TryingToWithdrawMoreETHThenBalance(uint256 _amountWithdraw, uint256 _contractBalance);
    error TreasuryDAO__NothingToWithdraw();

//events
    event Deposit(address indexed from, uint256 amount, uint256 timestamp);
    event FailedWithdraw(address indexed recipient, uint256 amount, uint256 timestamp);
    event SuccesfulTWithdraw(address indexed recipient, uint256 amount, uint256 timestamp);
    event ReceiveTriggered(address sender, uint256 amount, uint256 timestamp);
    event FallbackTriggered(address sender, uint256 amount, bytes data, uint256 timestamp);
    event EmergencyWithdraw(uint256 amount, uint256 timestamp);

//modifiers
    modifier onlyOwner() {
        if(msg.sender != i_Owner){ revert TreasuryDAO__NotOwner();}
        _;
    }

    modifier onlyDAO(){
        if(msg.sender != i_DAOContract){revert TreasuryDAO__NotDAO();}
        _;
    }

//variables and mappings
    address immutable i_Owner;
    address immutable i_DAOContract;
    address payable immutable payableOwner = payable(i_Owner);

//constructor
    constructor(address _teamAddress){
        i_Owner = _teamAddress;
        i_DAOContract = msg.sender;
    }

//functions

    function getBalance() public view returns (uint256) {
    return address(this).balance;
    }

    function withdraw(uint256 _amount, address _recipient) external onlyDAO{
        if(_amount <= 0){revert TreasuryDAO__InvalidInputValue();}
        if(_amount > address(this).balance){revert TreasuryDAO__TryingToWithdrawMoreETHThenBalance(_amount, address(this).balance);}
        bool sendSuccess = payable(_recipient).send(_amount);
        if (!sendSuccess) {
            emit FailedWithdraw(_recipient, _amount, block.timestamp);
        } else emit SuccesfulTWithdraw(_recipient, _amount, block.timestamp);
    }

    function emergencyWithdraw() external onlyOwner {
        if(address(this).balance == 0){revert TreasuryDAO__NothingToWithdraw();}
        payableOwner.transfer(address(this).balance);
        emit EmergencyWithdraw(address(this).balance, block.timestamp);
    }

    receive() external payable{
        emit ReceiveTriggered(msg.sender, msg.value, block.timestamp);
        if(msg.sender == i_DAOContract){
            emit Deposit(msg.sender, msg.value, block.timestamp);
        } else revert TreasuryDAO__SendETHToGovernanceContractToBuyTokens(i_DAOContract);
    }

    fallback() external payable{
        emit FallbackTriggered(msg.sender, msg.value, msg.data, block.timestamp);
        revert TreasuryDAO__UseGovernanceContractToInteractWithTheDAO(i_DAOContract);   
    }

}

