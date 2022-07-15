const keys = require("../../../json_keys.js");
const func = require("../../../json_func.js");

const ItfIporOracle = artifacts.require("ItfIporOracle");

module.exports = async function (deployer, _network, addresses) {
    const [admin, iporIndexUpdater, _] = addresses;

    const iporOracle = await func.getValue(keys.ItfIporOracleProxy);

    const iporOracleInstance = await ItfIporOracle.at(iporOracle);

    await iporOracleInstance.addUpdater(admin);
    await iporOracleInstance.addUpdater(iporIndexUpdater);
};
