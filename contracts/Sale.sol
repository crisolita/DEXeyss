//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/TokenTimelock.sol";

/// @title Sale
/// @author crisolita
/// @notice this contract allow create phases for mint token and transfer the funds
contract Sale is Ownable, Pausable {
    /// a phase is a period for a discount in minting price
    /// until amount N of token sold out or reaching a date or time is over
    /// @dev a phase is always needed to mint

    

    struct Phase {
        // bool is the phase public
        bool isPublic;
        // uint minimum amount of token
        uint256 minimunEntry;
        // uint amount of tokens minted for one BNB/ETH
        uint256 price;
        // uint between 0(0.0%) - 1000(100.0%) to mul with the price on sell
        uint256 discount;
        // timestamp when this phase ends
        uint256 endAt;
        // initial supply
        uint256 initSupply;
        // uint that decreases when sold in phase
        // @note to know the original supply look up in logs
        uint256 supply;
        // mark as finished the phase
        bool over;
        //time in days for lock tokens
        uint256 time;
    }



    /// all phases (next, current and previous)
    mapping(uint256 => Phase) public phases;

    // only the private wallets
 
    mapping(address => bool ) private whitelist;

    //address with amount and time for timelock 

    mapping(uint256 => TokenTimelock) public tokenLock; 

    /// reference for the mapping of phases, uint of the current phase
    uint256 public currentPhase;

    //  ID for every sale 

    uint256 public id;
    /// reference for the mapping of phases, uint of the total phase
    /// @dev phases[totalPhase - 1] to get the total phase
    uint256 public totalPhase;

    /// @notice max amount of token allowed to mint in this contract
    uint256 public immutable maxSupply;

    /// @notice current mintable amount of tokens
    uint256 public supply;

    /// @notice wallet to transfer funds of the contract
    address public dispatcher;

    /// @notice address the token that user buys
    address public tokenAddress;

    /// records the changes of the wallet where the tokens are transferred
    event DispatcherChange(address indexed _dispatcher);

    /// records the token transfers made by the contract
    event Purchase(address indexed _account, uint256 _amount, uint256 _price,uint256 _id);

    /// records creation  of phases
    event PhaseCreated(
        uint256 indexed index,
        bool isPublic,
        uint256 _minimunEntry,
        uint256 _price,
        uint256 _discount,
        uint256 _endAt,
        uint256 _supply
    );
    event PhaseOver(bool _over);

    event Claims(address _buyer, uint256 _id);

    constructor(
        uint256 _maxSupply,
        address _dispatcher,
        address _tokenAddress
    ) {
        currentPhase = 0;
        totalPhase = 0;
        maxSupply = _maxSupply;
        supply = _maxSupply;
        dispatcher = _dispatcher;
        tokenAddress = _tokenAddress;
    }

    //receive a bool and make the access possible
    modifier isPublic() {
       if(!phases[currentPhase].isPublic) {
            require(whitelist[msg.sender], "This phase is private");
       }
        _;

    }

    modifier isOver() {
        require(
            phases[currentPhase].over == false,
            "This phase is over, wait for the next"
        );
        _;
    }
    /// @notice add a phase to mapping
    function createPhase(
        bool _isPublic,
        uint256 _minimunEntry,
        uint256 _price,
        uint256 _discount,
        uint256 _endAt,
        uint256 _supply,
        uint256 _time
    ) external onlyOwner {
        emit PhaseCreated(
            totalPhase,
            _isPublic,
            _minimunEntry,
            _price,
            _discount,
            _endAt,
            _supply
        );

        Phase storage p = phases[totalPhase++];

        p.isPublic = _isPublic;

        p.minimunEntry = _minimunEntry;

        p.price = _price;

        require(_discount < 1001, "Discount cannot be greater than 100%");
        p.discount = _discount;

        require(
            block.timestamp < _endAt,
            "The end of the phase should be greater than now"
        );
        p.endAt = _endAt;

        p.initSupply = _supply;

        p.over = false;

        p.time = _time;

        require(supply >= _supply, "Not enough supply to mint");
        /// supply will decrease with each phase
        /// if the supply reaches 0 means that the cap of token are distributed in the phases
        supply -= _supply;
        p.supply = _supply;

        require(
            ERC20(tokenAddress).transferFrom(
                dispatcher,
                address(this),
                _supply
            ),
            "The token could not be transferred to the phase"
        );
    }

    function cancelPhase() external onlyOwner isOver{
        phases[currentPhase].over = true;
        emit PhaseOver(true);
    }

    function addToWhitelist(address _account) public onlyOwner {
        whitelist[_account] = true;
    }

      function removeWhitelistedAddress(address _account) public onlyOwner {
        whitelist[_account] = false;
    }

    /// @notice change account to transfer the contract balance
    function changeDispatcher(address _dispatcher) external onlyOwner {
        emit DispatcherChange(_dispatcher);
        dispatcher = _dispatcher;
    }

    /// @notice mint tokens, require send ETH/BNB
    function buyToken(uint256 _tokenAmount)
        external
        payable
        whenNotPaused
        isPublic
        isOver
    {
        if (block.timestamp > phases[currentPhase].endAt) {
            phases[currentPhase].over = true;
            emit PhaseOver(true);
        }

        require(
            phases[currentPhase].supply >= _tokenAmount,
            "Not enought supply"
        );

        require(
            _tokenAmount >= phases[currentPhase].minimunEntry,
            "There are too few tokens"
        );

        // calculation: tokens / (price * (100 - discount) / 100)
    
        uint256 finalPrice = phases[currentPhase].price;


        if (phases[currentPhase].discount!= 0 ) {
             finalPrice = (_tokenAmount /
            (phases[currentPhase].price *
                (1000 - phases[currentPhase].discount))) / 1000;
        } 
       
        require(finalPrice <= msg.value, "Not enough ETH/BNB");
        TokenTimelock usertime = new TokenTimelock(IERC20(tokenAddress),msg.sender,block.timestamp + phases[currentPhase].time);
        ERC20(tokenAddress).transfer(address(usertime),_tokenAmount);
        tokenLock[id] = usertime;
        emit Purchase(msg.sender, _tokenAmount, finalPrice,id);
        id++;
        /// change current phase total supply
        phases[currentPhase].supply -= _tokenAmount;
        /// advance phase if the supply is out
        if (phases[currentPhase].supply == 0) {
            phases[currentPhase].over = true;
            emit PhaseOver(true);
        }



    }


    /// @notice a function to make stake 
    function makeStake(uint256 _amount) public {
        require(_amount>=100,"Not enough tokens to stake");
        ERC20(tokenAddress).transfer(address(this), _amount);
        

    }

 
    /// @notice get ongoing phase or the last phase over
    function getcurrentPhase() external view returns (Phase memory) {
        return phases[currentPhase];
    }

    /// @notice pause the mint, no one could buy token from this contract
    function pauseMint() external onlyOwner {
        _pause();
    }

    //release the tokens at time

    function release(uint256 _id) public {
        require(msg.sender == tokenLock[_id].beneficiary(), "This is not your id");
        tokenLock[_id].release();
        emit Claims(msg.sender,_id);
    }

    /// @notice withdraw eth
    function withdraw(address _account, uint256 _amount) external onlyOwner {
        payable(_account).transfer(_amount);
    }

    /// @notice continue minting, let user call function to buy token
    function unpauseMint() external onlyOwner {
        _unpause();
    }
}
