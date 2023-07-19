// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity ^0.8.20;

import {OwnablePausable} from '../presets/OwnablePausable.sol';

contract OwnablePausableMock is OwnablePausable {
  constructor(address _admin) OwnablePausable(_admin) {}
}
