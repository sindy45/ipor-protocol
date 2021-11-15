const testUtils = require("./TestUtils.js");
const truffleAssert = require('truffle-assertions');
const keccak256 = require("keccak256");

contract('IpToken', (accounts) => {

    const [admin, userOne, userTwo, userThree, liquidityProvider, _] = accounts;

    let data = null;
    let testData

    before(async () => {
        data = await testUtils.prepareDataForBefore(accounts);
    });

    beforeEach(async () => {
        testData = await testUtils.prepareDataForBeforeEach(data);
    });


    it('should NOT mint ipToken if not a Liquidity Pool', async () => {

        //when
        await testUtils.assertError(
            //when
            data.ipTokenDai.mint(userOne, testUtils.USD_10_000_18DEC, {from: userTwo}),
            //then
            'IPOR_46'
        );

    });

    it('should NOT burn ipToken if not a Liquidity Pool', async () => {
        //when
        await testUtils.assertError(
            //when
            data.ipTokenDai.burn(userOne, userTwo, testUtils.USD_10_000_18DEC, {from: userTwo}),
            //then
            'IPOR_46'
        );
    });

    it('should emit event', async () => {
        //given
        await data.iporConfiguration.setAddress(keccak256("JOSEPH"), admin);

        //when
        let tx = await data.ipTokenDai.mint(userOne, testUtils.USD_10_000_18DEC, {from: admin})

        //then
        truffleAssert.eventEmitted(tx, 'Mint', (ev) => {
            return ev.user == userOne && ev.value == testUtils.USD_10_000_18DEC;
        });
        await data.iporConfiguration.setAddress(keccak256("JOSEPH"), data.joseph.address);
    });
});
