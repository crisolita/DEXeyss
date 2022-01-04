const hre = require("hardhat"); //import the hardhat
// toBN = (num) => web3.utils.toBN(num + "0".repeat(18));

async function main() {

  const [deployer] = await ethers.getSigners(); //get the account to deploy the contract

  console.log("Deploying contracts with the account:", deployer.address); 

  const Token = await hre.ethers.getContractFactory("Token");
  const token = await Token.deploy();

  await token.deployed();

  const maxSupply = 100000000000000;
  console.log("Token deployed to:", token.address)

  const Sale = await hre.ethers.getContractFactory("Sale"); // Getting the Contract
  const sale = await Sale.deploy(maxSupply,deployer.address,token.address); //deploying the contract

  await sale.deployed(); // waiting for the contract to be deployed

  console.log("Sale deployed to:", sale.address); // Returning the contract address on the rinkeby
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); // Calling the function to deploy the contract 