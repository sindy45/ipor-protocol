require("dotenv").config({ path: "../../../.env" });
const func = require("../../libs/json_func.js");
const script = require("../../libs/contracts/deploy/stanley_strategies/compound/usdt/0001_initial_deploy.js");

module.exports = async function (deployer, _network, addresses) {
    const StrategyCompoundUsdt = artifacts.require("StrategyCompoundUsdt");
    await script(deployer, _network, addresses, StrategyCompoundUsdt);
    await func.updateLastCompletedMigration();
};
