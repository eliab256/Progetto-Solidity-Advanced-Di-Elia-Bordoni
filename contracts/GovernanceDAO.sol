// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {GovernanceToken} from "./GovernanceToken.sol";
import {StakingTokenManager} from "./StakingTokenManager.sol";
import {TreasuryDAO} from "./TreasuryDAO.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {GovernanceDelegationLibrary} from "./GovernanceDelegationLibrary.sol";

import "hardhat/console.sol";


contract GovernanceDAO is ReentrancyGuard{
    using GovernanceDelegationLibrary for mapping(address => address[]);
    using GovernanceDelegationLibrary for address[];

    GovernanceToken public MooveToken;
    TreasuryDAO public MooveTreasury;
    StakingTokenManager public MooveStakingManager;

//custom errors
    //constructor errors
    error GovernanceDAO__NameAndSymbolFieldsCantBeEmpty();
    error GovernanceDAO__MaxSupplyReached();
    error GovernanceDAO__OlderUsersListMustBeMoreThanZero();
    error GovernanceDAO__InvalidInputValue();
    error GovernanceDAO__CirculatingSupplyCannotExceedCap();
    //proposal errors
    error GovernanceDao__DescriptionCannotBeEmpty();
    error GovernanceDAO__NotEnoughtCirculatingSupplyToMakeProposals();
    error GovernanceDAO__AnotherProposalStillActive();
    error GovernanceDAO__InvalidId();
    error GovernanceDAO__ProposalStillOnVoting();
    //vote errors
    error GovernanceDAO__InsufficientAmountOfTokenOnContract();
    error GovernanceDAO__OutOfVotingPeriod();
    error GovernanceDAO__VoteAlreadyRegistered();
    error GovernanceDAO__YourVoteIsDelegated();
    error GovernanceDAO__InvalideVoteOption();
    //delelgations errors
    error GovernanceDAO__InvalidDelegateeAddress();
    error GovernanceDAO__NoDelegationFound();
    error GovernanceDAO__DelegatorHasNotToken();
    error GovernanceDAO__CantBeProposerAndDelegateeTogether();
    error GovernanceDAO__DelegateeCantBeDelegator();
    error GovernanceDAO__AlreadyDelegatee();
    error GovernanceDAO__AlreadyDelegator();
    error GovernanceDAO__NotAppliedDelegatee();
    error GovernanceDAO__DelegateeVotedAnActiveProposal();
    error GovernanceDAO__DelegateeHasTheirOwnFunctionToVote();
    //transfer and trading erros
    error GovernanceDAO__ETHTransferToTreasuryFailed();
    error GovernanceDAO__TradingIsNotAllowed();
    error GovernanceDAO__InsufficientBalance();
    error GovernanceDAO__TryingToWithdrawMoreETHThenBalance();
    //modifiers errors
    error GovernanceDAO__NotOwner();
    error GovernanceDAO__NotEnoughtTokenToVote();
    error GovernanceDAO__NotEnoughtTokenStakedToMakeProposal(uint256 _stakedToken, uint256 _tokenStakedYouNeed);
    //receive and fallback errors
    error GovernanceDAO__ToSendETHUseDepositFunction();
    error GovernanceDAO__NoFunctionCalled();
    
//event
    //contructor events
    event GovernanceDAOContractDeployedCorrectly (address teamAddress, address daoAddress, address tokenAddress, address treasuryAddress, address stakingManagerAddress);
    //proposal events
    event ProposalCreated(address indexed proposer, uint256 indexed proposalIndex, string proposalDescription, uint256 creationTime, uint256 closeVotationTime);
    event ProposalRefused(uint256 indexed proposalIndex, uint256 totalVotes, uint256 abstainVotes, address indexed proposer);
    event ProposalApproved(uint256 indexed proposalIndex, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, address indexed proposer);
    event ProposalFailed(uint256 indexed proposalIndex, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, address indexed proposer);
    //vote and delegation events
    event VoteDelegated(address indexed delegant, address indexed delegatee, uint256 tokenAmountDelegated);
    event VoteUndelegated(address indexed delegant, uint256 tokenAmountUndelegated);
    event SingleVoteRegistered(address indexed voter, VoteOptions indexed vote, uint256 votingPower, uint256 indexed proposalId);
    event DelegateeVoteRegistered(address indexed voter, VoteOptions indexed vote, uint256 votingPower, uint256 indexed proposalId, address[] delegators);
    event NewDelegateeApplied(address indexed newDelegatee);
    event DelegateeRemvedFromAppliedList(address indexed delegatee);
    //token and trading events 
    event TradingStatusChanged (bool tradingIsAllowed, uint256 blocktimestamp);
    event TokenPurchased(address indexed _buyer, uint256 indexed _amount, uint256 blocktimestamp);
    event NewTokenPriceSet(uint256 indexed _newPrice, uint256 blocktimestamp);
    event ETHDeposit(uint256 _amount, address indexed _sender, uint256 blocktimestamp);
    event SuccesfulTransferToTreasury(uint256 amount, uint256 blocktimestamp);
    event FailedTransferToTreasury(uint256 amount, uint256 blocktimestamp);
    event ReceiveTriggered(address sender, uint256 amount, uint256 timestamp);
    event FallbackTriggered(address sender, uint256 amount, bytes data, uint256 timestamp);

//modifiers
    modifier onlyOwner() {
        if(msg.sender != i_Owner){ revert GovernanceDAO__NotOwner();}
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

    struct ProposalVoteDatabase {
        uint256 proposalId;
        mapping (address => uint256) voteForTracker;
        mapping (address => uint256) voteAgainstTracker;
        mapping (address => uint256) voteAbstainTraker;
    }

    struct Proposal {
        uint256 proposalId;
        address proposer;
        string description;
        uint256 creationTimeStamp;
        uint256 endVotingTimestamp;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 totalVotes;
        bool quorumReached;  
        bool isApproved;
        bool isFinalized;
    }

//variables and mappings
    mapping (uint256 => Proposal) public proposalsById;
    mapping (uint256 => ProposalVoteDatabase) public votesById;
    mapping (address => bool) public activeProposers;
    mapping (address => address[]) public delegateeToDelegators;
    address[] public delegatees; 

    address immutable public i_Owner;
    address immutable public i_tokenContract;
    address immutable public i_treasuryContract;
    address immutable public i_stakingContract; 

    uint256 public tokenPrice;
    bool public isTradingAllowed = true;

    uint256 public daysofVoting;
    uint256 public minimumTokenStakedToMakeAProposal;
    uint256 public minimumCirculatingSupplyToMakeAProposalInPercent;
    uint256 internal proposalIdCounter = 1; 
    uint256 public proposalQuorumPercent;

// Constructor Parameters Struct
    struct GovernanceConstructorParams {
        string name;
        string symbol;
        uint256 teamMintSupply;
        uint256 cap;
        uint256 olderUsersMintSupply;
        uint256 earlyAdopterMintSupply;
        address[] olderUsersAddresses;
        uint8 weeksOfVesting;
        uint256 tokenPrice;
        uint256 minimumTokenStakedToMakeAProposal;
        uint256 minimumCirculatingSupplyToMakeAProposalInPercent;
        uint256 proposalQuorumPercent;
        uint256 slashingPercent;
        uint256 votingPeriodInDays;  
    }

//constructor
    constructor(GovernanceConstructorParams memory params){
        if(bytes(params.name).length == 0 || bytes(params.symbol).length == 0 ){revert GovernanceDAO__NameAndSymbolFieldsCantBeEmpty();}
        if(params.cap == 0){revert GovernanceDAO__InvalidInputValue();}
        uint256 totalInitalMint = params.teamMintSupply + params.olderUsersMintSupply + params.earlyAdopterMintSupply;
        if(totalInitalMint > params.cap){revert GovernanceDAO__MaxSupplyReached();}
        if(params.tokenPrice == 0){revert GovernanceDAO__InvalidInputValue();}
        if(params.minimumTokenStakedToMakeAProposal == 0){
            revert GovernanceDAO__InvalidInputValue();
        }
        if(params.minimumCirculatingSupplyToMakeAProposalInPercent > params.cap){revert GovernanceDAO__CirculatingSupplyCannotExceedCap();}
        if(params.proposalQuorumPercent < 0 || params.proposalQuorumPercent > 100){revert GovernanceDAO__InvalidInputValue();}
        if(params.slashingPercent < 0 || params.slashingPercent > 100){revert GovernanceDAO__InvalidInputValue();}
        if(params.votingPeriodInDays == 0) {revert GovernanceDAO__InvalidInputValue();}
        if(params.olderUsersMintSupply > 0 && params.olderUsersAddresses.length == 0){revert GovernanceDAO__OlderUsersListMustBeMoreThanZero();}

        MooveTreasury = new TreasuryDAO(msg.sender); 

        GovernanceToken.TokenConstructorParams memory tokenParams = GovernanceToken.TokenConstructorParams({
            name: params.name,
            symbol: params.symbol,
            teamAddress: msg.sender,
            treasuryAddress: address(MooveTreasury),
            teamMintSupply: params.teamMintSupply,
            cap: params.cap,
            olderUsersMintSupply: params.olderUsersMintSupply,
            earlyAdopterMintSupply: params.earlyAdopterMintSupply,
            olderUsersAddresses: params.olderUsersAddresses,
            weeksOfVesting: params.weeksOfVesting
        });

        MooveToken = new GovernanceToken(tokenParams);

        MooveStakingManager = new StakingTokenManager(msg.sender, address(MooveToken), params.slashingPercent);

        i_tokenContract = address(MooveToken);
        i_treasuryContract = address(MooveTreasury);
        i_Owner = msg.sender;
        i_stakingContract = address(MooveStakingManager);
        minimumTokenStakedToMakeAProposal = params.minimumTokenStakedToMakeAProposal * 10 ** MooveToken.decimals(); 
        //20 = 20000000000000000000 
        //200.5 = 2005000000000000000
        minimumCirculatingSupplyToMakeAProposalInPercent = params.minimumCirculatingSupplyToMakeAProposalInPercent;
        proposalQuorumPercent = params.proposalQuorumPercent;
        daysofVoting = params.votingPeriodInDays * 86400;
        tokenPrice = params.tokenPrice;

        emit NewTokenPriceSet(params.tokenPrice, block.timestamp);
        emit GovernanceDAOContractDeployedCorrectly (msg.sender, address(this), i_tokenContract, i_treasuryContract, i_stakingContract);
    }

//functions

    function makeProposal(string calldata _proposalDescription) external onlyEligibleToProposeOrDelegatee {
        if (bytes(_proposalDescription).length <= 0) {revert GovernanceDao__DescriptionCannotBeEmpty();}

        uint256 minimumCirculatingSupply = MooveToken.totalSupply() * minimumCirculatingSupplyToMakeAProposalInPercent / 100;
        uint256 actualCirculatingSupply = MooveToken.totalSupply() - MooveToken.balanceOf(address(this));
        if(actualCirculatingSupply < minimumCirculatingSupply){
            revert GovernanceDAO__NotEnoughtCirculatingSupplyToMakeProposals();
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
            totalVotes : 0,
            quorumReached : false,
            isFinalized: false,
            isApproved: false
        });
       
        uint256 currentProposalId = proposal.proposalId;
        proposalsById[currentProposalId] = proposal;
        activeProposers[msg.sender] = true;

        MooveStakingManager.lockStakedTokens(msg.sender);

        proposalIdCounter++;    

        emit ProposalCreated(proposal.proposer, proposal.proposalId, proposal.description, proposal.creationTimeStamp, proposal.endVotingTimestamp);
    }

    function applyForDelegatee() public onlyEligibleToProposeOrDelegatee() {
        if(activeProposers[msg.sender]){revert GovernanceDAO__CantBeProposerAndDelegateeTogether();}
        if(checkIfDelegator(msg.sender)){revert GovernanceDAO__DelegateeCantBeDelegator();}
        if(checkIfDelegatee(msg.sender)){revert GovernanceDAO__AlreadyDelegatee();}

        MooveStakingManager.lockStakedTokens(msg.sender);

        for (uint i = 0; i < delegatees.length; i++) {
        if (delegatees[i] == msg.sender) {
            return;
            }
        }
        delegatees.push(msg.sender);
        emit NewDelegateeApplied(msg.sender);
    }

    function rejectForDelegatee() public {
        if(!checkIfDelegatee(msg.sender)){revert GovernanceDAO__NotAppliedDelegatee();}
        for(uint i; i < proposalIdCounter; i++){
           Proposal memory proposal = getProposalById(i);
           bool delegateeVote = checkVoteById(i, msg.sender);
           if(!proposal.isFinalized && delegateeVote){revert GovernanceDAO__DelegateeVotedAnActiveProposal();}
        }

        for(uint i; i< delegatees.length; i++){
            if(delegatees[i] == msg.sender){
                delegatees[i] = address(0);
            }
        }

        for(uint i; ; i++ ){
            if(delegateeToDelegators[msg.sender][i] != address(0)){
                address delegator = delegateeToDelegators[msg.sender][i];
                MooveStakingManager.unlockStakedTokens(delegator);
            } else break;
        }

        delete delegateeToDelegators[msg.sender];

        MooveStakingManager.unlockStakedTokens(msg.sender);
        emit DelegateeRemvedFromAppliedList(msg.sender);
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

    function undelegateVote(address _delegatee) public onlyEligibleVoters {
        if(!checkIfDelegator(msg.sender)){revert GovernanceDAO__NoDelegationFound();}
        if(!checkIfDelegatee(_delegatee)){revert GovernanceDAO__NotAppliedDelegatee();}
     
        for(uint i; i < proposalIdCounter; i++){
           Proposal memory proposal = getProposalById(i);
           bool delegateeVote = checkVoteById(i, _delegatee);
           if(!proposal.isFinalized && delegateeVote){revert GovernanceDAO__DelegateeVotedAnActiveProposal();}
        }

        (bool isInDelegators, uint256 arrayIndex) = isSenderInDelegators(_delegatee, msg.sender);
        address[] storage delegators = delegateeToDelegators[_delegatee];
       
        if (!isInDelegators) {
            revert GovernanceDAO__NoDelegationFound();
        } else {
            delegators[arrayIndex] = delegators[delegators.length - 1];
            delegators.pop();
        }
        
        MooveStakingManager.unlockStakedTokens(msg.sender);
        uint256 tokensDelegated = MooveStakingManager.getUserStakedTokens(msg.sender);
        emit VoteUndelegated(msg.sender, tokensDelegated);
    }

    function voteOnProposal(uint256 _proposalId, VoteOptions _vote) public onlyEligibleVoters {
        if(checkIfDelegator(msg.sender)){revert GovernanceDAO__YourVoteIsDelegated();}
        if(checkIfDelegatee(msg.sender)){revert GovernanceDAO__DelegateeHasTheirOwnFunctionToVote();}
        if(_vote > (type(VoteOptions).max) ){revert GovernanceDAO__InvalideVoteOption();}
        Proposal memory proposal = proposalsById[_proposalId];
        if(proposal.endVotingTimestamp < block.timestamp){revert GovernanceDAO__OutOfVotingPeriod();}
        if(checkVoteById(_proposalId, msg.sender)){revert GovernanceDAO__VoteAlreadyRegistered();}

        MooveStakingManager.lockStakedTokens(msg.sender);
        uint256 votingPower = MooveStakingManager.getUserStakedTokens(msg.sender);

        ProposalVoteDatabase storage voteDatabase = votesById[_proposalId];

        if(_vote == VoteOptions.InFavor){
            proposal.forVotes += votingPower;
            proposal.totalVotes += votingPower;
            voteDatabase.voteForTracker[msg.sender] = votingPower;
        } else if(_vote == VoteOptions.Against){
            proposal.againstVotes += votingPower;
            proposal.totalVotes += votingPower;
            voteDatabase.voteAgainstTracker[msg.sender] = votingPower;
        } else if(_vote == VoteOptions.Abstain){
            proposal.abstainVotes += votingPower;
            proposal.totalVotes += votingPower;
            voteDatabase.voteAbstainTraker[msg.sender] = votingPower;
        }

        emit SingleVoteRegistered(msg.sender, _vote, votingPower, _proposalId);
    }

    function delegateeVoteOnProposal(uint256 _proposalId, VoteOptions _vote) public onlyEligibleVoters{
        if(!checkIfDelegatee(msg.sender)){revert GovernanceDAO__NotAppliedDelegatee();}
        if(_vote > (type(VoteOptions).max) ){revert GovernanceDAO__InvalideVoteOption();}
        Proposal memory proposal = proposalsById[_proposalId];
        if(proposal.endVotingTimestamp < block.timestamp){revert GovernanceDAO__OutOfVotingPeriod();}
        if(checkVoteById(_proposalId, msg.sender)){revert GovernanceDAO__VoteAlreadyRegistered();}

        uint256 votingPower;
        for(uint256 i= 0; i > delegateeToDelegators[msg.sender].length ; i++){
            votingPower += MooveStakingManager.getUserStakedTokens(delegateeToDelegators[msg.sender][i]);      
        }

        ProposalVoteDatabase storage voteDatabase = votesById[_proposalId];

        if(_vote == VoteOptions.InFavor){
            proposal.forVotes += votingPower;
            proposal.totalVotes += votingPower;
            voteDatabase.voteForTracker[msg.sender] = votingPower;
        } else if(_vote == VoteOptions.Against){
            proposal.againstVotes += votingPower;
            proposal.totalVotes += votingPower;
            voteDatabase.voteAgainstTracker[msg.sender] = votingPower;
        } else if(_vote == VoteOptions.Abstain){
            proposal.abstainVotes += votingPower;
            proposal.totalVotes += votingPower;
            voteDatabase.voteAbstainTraker[msg.sender] = votingPower;
        }
        
        emit DelegateeVoteRegistered(msg.sender, _vote, votingPower, _proposalId, delegateeToDelegators[msg.sender]);
    }

    function finalizeProposal(uint256 _proposalId) public onlyOwner {
        Proposal memory proposal =  getProposalById(_proposalId);
        if(proposal.creationTimeStamp == 0){revert GovernanceDAO__InvalidId();}
        if(proposal.endVotingTimestamp < block.timestamp){revert GovernanceDAO__ProposalStillOnVoting();}
        if(checkQuorumReached(proposal.totalVotes, proposal.abstainVotes)){
            proposal.quorumReached = true;
            if(proposal.forVotes >= proposal.againstVotes){
                proposal.isApproved = true;
                proposal.isFinalized = true;
                emit ProposalApproved(_proposalId, proposal.forVotes, proposal.againstVotes, proposal.abstainVotes, proposal.proposer);
            } else{
                proposal.isFinalized = true;
                emit ProposalFailed(_proposalId, proposal.forVotes, proposal.againstVotes, proposal.abstainVotes, proposal.proposer);
            }
        } else{ 
            proposal.isFinalized = true;
            MooveStakingManager.tokenSlasher(proposal.proposer);
            emit ProposalRefused(_proposalId, proposal.totalVotes, proposal.abstainVotes, proposal.proposer);
        }
        activeProposers[proposal.proposer] = false;
    }

    //view functions

    function getVotePeriodActive(uint256 _id) view external returns(bool){   
        Proposal memory proposal = proposalsById[_id];
        if(proposal.endVotingTimestamp == 0){revert GovernanceDAO__InvalidId();}
        return proposal.endVotingTimestamp > block.timestamp;
    }

     function checkIfDelegator(address _address) public view returns (bool) {
        return delegateeToDelegators.checkIfDelegator(_address);
    }

    function checkIfDelegatee(address _address) public view returns (bool) {
        return delegatees.checkIfDelegatee(_address);
    }

    function isSenderInDelegators(address _delegatee, address _delegator) 
        public view returns (bool, uint256) {
        return delegateeToDelegators.isSenderInDelegators(_delegatee, _delegator);
    }

    function getProposalById(uint256 _proposalId) public view returns (Proposal memory){
        return proposalsById[_proposalId];
    }

    function checkVoteById(uint256 _proposalId, address _voter) public view returns (bool){
        ProposalVoteDatabase storage votersList = votesById[_proposalId];
        if(votersList.voteForTracker[_voter] > 0){
            return true;
        } else if (votersList.voteAgainstTracker[_voter] > 0){
            return true;
        } else if(votersList.voteAbstainTraker[_voter] > 0){
            return true;
        } else return false;
    }

    function checkQuorumReached(uint256 _totalVoters, uint256 _abstainedVoters) private view returns (bool){
        if(((_totalVoters * proposalQuorumPercent)/100) >= (_totalVoters - _abstainedVoters)){
            return true;
        } else return false;
    }

    //functions to handle token trading
    function buyToken() public payable {
        if(isTradingAllowed == false){revert GovernanceDAO__TradingIsNotAllowed();}
        if(msg.value <= 0) {revert GovernanceDAO__InsufficientBalance();}
        if(msg.value > MooveToken.balanceOf(address(this))){
            revert GovernanceDAO__InsufficientAmountOfTokenOnContract();
        }
    
        uint256 amountToSend = (msg.value / tokenPrice) * 10 ** MooveToken.decimals();

        MooveToken.sendingToken( msg.sender, amountToSend);
        emit TokenPurchased(msg.sender, amountToSend, block.timestamp);

        bool vestingperiod = MooveToken.getVestingPeriodStatus();
        bool addressAlreadyRegistered = MooveToken.getElegibleForClaimsArray(msg.sender);
        if(vestingperiod || addressAlreadyRegistered){
            MooveToken.updateElegibleAdresses(msg.sender);
        }

        sendETHToTreasury(msg.value);
    }

    function changeTradingStatus() external onlyOwner {
        isTradingAllowed = !isTradingAllowed; 
        emit TradingStatusChanged(isTradingAllowed, block.timestamp);
    }

    function depositETH()external payable {
        if(msg.value == 0){revert GovernanceDAO__InvalidInputValue();}
        emit ETHDeposit(msg.value, msg.sender, block.timestamp);

    }

    function sendETHToTreasury(uint256 _amount) private {
        if(_amount <= 0){revert GovernanceDAO__InvalidInputValue();}
        if(_amount > address(this).balance){revert GovernanceDAO__TryingToWithdrawMoreETHThenBalance();}
        bool sendSuccess = payable(i_treasuryContract).send(_amount);
        if (!sendSuccess) {
            emit FailedTransferToTreasury(_amount, block.timestamp);
        } else emit SuccesfulTransferToTreasury(_amount, block.timestamp);
    }

    function sendETHToTreasuryAsOwner(uint256 _amount) public onlyOwner{
        sendETHToTreasury(_amount);
    }

    receive() external payable{
        emit ReceiveTriggered(msg.sender, msg.value, block.timestamp);
        revert GovernanceDAO__ToSendETHUseDepositFunction();
    
    }

    fallback() external payable{
        emit FallbackTriggered(msg.sender, msg.value, msg.data, block.timestamp);
        revert GovernanceDAO__NoFunctionCalled();
        
    }

}