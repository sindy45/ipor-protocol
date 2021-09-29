const testUtils = require("./TestUtils.js");
const {time, BN} = require("@openzeppelin/test-helpers");
const {ZERO} = require("./TestUtils");
const MiltonConfiguration = artifacts.require('MiltonConfiguration');
const TestMilton = artifacts.require('TestMilton');
const MiltonStorage = artifacts.require('MiltonStorage');
const TestWarren = artifacts.require('TestWarren');
const WarrenStorage = artifacts.require('WarrenStorage');
const IporToken = artifacts.require('IporToken');
const DaiMockedToken = artifacts.require('DaiMockedToken');
const UsdtMockedToken = artifacts.require('UsdtMockedToken');
const UsdcMockedToken = artifacts.require('UsdcMockedToken');
const DerivativeLogic = artifacts.require('DerivativeLogic');
const SoapIndicatorLogic = artifacts.require('SoapIndicatorLogic');
const TotalSoapIndicatorLogic = artifacts.require('TotalSoapIndicatorLogic');
const IporAddressesManager = artifacts.require('IporAddressesManager');
const MiltonDevToolDataProvider = artifacts.require('MiltonDevToolDataProvider');

contract('Milton', (accounts) => {

    const [admin, userOne, userTwo, userThree, liquidityProvider, _] = accounts;

    let milton = null;
    let miltonStorage = null;
    let derivativeLogic = null;
    let soapIndicatorLogic = null;
    let totalSoapIndicatorLogic = null;
    let tokenDai = null;
    let tokenUsdt = null;
    let tokenUsdc = null;
    let iporTokenUsdt = null;
    let iporTokenUsdc = null;
    let iporTokenDai = null;
    let warren = null;
    let warrenStorage = null;
    let miltonConfiguration = null;
    let iporAddressesManager = null;
    let miltonDevToolDataProvider = null;

    before(async () => {
        derivativeLogic = await DerivativeLogic.deployed();
        soapIndicatorLogic = await SoapIndicatorLogic.deployed();
        totalSoapIndicatorLogic = await TotalSoapIndicatorLogic.deployed();
        miltonConfiguration = await MiltonConfiguration.deployed();
        iporAddressesManager = await IporAddressesManager.deployed();
        miltonDevToolDataProvider = await MiltonDevToolDataProvider.deployed();

        //TODO: zrobic obsługę 6 miejsc po przecinku! - totalSupply6Decimals
        tokenUsdt = await UsdtMockedToken.new(testUtils.TOTAL_SUPPLY_6_DECIMALS, 6);
        tokenUsdc = await UsdcMockedToken.new(testUtils.TOTAL_SUPPLY_18_DECIMALS, 18);
        tokenDai = await DaiMockedToken.new(testUtils.TOTAL_SUPPLY_18_DECIMALS, 18);

        iporTokenUsdt = await IporToken.new(tokenUsdt.address, 6, "IPOR USDT", "ipUSDT");
        iporTokenUsdt.initialize(iporAddressesManager.address);
        iporTokenUsdc = await IporToken.new(tokenUsdc.address, 18, "IPOR USDC", "ipUSDC");
        iporTokenUsdc.initialize(iporAddressesManager.address);
        iporTokenDai = await IporToken.new(tokenDai.address, 18, "IPOR DAI", "ipDAI");
        iporTokenDai.initialize(iporAddressesManager.address);

        await iporAddressesManager.setIporToken(tokenUsdt.address, iporTokenUsdt.address);
        await iporAddressesManager.setIporToken(tokenUsdc.address, iporTokenUsdc.address);
        await iporAddressesManager.setIporToken(tokenDai.address, iporTokenDai.address);

        milton = await TestMilton.new();

        for (let i = 1; i < accounts.length - 2; i++) {
            //Milton has rights to spend money on behalf of user accounts[i]
            await tokenUsdt.approve(milton.address, testUtils.TOTAL_SUPPLY_6_DECIMALS, {from: accounts[i]});
            //TODO: zrobic obsługę 6 miejsc po przecinku! - totalSupply6Decimals
            await tokenUsdc.approve(milton.address, testUtils.TOTAL_SUPPLY_18_DECIMALS, {from: accounts[i]});
            await tokenDai.approve(milton.address, testUtils.TOTAL_SUPPLY_18_DECIMALS, {from: accounts[i]});
        }

        await iporAddressesManager.setAddress("MILTON_CONFIGURATION", await miltonConfiguration.address);
        await iporAddressesManager.setAddress("MILTON", milton.address);

        await iporAddressesManager.addAsset(tokenUsdt.address);
        await iporAddressesManager.addAsset(tokenUsdc.address);
        await iporAddressesManager.addAsset(tokenDai.address);

        await milton.initialize(iporAddressesManager.address);

    });

    beforeEach(async () => {
        miltonStorage = await MiltonStorage.new();
        await iporAddressesManager.setAddress("MILTON_STORAGE", miltonStorage.address);

        warrenStorage = await WarrenStorage.new();

        warren = await TestWarren.new(warrenStorage.address);
        await iporAddressesManager.setAddress("WARREN", warren.address);

        await warrenStorage.addUpdater(userOne);
        await warrenStorage.addUpdater(warren.address);

        await miltonStorage.initialize(iporAddressesManager.address);

        await miltonStorage.addAsset(tokenDai.address);
        await miltonStorage.addAsset(tokenUsdc.address);
        await miltonStorage.addAsset(tokenUsdt.address);

    });

    it('should NOT open position because deposit amount too low', async () => {
        //given
        await setupTokenDaiInitialValues();
        let asset = tokenDai.address;
        let depositAmount = 0;
        let slippageValue = 3;
        let direction = 0;
        let collateralization = BigInt(10000000000000000000);

        await testUtils.assertError(
            //when
            milton.openPosition(asset, depositAmount, slippageValue, collateralization, direction),
            //then
            'IPOR_4'
        );
    });

    it('should NOT open position because slippage too low', async () => {
        //given
        await setupTokenDaiInitialValues();
        let asset = tokenDai.address;
        let depositAmount = BigInt("30000000000000000001");
        let slippageValue = 0;
        let direction = 0;
        let collateralization = BigInt(10000000000000000000);

        await testUtils.assertError(
            //when
            milton.openPosition(asset, depositAmount, slippageValue, collateralization, direction),
            //then
            'IPOR_5'
        );
    });

    it('should NOT open position because slippage too high', async () => {
        //given
        await setupTokenDaiInitialValues();
        let asset = tokenDai.address;
        let depositAmount = BigInt("30000000000000000001");
        let slippageValue = web3.utils.toBN(1e20);
        let theOne = web3.utils.toBN(1);
        slippageValue = slippageValue.add(theOne);
        let direction = 0;
        let collateralization = BigInt(10000000000000000000);

        await testUtils.assertError(
            //when
            milton.openPosition(asset, depositAmount, slippageValue, collateralization, direction),
            //then
            'IPOR_9'
        );
    });

    it('should NOT open position because deposit amount too high', async () => {
        //given
        await setupTokenDaiInitialValues();
        let asset = tokenDai.address;
        let depositAmount = BigInt("1000000000000000000000001")
        let slippageValue = 3;
        let direction = 0;
        let collateralization = BigInt(10000000000000000000);

        await testUtils.assertError(
            //when
            milton.openPosition(asset, depositAmount, slippageValue, collateralization, direction),
            //then
            'IPOR_10'
        );
    });

    it('should open pay fixed position - simple case DAI', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: 0,
            openTimestamp: Math.floor(Date.now() / 1000),
            from: userTwo
        }
        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        await milton.provideLiquidity(params.asset, miltonBalanceBeforePayout, {from: liquidityProvider})

        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + params.totalAmount;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("99700000000000000000");
        let expectedDerivativesTotalBalance = BigInt("9870300000000000000000");

        //when
        await milton.openPosition(
            params.asset, params.totalAmount,
            params.slippageValue, params.collateralization,
            params.direction, {from: userTwo});

        //then
        await assertExpectedValues(
            params.asset,
            userTwo,
            userTwo,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            BigInt("9990000000000000000000000"),
            BigInt("9990000000000000000000000"),
            expectedLiquidityPoolTotalBalance,
            1,
            BigInt("9870300000000000000000"),
            testUtils.MILTON_20_USD,
            BigInt("0")
        );

        const actualDerivativesTotalBalance = BigInt(await (await miltonStorage.balances(params.asset)).derivatives);

        assert(expectedDerivativesTotalBalance === actualDerivativesTotalBalance,
            `Incorrect derivatives total balance for ${params.asset} ${actualDerivativesTotalBalance}, expected ${expectedDerivativesTotalBalance}`)

    });

    it('should close position, DAI, owner, pay fixed, IPOR not changed, IBT price not changed, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("0");

        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9999890300000000000000000");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("9999890300000000000000000");


        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("109700000000000000000");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("99700000000000000000") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_3_PERCENTAGE, testUtils.MILTON_3_PERCENTAGE, 0,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, pay fixed, IPOR not changed, IBT price increased 25%, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("6760479452054794520");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9999822695205479452054796");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("9999822695205479452054796");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("177304794520547945204");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("167304794520547945204") - incomeTax;
        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_365_PERCENTAGE, testUtils.MILTON_365_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should NOT open position because Liquidity Pool is to low', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = {
            asset: tokenDai.address,
            totalAmount: BigInt("10000000000000000000000"), //10 000 USD
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: 0,
            openTimestamp: Math.floor(Date.now() / 1000),
            from: userTwo
        }
        let closePositionTimestamp = params.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS

        await milton.provideLiquidity(params.asset, testUtils.MILTON_14_000_USD, {from: liquidityProvider})

        await warren.test_updateIndex(params.asset, BigInt("10000000000000000"), params.openTimestamp, {from: userOne});
        await openPositionFunc(params);
        await warren.test_updateIndex(params.asset, BigInt("1600000000000000000"), params.openTimestamp, {from: userOne});
        await warren.test_updateIndex(params.asset, BigInt("50000000000000000"), closePositionTimestamp, {from: userOne});

        await iporAddressesManager.setAddress("MILTON", userOne);
        await miltonStorage.subtractLiquidity(params.asset, params.totalAmount, {from: userOne})
        await iporAddressesManager.setAddress("MILTON", milton.address);

        //when
        await testUtils.assertError(
            //when
            milton.test_closePosition(1, closePositionTimestamp, {from: userTwo}),
            //then
            'IPOR_14'
        );

    });

    it('should close position, DAI, owner, pay fixed, Liquidity Pool earned, User lost > Deposit, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9990020000000000000000000");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("9990020000000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("9980000000000000000000");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("9970000000000000000000") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_160_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, pay fixed, Liquidity Pool earned, User lost < Deposit, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("784215616438356167764");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9992048143835616438322363");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("9992048143835616438322363");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("7951856164383561677637");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("7941856164383561677637") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_120_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, pay fixed, Liquidity Pool earned, User lost < Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("848575380821917805109");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9991404546191780821948907");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("9991404546191780821948907");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("8595453808219178051093");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("8585453808219178051093") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_120_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, pay fixed, Liquidity Pool lost, User earned > Deposit, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10009760600000000000000000") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10009760600000000000000000") - incomeTax;

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("639400000000000000000") + incomeTax;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("629400000000000000000");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_160_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, pay fixed, Liquidity Pool lost, User earned < Deposit, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("770694657534246573179");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10007597246575342465731791") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10007597246575342465731791") - incomeTax;

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("2802753424657534268209") + incomeTax;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("2792753424657534268209");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_120_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, pay fixed, Liquidity Pool lost, User earned > Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10009760600000000000000000") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10009760600000000000000000") - incomeTax;

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("639400000000000000000") + incomeTax;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("629400000000000000000");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_160_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, pay fixed, Liquidity Pool lost, User earned < Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("630617523287671234364");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10006196475232876712343640") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10006196475232876712343640") - incomeTax;

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("4203524767123287656360") + incomeTax;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("4193524767123287656360");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_50_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, not owner, pay fixed, Liquidity Pool lost, User earned > Deposit, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10009740600000000000000000") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10000020000000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD + testUtils.MILTON_10_400_USD;
        let expectedMiltonTokenBalance = testUtils.MILTON_10_000_USD + BigInt("639400000000000000000") + incomeTax;
        let expectedLiquidityPoolTotalBalance = testUtils.MILTON_10_000_USD + BigInt("629400000000000000000");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userThree,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_160_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });


    it('should NOT close position, DAI, not owner, pay fixed, Liquidity Pool lost, User earned < Deposit, before maturity', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: 0,
            openTimestamp: Math.floor(Date.now() / 1000),
            from: userTwo
        }
        await milton.provideLiquidity(params.asset, testUtils.MILTON_14_000_USD, {from: liquidityProvider})
        await warren.test_updateIndex(params.asset, testUtils.MILTON_5_PERCENTAGE, params.openTimestamp, {from: userOne});
        await openPositionFunc(params);
        await warren.test_updateIndex(params.asset, testUtils.MILTON_120_PERCENTAGE, params.openTimestamp, {from: userOne});
        let endTimestamp = params.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        await warren.test_updateIndex(params.asset, testUtils.MILTON_6_PERCENTAGE, endTimestamp, {from: userOne});


        //when
        await testUtils.assertError(
            //when
            milton.test_closePosition(1, endTimestamp, {from: userThree}),
            //then
            'IPOR_16');
    });

    it('should close position, DAI, not owner, pay fixed, Liquidity Pool lost, User earned > Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10009740600000000000000000") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10000020000000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("639400000000000000000") + incomeTax;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("629400000000000000000");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userThree,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_160_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, not owner, pay fixed, Liquidity Pool lost, User earned < Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("630617523287671234364");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10006176475232876712343640") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10000020000000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("4203524767123287656360") + incomeTax;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("4193524767123287656360");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userThree,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_50_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, not owner, pay fixed, Liquidity Pool earned, User lost > Deposit, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9990000000000000000000000");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10000020000000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("9980000000000000000000");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("9970000000000000000000") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userThree,
            testUtils.MILTON_160_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should NOT close position, DAI, not owner, pay fixed, Liquidity Pool earned, User lost < Deposit, before maturity', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: 0,
            openTimestamp: Math.floor(Date.now() / 1000),
            from: userTwo
        }

        await milton.provideLiquidity(params.asset, testUtils.MILTON_14_000_USD, {from: liquidityProvider})
        await warren.test_updateIndex(params.asset, testUtils.MILTON_120_PERCENTAGE, params.openTimestamp, {from: userOne});
        await openPositionFunc(params);
        await warren.test_updateIndex(params.asset, testUtils.MILTON_5_PERCENTAGE, params.openTimestamp, {from: userOne});
        let endTimestamp = params.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        await warren.test_updateIndex(params.asset, testUtils.MILTON_6_PERCENTAGE, endTimestamp, {from: userOne});


        //when
        await testUtils.assertError(
            //when
            milton.test_closePosition(1, endTimestamp, {from: userThree}),
            //then
            'IPOR_16');
    });

    it('should close position, DAI, not owner, pay fixed, Liquidity Pool earned, User lost < Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("848575380821917805109");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9991384546191780821948907");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10000020000000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("8595453808219178051093");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("8585453808219178051093") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userThree,
            testUtils.MILTON_120_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, not owner, pay fixed, Liquidity Pool earned, User lost > Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9990000000000000000000000");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10000020000000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("9980000000000000000000");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("9970000000000000000000") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userThree,
            testUtils.MILTON_160_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, receive fixed, IPOR not changed, IBT price not changed, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("6760479452054792492");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9999822695205479452075077");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("9999822695205479452075077");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("177304794520547924923");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("167304794520547924923") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userTwo,
            testUtils.MILTON_3_PERCENTAGE, testUtils.MILTON_3_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, receive fixed, IPOR not changed, IBT price changed 25%, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("6760479452054794520");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9999822695205479452054796");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("9999822695205479452054796");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("177304794520547945204");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("167304794520547945204") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userTwo,
            testUtils.MILTON_365_PERCENTAGE, testUtils.MILTON_365_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, receive fixed, Liquidity Pool lost, User earned > Deposit, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10009760600000000000000000") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10009760600000000000000000") - incomeTax;

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = testUtils.MILTON_10_000_USD + BigInt("639400000000000000000") + incomeTax;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("629400000000000000000");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userTwo,
            testUtils.MILTON_160_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, receive fixed, Liquidity Pool lost, User earned < Deposit, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("770694657534246578723");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10007597246575342465787227") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10007597246575342465787227") - incomeTax;

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = testUtils.MILTON_10_000_USD + BigInt("2802753424657534212773") + incomeTax;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("2792753424657534212773");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userTwo,
            testUtils.MILTON_120_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, receive fixed, Liquidity Pool earned, User lost > Deposit, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9990020000000000000000000");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("9990020000000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("9980000000000000000000");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("9970000000000000000000") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userTwo,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_160_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, receive fixed, Liquidity Pool earned, User lost < Deposit, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("784215616438356162220");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9992048143835616438377799");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("9992048143835616438377799");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("7951856164383561622201");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("7941856164383561622201") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userTwo,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_120_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, receive fixed, Liquidity Pool lost, User earned > Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10009760600000000000000000") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10009760600000000000000000") - incomeTax;

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("639400000000000000000") + incomeTax;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("629400000000000000000");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userTwo,
            testUtils.MILTON_160_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax,
            testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, receive fixed, Liquidity Pool lost, User earned < Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("833431906849315065383");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10008224619068493150653833") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10008224619068493150653833") - incomeTax;

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("2175380931506849346167") + incomeTax;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("2165380931506849346167");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userTwo,
            testUtils.MILTON_120_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, receive fixed, Liquidity Pool earned, User lost > Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9990020000000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("9980000000000000000000");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("9970000000000000000000") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userTwo,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_120_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            BigInt("9990020000000000000000000"), //expectedCloserUserTokenBalanceAfterPayOut
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax, testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, receive fixed, Liquidity Pool earned, User lost < Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("645760997260273974090");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9993432690027397260259101");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("6567309972602739740899");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("6557309972602739740899") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userTwo,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_50_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut, //expectedOpenerUserTokenBalanceAfterPayOut
            BigInt("9993432690027397260259101"), //expectedCloserUserTokenBalanceAfterPayOut
            expectedLiquidityPoolTotalBalance, //expectedLiquidityPoolTotalBalance
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax,
            testUtils.ZERO, null
        );
    });

    it('should close position, DAI, not owner, receive fixed, Liquidity Pool lost, User earned > Deposit, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10009740600000000000000000") - incomeTax;

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("639400000000000000000") + incomeTax
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("629400000000000000000");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userThree,
            testUtils.MILTON_160_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance, //expectedMiltonTokenBalance
            expectedOpenerUserTokenBalanceAfterPayOut,
            BigInt("10000020000000000000000000"), //expectedCloserUserTokenBalanceAfterPayOut
            expectedLiquidityPoolTotalBalance, //expectedLiquidityPoolTotalBalance
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax,
            testUtils.ZERO, null
        );
    });

    it('should NOT close position, DAI, not owner, receive fixed, Liquidity Pool lost, User earned < Deposit, before maturity', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: 1,
            openTimestamp: Math.floor(Date.now() / 1000),
            from: userTwo
        }

        await milton.provideLiquidity(params.asset, testUtils.MILTON_14_000_USD, {from: liquidityProvider})
        await warren.test_updateIndex(params.asset, testUtils.MILTON_120_PERCENTAGE, params.openTimestamp, {from: userOne});
        await openPositionFunc(params);
        await warren.test_updateIndex(params.asset, testUtils.MILTON_5_PERCENTAGE, params.openTimestamp, {from: userOne});
        let endTimestamp = params.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        await warren.test_updateIndex(params.asset, testUtils.MILTON_6_PERCENTAGE, endTimestamp, {from: userOne});

        //when
        await testUtils.assertError(
            //when
            milton.test_closePosition(1, endTimestamp, {from: userThree}),
            //then
            'IPOR_16');
    });

    it('should close position, DAI, not owner, receive fixed, Liquidity Pool earned, User lost > Deposit, before maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("9980000000000000000000");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("9970000000000000000000") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userThree,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_160_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            BigInt("9990000000000000000000000"), //expectedOpenerUserTokenBalanceAfterPayOut
            BigInt("10000020000000000000000000"), //expectedCloserUserTokenBalanceAfterPayOut
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax,
            testUtils.ZERO, null
        );
    });

    it('should NOT close position, DAI, not owner, receive fixed, Liquidity Pool earned, User lost < Deposit, before maturity', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: 1,
            openTimestamp: Math.floor(Date.now() / 1000),
            from: userTwo
        }
        await milton.provideLiquidity(params.asset, testUtils.MILTON_14_000_USD, {from: liquidityProvider})
        await warren.test_updateIndex(params.asset, testUtils.MILTON_5_PERCENTAGE, params.openTimestamp, {from: userOne});
        await openPositionFunc(params);
        await warren.test_updateIndex(params.asset, testUtils.MILTON_120_PERCENTAGE, params.openTimestamp, {from: userOne});
        let endTimestamp = params.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        await warren.test_updateIndex(params.asset, testUtils.MILTON_6_PERCENTAGE, endTimestamp, {from: userOne});

        //when
        await testUtils.assertError(
            //when
            milton.test_closePosition(1, endTimestamp, {from: userThree}),
            //then
            'IPOR_16');
    });

    it('should close position, DAI, not owner, receive fixed, Liquidity Pool lost, User earned > Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10009740600000000000000000") - incomeTax;

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("639400000000000000000") + incomeTax;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("629400000000000000000");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userThree,
            testUtils.MILTON_160_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance, //expectedMiltonTokenBalance
            expectedOpenerUserTokenBalanceAfterPayOut, //expectedOpenerUserTokenBalanceAfterPayOut
            BigInt("10000020000000000000000000"), //expectedCloserUserTokenBalanceAfterPayOut
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax,
            testUtils.ZERO, null
        );
    });

    it('should close position, DAI, not owner, receive fixed, Liquidity Pool lost, User earned < Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("833431906849315065383");
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10008204619068493150653833") - incomeTax;

        let miltonBalanceBeforePayout = testUtils.MILTON_10_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("2175380931506849346167") + incomeTax;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("2165380931506849346167");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userThree,
            testUtils.MILTON_120_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout + testUtils.MILTON_10_400_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            BigInt("10000020000000000000000000"), //expectedCloserUserTokenBalanceAfterPayOut
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax,
            testUtils.ZERO, null
        );
    });

    it('should close position, DAI, not owner, receive fixed, Liquidity Pool earned, User lost > Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("9980000000000000000000");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("9970000000000000000000") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userThree,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_160_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            BigInt("9990000000000000000000000"), //expectedOpenerUserTokenBalanceAfterPayOut
            BigInt("10000020000000000000000000"), //expectedCloserUserTokenBalanceAfterPayOut
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax,
            testUtils.ZERO, null
        );
    });

    it('should close position, DAI, not owner, receive fixed, Liquidity Pool earned, User lost < Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("645760997260273974090");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("6567309972602739740899");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("6557309972602739740899") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userThree,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_50_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            BigInt("9993412690027397260259101"), //expectedOpenerUserTokenBalanceAfterPayOut
            BigInt("10000020000000000000000000"), //expectedCloserUserTokenBalanceAfterPayOut
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax, //treasury total balance
            testUtils.ZERO, null
        );
    });

    it('should close position, DAI, owner, pay fixed, Liquidity Pool earned, User lost > Deposit, after maturity', async () => {
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("987030000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("9980000000000000000000");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("9970000000000000000000") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_160_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            BigInt("9990020000000000000000000"), //expectedOpenerUserTokenBalanceAfterPayOut
            BigInt("9990020000000000000000000"), //expectedCloserUserTokenBalanceAfterPayOut
            expectedLiquidityPoolTotalBalance, //expectedLiquidityPoolTotalBalance
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax, //treasury total balance
            testUtils.ZERO, null
        );
    });

    it('should NOT close position, because incorrect derivative Id', async () => {
        //given
        await setupTokenDaiInitialValues();
        let direction = 0;
        let openerUserAddress = userTwo;
        let closerUserAddress = userTwo;
        let iporValueBeforeOpenPosition = testUtils.MILTON_3_PERCENTAGE;
        let openTimestamp = Math.floor(Date.now() / 1000);

        const derivativeParamsFirst = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp,
            from: openerUserAddress
        }
        await warren.test_updateIndex(derivativeParamsFirst.asset, iporValueBeforeOpenPosition, derivativeParamsFirst.openTimestamp, {from: userOne});
        await milton.provideLiquidity(derivativeParamsFirst.asset, testUtils.MILTON_14_000_USD, {from: liquidityProvider})
        await openPositionFunc(derivativeParamsFirst);

        await testUtils.assertError(
            //when
            milton.test_closePosition(0, openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS, {from: closerUserAddress}),
            //then
            'IPOR_22'
        );
    });

    it('should NOT close position, because derivative has incorrect status', async () => {
        //given
        await setupTokenDaiInitialValues();
        let direction = 0;
        let openerUserAddress = userTwo;
        let closerUserAddress = userTwo;
        let iporValueBeforeOpenPosition = testUtils.MILTON_3_PERCENTAGE;
        let openTimestamp = Math.floor(Date.now() / 1000);

        const derivativeParamsFirst = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp,
            from: openerUserAddress
        }
        await warren.test_updateIndex(derivativeParamsFirst.asset, iporValueBeforeOpenPosition, derivativeParamsFirst.openTimestamp, {from: userOne});
        await milton.provideLiquidity(derivativeParamsFirst.asset, testUtils.MILTON_14_000_USD + testUtils.MILTON_14_000_USD, {from: liquidityProvider})
        await openPositionFunc(derivativeParamsFirst);

        const derivativeParams25days = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS,
            from: openerUserAddress
        }
        await openPositionFunc(derivativeParams25days);

        let endTimestamp = openTimestamp + testUtils.PERIOD_50_DAYS_IN_SECONDS

        await milton.test_closePosition(1, endTimestamp, {from: closerUserAddress})

        await testUtils.assertError(
            //when
            milton.test_closePosition(1, endTimestamp, {from: closerUserAddress}),
            //then
            'IPOR_23'
        );
    });

    it('should NOT close position, because derivative not exists', async () => {
        //given
        let closerUserAddress = userTwo;
        let openTimestamp = Math.floor(Date.now() / 1000);

        await testUtils.assertError(
            //when
            milton.test_closePosition(0, openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS, {from: closerUserAddress}),
            //then
            'IPOR_22'
        );
    });


    it('should close only one position - close first position', async () => {
        //given
        await setupTokenDaiInitialValues();
        let direction = 0;
        let openerUserAddress = userTwo;
        let closerUserAddress = userTwo;
        let iporValueBeforeOpenPosition = testUtils.MILTON_3_PERCENTAGE;
        let openTimestamp = Math.floor(Date.now() / 1000);

        const derivativeParamsFirst = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp,
            from: openerUserAddress
        }
        await milton.provideLiquidity(derivativeParamsFirst.asset, testUtils.MILTON_14_000_USD + testUtils.MILTON_14_000_USD, {from: liquidityProvider})
        await warren.test_updateIndex(derivativeParamsFirst.asset, iporValueBeforeOpenPosition, derivativeParamsFirst.openTimestamp, {from: userOne});
        await openPositionFunc(derivativeParamsFirst);

        const derivativeParams25days = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS,
            from: openerUserAddress
        }
        await openPositionFunc(derivativeParams25days);
        let endTimestamp = openTimestamp + testUtils.PERIOD_50_DAYS_IN_SECONDS
        let expectedOpenedPositionsVol = 1;
        let expectedDerivativeId = BigInt(2);

        //when
        await milton.test_closePosition(1, endTimestamp, {from: closerUserAddress});

        //then
        let actualDerivatives = await miltonStorage.getPositions();
        let actualOpenedPositionsVol = countOpenPositions(actualDerivatives);

        assert(expectedOpenedPositionsVol === actualOpenedPositionsVol,
            `Incorrect number of opened positions actual: ${actualOpenedPositionsVol}, expected: ${expectedOpenedPositionsVol}`)

        let oneDerivative = actualDerivatives[0];

        assert(expectedDerivativeId === BigInt(oneDerivative.id),
            `Incorrect derivative id actual: ${oneDerivative.id}, expected: ${expectedDerivativeId}`)
    });

    it('should close only one position - close last position', async () => {
        //given
        await setupTokenDaiInitialValues();
        let direction = 0;
        let openerUserAddress = userTwo;
        let closerUserAddress = userTwo;
        let iporValueBeforeOpenPosition = testUtils.MILTON_3_PERCENTAGE;
        let openTimestamp = Math.floor(Date.now() / 1000);

        const derivativeParamsFirst = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp,
            from: openerUserAddress
        }
        await milton.provideLiquidity(derivativeParamsFirst.asset, testUtils.MILTON_14_000_USD + testUtils.MILTON_14_000_USD, {from: liquidityProvider})
        await warren.test_updateIndex(derivativeParamsFirst.asset, iporValueBeforeOpenPosition, derivativeParamsFirst.openTimestamp, {from: userOne});
        await openPositionFunc(derivativeParamsFirst);

        const derivativeParams25days = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS,
            from: openerUserAddress
        }
        await openPositionFunc(derivativeParams25days);
        let endTimestamp = openTimestamp + testUtils.PERIOD_50_DAYS_IN_SECONDS
        let expectedOpenedPositionsVol = 1;
        let expectedDerivativeId = BigInt(1);

        //when
        await milton.test_closePosition(2, endTimestamp, {from: closerUserAddress});

        //then
        let actualDerivatives = await miltonStorage.getPositions();
        let actualOpenedPositionsVol = countOpenPositions(actualDerivatives);

        assert(expectedOpenedPositionsVol === actualOpenedPositionsVol,
            `Incorrect number of opened positions actual: ${actualOpenedPositionsVol}, expected: ${expectedOpenedPositionsVol}`)

        let oneDerivative = actualDerivatives[0];

        assert(expectedDerivativeId === BigInt(oneDerivative.id),
            `Incorrect derivative id actual: ${oneDerivative.id}, expected: ${expectedDerivativeId}`)

    });

    it('should close position with appropriate balance, DAI, owner, pay fixed, Liquidity Pool lost, User earned < Deposit, after maturity, last IPOR index calculation 50 days before', async () => {
        //NOTICE: IPOR index update 50 days before on in day of closing position should be the same
        await setupTokenDaiInitialValues();
        let incomeTax = BigInt("630617523287671234364");
        let expectedMiltonTokenBalance = BigInt("7803524767123287656360") + incomeTax;
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10006196475232876712343640") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10006196475232876712343640") - incomeTax;
        let expectedLiquidityPoolTotalBalance = BigInt("7793524767123287656360");

        //given
        let closerUserAddress = userTwo;
        let iporValueBeforeOpenPosition = testUtils.MILTON_5_PERCENTAGE;
        let iporValueAfterOpenPosition = testUtils.MILTON_50_PERCENTAGE;
        let periodOfTimeElapsedInSeconds = testUtils.PERIOD_50_DAYS_IN_SECONDS;
        const params = getStandardDerivativeParams();

        let endTimestamp = params.openTimestamp + periodOfTimeElapsedInSeconds;

        await milton.provideLiquidity(params.asset, testUtils.MILTON_14_000_USD, {from: liquidityProvider});
        await warren.test_updateIndex(params.asset, iporValueBeforeOpenPosition, params.openTimestamp, {from: userOne});
        await openPositionFunc(params);
        await warren.test_updateIndex(params.asset, iporValueAfterOpenPosition, params.openTimestamp, {from: userOne});

        //when
        await milton.test_closePosition(1, endTimestamp, {from: closerUserAddress});

        //then
        await assertExpectedValues(
            params.asset,
            params.from,
            closerUserAddress,
            testUtils.MILTON_14_000_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0,
            testUtils.ZERO,
            testUtils.ZERO,
            incomeTax
        );

        const soapParams = {
            asset: params.asset,
            calculateTimestamp: endTimestamp,
            expectedSoap: testUtils.ZERO,
            from: params.from
        }
        await assertSoap(soapParams);

    });

    it('should open many positions and arrays with ids have correct state, one user', async () => {
        //given
        await setupTokenDaiInitialValues();
        let direction = 0;
        let openerUserAddress = userTwo;
        let iporValueBeforeOpenPosition = testUtils.MILTON_3_PERCENTAGE;
        let openTimestamp = Math.floor(Date.now() / 1000);

        const derivativeParams = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp,
            from: openerUserAddress
        }
        await warren.test_updateIndex(derivativeParams.asset, iporValueBeforeOpenPosition, derivativeParams.openTimestamp, {from: userOne});

        let expectedUserDerivativeIdsLength = 3
        let expectedDerivativeIdsLength = 3;

        await milton.provideLiquidity(derivativeParams.asset, BigInt(3) * testUtils.MILTON_14_000_USD, {from: liquidityProvider})

        //when
        await openPositionFunc(derivativeParams);
        derivativeParams.openTimestamp = derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        await openPositionFunc(derivativeParams);
        derivativeParams.openTimestamp = derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        await openPositionFunc(derivativeParams);


        //then
        let actualUserDerivativeIds = await miltonStorage.getUserDerivativeIds(openerUserAddress);
        let actualDerivativeIds = await miltonStorage.getDerivativeIds();


        assert(expectedUserDerivativeIdsLength === actualUserDerivativeIds.length,
            `Incorrect user derivative ids length actual: ${actualUserDerivativeIds.length}, expected: ${expectedUserDerivativeIdsLength}`)
        assert(expectedDerivativeIdsLength === actualDerivativeIds.length,
            `Incorrect derivative ids length actual: ${actualDerivativeIds.length}, expected: ${expectedDerivativeIdsLength}`)

        await assertMiltonDerivativeItem(1, 0, 0);
        await assertMiltonDerivativeItem(2, 1, 1);
        await assertMiltonDerivativeItem(3, 2, 2);
    });

    it('should open many positions and arrays with ids have correct state, two users', async () => {
        //given
        await setupTokenDaiInitialValues();
        let direction = 0;
        let iporValueBeforeOpenPosition = testUtils.MILTON_3_PERCENTAGE;
        let openTimestamp = Math.floor(Date.now() / 1000);

        const derivativeParams = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp,
            from: userTwo
        }
        await warren.test_updateIndex(derivativeParams.asset, iporValueBeforeOpenPosition, derivativeParams.openTimestamp, {from: userOne});

        let expectedUserDerivativeIdsLengthFirst = 2;
        let expectedUserDerivativeIdsLengthSecond = 1;
        let expectedDerivativeIdsLength = 3;

        await milton.provideLiquidity(derivativeParams.asset, BigInt(3) * testUtils.MILTON_14_000_USD, {from: liquidityProvider})

        //when
        await openPositionFunc(derivativeParams);

        derivativeParams.openTimestamp = derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        derivativeParams.from = userThree;
        await openPositionFunc(derivativeParams);

        derivativeParams.openTimestamp = derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        derivativeParams.from = userTwo;
        await openPositionFunc(derivativeParams);

        //then
        let actualUserDerivativeIdsFirst = await miltonStorage.getUserDerivativeIds(userTwo);
        let actualUserDerivativeIdsSecond = await miltonStorage.getUserDerivativeIds(userThree);
        let actualDerivativeIds = await miltonStorage.getDerivativeIds();


        assert(expectedUserDerivativeIdsLengthFirst === actualUserDerivativeIdsFirst.length,
            `Incorrect first user derivative ids length actual: ${actualUserDerivativeIdsFirst.length}, expected: ${expectedUserDerivativeIdsLengthFirst}`)
        assert(expectedUserDerivativeIdsLengthSecond === actualUserDerivativeIdsSecond.length,
            `Incorrect second user derivative ids length actual: ${actualUserDerivativeIdsSecond.length}, expected: ${expectedUserDerivativeIdsLengthSecond}`)
        assert(expectedDerivativeIdsLength === actualDerivativeIds.length,
            `Incorrect derivative ids length actual: ${actualDerivativeIds.length}, expected: ${expectedDerivativeIdsLength}`)

        await assertMiltonDerivativeItem(1, 0, 0);
        await assertMiltonDerivativeItem(2, 1, 0);
        await assertMiltonDerivativeItem(3, 2, 1);

    });

    it('should open many positions and close one position and arrays with ids have correct state, two users', async () => {
        //given
        await setupTokenDaiInitialValues();
        let direction = 0;
        let iporValueBeforeOpenPosition = testUtils.MILTON_3_PERCENTAGE;
        let openTimestamp = Math.floor(Date.now() / 1000);

        const derivativeParams = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp,
            from: userTwo
        }
        await warren.test_updateIndex(derivativeParams.asset, iporValueBeforeOpenPosition, derivativeParams.openTimestamp, {from: userOne});

        let expectedUserDerivativeIdsLengthFirst = 2;
        let expectedUserDerivativeIdsLengthSecond = 0;
        let expectedDerivativeIdsLength = 2;

        await milton.provideLiquidity(derivativeParams.asset, BigInt(3) * testUtils.MILTON_14_000_USD, {from: liquidityProvider})

        await openPositionFunc(derivativeParams);

        derivativeParams.openTimestamp = derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        derivativeParams.from = userThree;
        await openPositionFunc(derivativeParams);

        derivativeParams.openTimestamp = derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        derivativeParams.from = userTwo;
        await openPositionFunc(derivativeParams);

        //when
        await milton.test_closePosition(2, derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS, {from: userThree});

        //then
        let actualUserDerivativeIdsFirst = await miltonStorage.getUserDerivativeIds(userTwo);
        let actualUserDerivativeIdsSecond = await miltonStorage.getUserDerivativeIds(userThree);
        let actualDerivativeIds = await miltonStorage.getDerivativeIds();


        assert(expectedUserDerivativeIdsLengthFirst === actualUserDerivativeIdsFirst.length,
            `Incorrect first user derivative ids length actual: ${actualUserDerivativeIdsFirst.length}, expected: ${expectedUserDerivativeIdsLengthFirst}`)
        assert(expectedUserDerivativeIdsLengthSecond === actualUserDerivativeIdsSecond.length,
            `Incorrect second user derivative ids length actual: ${actualUserDerivativeIdsSecond.length}, expected: ${expectedUserDerivativeIdsLengthSecond}`)
        assert(expectedDerivativeIdsLength === actualDerivativeIds.length,
            `Incorrect derivative ids length actual: ${actualDerivativeIds.length}, expected: ${expectedDerivativeIdsLength}`)

        await assertMiltonDerivativeItem(1, 0, 0);
        await assertMiltonDerivativeItem(3, 1, 1);
    });

    it('should open many positions and close two positions and arrays with ids have correct state, two users', async () => {
        //given
        await setupTokenDaiInitialValues();
        let direction = 0;
        let iporValueBeforeOpenPosition = testUtils.MILTON_3_PERCENTAGE;
        let openTimestamp = Math.floor(Date.now() / 1000);

        const derivativeParams = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp,
            from: userTwo
        }
        await warren.test_updateIndex(derivativeParams.asset, iporValueBeforeOpenPosition, derivativeParams.openTimestamp, {from: userOne});

        let expectedUserDerivativeIdsLengthFirst = 1;
        let expectedUserDerivativeIdsLengthSecond = 0;
        let expectedDerivativeIdsLength = 1;

        await milton.provideLiquidity(derivativeParams.asset, BigInt(3) * testUtils.MILTON_14_000_USD, {from: liquidityProvider})

        await openPositionFunc(derivativeParams);

        derivativeParams.openTimestamp = derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        derivativeParams.from = userThree;
        await openPositionFunc(derivativeParams);

        derivativeParams.openTimestamp = derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        derivativeParams.from = userTwo;
        await openPositionFunc(derivativeParams);

        //when
        await milton.test_closePosition(2, derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS, {from: userThree});
        await milton.test_closePosition(3, derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS, {from: userTwo});

        //then
        let actualUserDerivativeIdsFirst = await miltonStorage.getUserDerivativeIds(userTwo);
        let actualUserDerivativeIdsSecond = await miltonStorage.getUserDerivativeIds(userThree);
        let actualDerivativeIds = await miltonStorage.getDerivativeIds();


        assert(expectedUserDerivativeIdsLengthFirst === actualUserDerivativeIdsFirst.length,
            `Incorrect first user derivative ids length actual: ${actualUserDerivativeIdsFirst.length}, expected: ${expectedUserDerivativeIdsLengthFirst}`)
        assert(expectedUserDerivativeIdsLengthSecond === actualUserDerivativeIdsSecond.length,
            `Incorrect second user derivative ids length actual: ${actualUserDerivativeIdsSecond.length}, expected: ${expectedUserDerivativeIdsLengthSecond}`)
        assert(expectedDerivativeIdsLength === actualDerivativeIds.length,
            `Incorrect derivative ids length actual: ${actualDerivativeIds.length}, expected: ${expectedDerivativeIdsLength}`)

        await assertMiltonDerivativeItem(1, 0, 0);

    });

    it('should open two positions and close two positions - Arithmetic overflow - fix last byte difference - case 1', async () => {
        //given
        await setupTokenDaiInitialValues();
        let direction = 0;
        let iporValueBeforeOpenPosition = testUtils.MILTON_3_PERCENTAGE;
        let openTimestamp = Math.floor(Date.now() / 1000);

        const derivativeParams = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp,
            from: userThree
        }
        await milton.provideLiquidity(derivativeParams.asset, BigInt(2) * testUtils.MILTON_14_000_USD, {from: liquidityProvider});
        await warren.test_updateIndex(derivativeParams.asset, iporValueBeforeOpenPosition, derivativeParams.openTimestamp, {from: userOne});

        let expectedUserDerivativeIdsLengthFirst = 0;
        let expectedUserDerivativeIdsLengthSecond = 0;
        let expectedDerivativeIdsLength = 0;

        //position 1, user first
        await openPositionFunc(derivativeParams);

        //position 2, user second
        derivativeParams.openTimestamp = derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        await openPositionFunc(derivativeParams);

        //when
        await milton.test_closePosition(1, derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS, {from: userThree});
        await milton.test_closePosition(2, derivativeParams.openTimestamp + testUtils.PERIOD_50_DAYS_IN_SECONDS, {from: userThree});


        //then
        let actualUserDerivativeIdsFirst = await miltonStorage.getUserDerivativeIds(userTwo);
        let actualUserDerivativeIdsSecond = await miltonStorage.getUserDerivativeIds(userTwo);
        let actualDerivativeIds = await miltonStorage.getDerivativeIds();


        assert(expectedUserDerivativeIdsLengthFirst === actualUserDerivativeIdsFirst.length,
            `Incorrect first user derivative ids length actual: ${actualUserDerivativeIdsFirst.length}, expected: ${expectedUserDerivativeIdsLengthFirst}`)
        assert(expectedUserDerivativeIdsLengthSecond === actualUserDerivativeIdsSecond.length,
            `Incorrect second user derivative ids length actual: ${actualUserDerivativeIdsSecond.length}, expected: ${expectedUserDerivativeIdsLengthSecond}`)
        assert(expectedDerivativeIdsLength === actualDerivativeIds.length,
            `Incorrect derivative ids length actual: ${actualDerivativeIds.length}, expected: ${expectedDerivativeIdsLength}`)


    });

    it('should open two positions and close two positions - Arithmetic overflow - fix last byte difference - case 1 with minus 3', async () => {
        //given
        await setupTokenDaiInitialValues();
        let direction = 0;
        let iporValueBeforeOpenPosition = testUtils.MILTON_3_PERCENTAGE;
        let openTimestamp = Math.floor(Date.now() / 1000);

        const derivativeParams = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp,
            from: userThree
        }
        await milton.provideLiquidity(derivativeParams.asset, BigInt(2) * testUtils.MILTON_14_000_USD, {from: liquidityProvider});
        await warren.test_updateIndex(derivativeParams.asset, iporValueBeforeOpenPosition, derivativeParams.openTimestamp, {from: userOne});

        let expectedUserDerivativeIdsLengthFirst = 0;
        let expectedUserDerivativeIdsLengthSecond = 0;
        let expectedDerivativeIdsLength = 0;

        //position 1, user first
        await openPositionFunc(derivativeParams);

        //position 2, user second
        derivativeParams.openTimestamp = derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS - 3;
        await openPositionFunc(derivativeParams);

        //when
        await milton.test_closePosition(1, derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS, {from: userThree});
        await milton.test_closePosition(2, derivativeParams.openTimestamp + testUtils.PERIOD_50_DAYS_IN_SECONDS, {from: userThree});


        //then
        let actualUserDerivativeIdsFirst = await miltonStorage.getUserDerivativeIds(userTwo);
        let actualUserDerivativeIdsSecond = await miltonStorage.getUserDerivativeIds(userTwo);
        let actualDerivativeIds = await miltonStorage.getDerivativeIds();


        assert(expectedUserDerivativeIdsLengthFirst === actualUserDerivativeIdsFirst.length,
            `Incorrect first user derivative ids length actual: ${actualUserDerivativeIdsFirst.length}, expected: ${expectedUserDerivativeIdsLengthFirst}`)
        assert(expectedUserDerivativeIdsLengthSecond === actualUserDerivativeIdsSecond.length,
            `Incorrect second user derivative ids length actual: ${actualUserDerivativeIdsSecond.length}, expected: ${expectedUserDerivativeIdsLengthSecond}`)
        assert(expectedDerivativeIdsLength === actualDerivativeIds.length,
            `Incorrect derivative ids length actual: ${actualDerivativeIds.length}, expected: ${expectedDerivativeIdsLength}`)


    });

    it('should open two positions and close one position - Arithmetic overflow - last byte difference - case 1', async () => {
        //given
        await setupTokenDaiInitialValues();
        let direction = 0;
        let iporValueBeforeOpenPosition = testUtils.MILTON_3_PERCENTAGE;
        let openTimestamp = Math.floor(Date.now() / 1000);

        const derivativeParams = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: openTimestamp,
            from: userThree
        }
        await milton.provideLiquidity(derivativeParams.asset, BigInt(2) * testUtils.MILTON_14_000_USD, {from: liquidityProvider});
        await warren.test_updateIndex(derivativeParams.asset, iporValueBeforeOpenPosition, derivativeParams.openTimestamp, {from: userOne});

        let expectedUserDerivativeIdsLengthFirst = 0;
        let expectedUserDerivativeIdsLengthSecond = 0;
        let expectedDerivativeIdsLength = 0;

        //position 1, user first
        derivativeParams.from = userThree;
        derivativeParams.direction = 0;
        await openPositionFunc(derivativeParams);

        //position 2, user second
        derivativeParams.openTimestamp = derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS;
        derivativeParams.from = userThree;
        derivativeParams.direction = 0;
        await openPositionFunc(derivativeParams);

        await milton.test_closePosition(1, derivativeParams.openTimestamp + testUtils.PERIOD_25_DAYS_IN_SECONDS, {from: userThree});

        //when
        await milton.test_closePosition(2, derivativeParams.openTimestamp + testUtils.PERIOD_50_DAYS_IN_SECONDS, {from: userThree});


        //then
        let actualUserDerivativeIdsFirst = await miltonStorage.getUserDerivativeIds(userTwo);
        let actualUserDerivativeIdsSecond = await miltonStorage.getUserDerivativeIds(userTwo);
        let actualDerivativeIds = await miltonStorage.getDerivativeIds();


        assert(expectedUserDerivativeIdsLengthFirst === actualUserDerivativeIdsFirst.length,
            `Incorrect first user derivative ids length actual: ${actualUserDerivativeIdsFirst.length}, expected: ${expectedUserDerivativeIdsLengthFirst}`)
        assert(expectedUserDerivativeIdsLengthSecond === actualUserDerivativeIdsSecond.length,
            `Incorrect second user derivative ids length actual: ${actualUserDerivativeIdsSecond.length}, expected: ${expectedUserDerivativeIdsLengthSecond}`)
        assert(expectedDerivativeIdsLength === actualDerivativeIds.length,
            `Incorrect derivative ids length actual: ${actualDerivativeIds.length}, expected: ${expectedDerivativeIdsLength}`)

    });


    it('should calculate income tax, 5%, not owner, Milton loses, user earns, |I| < D', async () => {
        await setupTokenDaiInitialValues();
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_5_PERCENTAGE);
        let incomeTax = BigInt("416715953424657532692");
        let expectedMiltonTokenBalance = BigInt("5775380931506849346167") + incomeTax;
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10008204619068493150653833") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10000020000000000000000000");
        let expectedLiquidityPoolTotalBalance = BigInt("5765380931506849346167");
        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userThree,
            testUtils.MILTON_120_PERCENTAGE,
            testUtils.MILTON_5_PERCENTAGE,
            testUtils.PERIOD_50_DAYS_IN_SECONDS,
            testUtils.MILTON_14_000_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax,
            testUtils.ZERO, null
        );
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_10_PERCENTAGE);
    });

    it('should calculate income tax, 5%, Milton loses, user earns, |I| > D', async () => {
        await setupTokenDaiInitialValues();
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_5_PERCENTAGE);
        let incomeTax = BigInt("493515000000000000000");
        let expectedMiltonTokenBalance = BigInt("4239400000000000000000") + incomeTax;
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10009760600000000000000000") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10009760600000000000000000") - incomeTax;
        let expectedLiquidityPoolTotalBalance = BigInt("4229400000000000000000");
        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_160_PERCENTAGE, testUtils.PERIOD_25_DAYS_IN_SECONDS, testUtils.MILTON_14_000_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_10_PERCENTAGE);
    });

    it('should calculate income tax, 5%, Milton earns, user loses, |I| < D', async () => {
        await setupTokenDaiInitialValues();
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_5_PERCENTAGE);
        let incomeTax = BigInt("392107808219178083882");

        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9992048143835616438322363");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("9992048143835616438322363");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("7951856164383561677637");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("7941856164383561677637") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_120_PERCENTAGE,
            testUtils.MILTON_5_PERCENTAGE,
            testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax, testUtils.ZERO, null
        );
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_10_PERCENTAGE);
    });


    it('should calculate income tax, 5%, Milton earns, user loses, |I| > D', async () => {
        await setupTokenDaiInitialValues();
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_5_PERCENTAGE);
        let incomeTax = BigInt("493515000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("9980000000000000000000");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("9970000000000000000000") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userThree,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_160_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            BigInt("9990000000000000000000000"), //expectedOpenerUserTokenBalanceAfterPayOut
            BigInt("10000020000000000000000000"), //expectedCloserUserTokenBalanceAfterPayOut
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax,
            testUtils.ZERO, null
        );
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_10_PERCENTAGE);
    });

    it('should calculate income tax, 100%, Milton loses, user earns, |I| < D', async () => {
        await setupTokenDaiInitialValues();
        await miltonConfiguration.setMaxIncomeTaxPercentage(testUtils.MILTON_100_PERCENTAGE);
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_100_PERCENTAGE);
        let incomeTax = BigInt("8334319068493150653833");
        let expectedMiltonTokenBalance = BigInt("5775380931506849346167") + incomeTax;
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10008204619068493150653833") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10000020000000000000000000");
        let expectedLiquidityPoolTotalBalance = BigInt("5765380931506849346167");
        let providedLiquidityAmount = testUtils.MILTON_14_000_USD;
        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userThree,
            testUtils.MILTON_120_PERCENTAGE, testUtils.MILTON_5_PERCENTAGE,
            testUtils.PERIOD_50_DAYS_IN_SECONDS, providedLiquidityAmount,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax,
            testUtils.ZERO, null
        );
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_10_PERCENTAGE);
        await miltonConfiguration.setMaxIncomeTaxPercentage(testUtils.MILTON_20_PERCENTAGE);
    });

    it('should calculate income tax, 100%, Milton loses, user earns, |I| > D', async () => {
        await setupTokenDaiInitialValues();
        await miltonConfiguration.setMaxIncomeTaxPercentage(testUtils.MILTON_100_PERCENTAGE);
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_100_PERCENTAGE);

        let incomeTax = BigInt("9870300000000000000000");
        let expectedMiltonTokenBalance = BigInt("4239400000000000000000") + incomeTax;
        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("10009760600000000000000000") - incomeTax;
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("10009760600000000000000000") - incomeTax;
        let expectedLiquidityPoolTotalBalance = BigInt("4229400000000000000000");

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_5_PERCENTAGE,
            testUtils.MILTON_160_PERCENTAGE,
            testUtils.PERIOD_25_DAYS_IN_SECONDS,
            testUtils.MILTON_14_000_USD,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, null
        );
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_10_PERCENTAGE);
        await miltonConfiguration.setMaxIncomeTaxPercentage(testUtils.MILTON_20_PERCENTAGE);
    });

    it('should calculate income tax, 100%, Milton earns, user loses, |I| < D, to low liquidity pool', async () => {
        await setupTokenDaiInitialValues();
        await miltonConfiguration.setMaxIncomeTaxPercentage(testUtils.MILTON_100_PERCENTAGE);
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_100_PERCENTAGE);
        let incomeTax = BigInt("7842156164383561677637");

        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9992048143835616438322363");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("9992048143835616438322363");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("7951856164383561677637");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("7941856164383561677637") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_120_PERCENTAGE,
            testUtils.MILTON_5_PERCENTAGE,
            testUtils.PERIOD_25_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax, testUtils.ZERO, null
        );
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_10_PERCENTAGE);
        await miltonConfiguration.setMaxIncomeTaxPercentage(testUtils.MILTON_20_PERCENTAGE);
    });


    it('should calculate income tax, 100%, Milton earns, user loses, |I| > D, to low liquidity pool', async () => {
        await setupTokenDaiInitialValues();
        await miltonConfiguration.setMaxIncomeTaxPercentage(testUtils.MILTON_100_PERCENTAGE);
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_100_PERCENTAGE);
        let incomeTax = BigInt("9870300000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("9980000000000000000000");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("9970000000000000000000") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 1, userTwo, userThree,
            testUtils.MILTON_5_PERCENTAGE, testUtils.MILTON_160_PERCENTAGE, testUtils.PERIOD_50_DAYS_IN_SECONDS,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            BigInt("9990000000000000000000000"), //expectedOpenerUserTokenBalanceAfterPayOut
            BigInt("10000020000000000000000000"), //expectedCloserUserTokenBalanceAfterPayOut
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO,
            incomeTax,
            testUtils.ZERO, null
        );
        await miltonConfiguration.setIncomeTaxPercentage(testUtils.MILTON_10_PERCENTAGE);
        await miltonConfiguration.setMaxIncomeTaxPercentage(testUtils.MILTON_20_PERCENTAGE);
    });

    it('should open pay fixed position, DAI, custom Opening Fee for Treasury 50%', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = getStandardDerivativeParams();

        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});
        await miltonConfiguration.setOpeningFeeForTreasuryPercentage(BigInt("50000000000000000"))

        let expectedOpeningFeeTotalBalance = testUtils.MILTON_99__7_USD;
        let expectedTreasuryTotalBalance = BigInt("4985000000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("94715000000000000000");
        await milton.provideLiquidity(params.asset, miltonBalanceBeforePayout, {from: liquidityProvider})

        //when
        await milton.openPosition(
            params.asset, params.totalAmount,
            params.slippageValue, params.collateralization,
            params.direction, {from: userTwo});

        //then
        let balance = await miltonStorage.balances(params.asset);

        const actualOpeningFeeTotalBalance = BigInt(balance.openingFee);
        const actualLiquidityPoolTotalBalance = BigInt(balance.liquidityPool);
        const actualTreasuryTotalBalance = BigInt(balance.treasury);

        assert(expectedOpeningFeeTotalBalance === actualOpeningFeeTotalBalance,
            `Incorrect opening fee total balance for ${params.asset}, actual:  ${actualOpeningFeeTotalBalance},
            expected: ${expectedOpeningFeeTotalBalance}`)
        assert(expectedLiquidityPoolTotalBalance === actualLiquidityPoolTotalBalance,
            `Incorrect Liquidity Pool total balance for ${params.asset}, actual:  ${actualLiquidityPoolTotalBalance},
            expected: ${expectedLiquidityPoolTotalBalance}`)
        assert(expectedTreasuryTotalBalance === actualTreasuryTotalBalance,
            `Incorrect Treasury total balance for ${params.asset}, actual:  ${actualTreasuryTotalBalance},
            expected: ${expectedTreasuryTotalBalance}`)

        await miltonConfiguration.setOpeningFeeForTreasuryPercentage(ZERO);
    });

    it('should open pay fixed position, DAI, custom Opening Fee for Treasury 25%', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = getStandardDerivativeParams();

        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});
        await miltonConfiguration.setOpeningFeeForTreasuryPercentage(BigInt("25000000000000000"))

        let expectedOpeningFeeTotalBalance = testUtils.MILTON_99__7_USD;
        let expectedTreasuryTotalBalance = BigInt("2492500000000000000");

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("97207500000000000000");
        await milton.provideLiquidity(params.asset, miltonBalanceBeforePayout, {from: liquidityProvider})

        //when
        await milton.openPosition(
            params.asset, params.totalAmount,
            params.slippageValue, params.collateralization,
            params.direction, {from: userTwo});

        //then
        let balance = await miltonStorage.balances(params.asset);

        const actualOpeningFeeTotalBalance = BigInt(balance.openingFee);
        const actualLiquidityPoolTotalBalance = BigInt(balance.liquidityPool);
        const actualTreasuryTotalBalance = BigInt(balance.treasury);

        assert(expectedOpeningFeeTotalBalance === actualOpeningFeeTotalBalance,
            `Incorrect opening fee total balance for ${params.asset}, actual:  ${actualOpeningFeeTotalBalance},
            expected: ${expectedOpeningFeeTotalBalance}`)
        assert(expectedLiquidityPoolTotalBalance === actualLiquidityPoolTotalBalance,
            `Incorrect Liquidity Pool total balance for ${params.asset}, actual:  ${actualLiquidityPoolTotalBalance},
            expected: ${expectedLiquidityPoolTotalBalance}`)
        assert(expectedTreasuryTotalBalance === actualTreasuryTotalBalance,
            `Incorrect Treasury total balance for ${params.asset}, actual:  ${actualTreasuryTotalBalance},
            expected: ${expectedTreasuryTotalBalance}`)

        await miltonConfiguration.setOpeningFeeForTreasuryPercentage(ZERO);
    });

    it('should NOT transfer Publication Fee to Charlie Treasury - caller not publication fee transferer', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = getStandardDerivativeParams();

        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});

        await milton.provideLiquidity(params.asset, testUtils.MILTON_14_000_USD, {from: liquidityProvider})

        await milton.openPosition(
            params.asset, params.totalAmount,
            params.slippageValue, params.collateralization,
            params.direction, {from: userTwo});

        //when
        await testUtils.assertError(
            //when
            milton.transferPublicationFee(tokenDai.address, BigInt("100")),
            //then
            'IPOR_31'
        );
    });

    it('should NOT transfer Publication Fee to Charlie Treasury - Charlie Treasury address incorrect', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = getStandardDerivativeParams();

        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});

        await milton.provideLiquidity(params.asset, testUtils.MILTON_14_000_USD, {from: liquidityProvider})

        await milton.openPosition(
            params.asset, params.totalAmount,
            params.slippageValue, params.collateralization,
            params.direction, {from: userTwo});

        await iporAddressesManager.setAddress("PUBLICATION_FEE_TRANSFERER", admin);

        //when
        await testUtils.assertError(
            //when
            milton.transferPublicationFee(tokenDai.address, BigInt("100")),
            //then
            'IPOR_29'
        );
    });

    it('should transfer Publication Fee to Charlie Treasury - simple case 1', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = getStandardDerivativeParams();

        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});

        await milton.provideLiquidity(params.asset, testUtils.MILTON_14_000_USD, {from: liquidityProvider})

        await milton.openPosition(
            params.asset, params.totalAmount,
            params.slippageValue, params.collateralization,
            params.direction, {from: userTwo});

        await iporAddressesManager.setAddress("PUBLICATION_FEE_TRANSFERER", admin);
        await iporAddressesManager.setCharlieTreasurer(params.asset, userThree);

        const transferedAmount = BigInt("100");

        //when
        await milton.transferPublicationFee(tokenDai.address, transferedAmount);

        //then
        let balance = await miltonStorage.balances(params.asset);

        let expectedErc20BalanceCharlieTreasurer = testUtils.USER_SUPPLY_18_DECIMALS + transferedAmount;
        let actualErc20BalanceCharlieTreasurer = BigInt(await tokenDai.balanceOf(userThree));

        let expectedErc20BalanceMilton = testUtils.MILTON_14_000_USD + testUtils.MILTON_10_000_USD - transferedAmount;
        let actualErc20BalanceMilton = BigInt(await tokenDai.balanceOf(milton.address));

        let expectedPublicationFeeBalanceMilton = testUtils.MILTON_10_USD - transferedAmount;
        const actualPublicationFeeBalanceMilton = BigInt(balance.iporPublicationFee);

        assert(expectedErc20BalanceCharlieTreasurer === actualErc20BalanceCharlieTreasurer,
            `Incorrect ERC20 Charlie Treasurer balance for ${params.asset}, actual:  ${actualErc20BalanceCharlieTreasurer},
                expected: ${expectedErc20BalanceCharlieTreasurer}`)

        assert(expectedErc20BalanceMilton === actualErc20BalanceMilton,
            `Incorrect ERC20 Milton balance for ${params.asset}, actual:  ${actualErc20BalanceMilton},
                expected: ${expectedErc20BalanceMilton}`)

        assert(expectedPublicationFeeBalanceMilton === actualPublicationFeeBalanceMilton,
            `Incorrect Milton balance for ${params.asset}, actual:  ${actualPublicationFeeBalanceMilton},
                expected: ${expectedPublicationFeeBalanceMilton}`)
    });

    it('should NOT open pay fixed position, DAI, collateralization too low', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(500),
            direction: 0,
            openTimestamp: Math.floor(Date.now() / 1000),
            from: userTwo
        }
        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});

        //when
        await testUtils.assertError(
            //when
            milton.openPosition(
                params.asset, params.totalAmount,
                params.slippageValue, params.collateralization,
                params.direction, {from: userTwo}),
            //then
            'IPOR_12'
        );
    });

    it('should NOT open pay fixed position, DAI, collateralization too high', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt("50000000000000000001"),
            direction: 0,
            openTimestamp: Math.floor(Date.now() / 1000),
            from: userTwo
        }
        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});

        //when
        await testUtils.assertError(
            //when
            milton.openPosition(
                params.asset, params.totalAmount,
                params.slippageValue, params.collateralization,
                params.direction, {from: userTwo}),
            //then
            'IPOR_34'
        );
    });


    it('should open pay fixed position, DAI, custom collateralization - simple case 1', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt("15125000000000000000"),
            direction: 0,
            openTimestamp: Math.floor(Date.now() / 1000),
            from: userTwo
        }
        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});

        await milton.provideLiquidity(params.asset, testUtils.MILTON_14_000_USD, {from: liquidityProvider})

        //when
        await milton.openPosition(
            params.asset, params.totalAmount,
            params.slippageValue, params.collateralization,
            params.direction, {from: userTwo});

        //then
        let actualDerivativeItem = await miltonStorage.getDerivativeItem(1);
        let actualNotionalAmount = BigInt(actualDerivativeItem.item.notionalAmount);
        let expectedNotionalAmount = BigInt("149288287500000000000000");

        assert(expectedNotionalAmount === actualNotionalAmount,
            `Incorrect notional amount for ${params.asset}, actual:  ${actualNotionalAmount},
            expected: ${expectedNotionalAmount}`)

    });

    it('should open pay fixed position - liquidity pool utilisation not exceeded, custom utilisation', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = getStandardDerivativeParams();
        let oldLiquidityPoolMaxUtilizationPercentage = await miltonConfiguration.getLiquidityPoolMaxUtilizationPercentage();
        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        await milton.provideLiquidity(params.asset, miltonBalanceBeforePayout, {from: liquidityProvider})

        let liquiditiPoolMaxUtilizationEdge = BigInt(700036170982361327)
        await miltonConfiguration.setLiquidityPoolMaxUtilizationPercentage(liquiditiPoolMaxUtilizationEdge);

        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + params.totalAmount;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("99700000000000000000");

        //when
        await milton.openPosition(
            params.asset, params.totalAmount,
            params.slippageValue, params.collateralization,
            params.direction, {from: userTwo});

        //then

        await assertExpectedValues(
            params.asset,
            userTwo,
            userTwo,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            BigInt("9990000000000000000000000"),
            BigInt("9990000000000000000000000"),
            expectedLiquidityPoolTotalBalance,
            1,
            BigInt("9870300000000000000000"),
            testUtils.MILTON_20_USD,
            BigInt("0")
        );

        await miltonConfiguration.setLiquidityPoolMaxUtilizationPercentage(oldLiquidityPoolMaxUtilizationPercentage);
    });


    it('should NOT open pay fixed position - when new position opened then liquidity pool utilisation exceeded, custom utilisation', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = getStandardDerivativeParams();

        let oldLiquidityPoolMaxUtilizationPercentage = await miltonConfiguration.getLiquidityPoolMaxUtilizationPercentage();
        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        await milton.provideLiquidity(params.asset, miltonBalanceBeforePayout, {from: liquidityProvider})

        let liquiditiPoolMaxUtilizationEdgeExceeded = BigInt(700036170982360000)
        await miltonConfiguration.setLiquidityPoolMaxUtilizationPercentage(liquiditiPoolMaxUtilizationEdgeExceeded);

        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + params.totalAmount;
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("99700000000000000000");

        //when
        await testUtils.assertError(
            //when
            milton.openPosition(
                params.asset, params.totalAmount,
                params.slippageValue, params.collateralization,
                params.direction, {from: userTwo}),
            //then
            'IPOR_35'
        );

        await miltonConfiguration.setLiquidityPoolMaxUtilizationPercentage(oldLiquidityPoolMaxUtilizationPercentage);
    });


    it('should NOT open pay fixed position - liquidity pool utilisation already exceeded, custom utilisation', async () => {

        //given
        await setupTokenDaiInitialValues();
        const params = getStandardDerivativeParams();

        let oldLiquidityPoolMaxUtilizationPercentage = await miltonConfiguration.getLiquidityPoolMaxUtilizationPercentage();
        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        await milton.provideLiquidity(params.asset, miltonBalanceBeforePayout, {from: liquidityProvider})

        let liquiditiPoolMaxUtilizationEdge = BigInt(700036170982361327)
        await miltonConfiguration.setLiquidityPoolMaxUtilizationPercentage(liquiditiPoolMaxUtilizationEdge);

        //First open position not exceeded liquidity utilization
        await milton.openPosition(
            params.asset, params.totalAmount,
            params.slippageValue, params.collateralization,
            params.direction, {from: userTwo});

        //when
        //Second open position exceeded liquidity utilization
        await testUtils.assertError(
            //when
            milton.openPosition(
                params.asset, params.totalAmount,
                params.slippageValue, params.collateralization,
                params.direction, {from: userTwo}),
            //then
            'IPOR_35'
        );

        await miltonConfiguration.setLiquidityPoolMaxUtilizationPercentage(oldLiquidityPoolMaxUtilizationPercentage);
    });

    it('should NOT open pay fixed position - liquidity pool utilisation exceeded, liquidity pool and opening fee are ZERO', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = getStandardDerivativeParams();

        let oldLiquidityPoolMaxUtilizationPercentage = await miltonConfiguration.getLiquidityPoolMaxUtilizationPercentage();
        let oldOpeningFeePercentage = await miltonConfiguration.getOpeningFeePercentage();

        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});

        await miltonConfiguration.setOpeningFeePercentage(ZERO);
        //very high value
        await miltonConfiguration.setLiquidityPoolMaxUtilizationPercentage(BigInt(99999999999999999999999999999999999999999));


        await testUtils.assertError(
            //when
            milton.openPosition(
                params.asset, params.totalAmount,
                params.slippageValue, params.collateralization,
                params.direction, {from: userTwo}),
            //then
            'IPOR_35'
        );

        await miltonConfiguration.setLiquidityPoolMaxUtilizationPercentage(oldLiquidityPoolMaxUtilizationPercentage);
        await miltonConfiguration.setOpeningFeePercentage(oldOpeningFeePercentage);
    });

    it('should open pay fixed position - when open timestamp is long time ago', async () => {
        //given
        await setupTokenDaiInitialValues();
        let veryLongTimeAgoTimestamp = 31536000; //1971-01-01
        let incomeTax = BigInt("0");

        let expectedOpenerUserTokenBalanceAfterPayOut = BigInt("9999890300000000000000000");
        let expectedCloserUserTokenBalanceAfterPayOut = BigInt("9999890300000000000000000");


        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        let expectedMiltonTokenBalance = miltonBalanceBeforePayout + BigInt("109700000000000000000");
        let expectedLiquidityPoolTotalBalance = miltonBalanceBeforePayout + BigInt("99700000000000000000") - incomeTax;

        await exetuceClosePositionTestCase(
            tokenDai.address, 10, 0, userTwo, userTwo,
            testUtils.MILTON_3_PERCENTAGE, testUtils.MILTON_3_PERCENTAGE, 0,
            miltonBalanceBeforePayout,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            0, testUtils.ZERO, testUtils.ZERO, incomeTax, testUtils.ZERO, veryLongTimeAgoTimestamp
        );

    });

    it('should NOT open pay fixed position - asset address not supported', async () => {

        //given

        await setupTokenDaiInitialValues();
        const params = getStandardDerivativeParams();

        await warren.updateIndex(params.asset, testUtils.MILTON_3_PERCENTAGE, {from: userOne});

        let miltonBalanceBeforePayout = testUtils.MILTON_14_000_USD;
        await milton.provideLiquidity(params.asset, miltonBalanceBeforePayout, {from: liquidityProvider})

        //when
        await testUtils.assertError(
            //when
            milton.openPosition(
                liquidityProvider, params.totalAmount,
                params.slippageValue, params.collateralization,
                params.direction, {from: userTwo}),
            //then
            'IPOR_39'
        );

    });


    it('should provide liquidity and take IPOR token - simple case 1', async () => {
        //given
        await setupTokenDaiInitialValues();
        await setupIporTokenDaiInitialValues();
        const params = getStandardDerivativeParams();
        let liquidityAmount = testUtils.MILTON_14_000_USD;

        let expectedLiquidityProviderStableBalance = BigInt("9986000000000000000000000");

        //when
        await milton.provideLiquidity(params.asset, liquidityAmount, {from: liquidityProvider})

        //then
        const iporTokenBalanceSender = BigInt(await iporTokenDai.balanceOf(liquidityProvider));
        const stableBalanceMilton = BigInt(await tokenDai.balanceOf(milton.address));
        //TODO: liquidity balance milton storage
        const stableBalanceSender = BigInt(await tokenDai.balanceOf(liquidityProvider));

        assert(liquidityAmount === iporTokenBalanceSender,
            `Incorrect IPOR Token balance on user for asset ${params.asset} actual: ${iporTokenBalanceSender}, expected: ${liquidityAmount}`);

        assert(liquidityAmount === stableBalanceMilton,
            `Incorrect DAI balance on Milton for asset ${params.asset} actual: ${stableBalanceMilton}, expected: ${liquidityAmount}`);

        assert(expectedLiquidityProviderStableBalance === stableBalanceSender,
            `Incorrect DAI balance on user for asset ${params.asset} actual: ${stableBalanceSender}, expected: ${expectedLiquidityProviderStableBalance}`);

    });

    it('should withdraw IPOR Token - simple case 1', async () => {
        //given
        await setupTokenDaiInitialValues();
        await setupIporTokenDaiInitialValues();
        const params = getStandardDerivativeParams();
        let liquidityAmount = testUtils.MILTON_14_000_USD;
        let withdrawAmount = testUtils.MILTON_10_000_USD;
        let expectedIporTokenBalanceSender = BigInt("4000000000000000000000");
        let expectedStableBalanceMilton = BigInt("4000000000000000000000");
        let expectedLiquidityProviderStableBalance = BigInt("9996000000000000000000000");
        await milton.provideLiquidity(params.asset, liquidityAmount, {from: liquidityProvider})

        //when
        await milton.withdraw(params.asset, withdrawAmount, {from: liquidityProvider})


        //then
        const iporTokenBalanceSender = BigInt(await iporTokenDai.balanceOf(liquidityProvider));
        const stableBalanceMilton = BigInt(await tokenDai.balanceOf(milton.address));
        //TODO: liquidity balance milton storage
        const stableBalanceSender = BigInt(await tokenDai.balanceOf(liquidityProvider));

        assert(expectedIporTokenBalanceSender === iporTokenBalanceSender,
            `Incorrect IPOR Token balance on user for asset ${params.asset} actual: ${iporTokenBalanceSender}, expected: ${expectedIporTokenBalanceSender}`);

        assert(expectedStableBalanceMilton === stableBalanceMilton,
            `Incorrect DAI balance on Milton for asset ${params.asset} actual: ${stableBalanceMilton}, expected: ${expectedStableBalanceMilton}`);

        assert(expectedLiquidityProviderStableBalance === stableBalanceSender,
            `Incorrect DAI balance on user for asset ${params.asset} actual: ${stableBalanceSender}, expected: ${expectedLiquidityProviderStableBalance}`);

    });

    it('should NOT withdraw IPOR Token - Liquidity Pool is too low', async () => {
        //given
        await setupTokenDaiInitialValues();
        const params = getStandardDerivativeParams();
        await milton.provideLiquidity(params.asset, params.totalAmount, {from: liquidityProvider})
        await iporAddressesManager.setAddress("MILTON", userOne);
        await miltonStorage.subtractLiquidity(params.asset, params.totalAmount, {from: userOne})

        //when
        await testUtils.assertError(
            //when
            milton.withdraw(params.asset, params.totalAmount, {from: liquidityProvider}),
            //then
            'IPOR_43'
        );
        await iporAddressesManager.setAddress("MILTON", milton.address);
    });


    //TODO: check initial IBT

    //TODO: test w którym skutecznie przenoszone jest wlascicielstwo kontraktu na inna osobe
    //TODO: dodac test 1 otwarta long, zmiana indeksu, 2 otwarta short, zmiana indeksu, zamykamy 1 i 2, soap = 0

    //TODO: dodać test w którym zmieniamy konfiguracje w MiltonConfiguration i widac zmiany w Milton

    //TODO: testy na strukturze MiltonDerivatives

    //TODO: test when ipor not ready yet

    //TODO: create test when ipor index not yet created for specific asset

    //TODO: test na 1 sprwdzenie czy totalAmount wiekszy od fee
    //TODO: test na 2 sprwdzenie czy totalAmount wiekszy od fee (po przeliczeniu openingFeeAmount)
    //TODO: test na wysłanie USDT które ma 6 miejsc po przecinku i weryfikacja liczb

    //TODO: add test which checks emited events!!!
    //TODO: dopisać test zmiany na przykład adresu warrena i sprawdzenia czy widzi to milton
    //TODO: dopisac test zmiany adresu usdt i sprawdzenia czy widzi to milton
    //TODO: test sprawdzajacy wykonaniue przxelewu eth na miltona
    //TODO: test na podmianke miltonStorage - czy pokazuje nowy balance??


    const calculateSoap = async (params) => {
        return await milton.test_calculateSoap.call(params.asset, params.calculateTimestamp, {from: params.from});
    }

    const openPositionFunc = async (params) => {
        await milton.test_openPosition(
            params.openTimestamp,
            params.asset,
            params.totalAmount,
            params.slippageValue,
            params.collateralization,
            params.direction, {from: params.from});
    }

    const countOpenPositions = (derivatives) => {
        let count = 0;
        for (let i = 0; i < derivatives.length; i++) {
            if (derivatives[i].state == 0) {
                count++;
            }
        }
        return count;
    }

    const assertMiltonDerivativeItem = async (
        derivativeId,
        expectedIdsIndex,
        expectedUserDerivativeIdsIndex
    ) => {
        let actualDerivativeItem = await miltonStorage.getDerivativeItem(derivativeId);
        assert(BigInt(expectedIdsIndex) === BigInt(actualDerivativeItem.idsIndex),
            `Incorrect idsIndex for derivative id ${actualDerivativeItem.item.id} actual: ${actualDerivativeItem.idsIndex}, expected: ${expectedIdsIndex}`);
        assert(BigInt(expectedUserDerivativeIdsIndex) === BigInt(actualDerivativeItem.userDerivativeIdsIndex),
            `Incorrect userDerivativeIdsIndex for derivative id ${actualDerivativeItem.item.id} actual: ${actualDerivativeItem.userDerivativeIdsIndex}, expected: ${expectedUserDerivativeIdsIndex}`)
    }

    //TODO: add to every test..
    const assertDerivative = async (
        derivativeId,
        expectedDerivative
    ) => {

        // let actualDerivative = await milton.getOpenPosition(derivativeId);
        //
        // assertDerivativeItem('ID', expectedDerivative.id, actualDerivative.id);
        // assertDerivativeItem('State', expectedDerivative.state, actualDerivative.state);
        // assertDerivativeItem('Buyer', expectedDerivative.buyer, actualDerivative.buyer);
        // assertDerivativeItem('Asset', expectedDerivative.asset, actualDerivative.asset);
        // assertDerivativeItem('Direction', expectedDerivative.direction, actualDerivative.direction);
        // assertDerivativeItem('Deposit Amount', expectedDerivative.depositAmount, actualDerivative.depositAmount);
        // assertDerivativeItem('Liquidation Deposit Amount', expectedDerivative.fee.liquidationDepositAmount, actualDerivative.fee.liquidationDepositAmount);
        // assertDerivativeItem('Opening Amount Fee', expectedDerivative.fee.openingAmount, actualDerivative.fee.openingAmount);
        // assertDerivativeItem('IPOR Publication Amount Fee', expectedDerivative.fee.iporPublicationAmount, actualDerivative.fee.iporPublicationAmount);
        // assertDerivativeItem('Spread Percentage Fee', expectedDerivative.fee.spreadPercentage, actualDerivative.fee.spreadPercentage);
        // assertDerivativeItem('Collateralization', expectedDerivative.collateralization, actualDerivative.collateralization);
        // assertDerivativeItem('Notional Amount', expectedDerivative.notionalAmount, actualDerivative.notionalAmount);
        // // assertDerivativeItem('Derivative starting timestamp', expectedDerivative.startingTimestamp, actualDerivative.startingTimestamp);
        // // assertDerivativeItem('Derivative ending timestamp', expectedDerivative.endingTimestamp, actualDerivative.endingTimestamp);
        // assertDerivativeItem('IPOR Index Value', expectedDerivative.indicator.iporIndexValue, actualDerivative.indicator.iporIndexValue);
        // assertDerivativeItem('IBT Price', expectedDerivative.indicator.ibtPrice, actualDerivative.indicator.ibtPrice);
        // assertDerivativeItem('IBT Quantity', expectedDerivative.indicator.ibtQuantity, actualDerivative.indicator.ibtQuantity);
        // assertDerivativeItem('Fixed Interest Rate', expectedDerivative.indicator.fixedInterestRate, actualDerivative.indicator.fixedInterestRate);
        // assertDerivativeItem('SOAP', expectedDerivative.indicator.soap, actualDerivative.indicator.soap);

    }

    const exetuceClosePositionTestCase = async function (
        asset,
        collateralization,
        direction,
        openerUserAddress,
        closerUserAddress,
        iporValueBeforeOpenPosition,
        iporValueAfterOpenPosition,
        periodOfTimeElapsedInSeconds,
        providedLiquidityAmount,
        expectedMiltonTokenBalance,
        expectedOpenerUserTokenBalanceAfterPayOut,
        expectedCloserUserTokenBalanceAfterPayOut,
        expectedLiquidityPoolTotalBalance,
        expectedOpenedPositions,
        expectedDerivativesTotalBalance,
        expectedLiquidationDepositFeeTotalBalance,
        expectedTreasuryTotalBalance,
        expectedSoap,
        openTimestamp
    ) {
        //given
        let localOpenTimestamp = null;
        if (openTimestamp != null) {
            localOpenTimestamp = openTimestamp;
        } else {
            localOpenTimestamp = Math.floor(Date.now() / 1000);
        }
        const params = {
            asset: asset,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: direction,
            openTimestamp: localOpenTimestamp,
            from: openerUserAddress
        }

        if (providedLiquidityAmount != null) {
            //in test we expect that Liquidity Pool is loosing and from its pool Milton has to paid out to closer user
            await milton.provideLiquidity(params.asset, providedLiquidityAmount, {from: liquidityProvider})
        }

        await warren.test_updateIndex(params.asset, iporValueBeforeOpenPosition, params.openTimestamp, {from: userOne});
        await openPositionFunc(params);
        await warren.test_updateIndex(params.asset, iporValueAfterOpenPosition, params.openTimestamp, {from: userOne});

        let endTimestamp = params.openTimestamp + periodOfTimeElapsedInSeconds;

        //when
        await milton.test_closePosition(1, endTimestamp, {from: closerUserAddress});

        //then
        await assertExpectedValues(
            params.asset,
            openerUserAddress,
            closerUserAddress,
            providedLiquidityAmount,
            expectedMiltonTokenBalance,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedLiquidityPoolTotalBalance,
            expectedOpenedPositions,
            expectedDerivativesTotalBalance,
            expectedLiquidationDepositFeeTotalBalance,
            expectedTreasuryTotalBalance
        );

        const soapParams = {
            asset: params.asset,
            calculateTimestamp: endTimestamp,
            expectedSoap: expectedSoap,
            from: openerUserAddress
        }
        await assertSoap(soapParams);
    }

    const assertExpectedValues = async function (
        asset,
        openerUserAddress,
        closerUserAddress,
        miltonBalanceBeforePayout,
        expectedMiltonTokenBalance,
        expectedOpenerUserTokenBalanceAfterPayOut,
        expectedCloserUserTokenBalanceAfterPayOut,
        expectedLiquidityPoolTotalBalance,
        expectedOpenedPositions,
        expectedDerivativesTotalBalance,
        expectedLiquidationDepositFeeTotalBalance,
        expectedTreasuryTotalBalance
    ) {
        let actualDerivatives = await miltonStorage.getPositions();
        let actualOpenPositionsVol = countOpenPositions(actualDerivatives);
        assert(expectedOpenedPositions === actualOpenPositionsVol,
            `Incorrect number of opened derivatives, actual:  ${actualOpenPositionsVol}, expected: ${expectedOpenedPositions}`)

        let expectedOpeningFeeTotalBalance = testUtils.MILTON_99__7_USD;
        let expectedPublicationFeeTotalBalance = testUtils.MILTON_10_USD;

        await assertBalances(
            asset,
            openerUserAddress,
            closerUserAddress,
            expectedOpenerUserTokenBalanceAfterPayOut,
            expectedCloserUserTokenBalanceAfterPayOut,
            expectedMiltonTokenBalance,
            expectedDerivativesTotalBalance,
            expectedOpeningFeeTotalBalance,
            expectedLiquidationDepositFeeTotalBalance,
            expectedPublicationFeeTotalBalance,
            expectedLiquidityPoolTotalBalance,
            expectedTreasuryTotalBalance
        );

        let openerUserTokenBalanceBeforePayout = testUtils.MILTON_10_000_000_USD;
        let closerUserTokenBalanceBeforePayout = testUtils.MILTON_10_000_000_USD;


        const ammTokenBalanceAfterPayout = BigInt(await tokenDai.balanceOf(milton.address));
        const openerUserTokenBalanceAfterPayout = BigInt(await tokenDai.balanceOf(openerUserAddress));
        const closerUserTokenBalanceAfterPayout = BigInt(await tokenDai.balanceOf(closerUserAddress));

        let expectedSumOfBalancesBeforePayout = null;
        let actualSumOfBalances = null;

        if (openerUserAddress === closerUserAddress) {
            expectedSumOfBalancesBeforePayout = miltonBalanceBeforePayout + openerUserTokenBalanceBeforePayout;
            actualSumOfBalances = openerUserTokenBalanceAfterPayout + ammTokenBalanceAfterPayout;
        } else {
            expectedSumOfBalancesBeforePayout = miltonBalanceBeforePayout + openerUserTokenBalanceBeforePayout + closerUserTokenBalanceBeforePayout;
            actualSumOfBalances = openerUserTokenBalanceAfterPayout + closerUserTokenBalanceAfterPayout + ammTokenBalanceAfterPayout;
        }

        assert(expectedSumOfBalancesBeforePayout === actualSumOfBalances,
            `Incorrect balance between AMM Balance and Users Balance for asset ${asset}, actual: ${actualSumOfBalances}, expected ${expectedSumOfBalancesBeforePayout}`);

    }

    const getStandardDerivativeParams = () => {
        return {
            asset: tokenDai.address,
            totalAmount: testUtils.MILTON_10_000_USD,
            slippageValue: 3,
            collateralization: BigInt(10000000000000000000),
            direction: 0,
            openTimestamp: Math.floor(Date.now() / 1000),
            from: userTwo
        }
    }

    const setupTokenUsdtInitialValues = async () => {
        await tokenUsdt.setupInitialAmount(await milton.address, ZERO);
        await tokenUsdt.setupInitialAmount(admin, testUtils.USER_SUPPLY_6_DECIMALS);
        await tokenUsdt.setupInitialAmount(userOne, testUtils.USER_SUPPLY_6_DECIMALS);
        await tokenUsdt.setupInitialAmount(userTwo, testUtils.USER_SUPPLY_6_DECIMALS);
        await tokenUsdt.setupInitialAmount(userThree, testUtils.USER_SUPPLY_6_DECIMALS);
        await tokenUsdt.setupInitialAmount(liquidityProvider, testUtils.USER_SUPPLY_6_DECIMALS);
    }
    const setupTokenUsdcInitialValues = async () => {
        await tokenUsdc.setupInitialAmount(await milton.address, ZERO);
        await tokenUsdc.setupInitialAmount(admin, testUtils.USER_SUPPLY_18_DECIMALS);
        await tokenUsdc.setupInitialAmount(userOne, testUtils.USER_SUPPLY_18_DECIMALS);
        await tokenUsdc.setupInitialAmount(userTwo, testUtils.USER_SUPPLY_18_DECIMALS);
        await tokenUsdc.setupInitialAmount(userThree, testUtils.USER_SUPPLY_18_DECIMALS);
        await tokenUsdc.setupInitialAmount(liquidityProvider, testUtils.USER_SUPPLY_18_DECIMALS);
    }
    const setupIporTokenDaiInitialValues = async () => {
        await iporAddressesManager.setAddress("MILTON", userOne);
        let lpBalance = BigInt(await iporTokenDai.balanceOf(liquidityProvider));
        if (lpBalance > 0) {
            await iporTokenDai.burn(liquidityProvider, accounts[5], lpBalance, {from: userOne});
        }
        await iporAddressesManager.setAddress("MILTON", milton.address);
    }
    const setupTokenDaiInitialValues = async () => {
        await tokenDai.setupInitialAmount(await milton.address, ZERO);
        await tokenDai.setupInitialAmount(admin, testUtils.USER_SUPPLY_18_DECIMALS);
        await tokenDai.setupInitialAmount(userOne, testUtils.USER_SUPPLY_18_DECIMALS);
        await tokenDai.setupInitialAmount(userTwo, testUtils.USER_SUPPLY_18_DECIMALS);
        await tokenDai.setupInitialAmount(userThree, testUtils.USER_SUPPLY_18_DECIMALS);
        await tokenDai.setupInitialAmount(liquidityProvider, testUtils.USER_SUPPLY_18_DECIMALS);
    }

    const assertSoap = async (params) => {
        let actualSoapStruct = await calculateSoap(params);
        let actualSoap = BigInt(actualSoapStruct.soap);

        //then
        assert(params.expectedSoap === actualSoap,
            `Incorrect SOAP for asset ${params.asset} actual: ${actualSoap}, expected: ${params.expectedSoap}`)
    }

    const assertDerivativeItem = function (itemName, expected, actual) {
        assert(actual === expected, `Incorrect ${itemName} ${actual}, expected ${expected}`);
    }
    const assertBalances = async (
        asset,
        openerUserAddress,
        closerUserAddress,
        expectedOpenerUserTokenBalance,
        expectedCloserUserTokenBalance,
        expectedMiltonTokenBalance,
        expectedDerivativesTotalBalance,
        expectedOpeningFeeTotalBalance,
        expectedLiquidationDepositFeeTotalBalance,
        expectedPublicationFeeTotalBalance,
        expectedLiquidityPoolTotalBalance,
        expectedTreasuryTotalBalance
    ) => {

        let actualOpenerUserTokenBalance = null;
        let actualCloserUserTokenBalance = null;
        if (asset === tokenDai.address) {
            actualOpenerUserTokenBalance = BigInt(await tokenDai.balanceOf(openerUserAddress));
            actualCloserUserTokenBalance = BigInt(await tokenDai.balanceOf(closerUserAddress));
        }

        let balance = await miltonStorage.balances(asset);

        const actualMiltonTokenBalance = BigInt(await miltonDevToolDataProvider.getMiltonTotalSupply(asset));
        const actualDerivativesTotalBalance = BigInt(balance.derivatives);
        const actualOpeningFeeTotalBalance = BigInt(balance.openingFee);
        const actualLiquidationDepositFeeTotalBalance = BigInt(balance.liquidationDeposit);
        const actualPublicationFeeTotalBalance = BigInt(balance.iporPublicationFee);
        const actualLiquidityPoolTotalBalance = BigInt(balance.liquidityPool);
        const actualTreasuryTotalBalance = BigInt(balance.treasury);

        if (expectedMiltonTokenBalance !== null) {
            assert(actualMiltonTokenBalance === expectedMiltonTokenBalance,
                `Incorrect token balance for ${asset} in Milton address, actual: ${actualMiltonTokenBalance}, expected: ${expectedMiltonTokenBalance}`);
        }

        if (expectedOpenerUserTokenBalance != null) {
            assert(actualOpenerUserTokenBalance === expectedOpenerUserTokenBalance,
                `Incorrect token balance for ${asset} in Opener User address, actual: ${actualOpenerUserTokenBalance}, expected: ${expectedOpenerUserTokenBalance}`);
        }

        if (expectedCloserUserTokenBalance != null) {
            assert(actualCloserUserTokenBalance === expectedCloserUserTokenBalance,
                `Incorrect token balance for ${asset} in Closer User address, actual: ${actualCloserUserTokenBalance}, expected: ${expectedCloserUserTokenBalance}`);
        }

        if (expectedDerivativesTotalBalance != null) {
            assert(expectedDerivativesTotalBalance === actualDerivativesTotalBalance,
                `Incorrect derivatives total balance for ${asset}, actual:  ${actualDerivativesTotalBalance}, expected: ${expectedDerivativesTotalBalance}`)
        }

        if (expectedOpeningFeeTotalBalance != null) {
            assert(expectedOpeningFeeTotalBalance === actualOpeningFeeTotalBalance,
                `Incorrect opening fee total balance for ${asset}, actual:  ${actualOpeningFeeTotalBalance}, expected: ${expectedOpeningFeeTotalBalance}`)
        }

        if (expectedLiquidationDepositFeeTotalBalance !== null) {
            assert(expectedLiquidationDepositFeeTotalBalance === actualLiquidationDepositFeeTotalBalance,
                `Incorrect liquidation deposit fee total balance for ${asset}, actual:  ${actualLiquidationDepositFeeTotalBalance}, expected: ${expectedLiquidationDepositFeeTotalBalance}`)
        }

        if (expectedPublicationFeeTotalBalance != null) {
            assert(expectedPublicationFeeTotalBalance === actualPublicationFeeTotalBalance,
                `Incorrect ipor publication fee total balance for ${asset}, actual: ${actualPublicationFeeTotalBalance}, expected: ${expectedPublicationFeeTotalBalance}`)
        }

        if (expectedLiquidityPoolTotalBalance != null) {
            assert(expectedLiquidityPoolTotalBalance === actualLiquidityPoolTotalBalance,
                `Incorrect Liquidity Pool total balance for ${asset}, actual:  ${actualLiquidityPoolTotalBalance}, expected: ${expectedLiquidityPoolTotalBalance}`)
        }

        if (expectedTreasuryTotalBalance != null) {
            assert(expectedTreasuryTotalBalance === actualTreasuryTotalBalance,
                `Incorrect Treasury total balance for ${asset}, actual:  ${actualTreasuryTotalBalance}, expected: ${expectedTreasuryTotalBalance}`)
        }
    }
});
