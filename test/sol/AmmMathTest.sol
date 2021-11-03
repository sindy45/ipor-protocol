// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.8.4 <0.9.0;

import '../../contracts/amm/Milton.sol';
import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";

contract AmmMathTest {

    function testCalculateIbtQuantityCase1() public {

        //given
        uint256 notionalAmount = 98703000000000000000000;
        uint256 ibtPrice = 100000000000000000000;

        //when
        uint256 ibtQuantity = AmmMath.calculateIbtQuantity(notionalAmount, ibtPrice, Constants.MD);

        //then
        Assert.equal(ibtQuantity, 987030000000000000000, "Wrong IBT Quantity");
    }

    function testCalculateIncomeTaxCase1() public {
        //given
        uint256 profit = 500 * Constants.MD;
        uint256 percentage = 6 * Constants.MD / 100;

        //when
        uint256 actualIncomeTaxValue = AmmMath.calculateIncomeTax(profit, percentage, Constants.MD);

        //then
        Assert.equal(actualIncomeTaxValue, 30000000000000000000, "Wrong Income Tax");
    }

    function testCalculateDerivativeAmountCase1() public {
        //given
        uint256 totalAmount = 10180 * Constants.MD;
        uint256 collateralizationFactor = 50 * Constants.MD;
        uint256 liquidationDepositAmount = 20 * Constants.MD;
        uint256 iporPublicationFeeAmount = 10 * Constants.MD;
        uint256 openingFeePercentage = 3 * 1e14;

        //when
        DataTypes.IporDerivativeAmount memory result = AmmMath.calculateDerivativeAmount(
            totalAmount,
            collateralizationFactor,
            liquidationDepositAmount,
            iporPublicationFeeAmount,
            openingFeePercentage,
                Constants.MD);

        //then
        Assert.equal(result.notional, 500000 * Constants.MD, "Wrong Notional");
        Assert.equal(result.openingFee, 150 * Constants.MD, "Wrong Opening Fee Amount");
        Assert.equal(result.deposit, 10000 * Constants.MD, "Wrong Collateral");
    }
}
