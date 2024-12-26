// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {GovernanceToken} from "./GovernanceToken.sol";

contract MooveGovernance {
    
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
        uint256 endVotingTimestamp;
        bool isApproved;
        bool isFinalized;
        ProposalVoteResult voteResults;
    }

    address teamAddress;

    constructor(){
        teamAddress = msg.sender;
    }

    function makeProposal() external {

    }
}