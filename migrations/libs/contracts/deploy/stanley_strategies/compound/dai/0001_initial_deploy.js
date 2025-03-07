const keys = require("../../../../../json_keys.js");
const func = require("../../../../../json_func.js");

const { deployProxy, erc1967 } = require("@openzeppelin/truffle-upgrades");

module.exports = async function (deployer, _network, addresses, StrategyCompoundDai) {
    const asset = await func.getValue(keys.DAI);
    const cToken = await func.getValue(keys.cDAI);

    const comptroller = await func.getValue(keys.Comptroller);
    const compToken = await func.getValue(keys.COMP);

    const compoundStrategyProxy = await deployProxy(
        StrategyCompoundDai,
        [asset, cToken, comptroller, compToken],
        {
            deployer: deployer,
            initializer: "initialize",
            kind: "uups",
        }
    );

    const compoundStrategyImpl = await erc1967.getImplementationAddress(
        compoundStrategyProxy.address
    );

    await func.update(keys.CompoundStrategyProxyDai, compoundStrategyProxy.address);
    await func.update(keys.CompoundStrategyImplDai, compoundStrategyImpl);
};
