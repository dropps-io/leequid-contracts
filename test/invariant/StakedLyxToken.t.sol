pragma solidity 0.8.20;

// solhint-disable no-console

import "contracts/tokens/StakedLyxToken.sol";

import "forge-std/console.sol";
import "forge-std/Test.sol";

/**
 * @title StakedLyxTokenTest contract
 * @dev Test contract for StakedLyxToken.sol
 */
contract StakedLyxTokenTest is Test, StakedLyxToken {
    constructor() public StakedLyxToken() {}

    // function getTotalDeposits() public view returns (uint256) {
    //     return _totalDeposits;
    // }

    // function getUnstakeRequest(uint256 index) public view returns (UnstakeRequest memory) {
    //     return _unstakeRequests[index];
    // }

    // function getDeposits(address owner) public view returns (uint256) {
    //     return _deposits[owner];
    // }

    // function getOperatorAuthorizedAmount(
    //     address owner,
    //     address operator
    // ) public view returns (uint256) {
    //     return _operatorAuthorizedAmount[owner][operator];
    // }

    // function getPoolAddress() public view returns (address) {
    //     return address(pool);
    // }

    // function getOraclesAddress() public view returns (address) {
    //     return oracles;
    // }

    // function getRewardsAddress() public view returns (address) {
    //     return address(rewards);
    // }

    // function calculateMatchUnstake(uint256 amount) public view override returns (uint256) {
    //     if (totalPendingUnstake == 0) {
    //         return 0;
    //     } else if (amount >= totalPendingUnstake) {
    //         return totalPendingUnstake;
    //     } else {
    //         return amount;
    //     }
    // }
}
