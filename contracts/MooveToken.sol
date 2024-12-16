// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20";

contract MooveToken is ERC20Capped {

//variables declaration
    uint256 deployTimeStamp;
    uint256 timestampWeek = 604800;
    uint8 weeksOfVesting;
    
    //minting sessions
    uint256 public teamMintSupply;    
    uint256 public olderUsersMintSupply;    
    uint256 public earlyAdopterMintSupply;  
    
    address public teamAddress;

    bool private vestingPeriod = false;

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
        uint256 _cap,                           // Max supply 
        uint256 _olderUsersMintSupply,          // Supply for the older users
        uint256 _earlyAdopterMintSupply,        // Supply the users who interact with the protocol
        address[] memory _olderUsersAddresses,  // Array of older users
        uint8 _weeksOfVesting,                  // Duration of vesting period in weeks     
    ) ERC20(_name, _symbol) ERC20Capped(_cap) {
        require(_teamMintSupply + _olderUsersMintSupply + _earlyAdopterMintSupply  <= _cap, "Initial supply exceeds cap");
        
        teamAddress = msg.sender;
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
    }

    function buyToken() public payable {

    }

    function checkEligibilityClaim() public view {

    }

    function claimCountdown() public view{

    }

    function vestingTokenClaims() public {

    }

     //require(block.timestamp < deployTimeStamp + (timestampWeek * 4), "The claim period has expired");
}