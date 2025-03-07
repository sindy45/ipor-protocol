// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./MockTestnetToken.sol";

//solhint-disable no-empty-blocks
contract MockTestnetShareTokenCompoundUsdt is MockTestnetToken {
    constructor(uint256 initialSupply)
        MockTestnetToken("Mocked Share cUSDT", "cUSDT", initialSupply, 6)
    {}
    function accrueInterest() public returns (uint) {}
}
