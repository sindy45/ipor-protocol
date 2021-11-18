// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.8.4 <0.9.0;

interface IJoseph {

    function provideLiquidity(address asset, uint256 liquidityAmount) external;

    function redeem(address ipTokenAddress, uint256 ipTokenVolume) external;

}
