// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.16;

/// @title Interface for interaction with Joseph - smart contract responsible
/// for managing ipTokens and ERC20 tokens in IPOR Protocol.
interface IJoseph {
    /// @notice Calculates ipToken exchange rate
    /// @dev exchange rate is a ratio between Liqudity Pool Balance and ipToken total supply
    /// @return ipToken exchange rate for a specific asset, represented in 18 decimals.
    function calculateExchangeRate() external view returns (uint256);

    /// @notice Function invoked to provide asset to Liquidity Pool in amount `assetValue`
    /// @dev Emits {ProvideLiquidity} event and transfers ERC20 tokens from sender to Milton,
    /// emits {Transfer} event from ERC20 asset, emits {Mint} event from ipToken.
    /// Transfers minted ipTokens to the sender. Amount of transferred ipTokens is based on current ipToken exchange rate
    /// @param assetAmount Amount of ERC20 tokens which are transferred from sender to Milton. Represented in decimals specific for asset.
    function provideLiquidity(uint256 assetAmount) external;

    /// @notice Redeems `ipTokenAmount` IpTokens for underlying asset
    /// @dev Emits {Redeem} event, emits {Transfer} event from ERC20 asset, emits {Burn} event from ipToken.
    /// Transfers asser ERC20 tokens from Milton to sender based on current exchange rate.
    /// @param ipTokenAmount redeem amount, represented in 18 decimals.
    function redeem(uint256 ipTokenAmount) external;

    /// @notice Method calculate how one should modifiy balances of stanley and milton before withdraw.
    /// @param wadMiltonErc20BalanceBeforeWithdraw balance of milton before withdraw, represented in 18 decimals.
    /// @param vaultBalance balance of stanley before withdraw, represented in 18 decimals.
    /// @param wadOperationAmount amount which one want to withdraw, represented in 18 decimals.
    /// @return amount for rebalance, if is negative one should withdraw from stanley,
    /// if it is positive one should deposit to stanley, represented in 18 decimals.
    function calculateRebalanceAmountBeforeWithdraw(
        uint256 wadMiltonErc20BalanceBeforeWithdraw,
        uint256 vaultBalance,
        uint256 wadOperationAmount
    ) external view returns (int256);

    /// @notice Emitted when `from` account provides liquidity (ERC20 token supported by IPOR Protocol) to Milton Liquidity Pool
    event ProvideLiquidity(
        /// @notice moment when liquidity is provided by `from` account
        uint256 timestamp,
        /// @notice address that provides liquidity
        address from,
        /// @notice Milton's address where liquidity is received
        address to,
        /// @notice current ipToken exchange rate
        /// @dev value represented in 18 decimals
        uint256 exchangeRate,
        /// @notice amount of asset provided by user to Milton's liquidity pool
        /// @dev value represented in 18 decimals
        uint256 assetAmount,
        /// @notice amount of ipToken issued to represent user's share in the liquidity pool.
        /// @dev value represented in 18 decimals
        uint256 ipTokenAmount
    );

    /// @notice Emitted when `to` accound executes redeem ipTokens
    event Redeem(
        /// @notice moment in which ipTokens were redeemed by `to` account
        uint256 timestamp,
        /// @notice Milton's address from which underlying asset - ERC20 Tokens, are transferred to `to` account
        address from,
        /// @notice account where underlying asset tokens are transferred after redeem
        address to,
        /// @notice ipToken exchange rate used for calculating `assetAmount`
        /// @dev value represented in 18 decimals
        uint256 exchangeRate,
        /// @notice underlying asset value calculated based on `exchangeRate` and `ipTokenAmount`
        /// @dev value represented in 18 decimals
        uint256 assetAmount,
        /// @notice redeemed IP Token value
        /// @dev value represented in 18 decimals
        uint256 ipTokenAmount,
        /// @notice underlying asset fee deducted when redeeming ipToken.
        /// @dev value represented in 18 decimals
        uint256 redeemFee,
        /// @notice net asset amount transferred from Milton to `to`/sender's account, reduced by the redeem fee
        /// @dev value represented in 18 decimals
        uint256 redeemAmount
    );
}
