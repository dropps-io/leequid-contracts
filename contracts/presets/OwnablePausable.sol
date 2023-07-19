// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.20;

import {AccessControlUpgradeable} from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import {PausableUpgradeable} from '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import {IOwnablePausable} from '../interfaces/IOwnablePausable.sol';

/**
 * @title OwnablePausable
 *
 * @dev Bundles Access Control and Pausable contracts in one.
 *
 */
abstract contract OwnablePausable is
  IOwnablePausable,
  PausableUpgradeable,
  AccessControlUpgradeable
{
  bytes32 public constant PAUSER_ROLE = keccak256('PAUSER_ROLE');

  /**
   * @dev Modifier for checking whether the caller is an admin.
   */
  modifier onlyAdmin() {
    require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), 'OwnablePausable: access denied');
    _;
  }

  /**
   * @dev Modifier for checking whether the caller is a pauser.
   */
  modifier onlyPauser() {
    require(hasRole(PAUSER_ROLE, msg.sender), 'OwnablePausable: access denied');
    _;
  }

  /**
   * @dev Grants `DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE` to the admin account.
   */
  constructor(address _admin) {
    _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    _setupRole(PAUSER_ROLE, _admin);
  }

  /**
   * @dev See {IOwnablePausable-isAdmin}.
   */
  function isAdmin(address _account) external view override returns (bool) {
    return hasRole(DEFAULT_ADMIN_ROLE, _account);
  }

  /**
   * @dev See {IOwnablePausable-addAdmin}.
   */
  function addAdmin(address _account) external override {
    grantRole(DEFAULT_ADMIN_ROLE, _account);
  }

  /**
   * @dev See {IOwnablePausable-removeAdmin}.
   */
  function removeAdmin(address _account) external override {
    revokeRole(DEFAULT_ADMIN_ROLE, _account);
  }

  /**
   * @dev See {IOwnablePausable-isPauser}.
   */
  function isPauser(address _account) external view override returns (bool) {
    return hasRole(PAUSER_ROLE, _account);
  }

  /**
   * @dev See {IOwnablePausable-addPauser}.
   */
  function addPauser(address _account) external override {
    grantRole(PAUSER_ROLE, _account);
  }

  /**
   * @dev See {IOwnablePausable-removePauser}.
   */
  function removePauser(address _account) external override {
    revokeRole(PAUSER_ROLE, _account);
  }

  /**
   * @dev See {IOwnablePausable-pause}.
   */
  function pause() external override onlyPauser {
    _pause();
  }

  /**
   * @dev See {IOwnablePausable-unpause}.
   */
  function unpause() external override onlyPauser {
    _unpause();
  }
}
