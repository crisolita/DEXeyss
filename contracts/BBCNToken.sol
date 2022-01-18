// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

/**
 * @title BBCN token
 */
contract BBCNToken is ERC20PresetMinterPauser {
	constructor() ERC20PresetMinterPauser("BITBCN", "BBCN") {}
}
