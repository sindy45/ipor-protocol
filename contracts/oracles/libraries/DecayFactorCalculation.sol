// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.16;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../../libraries/math/IporMath.sol";

uint256 constant END_INTERVAL_ONE = 179666;
uint256 constant END_INTERVAL_TWO = 596832;
uint256 constant END_INTERVAL_THREE = 1346513;

// Line One Parameters in wand
int256 constant SLOPE_FACTOR_ONE = -2782991070840;
int256 constant BASE_ONE = 1000000000000000000;

// Line two Parameters in wand
int256 constant SLOPE_FACTOR_TWO = -958849469240;
int256 constant BASE_TWO = 672268604625703800;

// Line three Parameters in wand
int256 constant SLOPE_FACTOR_THREE = -133388866004;
int256 constant BASE_THREE = 179609917339805645;

library DecayFactorCalculation {
    using SafeCast for uint256;
    using SafeCast for int256;

    //@param variable represent in int, NOT in WAD
    //@dev return value represented in WAD
    function calculate(uint256 timeInterval) internal pure returns (uint256 decayFactor) {
        if (timeInterval < END_INTERVAL_ONE) {
            return linearFunction(SLOPE_FACTOR_ONE, BASE_ONE, timeInterval.toInt256()).toUint256();
        }

        if (timeInterval < END_INTERVAL_TWO) {
            return linearFunction(SLOPE_FACTOR_TWO, BASE_TWO, timeInterval.toInt256()).toUint256();
        }

        if (timeInterval < END_INTERVAL_THREE) {
            return
                linearFunction(SLOPE_FACTOR_THREE, BASE_THREE, timeInterval.toInt256()).toUint256();
        }

        decayFactor = 0;
    }

    //@param slope represent in WAD
    //@param base represent in WAD
    //@param variable represent in int, NOT in WAD
    //@dev return value represented in WAD
    function linearFunction(
        int256 slope,
        int256 base,
        int256 variable
    ) internal pure returns (int256) {
        return slope * variable + base;
    }
}
