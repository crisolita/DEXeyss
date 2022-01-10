const hre = require("hardhat"); //import the hardhat
// toBN = (num) => web3.utils.toBN(num + "0".repeat(18));

async function main() {

  const [deployer] = await ethers.getSigners(); //get the account to deploy the contract

  console.log("Deploying contracts with the account:", deployer.address); 

  // const Token = await hre.ethers.getContractFactory("Token");
  // const token = await Token.deploy();

  // await token.deployed();

  const maxSupply = "1000000000000000000000";
  console.log("Token deployed to:", "0xaB97b0eEA567Bf8c5eEC65DE489F8faeF13646Af");

  const Sale = await hre.ethers.getContractFactory("Sale"); // Getting the Contract
  const sale = await Sale.deploy(maxSupply,deployer.address,"0xaB97b0eEA567Bf8c5eEC65DE489F8faeF13646Af"); //deploying the contract

  await sale.deployed(); // waiting for the contract to be deployed

//  const  genesis = new Date();
//  genesis.setMinutes(genesis.getMinutes() + 5);

//  console.log((web3.utils.toBN(genesis.getTime()).div(web3.utils.toBN(1000)).toString()));

//   const StakingRewardsFactory= await hre.ethers.getContractFactory("StakingRewardsFactory"); // Getting the Contrac
//   const stakingRewardsFactory = await StakingRewardsFactory.deploy("0xaB97b0eEA567Bf8c5eEC65DE489F8faeF13646Af",(web3.utils.toBN(genesis.getTime()).div(web3.utils.toBN(1000)).toString())); //deploying the contract
// ""
//   await stakingRewardsFactory.deployed(); // waiting for the contract to be deployed


  console.log("Sale deployed to:", sale.address); // Returning the contract address on the rinkeby
  console.log("StakingRewardsFactory deployed to:", "0xBD66934E02BbEa25F1f8cFC69A7369084ca3d926"); // Returning the contract address on the rinkeby

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); // Calling the function to deploy the contract 