const TOKEN_CONTRACT_NAME = "BBCNToken";

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const namedAccounts = await getNamedAccounts();
  const { deployer } = namedAccounts;
  const deployResult = await deploy("BBCNToken", {
    from: deployer,
    args: [],
  });
};

module.exports.tags = [TOKEN_CONTRACT_NAME];
