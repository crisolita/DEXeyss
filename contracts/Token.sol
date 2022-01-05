//SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/access/Ownable.sol";



contract Token is ERC20, Ownable{

    constructor () ERC20("Token", "Tkn") {
    }

    function mint(uint256 _amount) external onlyOwner {
        _mint(msg.sender, _amount);
    }


}