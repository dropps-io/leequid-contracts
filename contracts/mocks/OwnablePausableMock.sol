// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.4;

import "../presets/OwnablePausable.sol";

contract OwnablePausableMock is OwnablePausable {
    constructor(address _admin) OwnablePausable(_admin) { }
}
