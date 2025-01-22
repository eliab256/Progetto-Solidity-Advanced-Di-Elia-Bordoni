// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingTokenManager is ReentrancyGuard {

//custom errors 
    error StakingTokenManager__TransferToStakingFailed();
    error StakingTokenManager__NoAvailableTokensToStake();
    error StakingTokenManager__NoTokensStaked();
    error StakingTokenManager__AmountHigherThanStakedTokens();
    error StakingTokenManager__TransferTounstakeFailed();
    error StakingTokenManager__NotOwner();
    error StakingTokenManager__NotDAO();
    error StakingTokenManager__TokensLockedDueToActiveProposal();
    error StakingTokenManager__TokensAlreadyLocked();
    error StakingTokenManager__NoTokensToUnlock();
    error StakingTokenManager__SlashingTransferFailed();
    error StakingTokenManager__SendETHToGovernanceContractToBuyTokens(address _DAOAddress);
    error StakingTokenManager__UseGovernanceContractToInteractWithTheDAO(address _DAOAddress);

//events
    event StakingTokenManagerContractDeployedCorrectly(address teamAddress, address tokenAddress, address daoAddress, uint256 slashingPercent);
    event TokensStaked(address indexed user, uint256 amount, uint256 timestamp);
    event TokensUnstaked(address indexed user, uint256 amount, uint256 timestamp);
    event TokenSlashed(address indexed user, uint256 amount, uint256 timestamp);
    event TokenLoched(address indexed user, uint256 timestamp);
    event TokenUnlocked(address indexed user, uint256 timestamp);
    event ReceiveTriggered(address sender, uint256 amount, uint256 timestamp);
    event FallbackTriggered(address sender, uint256 amount, bytes data, uint256 timestamp);


//modifiers
    modifier onlyOwner() {
        if(msg.sender != i_Owner){ revert StakingTokenManager__NotOwner();}
        _;
    }

    modifier onlyDAO(){
        if(msg.sender != i_DAOContract){revert StakingTokenManager__NotDAO();}
        _;
    }

//variables and mapping
    IERC20 public immutable i_tokenContract;
    address immutable public i_Owner;
    address immutable public i_DAOContract;
    uint256 immutable public i_slashingPercent;

    mapping(address => uint256) stakingBalances;
    mapping(address => bool) lockedStakedTokens;

//constructor
    constructor(address _teamAddress, address _tokenAddress, uint256 _slashingPercent){
        i_tokenContract = IERC20(_tokenAddress);
        i_Owner = _teamAddress;
        i_DAOContract = msg.sender;
        i_slashingPercent = _slashingPercent;
        emit StakingTokenManagerContractDeployedCorrectly(_teamAddress, _tokenAddress, msg.sender, _slashingPercent);
    }

//functions
    function stakeTokens(uint256 _amount) external {
        if(i_tokenContract.balanceOf(msg.sender) <= 0){revert StakingTokenManager__NoAvailableTokensToStake();}
        stakingBalances[msg.sender] += _amount;

        bool transferSuccess = i_tokenContract.transferFrom(msg.sender, address(this), _amount);
        if (!transferSuccess) {revert StakingTokenManager__TransferToStakingFailed();}

        emit TokensStaked(msg.sender, _amount, block.timestamp);
    }

    function unstakeTokens(uint256 _amount) external {
        uint256 amountStaked = stakingBalances[msg.sender];
        if (amountStaked == 0) {revert StakingTokenManager__NoTokensStaked();}
        if (_amount > amountStaked){revert StakingTokenManager__AmountHigherThanStakedTokens();}
        if (lockedStakedTokens[msg.sender]){revert StakingTokenManager__TokensLockedDueToActiveProposal();}

        stakingBalances[msg.sender] = amountStaked - _amount;
        bool trasferSuccess = i_tokenContract.transfer(msg.sender, _amount);
        if (!trasferSuccess) {revert StakingTokenManager__TransferTounstakeFailed();}

        emit TokensUnstaked(msg.sender, _amount, block.timestamp);
    }

    function lockStakedTokens(address _address) external onlyDAO{
        if(lockedStakedTokens[_address]){revert StakingTokenManager__TokensAlreadyLocked(); }
        lockedStakedTokens[_address] = true;
        emit TokenLoched(_address, block.timestamp);
    }

    function unlockStakedTokens(address _address) external onlyDAO{
        if(!lockedStakedTokens[_address]){revert StakingTokenManager__NoTokensToUnlock(); }
        lockedStakedTokens[_address] = false;
        emit TokenUnlocked(_address, block.timestamp);
    }

    function tokenSlasher(address _slashingTarget) external onlyDAO {
        uint256 tokenBalance = stakingBalances[_slashingTarget];
        uint256 salshingAmount = (tokenBalance * i_slashingPercent) / 100;
        tokenBalance = stakingBalances[_slashingTarget] -= salshingAmount;

        bool transferSuccess = i_tokenContract.transferFrom(_slashingTarget, address(i_DAOContract), tokenBalance);
        if (!transferSuccess) {revert StakingTokenManager__SlashingTransferFailed();}

        emit TokenSlashed(_slashingTarget, salshingAmount, block.timestamp);
    }

    function getUserStakedTokens(address _address) external view onlyDAO returns(uint256) {
        return stakingBalances[_address];
    }

    function checkIfTokensAreLocked(address _address) external view returns (bool){
        return lockedStakedTokens[_address];
    }

    receive() external payable{
        emit ReceiveTriggered(msg.sender, msg.value, block.timestamp);
        revert StakingTokenManager__SendETHToGovernanceContractToBuyTokens(i_DAOContract);
    
    }

    fallback() external payable{
        emit FallbackTriggered(msg.sender, msg.value, msg.data, block.timestamp);
        revert StakingTokenManager__UseGovernanceContractToInteractWithTheDAO(i_DAOContract);
        
    }
}