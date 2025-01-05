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
    //constructor errors
    error GovernanceDAO__NameAndSymbolFieldsCantBeEmpty();
    error GovernanceDAO__MaxSupplyReached(uint256 _supply, uint256 __cap);
    error GovernanceDAO__CapMustBeGreaterThanZero();
    error GovernanceDAO__TokenPriceMustBeGreaterThanZero();
    error GovernanceDAO__OlderUsersListMustBeMoreThanZero();
    error GovernanceDAO__InvalidInputValue();
    error GovernanceDAO__CirculatingSupplyCannotExceedCap();

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
    error GovernanceDAO__VoteAlreadyRegistered();
    error GovernanceDAO__YourVoteIsDelegated();
    error GovernanceDAO__InvalideVoteOption();
    error GovernanceDAO__DelegateeVotedAnActiveProposal();
    error GovernanceDAO__DelegateeHasTheirOwnFunctionToVote();
    
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
    event VoteDelegated(address indexed delegant, address indexed delegatee, uint256 tokenAmountDelegated);
    event VoteUndelegated(address indexed delegant, uint256 tokenAmountUndelegated);
    event SingleVoteRegistered(address indexed voter, VoteOptions indexed vote, uint256 votingPower, uint256 indexed proposalId);
    event DelegateeVoteRegistered(address indexed voter, VoteOptions indexed vote, uint256 votingPower, uint256 indexed proposalId, address[] delegators);
    event NewDelegateeApplied(address indexed newDelegatee);
    event DelegateeRemvedFromAppliedList(address indexed delegatee);

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
        uint forVotes;
        uint againstVotes;
        uint abstainVotes;
        bool isFinalized;
        bool isApproved;  
    }

//variables and mappings
    mapping (uint256 => Proposal) public proposalsById;
    mapping (uint256 => ProposalVoteDatabase) public votesById;
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
        string memory _name,                            // Token name
        string memory _symbol,                          // Token simbol
        uint256 _teamMintSupply,                        // Supply for the team
        uint256 _cap,                                   // Max supply 
        uint256 _olderUsersMintSupply,                  // Supply for the older users
        uint256 _earlyAdopterMintSupply,                // Supply the users who interact with the protocol
        address[] memory _olderUsersAddresses,          // Array of older users
        uint8 _weeksOfVesting,                          // Duration of vesting period in weeks    
        uint256 _tokenPrice,                            // price of single token
        uint256 _minimumTokenStakedToMakeAProposal,
        uint256 _minimumCirculatingSupplyToMakeAProposalInPercent,
        uint256 _proposalQuorumPercent,
        uint256 _slashingPercent,
        uint256 _votingPeriodInDays                     
    ){
        if(bytes(_name).length == 0 || bytes(_symbol).length == 0 ){revert GovernanceDAO__NameAndSymbolFieldsCantBeEmpty();}
        uint256 totalInitalMint = _teamMintSupply + _olderUsersMintSupply + _earlyAdopterMintSupply;
        if(totalInitalMint > _cap){revert GovernanceDAO__MaxSupplyReached(totalInitalMint, _cap);}
        if(_cap == 0){revert GovernanceDAO__CapMustBeGreaterThanZero();}
        if(_tokenPrice == 0){revert GovernanceDAO__TokenPriceMustBeGreaterThanZero();}
        if(_olderUsersMintSupply > 0 && _olderUsersAddresses.length == 0){revert GovernanceDAO__OlderUsersListMustBeMoreThanZero();}
        if(_minimumTokenStakedToMakeAProposal == 0 || _minimumTokenStakedToMakeAProposal > totalInitalMint){
            revert GovernanceDAO__InvalidInputValue();
        }
        if(_minimumCirculatingSupplyToMakeAProposalInPercent > _cap){revert GovernanceDAO__CirculatingSupplyCannotExceedCap();}
        if(_proposalQuorumPercent < 0 || _proposalQuorumPercent > 100){revert GovernanceDAO__InvalidInputValue();}
        if(_slashingPercent < 0 || _slashingPercent > 100){revert GovernanceDAO__InvalidInputValue();}
        if(_votingPeriodInDays == 0) {revert GovernanceDAO__InvalidInputValue();}

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
        proposalQuorum = (_cap * _proposalQuorumPercent) / 100;
        daysofVoting = _votingPeriodInDays * 86400;

        emit MooveTokenCreated(i_tokenContractAddress, _name, _symbol, msg.sender, _cap, _tokenPrice);
        emit MooveTreasuryCreated(i_treasuryContractAddress, msg.sender, address(this));
        emit NewTokenPriceSet(_tokenPrice);
    }

//functions

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

        MooveStakingManager.lockStakedTokens(msg.sender);

        for (uint i = 0; i < delegatees.length; i++) {
        if (delegatees[i] == msg.sender) {
            return;
            }
        }
        delegatees.push(msg.sender);
        emit NewDelegateeApplied(msg.sender);
    }

    function rejectForDelegate() public {
        if(!checkIfDelegatee(msg.sender)){revert GovernanceDAO__NotAppliedDelegatee();}
        for(uint i; i < proposalIdCounter; i++){
           Proposal memory proposal = getProposalById(i);
           bool delegateeVote = checkVoteById(i, msg.sender);
           if(!proposal.isApproved && delegateeVote){revert GovernanceDAO__DelegateeVotedAnActiveProposal();}
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

    //FUNZIONE PER TOGLIERSI DAI POSSIBILI DELEGATORI   

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
           if(!proposal.isApproved && delegateeVote){revert GovernanceDAO__DelegateeVotedAnActiveProposal();}
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
            voteDatabase.voteForTracker[msg.sender] = votingPower;
        } else if(_vote == VoteOptions.Against){
            proposal.againstVotes += votingPower;
            voteDatabase.voteAgainstTracker[msg.sender] = votingPower;
        } else if(_vote == VoteOptions.Abstain){
            proposal.abstainVotes += votingPower;
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
            voteDatabase.voteForTracker[msg.sender] = votingPower;
        } else if(_vote == VoteOptions.Against){
            proposal.againstVotes += votingPower;
            voteDatabase.voteAgainstTracker[msg.sender] = votingPower;
        } else if(_vote == VoteOptions.Abstain){
            proposal.abstainVotes += votingPower;
            voteDatabase.voteAbstainTraker[msg.sender] = votingPower;
        }
        
        emit DelegateeVoteRegistered(msg.sender, _vote, votingPower, _proposalId, delegateeToDelegators[msg.sender]);
    }

    function finalizeProposal(uint256 _proposalId) public onlyOwner {
        //togliere la proposal dal mapping AddressToActiveProposalVote
        //togliere il proposer dal mapping active proposer
    }


    //view functions
    function getMinimumTokenStakedToMakeAProposal() public view returns(uint256) {
        return minimumTokenStakedToMakeAProposal;
    }

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

    function isSenderInDelegators(address _delegatee, address _delegator) public view returns (bool, uint256) {
        address[] memory delegators = delegateeToDelegators[_delegatee];
        for (uint i = 0; i < delegators.length; i++) {
            if (delegators[i] == _delegator) {
                return (true, i);
            }
        }
        return (false, 0); 
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