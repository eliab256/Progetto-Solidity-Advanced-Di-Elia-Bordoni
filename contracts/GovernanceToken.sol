// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {GovernanceDAO} from "./GovernanceDAO.sol";

contract GovernanceToken is ERC20, ReentrancyGuard {

//Custom Errors
    error GovernanceToken__NotOwner();
    error GovernanceToken__NotDAO();
    error GovernanceToken__NotEnoughTokens(uint256);
    error GovernanceToken__MaxSupplyReached(uint256 _supply, uint256 __cap);
    error GovernanceToken__VestingPeriodNotActive();
    error GovernanceToken__VestingPeriodIsActive();
    error GovernanceToken__CapMustBeGreaterThanZero();
    error GovernanceToken__InsufficientBalance();
    error GovernanceToken__AddressAlreadyRegistered();
    error GovernanceToken__YouAreNotEligibleForTheClaim();
    error GovernanceToken__SendETHToGovernanceContractToBuyTokens(address _governanceContractAddress);
    error GovernanceToken__UseGovernanceContractToInteractWithTheDAO(address _governanceContractAddress);

//events
    event GovernanceTokenContractDeployedCorrectly(string name, string symbol, address teamAddress, address treasuryAddress, address daoAddress, uint256 cap);
    event TokenMinting (uint256 tokenMintedAmount, uint256 mintingPeriod);
    event Claimed (address indexed claimant, uint256 amount, uint256 timestamp);
    event ReceiveTriggered(address sender, uint256 amount, uint256 timestamp);
    event FallbackTriggered(address sender, uint256 amount, bytes data, uint256 timestamp);

//Modifiers
    modifier onlyOwner() {
        if(msg.sender != i_Owner){ revert GovernanceToken__NotOwner();}
        _;
    }

    modifier onlyDAO(){
        if(msg.sender != i_DAOContract){revert GovernanceToken__NotDAO();}
        _;
    }
    
    modifier maxSupplyNotReached(uint256 _amount){
        if(totalSupply() + (_amount * 10 ** decimals()) > (i_cap * 10 ** decimals())) {
            revert GovernanceToken__MaxSupplyReached(totalSupply()/1e18, i_cap);}
        _;
    }

    modifier activeVestingPeriod(){
     if(vestingPeriod == false){revert GovernanceToken__VestingPeriodNotActive();}
        _;
    }

    modifier inactiveVestingPeriod(){
        if(vestingPeriod == true){revert GovernanceToken__VestingPeriodIsActive();}
        _;
    }


//variables and mapping

    //about time
    uint256 public immutable i_deployTimeStamp;
    uint256 private constant i_timestampWeek = 604800;
    uint8 public immutable i_weeksOfVesting;
    
    //minting sessions
    uint256 public immutable i_teamMintSupply;    
    uint256 public immutable i_olderUsersMintSupply;    
    uint256 public immutable i_earlyAdopterMintSupply;  
    address [] public olderUsersAddresses;
    
    //special addresses
    address public immutable i_Owner;
    address public immutable i_DAOContract;
    address public immutable i_treasuryContract;

    //token and vesting 
    uint256 public immutable i_cap;
    uint256 public totalMintedToken;
    string public tokenName;
    string public tokenSymbol;
    
    bool private vestingPeriod = true;

    address [] public elegibleForClaimsArray;
    mapping (address => uint256) internal claimsAmountForAddress;
    uint256 private index;   

// Constructor Parameters Struct
    struct TokenConstructorParams {
        string name;
        string symbol;
        address teamAddress;
        address treasuryAddress;
        uint256 teamMintSupply;
        uint256 cap;
        uint256 olderUsersMintSupply;
        uint256 earlyAdopterMintSupply;
        address[] olderUsersAddresses;
        uint8 weeksOfVesting;
    }

//Constructor
    constructor(TokenConstructorParams memory params) ERC20(params.name, params.symbol) {
        uint256 totalInitialMint = (params.teamMintSupply + params.olderUsersMintSupply + params.earlyAdopterMintSupply) * 10 ** decimals();
        if(params.cap == 0){
            revert GovernanceToken__CapMustBeGreaterThanZero();
        }
        if(totalInitialMint > (params.cap * 10 ** decimals())){
            revert GovernanceToken__MaxSupplyReached(totalInitialMint, (params.cap *10 ** decimals()));
        }

        tokenName = params.name;
        tokenSymbol = params.symbol;
        i_Owner = params.teamAddress;
        i_DAOContract = msg.sender;
        i_treasuryContract = params.treasuryAddress;
        i_cap = params.cap * 10 ** decimals();
        olderUsersAddresses = params.olderUsersAddresses;
        i_teamMintSupply = params.teamMintSupply * 10 ** decimals();
        i_olderUsersMintSupply = params.olderUsersMintSupply * 10 ** decimals();
        i_earlyAdopterMintSupply = params.earlyAdopterMintSupply * 10 ** decimals();

        // Mint tokens for the team
        if(params.teamMintSupply > 0){
            _mint(params.teamAddress, i_teamMintSupply);
        }

        // Mint tokens for older users
        if(params.olderUsersAddresses.length > 0 && i_olderUsersMintSupply > 0){
            _mint(address(this), i_olderUsersMintSupply);
            
            uint256 tokenForUser = (i_olderUsersMintSupply + olderUsersAddresses.length - 1) / olderUsersAddresses.length;
            for (uint256 i = 0; i < olderUsersAddresses.length; i++) {   
                require(balanceOf(address(this)) >= tokenForUser, "Not enough tokens in contract");
                _transfer(address(this), olderUsersAddresses[i], tokenForUser);
            }
        }
        
        // Mint remaining tokens to contract
        _mint(address(this), i_cap - totalSupply());

        i_deployTimeStamp = block.timestamp / 86400 * 86400;

        if(params.weeksOfVesting > 0 && i_earlyAdopterMintSupply > 0){
            i_weeksOfVesting = params.weeksOfVesting;
        }

        // Transfer tokens to DAO
        _transfer(address(this), i_DAOContract, balanceOf(address(this)) - i_earlyAdopterMintSupply);

        emit GovernanceTokenContractDeployedCorrectly(tokenName, tokenSymbol, i_Owner, i_treasuryContract, i_DAOContract, i_cap);
    }

//functions

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function getCap() public view returns (uint256) {
        return i_cap;
    }

    function getVestingPeriodStatus() public view onlyDAO returns (bool) {
        return vestingPeriod;
    }

    function getClaimsAmountForAddress(address _address) public view onlyOwner returns (uint256) {
        return claimsAmountForAddress[_address];
    }
   
    function checkEligibilityClaim() public view activeVestingPeriod returns (bool){
        if(balanceOf(msg.sender) > 0) {
            return true;
            } else return false;
    }

    function claimCountdownInDays() public view activeVestingPeriod returns (uint256){
        uint256 remaningTime = (i_deployTimeStamp + (i_timestampWeek * i_weeksOfVesting) - block.timestamp);
        return remaningTime / 86400;
    }

    function updateElegibleAdresses(address _buyerAddress) external onlyDAO activeVestingPeriod {
        for(uint256 i=0; i < elegibleForClaimsArray.length; i++){
            if(elegibleForClaimsArray[i] == _buyerAddress) {
                revert GovernanceToken__AddressAlreadyRegistered();
            } 
        }
        elegibleForClaimsArray.push(_buyerAddress);
    }   

    function getTotalBalanceClaims() public onlyOwner inactiveVestingPeriod{
        uint256 totalBalance;

        for (uint256 i = 0; i < elegibleForClaimsArray.length; i++) {
            address user = elegibleForClaimsArray[i];
            if (user != address(0)) {
                totalBalance += balanceOf(user);
            }
        }

        if (totalBalance == 0) {
            return;
        }

        for (uint256 i = 0; i < elegibleForClaimsArray.length; i++) {
            address user = elegibleForClaimsArray[i];
            if (user != address(0) && balanceOf(user) > 0) {
                uint256 userClaimAmount = (i_earlyAdopterMintSupply * balanceOf(user)) / totalBalance;
                claimsAmountForAddress[user] = userClaimAmount;
            }
        }
        
    }

    function changeVestingPeriodStatus() public onlyDAO{
        vestingPeriod = !vestingPeriod;
    }

    function vestingTokenClaims() public inactiveVestingPeriod {
        if(claimsAmountForAddress[msg.sender] == 0){
            revert GovernanceToken__YouAreNotEligibleForTheClaim();
        }
        
        _transfer(address(this),msg.sender,claimsAmountForAddress[msg.sender]);
    }

    function sendingToken( address _addressFunder, uint256 _amount) public onlyDAO{
        _transfer(msg.sender,_addressFunder,_amount);
    }

    receive() external payable{
        emit ReceiveTriggered(msg.sender, msg.value, block.timestamp);
        revert GovernanceToken__SendETHToGovernanceContractToBuyTokens(i_DAOContract);
    
    }

    fallback() external payable{
        emit FallbackTriggered(msg.sender, msg.value, msg.data, block.timestamp);
        revert GovernanceToken__UseGovernanceContractToInteractWithTheDAO(i_DAOContract);
        
    }

}