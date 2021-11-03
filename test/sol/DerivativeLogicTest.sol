// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.8.4 <0.9.0;

import '../../contracts/amm/Milton.sol';
import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "./TestData.sol";
contract DerivativeLogicTest is TestData {

    using DerivativeLogic  for DataTypes.IporDerivative;

    function testCalculateInterestFixedCase1() public {

        //given
        uint256 notionalAmount = 98703000000000000000000;
        uint256 derivativeFixedInterestRate = 40000000000000000;
        uint256 derivativePeriodInSeconds = 0;
        uint256 multiplicator = Constants.MD;

        //when
        uint256 result = DerivativeLogic.calculateQuasiInterestFixed(notionalAmount, derivativeFixedInterestRate, derivativePeriodInSeconds, multiplicator);

        //then
        Assert.equal(AmmMath.division(result, Constants.MD_YEAR_IN_SECONDS), notionalAmount, "Wrong interest fixed");
    }

    function testCalculateInterestFixedCase2() public {

        //given
        uint256 notionalAmount = 98703000000000000000000;
        uint256 derivativeFixedInterestRate = 40000000000000000;
        uint256 derivativePeriodInSeconds = Constants.DERIVATIVE_DEFAULT_PERIOD_IN_SECONDS;
        uint256 multiplicator = Constants.MD;

        //when
        uint256 result = DerivativeLogic.calculateQuasiInterestFixed(notionalAmount, derivativeFixedInterestRate, derivativePeriodInSeconds, multiplicator);

        //then
        Assert.equal(AmmMath.division(result, Constants.MD_YEAR_IN_SECONDS), 99005869479452054794521, "Wrong interest fixed");
    }

    function testCalculateInterestFixedCase3() public {

        //given
        uint256 notionalAmount = 98703000000000000000000;
        uint256 derivativeFixedInterestRate = 40000000000000000;
        uint256 derivativePeriodInSeconds = Constants.YEAR_IN_SECONDS;
        uint256 multiplicator = Constants.MD;

        //when
        uint256 result = DerivativeLogic.calculateQuasiInterestFixed(notionalAmount, derivativeFixedInterestRate, derivativePeriodInSeconds, multiplicator);

        //then
        Assert.equal(AmmMath.division(result, Constants.MD_YEAR_IN_SECONDS), 102651120000000000000000, "Wrong interest fixed");
    }

    function testCalculateInterestFloatingCase1() public {

        //given
        uint256 ibtQuantity = 987030000000000000000;
        uint256 ibtCurrentPrice = 100000000000000000000;

        //when
        uint256 result = DerivativeLogic.calculateQuasiInterestFloating(ibtQuantity, ibtCurrentPrice);

        //then
        Assert.equal(AmmMath.division(result, Constants.MD_YEAR_IN_SECONDS), 98703000000000000000000, "Wrong interest floating");
    }

    function testCalculateInterestFloatingCase2() public {

        //given
        uint256 ibtQuantity = 987030000000000000000;
        uint256 ibtCurrentPrice = 150000000000000000000;

        //when
        uint256 result = DerivativeLogic.calculateQuasiInterestFloating(ibtQuantity, ibtCurrentPrice);

        //then
        Assert.equal(AmmMath.division(result, Constants.MD_YEAR_IN_SECONDS), 148054500000000000000000, "Wrong interest floating");
    }

    function testCalculateInterestCase1() public {

        //given
        uint256 fixedInterestRate = 40000000000000000;
        DataTypes.IporDerivative memory derivative = prepareDerivativeCase1(fixedInterestRate);

        //when
        DataTypes.IporDerivativeInterest memory derivativeInterest = derivative.calculateInterest(
            derivative.startingTimestamp, 100 * Constants.MD, Constants.MD);

        //then
        Assert.equal(AmmMath.division(derivativeInterest.quasiInterestFixed, Constants.MD_YEAR_IN_SECONDS), 98703000000000000000000, "Wrong interest fixed");
        Assert.equal(AmmMath.division(derivativeInterest.quasiInterestFloating, Constants.MD_YEAR_IN_SECONDS), 98703000000000000000000, "Wrong interest floating");
        Assert.equal(derivativeInterest.positionValue, 0, "Wrong interest difference amount");
    }

    function testCalculateInterestCase2SameTimestampIBTPriceIncrease() public {

        //given
        uint256 fixedInterestRate = 40000000000000000;
        DataTypes.IporDerivative memory derivative = prepareDerivativeCase1(fixedInterestRate);


        uint256 ibtPriceSecond = 125 * Constants.MD;
        //when
        DataTypes.IporDerivativeInterest memory derivativeInterest = derivative.calculateInterest(
            derivative.startingTimestamp, ibtPriceSecond, Constants.MD);

        //then
        Assert.equal(AmmMath.division(derivativeInterest.quasiInterestFixed, Constants.MD_YEAR_IN_SECONDS), 98703000000000000000000, "Wrong interest fixed");
        Assert.equal(AmmMath.division(derivativeInterest.quasiInterestFloating, Constants.MD_YEAR_IN_SECONDS), 123378750000000000000000, "Wrong interest floating");
        Assert.equal(derivativeInterest.positionValue, 24675750000000000000000, "Wrong interest difference amount");
    }

    function testCalculateInterestCase25daysLaterIBTPriceNotChanged() public {

        //given
        uint256 fixedInterestRate = 40000000000000000;
        DataTypes.IporDerivative memory derivative = prepareDerivativeCase1(fixedInterestRate);


        uint256 ibtPriceSecond = 100 * Constants.MD;

        //when
        DataTypes.IporDerivativeInterest memory derivativeInterest = derivative.calculateInterest(
            derivative.startingTimestamp + PERIOD_25_DAYS_IN_SECONDS, ibtPriceSecond, Constants.MD);

        //then
        Assert.equal(AmmMath.division(derivativeInterest.quasiInterestFixed, Constants.MD_YEAR_IN_SECONDS), 98973419178082191780822, "Wrong interest fixed");
        Assert.equal(AmmMath.division(derivativeInterest.quasiInterestFloating, Constants.MD_YEAR_IN_SECONDS), 98703000000000000000000, "Wrong interest floating");
        Assert.equal(derivativeInterest.positionValue, - 270419178082191780821, "Wrong interest difference amount");
    }

    function testCalculateInterestCase25daysLaterIBTPriceChanged() public {

        //given
        uint256 fixedInterestRate = 40000000000000000;
        DataTypes.IporDerivative memory derivative = prepareDerivativeCase1(fixedInterestRate);


        uint256 ibtPriceSecond = 125 * Constants.MD;

        //when
        DataTypes.IporDerivativeInterest memory derivativeInterest = derivative.calculateInterest(
            derivative.startingTimestamp + PERIOD_25_DAYS_IN_SECONDS, ibtPriceSecond, Constants.MD);

        //then
        Assert.equal(AmmMath.division(derivativeInterest.quasiInterestFixed, Constants.MD_YEAR_IN_SECONDS), 98973419178082191780822, "Wrong interest fixed");
        Assert.equal(AmmMath.division(derivativeInterest.quasiInterestFloating, Constants.MD_YEAR_IN_SECONDS), 123378750000000000000000, "Wrong interest floating");
        Assert.equal(derivativeInterest.positionValue, 24405330821917808219178, "Wrong interest difference amount");
    }

    function testCalculateInterestCaseHugeIpor25daysLaterIBTPriceChangedUserLoses() public {

        //given
        uint256 iporIndex = 3650000000000000000;
        uint256 spread = 10000000000000000;
        uint256 fixedInterestRate = iporIndex + spread;

        DataTypes.IporDerivative memory derivative = prepareDerivativeCase1(fixedInterestRate);


        uint256 ibtPriceSecond = 125 * Constants.MD;

        //when
        DataTypes.IporDerivativeInterest memory derivativeInterest = derivative.calculateInterest(
            derivative.startingTimestamp + PERIOD_25_DAYS_IN_SECONDS, ibtPriceSecond, Constants.MD);

        //then
        Assert.equal(AmmMath.division(derivativeInterest.quasiInterestFixed, Constants.MD_YEAR_IN_SECONDS), 123446354794520547945205, "Wrong interest fixed");
        Assert.equal(AmmMath.division(derivativeInterest.quasiInterestFloating, Constants.MD_YEAR_IN_SECONDS), 123378750000000000000000, "Wrong interest floating");
        Assert.equal(derivativeInterest.positionValue, - 67604794520547945204, "Wrong interest difference amount");
    }

    function testCalculateInterestCase100daysLaterIBTPriceNotChanged() public {

        //given
        uint256 fixedInterestRate = 40000000000000000;
        DataTypes.IporDerivative memory derivative = prepareDerivativeCase1(fixedInterestRate);


        uint256 ibtPriceSecond = 100 * Constants.MD;

        //when
        DataTypes.IporDerivativeInterest memory derivativeInterest = derivative.calculateInterest(
            derivative.startingTimestamp + PERIOD_25_DAYS_IN_SECONDS * 4, ibtPriceSecond, Constants.MD);

        //then
        Assert.equal(AmmMath.division(derivativeInterest.quasiInterestFixed, Constants.MD_YEAR_IN_SECONDS), 99005869479452054794521, "Wrong interest fixed");
        Assert.equal(AmmMath.division(derivativeInterest.quasiInterestFloating, Constants.MD_YEAR_IN_SECONDS), 98703000000000000000000, "Wrong interest floating");
        Assert.equal(derivativeInterest.positionValue, - 302869479452054794520, "Wrong interest difference amount");
    }

}
