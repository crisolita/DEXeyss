//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/TokenTimelock.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/// @title Sale
/// @author crisolita
/// @notice this contract allow create phases for mint token and transfer the funds
contract Sale is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
	/// until amount N of token sold out or reaching a date or time is over

	struct Phase {
		// bool is the phase publici
		bool isPublic;
		// uint minimum amount of token
		uint256 minimunEntry;
		// uint price in usd
		uint256 price;
		// timestamp when this phase ends
		uint256 endAt;
		// uint that decreases when sold in phase
		// @note to know the original supply look up in logs
		uint256 supply;
		// mark as finished the phase
		bool over;
		//time in days for lock tokens
		uint256 timelock;
	}

	AggregatorV3Interface private priceFeed;

	/// all phases (next, current and previous)
	mapping(uint256 => Phase) public phases;

	// only the private wallets

	mapping(address => bool) private whitelist;

	//address with amount and time for timelock

	mapping(uint256 => TokenTimelock) public tokenLocksForSale;

	/// reference for the mapping of phases, uint of the current phase
	uint256 public currentPhase;

	//  ID for every sale

	uint256 public id;
	/// reference for the mapping of phases, uint of the total phase

	/// @notice current amount of tokens
	uint256 public tokensRemainForSale;

	/// @notice wallet to transfer funds of the contract
	address public dispatcher;

	/// @notice address the token that user buys
	address public tokenAddress;

	/// records the changes of the wallet where the tokens are transferred
	event DispatcherChange(address indexed _dispatcher);

	/// records the token transfers made by the contract
	event Purchase(address indexed _account, uint256 _amount, uint256 _id);

	//event to control withdraw
	event Withdraw(address _recipient, uint256 _amount);

	/// records creation  of phases
	event PhaseCreated(
		bool isPublic,
		uint256 _minimunEntry,
		uint256 _price,
		uint256 _endAt,
		uint256 _supply
	);
	event PhaseOver(bool _over);

	event Claims(address _buyer, uint256 _id);

	function initialize(
		uint256 _maxSupply,
		address _dispatcher,
		address _tokenAddress,
		address _chainLinkBNB_USD
	) public initializer {
		__Ownable_init();
		priceFeed = AggregatorV3Interface(_chainLinkBNB_USD);
		currentPhase = 0;
		tokensRemainForSale = _maxSupply;
		dispatcher = _dispatcher;
		tokenAddress = _tokenAddress;
		phases[currentPhase].over = true;
	}

	//receive a bool and make the access possible
	modifier isPublicSale() {
		if (!phases[currentPhase].isPublic) {
			require(whitelist[msg.sender], "This phase is private");
		}
		_;
	}

	/// @notice mint tokens, require send ETH/BNB
	function buyToken(uint256 _tokenAmount)
		external
		payable
		isPublicSale
		nonReentrant
	{
		require(
			block.timestamp < phases[currentPhase].endAt,
			"This phase is over, wait for the next"
		);

		require(
			phases[currentPhase].supply >= _tokenAmount,
			"Not enough supply"
		);

		require(
			_tokenAmount >= phases[currentPhase].minimunEntry,
			"There are too few tokens"
		);

		uint256 finalPrice =
			(_tokenAmount * phases[currentPhase].price) / (getLatestPrice());

		require(finalPrice <= msg.value, "Not enough ETH/BNB");

		id++;
		if (phases[currentPhase].timelock > 0) {
			TokenTimelock timelockForSale =
				new TokenTimelock(
					IERC20(tokenAddress),
					msg.sender,
					block.timestamp + phases[currentPhase].timelock
				);
			ERC20Upgradeable(tokenAddress).transfer(
				address(timelockForSale),
				_tokenAmount
			);

			tokenLocksForSale[id] = timelockForSale;
		} else {
			ERC20Upgradeable(tokenAddress).transfer(msg.sender, _tokenAmount);
		}

		/// change current phase total supply
		phases[currentPhase].supply -= _tokenAmount;

		if (phases[currentPhase].supply == 0) {
			phases[currentPhase].over = true;
			emit PhaseOver(true);
		}

		tokensRemainForSale -= _tokenAmount;

		emit Purchase(msg.sender, _tokenAmount, id);
	}

	//release the tokens at time

	function release(uint256 _id) public {
		require(
			msg.sender == tokenLocksForSale[_id].beneficiary(),
			"This is not your id"
		);
		tokenLocksForSale[_id].release();
		emit Claims(msg.sender, _id);
	}

	///@notice view functions

	///@dev get the usd/BNB price
	function getLatestPrice() public view returns (uint256) {
		(, int256 price, , , ) = priceFeed.latestRoundData();
		return uint256(price) * 10**10;
	}

	/// @notice get ongoing phase or the last phase over
	function getcurrentPhase() external view returns (Phase memory) {
		return phases[currentPhase];
	}

	///@notice ONLYOWNER FUNCTIONS

	/// @notice add a phase to mapping
	function createPhase(
		bool _isPublic,
		uint256 _minimunEntry,
		uint256 _price,
		uint256 _endAt,
		uint256 _supply,
		uint256 _timeLock
	) external onlyOwner {
		if (block.timestamp > phases[currentPhase].endAt) {
			phases[currentPhase].over = true;
		}
		require(phases[currentPhase].over, "This phase isn't over");
		if (phases[currentPhase].supply > 0) {
			IERC20(tokenAddress).transfer(
				dispatcher,
				phases[currentPhase].supply
			);
		}
		require(
			block.timestamp < _endAt,
			"The end of the phase should be greater than now"
		);
		require(
			_supply > _minimunEntry,
			"Supply should be greater than minimum entry"
		);
		require(tokensRemainForSale >= _supply, "Not enough supply to mint");
		require(
			IERC20(tokenAddress).transferFrom(
				dispatcher,
				address(this),
				_supply
			),
			"The token could not be transferred to the phase"
		);
		currentPhase++;
		Phase memory p =
			Phase(
				_isPublic,
				_minimunEntry,
				_price,
				_endAt,
				_supply,
				false,
				_timeLock
			);
		phases[currentPhase] = p;

		emit PhaseCreated(_isPublic, _minimunEntry, _price, _endAt, _supply);
	}

	/// @notice change account to transfer the contract balance
	function changeDispatcher(address _dispatcher) external onlyOwner {
		emit DispatcherChange(_dispatcher);
		dispatcher = _dispatcher;
	}

	function cancelPhase() external onlyOwner {
		require(
			phases[currentPhase].over == false,
			"This phase is over, wait for the next"
		);
		if (phases[currentPhase].supply > 0) {
			IERC20(tokenAddress).transfer(
				dispatcher,
				phases[currentPhase].supply
			);
			phases[currentPhase].supply = 0;
		}
		phases[currentPhase].over = true;
		emit PhaseOver(true);
	}

	function addToWhitelist(address[] memory _accounts) public onlyOwner {
		for (uint256 i = 0; i < _accounts.length; i++) {
			whitelist[_accounts[i]] = true;
		}
	}

	function removeWhitelistedAddress(address[] memory _accounts)
		public
		onlyOwner
	{
		for (uint256 i = 0; i < _accounts.length; i++) {
			whitelist[_accounts[i]] = false;
		}
	}

	///@notice  set chainlink address

	function setChainlinkAddress(address _newChainlinkAddres) public onlyOwner {
		priceFeed = AggregatorV3Interface(_newChainlinkAddres);
	}

	///@dev change the end date's phase
	function changeEndDate(uint256 _newEndDate) public onlyOwner {
		require(block.timestamp < _newEndDate);
		phases[currentPhase].endAt = _newEndDate;
	}

	/// @notice withdraw eth
	function withdraw(address _account, uint256 _amount)
		external
		onlyOwner
		nonReentrant
	{
		payable(_account).transfer(_amount);
		emit Withdraw(_account, _amount);
	}

	receive() external payable {}
}
