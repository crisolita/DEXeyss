const SALE_CONTRACT_NAME = "Sale";

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const maxSupply = "600000000000000000000000000";
  const BBCNToken = await deployments.get("BBCNToken");

  // Upgradeable Proxy
  const deployResult = await deploy("Sale", {
    from: deployer,
    proxy: {
      owner: deployer,
      execute: {
        init: {
          methodName: "initialize",
          args: [
            maxSupply,
            deployer,
            BBCNToken.address,
            process.env.CHAINLINKBSCTESTNET_BNB_USD_PRICE,
          ],
        },
      },
    },
    log: true,
  });
};
module.exports.tags = [SALE_CONTRACT_NAME];
module.exports.dependencies = ["BBCNToken"];
