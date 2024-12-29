// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {GovernanceToken} from "./GovernanceToken.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract GovernanceDAO {

    GovernanceToken public MooveToken;

//errors
    error GovernanceDAO__NotEnoughtTokenToVote(uint256 _tokenYouHave, uint256 _tokenYouNeed);
    error GovernanceDAO__NotEnoughtMintedTokenToMakeProposals(uint256 _totalSupply, uint256 _minimumSupply);
    error GovernanceDAO__TradingIsNotAllowed();
    error GovernanceDAO__InsufficientBalance();
    error GovernanceDAO__InsufficientAmountOfTokenOnContract(uint256 _requestAmount, uint256 _tokenOnContractAmount);
    error GovernanceDAO__NotOwner();

//modifiers
    modifier onlyOwner() {
        if(msg.sender != i_teamAddress){ revert GovernanceDAO__NotOwner();}
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
    address immutable i_teamAddress;
    address immutable i_tokenContractAddress;
    uint256 public minimumTokenToMakeAProposal;
    uint256 internal proposalIndexCounter;
    bool public isTradingAllowed;
    uint256 public tokenPrice = MooveToken.getPrice();

//event
    event ProposalCreated(address indexed _proposer, uint256 indexed _proposalIndex);
    event TradingStatusChanged (bool tradingIsAllowed);
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
        uint256 _minimumTokenToMakeAProposal                      
    ){
        MooveToken = new GovernanceToken(
            _name,
            _symbol,
            msg.sender,
            address(this),
            _teamMintSupply,
            _cap, 
            _olderUsersMintSupply,
            _earlyAdopterMintSupply,
            _olderUsersAddresses,
            _weeksOfVesting,
            _tokenPrice
            );

        i_tokenContractAddress = address(MooveToken);
        i_teamAddress = msg.sender;
        minimumTokenToMakeAProposal = _minimumTokenToMakeAProposal;
    }

//functions

    function makeProposal(string calldata _proposalDescription) external {
        //aggiungere le condizioni per poter fare una proposal
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

        voteResults[currentProposalIndex].forVotes = 0;
        voteResults[currentProposalIndex].againstVotes = 0;
        voteResults[currentProposalIndex].abstainVotes = 0;

        proposalIndexCounter++;    

        emit ProposalCreated(newProposal.proposer, newProposal.proposalIndex);
    } 
    
    function enableTrading() external onlyOwner {
        isTradingAllowed = !isTradingAllowed; 
        emit TradingStatusChanged(isTradingAllowed);
    }

    function buyToken() public payable {
        if(isTradingAllowed == false){revert GovernanceDAO__TradingIsNotAllowed();}
        if(msg.value <= 0) {revert GovernanceDAO__InsufficientBalance();}
        if(msg.value > MooveToken.balanceOf(address(this))){
            revert GovernanceDAO__InsufficientAmountOfTokenOnContract(msg.value, MooveToken.balanceOf(address(this)));
        }
        

        //trasferire token al buyer, aggiornare i saldi e fare la matematica per la conversione tra token

        //MooveToken.updateElegibleAdresses(msg.sender);

        //inviare i fondi ricevuti al contratto della treasury
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