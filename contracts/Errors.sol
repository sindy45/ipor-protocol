// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.8.4 <0.9.0;

library Errors {
    string public constant CALLER_NOT_IPOR_ORACLE_ADMIN = 'IPOR_1'; // 'The caller must be the admin'
    string public constant CALLER_NOT_IPOR_ORACLE_UPDATER = 'IPOR_2'; // 'The caller must be the updater'
    string public constant AMM_TOTAL_AMOUNT_LOWER_THAN_FEE = 'IPOR_3'; // 'Deposit Amount when creating derivative position is lower than fee'
    string public constant AMM_TOTAL_AMOUNT_TOO_LOW = 'IPOR_4'; // 'Deposit Amount when creating derivative position is too low'
    string public constant AMM_MAXIMUM_SLIPPAGE_TOO_LOW = 'IPOR_5'; // 'Maximum Slippage is too low'
    string public constant AMM_LIQUIDITY_POOL_NOT_EXISTS = 'IPOR_7'; // 'Liquidity Pool for given asset symbol not exists'
    string public constant AMM_DERIVATIVE_DIRECTION_NOT_EXISTS = 'IPOR_8'; // 'Derivative direction not exists'
    string public constant AMM_MAXIMUM_SLIPPAGE_TOO_HIGH = 'IPOR_9'; // 'Maximum Slippage is too high'
    string public constant AMM_TOTAL_AMOUNT_TOO_HIGH = 'IPOR_10'; // 'Deposit Amount when creating derivative position is too high'
    string public constant AMM_LEVERAGE_TOO_LOW = 'IPOR_12'; //'Deposit amount to notional amount leverage is too low'
    string public constant AMM_ASSET_BALANCE_OF_TOO_LOW = 'IPOR_13'; //'Trader doesnt have enought tokens to execute transaction'
    string public constant AMM_CANNOT_CLOSE_DERIVATE_LIQUIDITY_POOL_IS_TOO_LOW = 'IPOR_14'; //'Derivative cannot be closed because liquidity pool is too low for payid out cash. Situation should never happen.'
    string public constant AMM_CANNOT_CLOSE_DERIVATE_LIQUIDATION_DEPOSIT_BALANCE_IS_TOO_LOW = 'IPOR_15'; //'Derivative cannot be closed because liquidation deposit balance is to low to pay sender for liquidation.'
    string public constant AMM_CANNOT_CLOSE_DERIVATE_CONDITION_NOT_MET = 'IPOR_16'; //'Derivative cannot be closed because general condition are not met'
    string public constant AMM_DERIVATIVE_IS_INACTIVE = 'IPOR_17'; //'Derivative should be in ACTIVE state'
    string public constant IPOR_ORACLE_INPUT_ARRAYS_LENGTH_MISMATCH = 'IPOR_18'; //'Input arrays which should have the same length - mismatch.'
    string public constant AMM_DERIVATIVE_NOTIONAL_HIGHER_THAN_TOTAL_NOTIONAL = 'IPOR_19'; //'Derivative Notional Amount is higher than Total Notional

}