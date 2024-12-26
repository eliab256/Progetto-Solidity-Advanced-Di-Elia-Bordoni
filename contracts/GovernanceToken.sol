// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract GovernanceToken is ERC20, ReentrancyGuard {

//variables declaration

    //about time
    uint256 public immutable i_deployTimeStamp;
    uint256 private constant i_timestampWeek = 604800;
    uint8 private immutable i_weeksOfVesting;
    
    //minting sessions
    uint256 private immutable i_teamMintSupply;    
    uint256 private immutable i_olderUsersMintSupply;    
    uint256 private immutable i_earlyAdopterMintSupply;  
    
    address public immutable i_Owner;

    //token and vesting 
    uint256 private immutable i_cap;
    uint256 public tokenPrice;
    uint256 public totalMintedToken;
    bool public isTradingAllowed;
    bool private vestingPeriod = false;

    //mapping (address => bool) elegibleForClaims;
    mapping (uint256 => address) elegibleForClaims; 
    mapping (address => uint256) claimsAmountForAddress;
    uint256 private index;   

//events
    event TradingStatusChanged (bool tradingIsAllowed);
    event TokenMinting (uint256 tokenMintedAmount, uint256 mintingPeriod);
    event Claimed (address indexed claimant, uint256 amount);

//Custom Errors

    error GovernanceToken__NotOwner();
    error GovernanceToken__NotEnoughTokens(uint256);
    error GovernanceToken__MaxSupplyReached(uint256 _supply, uint256 __cap);
    error GovernanceToken__VestingPeriodNotActive();
    error GovernanceToken__VestingPeriodIsActive();
    error GovernanceToken__CapMustBeGreaterThanZero();
    error GovernanceToken__TokenPriceMustBeGreaterThanZero();
    error GovernanceToken__TradingIsNotAllowed();
    error GovernanceToken__InsufficientBalance();
    error GovernanceToken__InsufficientAmountOfTokenOnContract(uint256 _requestAmount, uint256 _tokenOnContractAmount);


//Modifiers
    modifier onlyOwner() {
        if(msg.sender != i_Owner){ revert GovernanceToken__NotOwner();}
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

//Constructor
    constructor(
        string memory _name,                    // Token name
        string memory _symbol,                  // Token simbol
        uint256 _teamMintSupply,                // Supply for the team
        uint256 _cap,                           // Max supply 
        uint256 _olderUsersMintSupply,          // Supply for the older users
        uint256 _earlyAdopterMintSupply,        // Supply the users who interact with the protocol
        address[] memory _olderUsersAddresses,  // Array of older users
        uint8 _weeksOfVesting,                  // Duration of vesting period in weeks    
        uint256 _tokenPrice                     // price of single token 
    ) ERC20(_name, _symbol) {
        uint256 totalInitalMint = _teamMintSupply + _olderUsersMintSupply + _earlyAdopterMintSupply;
        if(totalInitalMint > _cap){revert GovernanceToken__MaxSupplyReached(totalInitalMint, _cap);}
        if(_cap == 0){revert GovernanceToken__CapMustBeGreaterThanZero();}
        if(_tokenPrice == 0){revert GovernanceToken__TokenPriceMustBeGreaterThanZero();}

        i_Owner = msg.sender;
        i_cap = _cap;
        tokenPrice = _tokenPrice;
        if(_teamMintSupply > 0){
            i_teamMintSupply = _teamMintSupply;
            _mint(msg.sender, i_teamMintSupply * 10 ** decimals());
            }

        if(_olderUsersAddresses.length > 0 && _olderUsersMintSupply > 0){
            _mint(address(this), _olderUsersMintSupply * 10 ** decimals());
            i_olderUsersMintSupply = _olderUsersMintSupply;
            
            uint256 tokenForUser = i_olderUsersMintSupply / _olderUsersAddresses.length;
            for (uint256 i = 0; i < _olderUsersAddresses.length; i++) {   
                require(balanceOf(address(this)) >= tokenForUser, "Not enough tokens in contract");
                _transfer(address(this),_olderUsersAddresses[i],tokenForUser);
            }
        }
        
        _mint(address(this), (i_cap * 10 ** decimals())- totalSupply());

        i_deployTimeStamp = block.timestamp / 86400 * 86400;

        if(_weeksOfVesting > 0 && _earlyAdopterMintSupply > 0){
            i_weeksOfVesting = _weeksOfVesting;
            i_earlyAdopterMintSupply = _earlyAdopterMintSupply;
        }

        emit TokenMinting(totalSupply(), i_deployTimeStamp);
    }

//functions

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function getCap() public view returns (uint256) {
        return i_cap;
    }

    function getPrice() public view returns (uint256){
        return tokenPrice;
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

    function enableTrading() external onlyOwner {
        isTradingAllowed = !isTradingAllowed; 
        emit TradingStatusChanged(isTradingAllowed);
    }

    function buyToken() public payable {
        if(msg.value <= 0) {revert GovernanceToken__InsufficientBalance();}
        if(msg.value > balanceOf(address(this))){
            revert GovernanceToken__InsufficientAmountOfTokenOnContract(msg.value, balanceOf(address(this)));
            }
        if(isTradingAllowed == false){revert GovernanceToken__TradingIsNotAllowed();}

        //trasferire token al buyer, aggiornare i saldi e fare la matematica per la conversione tra token

        updateElegibleAdresses(msg.sender);

        //inviare i fondi ricevuti al contratto della treasury
    }

    function updateElegibleAdresses(address _buyerAddress) private activeVestingPeriod {
        for(uint256 i=0; i < index; i++){
            if(elegibleForClaims[i] == _buyerAddress) {
                revert("Address already registered");
            } 
        }
        elegibleForClaims[index] = _buyerAddress;
        index++;
     
    }   

    function getTotalBalanceClaims() private onlyOwner inactiveVestingPeriod{
        uint256 totalBalance;

        for(uint256 i=0; i < index; i++){
            address user = elegibleForClaims[i];
            if (user != address(0)) { 
            totalBalance += balanceOf(user);
            }
        }

        for(uint256 i=0; i < index; i++){
            address user = elegibleForClaims[i];
            if (user != address(0) || balanceOf(user) != 0) { 
            uint256 userClaimAmount = i_earlyAdopterMintSupply *  balanceOf(user) / totalBalance;
            claimsAmountForAddress[user] = userClaimAmount;          
            }
        }
        
    }

    function vestingTokenClaims() public inactiveVestingPeriod {
        if(claimsAmountForAddress[msg.sender] == 0){
            revert("You are not eligible for the claim");
        }
        
        _transfer(address(this),msg.sender,claimsAmountForAddress[msg.sender]);
    }




    function getEthPrice() public view returns(uint256){
        AggregatorV3Interface dataFeed = AggregatorV3Interface(0x694AA1769357215DE4FAC081bf1f309aDC325306);
        (,int256 answer,,,) = dataFeed.latestRoundData();
        return uint256(answer * 1e10);
    }

    function getConversionRate(uint256 _tokenAmount) public view returns(uint256){
        uint256 ethPrice = getEthPrice();
    }

}