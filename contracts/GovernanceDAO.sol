// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {GovernanceToken} from "./GovernanceToken.sol";
import {StakingTokenManager} from "./StakingTokenManager.sol";
import {TreasuryDAO} from "./TreasuryDAO.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract GovernanceDAO is ReentrancyGuard{

    GovernanceToken public MooveToken;
    TreasuryDAO public MooveTreasury;
    StakingTokenManager public MooveStakingManager;

//errors
    error GovernanceDAO__NotEnoughtTokenToVote();
    error GovernanceDAO__NotEnoughtTokenStakedToMakeProposal(uint256 _stakedToken, uint256 _tokenStakedYouNeed);
    error GovernanceDAO__NotEnoughtCirculatingSupplyToMakeProposals(uint256 _actualSupply, uint256 _minimumSupply);
    error GovernanceDAO__AnotherProposalStillActive();
    error GovernanceDAO__TradingIsNotAllowed();
    error GovernanceDAO__InsufficientBalance();
    error GovernanceDAO__InsufficientAmountOfTokenOnContract(uint256 _requestAmount, uint256 _tokenOnContractAmount);
    error GovernanceDAO__NotOwner();
    error GovernanceDAO__ETHTransferToTreasuryFailed();

//modifiers
    modifier onlyOwner() {
        if(msg.sender != i_teamAddress){ revert GovernanceDAO__NotOwner();}
        _;
    }

    modifier onlyEligibleVoters(){
        if(MooveToken.balanceOf(msg.sender) == 0){revert GovernanceDAO__NotEnoughtTokenToVote();}
        _;
    }
    
//structs and Enum  
    enum ProposalVoteOptions{
        InFavor,
        Against,
        Abstain
    }

    struct ProposalVoteResult{
        mapping(address => uint8) voterChoices; //  0: For, 1: Against, 2: Abstain
        uint forVotes;
        uint againstVotes;
        uint abstainVotes;
    }

    struct ProposalStruct {
        uint256 proposalIndex;
        address proposer;
        string proposalDescription;
        uint256 creationTimeStamp;
        uint256 startVotingTimestamp;
        uint256 endVotingTimestamp;
        bool isFinalized;
        bool isApproved;
    }

//variables and mappings
    mapping (uint256 => ProposalStruct) public proposals;
    mapping (uint256 => ProposalVoteResult) public voteResults;
    mapping (address => bool) public activeProposers;

    address immutable i_teamAddress;
    address immutable i_tokenContractAddress;
    address immutable i_treasuryContractAddress;
    address immutable i_stakingContractAddress; 

    uint256 public tokenPrice = MooveToken.getPrice() * 10 ** MooveToken.decimals();
    bool public isTradingAllowed;

    uint256 public minimumTokenStakedToMakeAProposal;
    uint256 public minimumCirculatingSupplyToMakeAProposalInPercent;
    uint256 internal proposalIndexCounter;  

//event

    event MooveTokenCreated(address tokenAddress, string name, string symbol, address owner, uint256 totalSupply, uint256 tokenPrice);
    event MooveTreasuryCreated(address treasuryAddress, address owner, address dao);  
    event TradingStatusChanged (bool tradingIsAllowed);
    event TokenPurchased(address indexed _buyer, uint256 indexed _amount);
    event NewTokenPriceSet(uint256 indexed _newPrice);
    event SuccesfulTransferToTreasury(uint256 amount);
    event FailedTransferToTreasury(uint256 amount);
    event ProposalCreated(address indexed _proposer, uint256 indexed _proposalIndex);
    //event VoteRegistered(address indexed _voter, bool indexed _voteFor, uint256 indexed _proposalIndex);
    //event ProposalApproved(uint256 indexed _proposalIndex, uint256 indexed _voteFor, uint256 indexed _voteAgainst);
    //event ProposalFailed(uint256 indexed _proposalIndex, uint256 indexed _voteFor, uint256 indexed _voteAgainst);

//constructor
    constructor( 
        string memory _name,                    // Token name
        string memory _symbol,                  // Token simbol
        uint256 _teamMintSupply,                // Supply for the team
        uint256 _cap,                           // Max supply 
        uint256 _olderUsersMintSupply,          // Supply for the older users
        uint256 _earlyAdopterMintSupply,        // Supply the users who interact with the protocol
        address[] memory _olderUsersAddresses,  // Array of older users
        uint8 _weeksOfVesting,                  // Duration of vesting period in weeks    
        uint256 _tokenPrice,                    // price of single token
        uint256 _minimumTokenStakedToMakeAProposal,
        uint256 _minimumCirculatingSupplyToMakeAProposalInPercent,
        uint256 _slashingPercent                     
    ){
        MooveTreasury = new TreasuryDAO(msg.sender, address(this)); 

        MooveToken = new GovernanceToken(
            _name,
            _symbol,
            msg.sender,
            address(this),
            address(MooveTreasury),
            _teamMintSupply,
            _cap, 
            _olderUsersMintSupply,
            _earlyAdopterMintSupply,
            _olderUsersAddresses,
            _weeksOfVesting,
            _tokenPrice
            );

        MooveStakingManager = new StakingTokenManager(msg.sender, address(this), address(MooveToken), _slashingPercent);

        i_tokenContractAddress = address(MooveToken);
        i_treasuryContractAddress = address(MooveTreasury);
        i_teamAddress = msg.sender;
        i_stakingContractAddress = address(MooveStakingManager);
        minimumTokenStakedToMakeAProposal = _minimumTokenStakedToMakeAProposal * 10 ** MooveToken.decimals();
        minimumCirculatingSupplyToMakeAProposalInPercent = _minimumCirculatingSupplyToMakeAProposalInPercent * 10 ** MooveToken.decimals();

        emit MooveTokenCreated(i_tokenContractAddress, _name, _symbol, msg.sender, _cap, _tokenPrice);
        emit MooveTreasuryCreated(i_treasuryContractAddress, msg.sender, address(this));
        emit NewTokenPriceSet(_tokenPrice);
    }

//functions

    function getMinimumTokenStakedToMakeAProposal() public view returns(uint256) {
        return minimumTokenStakedToMakeAProposal;
    }

    function makeProposal(string calldata _proposalDescription) external {
        uint256 minimumCirculatingSupply = MooveToken.totalSupply() * minimumCirculatingSupplyToMakeAProposalInPercent / 100;
        uint256 actualCirculatingSupply = MooveToken.totalSupply() - MooveToken.balanceOf(address(this));
        if(actualCirculatingSupply < minimumCirculatingSupply){
            revert GovernanceDAO__NotEnoughtCirculatingSupplyToMakeProposals(actualCirculatingSupply,minimumCirculatingSupply);
        }

        if(activeProposers[msg.sender]){revert GovernanceDAO__AnotherProposalStillActive();}

        uint256 stakedToken = MooveStakingManager.getUserStakedTokens(msg.sender);
        if(stakedToken < minimumTokenStakedToMakeAProposal){
            revert GovernanceDAO__NotEnoughtTokenStakedToMakeProposal(stakedToken, minimumTokenStakedToMakeAProposal);
        }

        ProposalStruct memory newProposal = ProposalStruct ({
            proposalIndex: proposalIndexCounter,
            proposer: msg.sender,
            proposalDescription: _proposalDescription,
            creationTimeStamp: block.timestamp,
            startVotingTimestamp: 0,
            endVotingTimestamp: 0,
            isFinalized: false,
            isApproved: false
        });
       
        uint256 currentProposalIndex = newProposal.proposalIndex;
        proposals[currentProposalIndex] = newProposal;
        activeProposers[msg.sender] = true;

        voteResults[currentProposalIndex].forVotes = 0;
        voteResults[currentProposalIndex].againstVotes = 0;
        voteResults[currentProposalIndex].abstainVotes = 0;

        proposalIndexCounter++;    

        emit ProposalCreated(newProposal.proposer, newProposal.proposalIndex);
    } 

    //functions to handle token trading
    function buyToken() public payable {
        if(isTradingAllowed == false){revert GovernanceDAO__TradingIsNotAllowed();}
        if(msg.value <= 0) {revert GovernanceDAO__InsufficientBalance();}
        if(msg.value > MooveToken.balanceOf(address(this))){
            revert GovernanceDAO__InsufficientAmountOfTokenOnContract(msg.value, MooveToken.balanceOf(address(this)));
        }
        
        uint256 tokenPriceWithDecimals = tokenPrice * 10 ** MooveToken.decimals(); 
        uint256 ethAmountInUsd = getConversionRate(msg.value);
        uint256 amountToSend = ethAmountInUsd / tokenPriceWithDecimals;

        MooveToken.sendingToken(address(this), msg.sender, amountToSend);
        emit TokenPurchased(msg.sender, amountToSend);

        MooveToken.updateElegibleAdresses(msg.sender);

        bool sendSuccess = payable(i_treasuryContractAddress).send(msg.value);
        if (!sendSuccess) {
            emit FailedTransferToTreasury(msg.value);
        } else emit SuccesfulTransferToTreasury(msg.value);
    }

    function getEthPrice() public view returns(uint256){
        AggregatorV3Interface dataFeed = AggregatorV3Interface(0x694AA1769357215DE4FAC081bf1f309aDC325306);
        (,int256 answer,,,) = dataFeed.latestRoundData();
        return uint256(answer * 1e10);
    }

    function getConversionRate(uint256 _ethAmount) public view returns(uint256){
        uint256 ethPrice = getEthPrice();
        uint256 ethAmountInUsd = (ethPrice * _ethAmount) / 1e18;
        return ethAmountInUsd;
    }

    function enableTrading() external onlyOwner {
        isTradingAllowed = !isTradingAllowed; 
        emit TradingStatusChanged(isTradingAllowed);
    }

}