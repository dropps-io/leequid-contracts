// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

import "../tokens/StakedLyxToken.sol";
import "../interfaces/IPool.sol";

contract TestStakedLyxToken is StakedLyxToken {

    function setPool(address _pool) external {
        pool = IPool(_pool);
    }
}