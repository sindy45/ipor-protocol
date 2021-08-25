const Warren = artifacts.require("Warren");
const MiltonV1 = artifacts.require("MiltonV1");
const MiltonV1Storage= artifacts.require("MiltonV1Storage");
const MiltonFaucet = artifacts.require("MiltonFaucet");
const TestWarrenProxy = artifacts.require("TestWarrenProxy");
const TestMiltonV1Proxy = artifacts.require("TestMiltonV1Proxy");
const TusdMockedToken = artifacts.require('TusdMockedToken');
const UsdtMockedToken = artifacts.require('UsdtMockedToken');
const UsdcMockedToken = artifacts.require('UsdcMockedToken');
const DaiMockedToken = artifacts.require('DaiMockedToken');
const IporLogic = artifacts.require('IporLogic');
const DerivativeLogic = artifacts.require('DerivativeLogic');
const SoapIndicatorLogic = artifacts.require('SoapIndicatorLogic');
const SpreadIndicatorLogic = artifacts.require('SpreadIndicatorLogic');
const TotalSoapIndicatorLogic = artifacts.require('TotalSoapIndicatorLogic');
const DerivativesView = artifacts.require('DerivativesView');
const MiltonConfiguration = artifacts.require('MiltonConfiguration');
const AmmMath = artifacts.require('AmmMath');
const MiltonAddressesManager = artifacts.require('MiltonAddressesManager');
const MiltonDevToolDataProvider = artifacts.require('MiltonDevToolDataProvider');


module.exports = async function (deployer, _network, addresses) {
    const [admin, userOne, userTwo, userThree, _] = addresses;

    await deployer.deploy(AmmMath);
    await deployer.link(AmmMath, IporLogic);

    await deployer.deploy(IporLogic);
    await deployer.link(AmmMath, Warren);
    await deployer.link(IporLogic, Warren);
    await deployer.deploy(Warren);
    const warren = await Warren.deployed();

    let faucetSupply6Decimals = '1000000000000000000000000';
    let totalSupply6Decimals = '1000000000000000000000000000';

    let faucetSupply18Decimals = '10000000000000000000000000000000000000';
    let totalSupply18Decimals = '10000000000000000000000000000000000000000';

    //10 000 000 USD
    let userSupply6Decimals = '10000000000000';

    //10 000 000 USD
    let userSupply18Decimals = '10000000000000000000000000';

    let mockedUsdt = null;
    let mockedUsdtAddr = null;
    let mockedUsdc = null;
    let mockedUsdcAddr = null;
    let mockedDai = null;
    let mockedDaiAddr = null;
    let mockedTusd = null;
    let mockedTusdAddr = null;
    let warrenAddr = null;
    let milton = null;
    let miltonAddr = null;
    let miltonStorage = null;
    let miltonStorageAddr = null;
    let miltonFaucet = null;
    let miltonFaucetAddr = null;
    let miltonConfiguration = null;
    let miltonAddressesManager = null;

    await deployer.link(AmmMath, DerivativeLogic);
    await deployer.deploy(DerivativeLogic);
    await deployer.link(AmmMath, SoapIndicatorLogic);
    await deployer.deploy(SoapIndicatorLogic);
    await deployer.deploy(SpreadIndicatorLogic);
    await deployer.link(SoapIndicatorLogic, TotalSoapIndicatorLogic);
    await deployer.deploy(TotalSoapIndicatorLogic);
    await deployer.deploy(DerivativesView);

    await deployer.link(SoapIndicatorLogic, MiltonV1Storage);
    await deployer.link(SpreadIndicatorLogic, MiltonV1Storage);
    await deployer.link(DerivativeLogic, MiltonV1Storage);
    await deployer.link(TotalSoapIndicatorLogic, MiltonV1Storage);
    await deployer.link(DerivativesView, MiltonV1Storage);

    await deployer.link(DerivativeLogic, MiltonV1);
    await deployer.link(AmmMath, MiltonV1Storage);

    await deployer.deploy(MiltonConfiguration);
    miltonConfiguration = await MiltonConfiguration.deployed();

    await deployer.deploy(MiltonAddressesManager);
    miltonAddressesManager = await MiltonAddressesManager.deployed();
    let miltonAddressesManagerAddr = await miltonAddressesManager.address;

    if (_network === 'develop' || _network === 'develop2' || _network === 'dev' || _network === 'docker') {

        await deployer.deploy(UsdtMockedToken, totalSupply6Decimals, 6);
        mockedUsdt = await UsdtMockedToken.deployed();
        mockedUsdtAddr = await mockedUsdt.address;

        await deployer.deploy(UsdcMockedToken, totalSupply6Decimals, 6);
        mockedUsdc = await UsdcMockedToken.deployed();
        mockedUsdcAddr = await mockedUsdc.address;

        await deployer.deploy(DaiMockedToken, totalSupply18Decimals, 18);
        mockedDai = await DaiMockedToken.deployed();
        mockedDaiAddr = await mockedDai.address;

        await deployer.deploy(TusdMockedToken, totalSupply18Decimals, 18);
        mockedTusd = await TusdMockedToken.deployed();
        mockedTusdAddr = await mockedTusd.address;

        await deployer.deploy(MiltonFaucet,
            mockedUsdtAddr,
            mockedUsdcAddr,
            mockedDaiAddr,
            mockedTusdAddr);

        miltonFaucet = await MiltonFaucet.deployed();
        miltonFaucetAddr = await miltonFaucet.address;
        miltonFaucet.sendTransaction({from: admin, value: "500000000000000000000000"});


        await deployer.deploy(MiltonDevToolDataProvider, miltonAddressesManagerAddr);
    }

    if (_network == 'develop2' || _network === 'docker') {
        //by default add ADMIN as updater for IPOR Oracle
        await warren.addUpdater(admin);
        await warren.updateIndex("DAI", BigInt("30000000000000000"));
        await warren.updateIndex("USDT", BigInt("30000000000000000"));
        await warren.updateIndex("USDC", BigInt("30000000000000000"));
    }

    if (_network !== 'test') {
        await deployer.deploy(MiltonV1);
        milton = await MiltonV1.deployed();
        await deployer.deploy(MiltonV1Storage);
        miltonStorage = await MiltonV1Storage.deployed();
        warrenAddr = await warren.address;
        miltonAddr = await milton.address;
        miltonStorageAddr = await miltonStorage.address;
        const miltonConfigurationAddr = await miltonConfiguration.address;

        //initial addresses setup
        await miltonAddressesManager.setAddress("WARREN", warrenAddr );
        await miltonAddressesManager.setAddress("MILTON", miltonAddr);
        await miltonAddressesManager.setAddress("MILTON_STORAGE", miltonStorageAddr);
        await miltonAddressesManager.setAddress("MILTON_CONFIGURATION", miltonConfigurationAddr);

        await miltonAddressesManager.setAddress("USDT", mockedUsdtAddr);
        await miltonAddressesManager.setAddress("USDC", mockedUsdcAddr);
        await miltonAddressesManager.setAddress("DAI", mockedDaiAddr);

        await milton.initialize(miltonAddressesManagerAddr);
        await miltonStorage.initialize(miltonAddressesManagerAddr);
    } else {
        await deployer.link(AmmMath, TestWarrenProxy);
        await deployer.link(IporLogic, TestWarrenProxy);
        await deployer.link(DerivativeLogic, TestMiltonV1Proxy);
        await deployer.link(AmmMath, TestMiltonV1Proxy);
        await deployer.deploy(MiltonDevToolDataProvider, miltonAddressesManagerAddr);
    }

    if (_network === 'develop' || _network === 'develop2' || _network === 'dev' || _network === 'docker') {
        console.log("Setup Faucet...");
        await mockedUsdt.transfer(miltonFaucetAddr, faucetSupply6Decimals);
        await mockedUsdc.transfer(miltonFaucetAddr, faucetSupply6Decimals);
        await mockedDai.transfer(miltonFaucetAddr, faucetSupply18Decimals);
        await mockedTusd.transfer(miltonFaucetAddr, faucetSupply18Decimals);
        console.log("Setup Faucet finished.");

        console.log("Start transfer TOKENS to test addresses...");
        //first address is an admin, last two addresses will not have tokens and approves
        for (let i = 0; i < addresses.length - 2; i++) {
            await mockedUsdt.transfer(addresses[i], userSupply6Decimals);
            await mockedUsdc.transfer(addresses[i], userSupply6Decimals);
            await mockedDai.transfer(addresses[i], userSupply18Decimals);
            await mockedTusd.transfer(addresses[i], userSupply18Decimals);

            console.log(`Account: ${addresses[i]} - tokens transferred`);

            //AMM has rights to spend money on behalf of user
            //TODO: Use safeIncreaseAllowance() and safeDecreaseAllowance() from OpenZepppelin’s SafeERC20 implementation to prevent race conditions from manipulating the allowance amounts.
            mockedUsdt.approve(miltonAddr, totalSupply6Decimals, {from: addresses[i]});
            mockedUsdc.approve(miltonAddr, totalSupply6Decimals, {from: addresses[i]});
            mockedDai.approve(miltonAddr, totalSupply18Decimals, {from: addresses[i]});
            mockedTusd.approve(miltonAddr, totalSupply18Decimals, {from: addresses[i]});

            console.log(`Account: ${addresses[i]} approve spender ${miltonAddr} to spend tokens on behalf of user.`);
        }
    }

};