const SALE_CONTRACT_NAME = "Sale";
const TOKEN_CONTRACT_NAME = "BBCNToken";

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const maxSupply = "600000000000000000000000000";

  await deploy("BBCNToken", {
    contract: BBCNToken,
    from: deployer,
    args: [],
    log: true,
  });

  console.log("The token is deployed to.. ", BBCNToken.address);

  // Upgradeable Proxy
  await deploy("Sale", {
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

  console.log("The Sale is deployed to.. ", Sale.address);
};
module.exports.tags = [SALE_CONTRACT_NAME, TOKEN_CONTRACT_NAME];
