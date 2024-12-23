// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MooveToken is ERC20, ReentrancyGuard {

//variables declaration

    //about time
    uint256 public deployTimeStamp;
    uint256 private timestampWeek = 604800;
    uint8 private weeksOfVesting;
    
    //minting sessions
    uint256 public teamMintSupply;    
    uint256 public olderUsersMintSupply;    
    uint256 public earlyAdopterMintSupply;  
    
    address public immutable teamAddress;

    //token and vesting 
    uint256 private immutable cap;
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

//Modifiers
    modifier onlyOwner() {
        require(msg.sender == teamAddress, "Not authorized");
        _;
    }
    
    modifier maxSupplyNotReached(uint256 _amount){
        require(totalSupply() + _amount <= cap, "Max supply reached");
        _;
    }

    modifier activeVestingPeriod(){
        require(vestingPeriod == true,"there is not a vesting period active");
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
        require(_teamMintSupply + _olderUsersMintSupply + _earlyAdopterMintSupply  <= _cap || _cap == 0 , "Invalid parameters");
        
        teamAddress = msg.sender;
        cap = _cap;
        tokenPrice = _tokenPrice;
        teamMintSupply = _teamMintSupply;
        _mint(msg.sender, teamMintSupply);

        if(_olderUsersAddresses.length > 0 && _olderUsersMintSupply > 0){
            _mint(address(this), _olderUsersMintSupply);
            olderUsersMintSupply = _olderUsersMintSupply;
            
            uint256 tokenForUser = olderUsersMintSupply / _olderUsersAddresses.length;
            for (uint256 i = 0; i < _olderUsersAddresses.length; i++) {   
                require(balanceOf(address(this)) >= tokenForUser, "Not enough tokens in contract");
                _transfer(address(this),_olderUsersAddresses[i],tokenForUser);
            }
        }
        
        _mint(address(this), _cap - totalSupply());

        deployTimeStamp = block.timestamp / 86400 * 86400;

        if(_weeksOfVesting > 0 && _earlyAdopterMintSupply > 0){
            weeksOfVesting = _weeksOfVesting;
            earlyAdopterMintSupply = _earlyAdopterMintSupply;
        }

        emit TokenMinting(totalSupply(), deployTimeStamp);
    }

//functions

    function getCap() public view returns (uint256) {
        return cap;
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
        uint256 remaningTime = (deployTimeStamp + (timestampWeek * weeksOfVesting) - block.timestamp);
        return remaningTime / 86400;
    }

    function enableTrading() external onlyOwner {
        isTradingAllowed = !isTradingAllowed; 
        emit TradingStatusChanged(isTradingAllowed);
    }

    function buyToken() public payable {
        require(msg.value > 0, "Insufficient funds");
        require(msg.value < balanceOf(address(this)), "there is no enough token on the contract");
        require(isTradingAllowed == true, "team doesn't allolow trading");

        //trasferire token al buyer, aggiornare i saldi e fare la matematica per la conversione tra token

        updateElegibleAdresses(msg.sender);

        //emit Transfer (address(this),msg.sender,amount);
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

    function calculateTotalBalanceClaims() private onlyOwner{
        require(vestingPeriod == false, "Vesting period isn't ended");

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
            uint256 userClaimAmount = earlyAdopterMintSupply *  balanceOf(user) / totalBalance;
            claimsAmountForAddress[user] = userClaimAmount;          
            }
        }
        
    }

    function vestingTokenClaims() public {
        require(vestingPeriod == false, "Vesting period isn't ended");
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