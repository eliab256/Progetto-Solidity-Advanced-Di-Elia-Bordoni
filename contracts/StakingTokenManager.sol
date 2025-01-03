// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingTokenManager is ReentrancyGuard {

//custom errors 
    error StakingTokenManager__TransferToStakingFailed();
    error StakingTokenManager__NoTokensStaked();
    error StakingTokenManager__AmountHigherThanStakedTokens();
    error StakingTokenManager__TransferTounstakeFailed();
    error StakingTokenManager__NotOwner();
    error StakingTokenManager__NotDAO();
    error StakingTokenManager__TokensLockedDueToActiveProposal();
    error StakingTokenManager__TokensAlreadyLocked();
    error StakingTokenManager__NoTokensToUnlock();

//events
    event TokensStaked(address indexed user, uint256 amount, uint256 timestamp);
    event TokensUnstaked(address indexed user, uint256 amount, uint256 timestamp);

//modifiers
    modifier onlyOwner() {
        if(msg.sender != i_teamAddress){ revert StakingTokenManager__NotOwner();}
        _;
    }

    modifier onlyDAO(){
        if(msg.sender != i_DaoContractAddress){revert StakingTokenManager__NotDAO();}
        _;
    }

//variables and mapping
    IERC20 public immutable i_tokenAddress;
    address immutable i_teamAddress;
    address immutable i_DaoContractAddress;
    uint256 immutable i_slashingPercent;

    mapping(address => uint256) stakingBalances;
    mapping(address => bool) lockedStakedTokens;

    constructor(
        address _teamAddress, 
        address _DaoAddress, 
        address _tokenAddress,
        uint256 _slashingPercent
        ){
        i_tokenAddress = IERC20(_tokenAddress);
        i_teamAddress = _teamAddress;
        i_DaoContractAddress = _DaoAddress;
        i_slashingPercent = _slashingPercent;
    }

//functions

    function stakeTokens(uint256 _amount) external {
        bool transferSuccess = i_tokenAddress.transferFrom(msg.sender, address(this), _amount);
        if (!transferSuccess) {revert StakingTokenManager__TransferToStakingFailed();}

        stakingBalances[msg.sender] += _amount;
        emit TokensStaked(msg.sender, _amount, block.timestamp);
    }

    function unstakeTokens(uint256 _amount) external {
        uint256 amountStaked = stakingBalances[msg.sender];
        if (amountStaked == 0) {revert StakingTokenManager__NoTokensStaked();}
        if (_amount > amountStaked){revert StakingTokenManager__AmountHigherThanStakedTokens();}
        if (lockedStakedTokens[msg.sender]){revert StakingTokenManager__TokensLockedDueToActiveProposal();}

        stakingBalances[msg.sender] = amountStaked - _amount;
        bool trasferSuccess = i_tokenAddress.transfer(msg.sender, _amount);
        if (!trasferSuccess) {revert StakingTokenManager__TransferTounstakeFailed();}

        emit TokensUnstaked(msg.sender, _amount, block.timestamp);
    }

    function lockStakedTokens(address _address) external onlyDAO{
        if(lockedStakedTokens[_address]){revert StakingTokenManager__TokensAlreadyLocked(); }
        lockedStakedTokens[_address] = true;
    }

    function unlockStakedTokens(address _address) external onlyDAO{
        if(!lockedStakedTokens[_address]){revert StakingTokenManager__NoTokensToUnlock(); }
        lockedStakedTokens[_address] = false;
    }

    function tokenSlasher(address _slashingTarget) external {

    }

    function getUserStakedTokens(address _address) external view onlyDAO returns(uint256) {
        return stakingBalances[_address];
    }

    function getDelegateeList() public {}

}