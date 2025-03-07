//solhint-disable no-empty-blocks
// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.16;
import "../../interfaces/IStrategy.sol";

// simple mock for total _balance tests
contract MockStrategy is IStrategy {
    address private _stanley;
    uint256 private _balance;
    address private _shareTokens;
    uint256 private _apr;
    address private _asset;
    address private _owner;
    address private _treasury;
    address private _treasuryManager;

    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    function deposit(uint256 amount) external override returns (uint256 depositedAmount) {
        _balance = _balance + amount;
        depositedAmount = amount;
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawnAmount) {
        _balance = _balance - amount;
        withdrawnAmount = amount;
    }

    function getAsset() external view returns (address) {
        return _asset;
    }

    function pause() external override {}

    function unpause() external override {}

    function setAsset(address asset) external {
        _asset = asset;
    }

    function getApr() external view returns (uint256) {
        return _apr;
    }

    function setApr(uint256 apy) external {
        _apr = apy;
    }

    function balanceOf() external view returns (uint256) {
        return _balance;
    }

    function setBalance(uint256 balance) external {
        _balance = balance;
    }

    function getShareToken() external view override returns (address) {
        return _shareTokens;
    }

    function setShareToken(address shareToken) external {
        _shareTokens = shareToken;
    }

    function getTreasuryManager() external view override returns (address) {
        return _treasuryManager;
    }

    function setTreasuryManager(address manager) external {
        _treasuryManager = manager;
    }

    function getTreasury() external view override returns (address) {
        return _treasury;
    }

    function setTreasury(address treasury) external {
        _treasury = treasury;
    }

    function doClaim() external override {}

    function transferOwnership(address newOwner) external {
        _owner = newOwner;
    }

    function beforeClaim() external {}

    function getStanley() external view override returns (address) {
        return _stanley;
    }

    function setStanley(address stanley) external {
        _stanley = stanley;
    }
}
