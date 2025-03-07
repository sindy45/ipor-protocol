// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../libraries/errors/IporErrors.sol";
import "../../libraries/Constants.sol";
import "../../libraries/math/IporMath.sol";
import "../../interfaces/IStanley.sol";

contract MockCaseBaseStanley is IStanley {
    using SafeERC20 for IERC20;
    IERC20 private _asset;

    mapping(address => uint256) private _balance;

    uint256 private constant _FIXED_IV_TOKEN_PRICE = 1e18;

    constructor(address asset) {
        _asset = IERC20(asset);
    }

    function totalBalance(address who) external view override returns (uint256) {
        //@dev for simplicity we assume that reading total balance not include interest
        return _balance[who];
    }

    function calculateExchangeRate() external pure override returns (uint256) {
        return 0;
    }

    //@dev for test purposes, simulation that IporVault earn some money for recipient
    function testDeposit(address recipient, uint256 assetAmount)
        external
        returns (uint256 balance)
    {
        balance = _balance[recipient] + assetAmount;
        _balance[recipient] = balance;

        _asset.safeTransferFrom(msg.sender, address(this), assetAmount);
    }

    function deposit(uint256 wadAssetAmount)
        external
        override
        returns (uint256 balance, uint256 depositedAmount)
    {
        balance = _balance[msg.sender] + wadAssetAmount;

        _balance[msg.sender] = balance;

        uint256 decimals = IERC20Metadata(address(_asset)).decimals();

        uint256 assetAmount = IporMath.convertWadToAssetDecimals(wadAssetAmount, decimals);

        _asset.safeTransferFrom(msg.sender, address(this), assetAmount);

        depositedAmount = IporMath.convertToWad(assetAmount, decimals);
    }

    function withdraw(uint256 wadAssetAmount)
        external
        override
        returns (uint256 withdrawnAmount, uint256 balance)
    {
        uint256 wadFinalAssetAmount = IporMath.division(
            wadAssetAmount * _withdrawRate(),
            Constants.D18
        );
        if (wadFinalAssetAmount > _balance[msg.sender]) {
            return (0, _balance[msg.sender]);
        }
        balance = _balance[msg.sender] - wadFinalAssetAmount;
        withdrawnAmount = wadFinalAssetAmount;

        _balance[msg.sender] = balance;

        uint256 finalAssetAmount = IporMath.convertWadToAssetDecimals(
            wadFinalAssetAmount,
            IERC20Metadata(address(_asset)).decimals()
        );
        _asset.safeTransfer(msg.sender, finalAssetAmount);
    }

    //solhint-disable no-empty-blocks
    function withdrawAll()
        external
        override
        returns (uint256 withdrawnAmount, uint256 vaultBalance)
    {
        uint256 toWithdraw = _balance[msg.sender];
        _asset.safeTransfer(msg.sender, toWithdraw);
        withdrawnAmount = _balance[msg.sender];
        _balance[msg.sender] = 0;
        vaultBalance = 0;
    }

    function _withdrawRate() internal pure virtual returns (uint256) {
        return 1e18;
    }
}
