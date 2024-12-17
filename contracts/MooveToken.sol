// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";

contract MooveToken is ERC20Capped {

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
    uint256 public tokenPrice;
    bool public isTradingAllowed;
    bool private vestingPeriod = false;
    bool firstCallForTotalClaims;
    
    mapping (address => uint256) elegibleForClaims;


//events
    event TradingStatusChanged (bool tradingIsAllowed);
    event TokenMinting (uint256 tokenMintedAmount, uint256 mintingPeriod);

//Modifiers
    modifier onlyOwner() {
        require(msg.sender == teamAddress, "Not authorized");
        _;
    }
    
    modifier maxSupplyNotReached(){
        require(circulatingSupply() + balanceOf(address(this)) < _cap, "Max supply reached");
        _;
    }

    modifier activeVestingPeriod(){
        require(vestingPeriod == true,"there is not a vesting period active");
        _;
    }

    constructor(
        string memory _name,                    // Token name
        string memory _symbol,                  // Token simbol
        uint256 _teamMintSupply,                // Supply for the team
        uint256 constant _cap,                  // Max supply 
        uint256 _olderUsersMintSupply,          // Supply for the older users
        uint256 _earlyAdopterMintSupply,        // Supply the users who interact with the protocol
        address[] memory _olderUsersAddresses,  // Array of older users
        uint8 _weeksOfVesting,                  // Duration of vesting period in weeks    
        uint256 _tokenPrice                     // price of single token 
    ) ERC20(_name, _symbol) ERC20Capped(_cap) {
        require(_teamMintSupply + _olderUsersMintSupply + _earlyAdopterMintSupply  <= _cap, "Initial supply exceeds cap");
        
        teamAddress = msg.sender;
        tokenPrice = _tokenPrice;
        _mint(msg.sender, _teamMintSupply);
        teamMintSupply = _teamMintSupply;

        uint256 remainingTokens;

        if(_olderUsersAddresses > 0 && _olderUsersMintSupply > 0){
            _mint(address(this), _olderUsersMintSupply);
            olderUsersMintSupply = _olderUsersMintSupply;
            
            uint256 tokenForUser = olderUsersMintSupply / olderUsersAddresses.length;
            for (uint256 i = 0; i < _olderUsersAddresses.length; i++) {   
                require(balanceOf(address(this)) >= tokenForUser, "Not enough tokens in contract");
                _transfer(address(this),_olderUsersAddresses[i],tokenForUser);
            }

            if(balanceOf(address(this)) > 0){
                remainingTokens == balanceOf(address(this));
            }
        }
        
        _mint(address(this), _cap - circulatingSupply() - remainingTokens);

        deployTimeStamp = block.timestamp / 86400 * 86400;

        if(_weeksOfVesting > 0 && _earlyAdopterMintSupply > 0){
            weeksOfVesting = _weeksOfVesting;
            earlyAdopterMintSupply = _earlyAdopterMintSupply;
        }
        
        if(balanceOf(address(this)) + circulatingSupply() != _cap){
            revert("Max supply exceeded");
        }

        uint256 totalMintedToken = balanceOf(address(this)) + circulatingSupply();
        emit TokenMinting(totalMintedToken, deployTimeStamp);
    }



    function buyToken() public payable {
        require(msg.value > 0, "Insufficient funds");
        require(msg.value < balanceOf(address(this)), "there is no enough token on the contract");
        require(isTradingAllowed == true, "team doesn't allolow trading");

        //trasferire token al buyer, aggiornare i saldi e fare la matematica per la conversione tra token

        updateElegibleAdresses(msg.sender,msg.value); //check del calcolo tra i vari token
    }

    function updateElegibleAdresses(address _buyerAddress, uint256 _buyerAmount) private activeVestingPeriod {
        elegibleForClaims[_buyerAddress] += _buyerAmount;
    }

    function checkEligibilityClaim() public view activeVestingPeriod returns (bool){ //aggiungere il ritorno della quantità dei possibili token da prelevare dall' utente
        if(eligibleForVesting[msg.sender] > 0) {
            return true;
            } else return false;
    }

    function claimCountdownInDays() public view activeVestingPeriod returns (uint256){
        uint256 remaningTime = (deployTimeStamp + (timestampWeek * weeksOfVesting) - block.timestamp);
        return reminingTime / 86400;
    }

    function getTotalBalanceClaims() private {
        if(firstCallForTotalClaims == true){
            firstCallForTotalClaims = false;
        }
    }

    function vestingTokenClaims() public {
        require(vestingPeriod == false, "Vesting period isn't ended");
        require(eligibleForVesting[msg.sender] > 0, "You aren' t eligible for the claim");
        
        getTotalBalanceClaims();
        //capire come "salvare" il totale dei saldi solo la prima volta per distribuire i token in base al volume scambiato


    }

    function enableTrading() external onlyOwner {
        isTradingAllowed = !isTradingAllowed; 
        emit TradingStatusChanged(isTradingAllowed);
    }

    
}