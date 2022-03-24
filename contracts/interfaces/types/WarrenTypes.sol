// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;

/// @title Structs used in Warren smart contract
library WarrenTypes {
    //@notice IPOR Index Structure for a given asset
    struct IPOR {
        //@notice Tiestamp of most recent IPOR index update, action performed by Charlie (refer to the documentation for more details)
        uint32 lastUpdateTimestamp;
        //@notice IPOR Index Value
        uint128 indexValue;
        //@notice quasi Interest Bearing Token Price, it is IBT Price without division by year in seconds
        uint128 quasiIbtPrice;
        /// @notice Exponential Moving Average indicator
        /// @dev used in calculating SPREAD in MiltonSpreadModel smart contract
        uint128 exponentialMovingAverage;
        //@notice exponential weighted moving variance - required for calculating SPREAD in Milton
        uint128 exponentialWeightedMovingVariance;
    }
}
