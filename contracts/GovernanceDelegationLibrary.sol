// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library GovernanceDelegationLibrary {

    function checkIfDelegatee(address[] storage delegatees, address _address) 
        internal view returns (bool) {
        for (uint256 i = 0; i < delegatees.length; i++) {
            if (delegatees[i] == _address) {
                return true;
            }
        }
        return false;
    }

    function isSenderInDelegators(mapping(address => address[]) storage delegateeToDelegators, 
             address _delegatee, address _delegator) 
        internal view returns (bool, uint256) {
        address[] storage delegators = delegateeToDelegators[_delegatee];
        for (uint i = 0; i < delegators.length; i++) {
            if (delegators[i] == _delegator) {
                return (true, i);
            }
        }
        return (false, 0);
    }
}
