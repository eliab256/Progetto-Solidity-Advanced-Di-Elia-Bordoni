// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MooveToken is ERC20 {

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
    uint256 private index;   

//events
    event TradingStatusChanged (bool tradingIsAllowed);
    event TokenMinting (uint256 tokenMintedAmount, uint256 mintingPeriod);

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
        _mint(msg.sender, _teamMintSupply);
        teamMintSupply = _teamMintSupply;

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

    



    function checkEligibilityClaim() public view activeVestingPeriod returns (bool){
        if(balanceOf(msg.sender) > 0) {
            return true;
            } else return false;
    }

    function claimCountdownInDays() public view activeVestingPeriod returns (uint256){
        uint256 remaningTime = (deployTimeStamp + (timestampWeek * weeksOfVesting) - block.timestamp);
        return remaningTime / 86400;
    }

    function calculateTotalBalanceClaims() private onlyOwner{
        require(vestingPeriod == false, "Vesting period isn't ended");

        //qua fa lo snapshot dei saldi dei contratti andando a sommare tutti i valori dei vari address facendo il for degli index
        
    }

    function vestingTokenClaims() public {
        require(vestingPeriod == false, "Vesting period isn't ended");
        require(balanceOf(msg.sender) > 0, "You aren' t eligible for the claim");
        
        calculateTotalBalanceClaims();
        //capire come "salvare" il totale dei saldi solo la prima volta per distribuire i token in base al volume scambiato


    }


  // function updateElegibleAdresses(address _buyerAddress) private activeVestingPeriod {
  //      if(elegibleForClaims[_buyerAddress]) {
  //              revert("Address already registered");
   //         }       
  //      elegibleForClaims[_buyerAddress] = true;
  //  }
    
}