// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {GovernanceToken} from "./GovernanceToken.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MooveGovernanceDAO {
//errors
    error MooveGovernanceDAO__NotEnoughtTokenToVote(uint256 _tokenYouHave, uint256 _tokenYouNeed);


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
    mapping(uint256 => ProposalVoteResult) public voteResults;
    address immutable i_teamAddress;
    uint256 public minimumTokenToMakeAProposal;
    uint256 internal proposalIndexCounter;

//event
    event ProposalCreated(address indexed _proposer, uint256 indexed _proposalIndex);

//constructor
    constructor(uint256 _minimumTokenToMakeAProposal){
        i_teamAddress = msg.sender;
        minimumTokenToMakeAProposal = _minimumTokenToMakeAProposal;
    }

//functions

    function calculateDecimals() internal {
        uint result = GovernanceToken.decimals();
    }

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
}