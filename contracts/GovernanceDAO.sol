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

//custom errors
    error GovernanceDAO__NotEnoughtTokenToVote();
    error GovernanceDAO__NotEnoughtTokenStakedToMakeProposal(uint256 _stakedToken, uint256 _tokenStakedYouNeed);
    error GovernanceDAO__NotEnoughtCirculatingSupplyToMakeProposals(uint256 _actualSupply, uint256 _minimumSupply);
    error GovernanceDAO__AnotherProposalStillActive();
    error GovernanceDAO__TradingIsNotAllowed();
    error GovernanceDAO__InsufficientBalance();
    error GovernanceDAO__InsufficientAmountOfTokenOnContract(uint256 _requestAmount, uint256 _tokenOnContractAmount);
    error GovernanceDAO__NotOwner();
    error GovernanceDAO__ETHTransferToTreasuryFailed();
    error GovernanceDao__DescriptionCannotBeEmpty();
    error GovernanceDAO__InvalidId();
    error GovernanceDAO__InvalidDelegateeAddress();
    error GovernanceDAO__NoDelegationFound();
    error GovernanceDAO__DelegatorHasNotToken();
    error GovernanceDAO__CantBeProposerAndDelegateeTogether();
    error GovernanceDAO__DelegateeCantBeDelegator();
    error GovernanceDAO__AlreadyDelegatee();
    error GovernanceDAO__AlreadyDelegator();
    error GovernanceDAO__NotAppliedDelegatee();
    error GovernanceDAO__OutOfVotingPeriod();
//event
    event MooveTokenCreated(address tokenAddress, string name, string symbol, address owner, uint256 totalSupply, uint256 tokenPrice);
    event MooveTreasuryCreated(address treasuryAddress, address owner, address dao);  
    event TradingStatusChanged (bool tradingIsAllowed);
    event TokenPurchased(address indexed _buyer, uint256 indexed _amount);
    event NewTokenPriceSet(uint256 indexed _newPrice);
    event SuccesfulTransferToTreasury(uint256 amount);
    event FailedTransferToTreasury(uint256 amount);
    event ProposalCreated(address indexed proposer, uint256 indexed proposalIndex, string proposalDescription, uint256 creationTime, uint256 closeVotationTime);
    //event ProposalApproved(uint256 indexed _proposalIndex, uint256 indexed _voteFor, uint256 indexed _voteAgainst);
    //event ProposalFailed(uint256 indexed _proposalIndex, uint256 indexed _voteFor, uint256 indexed _voteAgainst);
    //event VoteRegistered(address indexed _voter, bool indexed _voteFor, uint256 indexed _proposalIndex);
    event VoteDelegated(address indexed delegant, address indexed delegatee, uint256 tokenAmountDelegated);
    event VoteUndelegated(address indexed delegant, uint256 tokenAmountUndelegated);

//modifiers
    modifier onlyOwner() {
        if(msg.sender != i_teamAddress){ revert GovernanceDAO__NotOwner();}
        _;
    }

    modifier onlyEligibleToProposeOrDelegatee(){
        uint256 stakedToken = MooveStakingManager.getUserStakedTokens(msg.sender);
        if(stakedToken < minimumTokenStakedToMakeAProposal){
            revert GovernanceDAO__NotEnoughtTokenStakedToMakeProposal(stakedToken, minimumTokenStakedToMakeAProposal);
        }
        _;
    }

    modifier onlyEligibleVoters(){
        if(MooveStakingManager.getUserStakedTokens(msg.sender) <= 0){revert GovernanceDAO__NotEnoughtTokenToVote();}
        _;
    }
    
//structs and Enum  
    enum VoteOptions{
        InFavor,
        Against,
        Abstain
    }

    struct Proposal {
        uint256 proposalId;
        address proposer;
        string description;
        uint256 creationTimeStamp;
        uint256 endVotingTimestamp;
        uint forVotes;
        uint againstVotes;
        uint abstainVotes;
        bool isFinalized;
        bool isApproved;
    }

//variables and mappings
    mapping (uint256 => Proposal) public proposalsById;
    mapping (address => mapping(uint256 => VoteOptions)) public voteList;
    mapping (address => bool) public activeProposers;
    mapping (address => address[]) public delegateeToDelegators;
    address[] public delegatees; 

    address immutable i_teamAddress;
    address immutable i_tokenContractAddress;
    address immutable i_treasuryContractAddress;
    address immutable i_stakingContractAddress; 

    uint256 public tokenPrice = MooveToken.getPrice() * 10 ** MooveToken.decimals();
    bool public isTradingAllowed;

    uint256 public daysofVoting;
    uint256 public minimumTokenStakedToMakeAProposal;
    uint256 public minimumCirculatingSupplyToMakeAProposalInPercent;
    uint256 internal proposalIdCounter; 
    uint256 public proposalQuorum; 

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
        uint256 _proposalQuorum,
        uint256 _slashingPercent,
        uint256 _votingPeriodInDays                     
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
        proposalQuorum = _proposalQuorum;
        daysofVoting = _votingPeriodInDays * 86400;

        emit MooveTokenCreated(i_tokenContractAddress, _name, _symbol, msg.sender, _cap, _tokenPrice);
        emit MooveTreasuryCreated(i_treasuryContractAddress, msg.sender, address(this));
        emit NewTokenPriceSet(_tokenPrice);
    }

//functions

    function getMinimumTokenStakedToMakeAProposal() public view returns(uint256) {
        return minimumTokenStakedToMakeAProposal;
    }

    function makeProposal(string calldata _proposalDescription) external onlyEligibleToProposeOrDelegatee {
        if (bytes(_proposalDescription).length <= 0) {revert GovernanceDao__DescriptionCannotBeEmpty();}

        uint256 minimumCirculatingSupply = MooveToken.totalSupply() * minimumCirculatingSupplyToMakeAProposalInPercent / 100;
        uint256 actualCirculatingSupply = MooveToken.totalSupply() - MooveToken.balanceOf(address(this));
        if(actualCirculatingSupply < minimumCirculatingSupply){
            revert GovernanceDAO__NotEnoughtCirculatingSupplyToMakeProposals(actualCirculatingSupply,minimumCirculatingSupply);
        }

        if(activeProposers[msg.sender]){revert GovernanceDAO__AnotherProposalStillActive();}

        Proposal memory proposal = Proposal ({
            proposalId: proposalIdCounter,
            proposer: msg.sender,
            description: _proposalDescription,
            creationTimeStamp: block.timestamp,
            endVotingTimestamp: block.timestamp + daysofVoting,
            forVotes : 0,
            againstVotes : 0,
            abstainVotes : 0,
            isFinalized: false,
            isApproved: false
            //no mapping address => vote, it will be set offchain with events
        });
       
        uint256 currentProposalId = proposal.proposalId;
        proposalsById[currentProposalId] = proposal;
        activeProposers[msg.sender] = true;
        MooveStakingManager.lockStakedTokens(msg.sender);

        proposalIdCounter++;    

        emit ProposalCreated(proposal.proposer, proposal.proposalId, proposal.description, proposal.creationTimeStamp, proposal.endVotingTimestamp);
    }

    function applyForDelegate() public onlyEligibleToProposeOrDelegatee() {
        if(activeProposers[msg.sender]){revert GovernanceDAO__CantBeProposerAndDelegateeTogether();}
        if(checkIfDelegator(msg.sender)){revert GovernanceDAO__DelegateeCantBeDelegator();}
        if(checkIfDelegatee(msg.sender)){revert GovernanceDAO__AlreadyDelegatee();}

        for (uint i = 0; i < delegatees.length; i++) {
        if (delegatees[i] == msg.sender) {
            return;
            }
        }
        delegatees.push(msg.sender);
    }

    function delegateVote(address _delegatee) public onlyEligibleVoters{
        if(checkIfDelegatee(msg.sender)){revert GovernanceDAO__DelegateeCantBeDelegator();}
        if(checkIfDelegator(msg.sender)){revert GovernanceDAO__AlreadyDelegator();}
        if(!checkIfDelegatee(_delegatee)){revert GovernanceDAO__NotAppliedDelegatee();}
        
        delegateeToDelegators[_delegatee].push(msg.sender);
        MooveStakingManager.lockStakedTokens(msg.sender);
        uint256 tokensDelegated = MooveStakingManager.getUserStakedTokens(msg.sender);

        emit VoteDelegated(msg.sender, _delegatee, tokensDelegated);
    }

    function undelegateVote() public onlyEligibleVoters {
        address[] storage delegators = delegateeToDelegators[msg.sender];
        if(delegators.length == 0){revert GovernanceDAO__NoDelegationFound();}
        //aggiungere condizioni per votazioni in corso
        
        for (uint i = 0; i < delegators.length; i++) {
            if (delegators[i] == msg.sender) {
                delegators[i] = delegators[delegators.length - 1];
                delegators.pop();
                break;
            }
        }
        
        MooveStakingManager.unlockStakedTokens(msg.sender);
        uint256 tokensDelegated = MooveStakingManager.getUserStakedTokens(msg.sender);
        emit VoteUndelegated(msg.sender, tokensDelegated);
    }

    function voteOnProposal(uint256 _proposalId, VoteOptions _vote) public onlyEligibleVoters {
        Proposal memory proposal = proposalsById[_proposalId];
        if(proposal.endVotingTimestamp < block.timestamp){revert GovernanceDAO__OutOfVotingPeriod();}
        //controllare se l' indirizzo ha già votato


    }


    //view functions
    function getVotePeriodActive(uint256 _id) view external returns(bool){   
        Proposal memory proposal = proposalsById[_id];
        if(proposal.endVotingTimestamp == 0){revert GovernanceDAO__InvalidId();}
        return proposal.endVotingTimestamp > block.timestamp;
    }

    function checkIfDelegator(address _address) public view returns (bool) {
        address[] storage delegators = delegateeToDelegators[_address];
        
        for (uint i = 0; i < delegators.length; i++) {
            if (delegators[i] == _address) {
                return false; 
            }
        }
        return true;
    }

    function checkIfDelegatee(address _address) public view returns (bool) {
       
        for (uint i = 0; i < delegatees.length; i++) {
            if (delegatees[i] == _address) {
                return false; 
            }
        }
        return true;
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

    function getEthPrice() private view returns(uint256){
        AggregatorV3Interface dataFeed = AggregatorV3Interface(0x694AA1769357215DE4FAC081bf1f309aDC325306);
        (,int256 answer,,,) = dataFeed.latestRoundData();
        return uint256(answer * 1e10);
    }

    function getConversionRate(uint256 _ethAmount) private view returns(uint256){
        uint256 ethPrice = getEthPrice();
        uint256 ethAmountInUsd = (ethPrice * _ethAmount) / 1e18;
        return ethAmountInUsd;
    }

    function enableTrading() external onlyOwner {
        isTradingAllowed = !isTradingAllowed; 
        emit TradingStatusChanged(isTradingAllowed);
    }



}