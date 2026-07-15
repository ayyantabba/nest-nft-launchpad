// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Royalty} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract RobinhoodNFTCollection is ERC721Royalty, Ownable2Step, ReentrancyGuard, Pausable {
    using Strings for uint256;

    error MintClosed();
    error MintNotStarted();
    error MintEnded();
    error BadQuantity();
    error MaxSupplyExceeded();
    error WalletLimitExceeded();
    error TxLimitExceeded();
    error IncorrectPayment();
    error InvalidAddress();
    error WithdrawFailed();

    struct CollectionConfig {
        string name;
        string symbol;
        uint256 maxSupply;
        uint256 mintPrice;
        uint256 maxMintPerWallet;
        uint256 maxMintPerTransaction;
        uint64 mintStart;
        uint64 mintEnd;
        string baseURI;
        string contractURI;
        address creatorPayout;
        address royaltyRecipient;
        uint96 royaltyBps;
        bool publicMintEnabled;
    }

    uint256 public immutable maxSupply;
    uint256 public mintPrice;
    uint256 public maxMintPerWallet;
    uint256 public maxMintPerTransaction;
    uint64 public mintStart;
    uint64 public mintEnd;
    bool public publicMintEnabled;
    address public immutable creatorPayout;
    address public immutable platformTreasury;
    uint96 public immutable platformFeeBps;

    string private baseTokenURI;
    string private collectionContractURI;
    uint256 public totalMinted;
    uint256 public creatorAccrued;
    uint256 public platformAccrued;

    mapping(address => uint256) public mintedByWallet;

    event Minted(address indexed buyer, uint256 quantity, uint256 paid);
    event PublicMintUpdated(bool enabled);
    event MintPriceUpdated(uint256 mintPrice);
    event MintWindowUpdated(uint64 start, uint64 end);
    event MetadataUpdated(string baseURI, string contractURI);
    event RevenueAccrued(uint256 creatorAmount, uint256 platformAmount);
    event CreatorWithdrawal(address indexed to, uint256 amount);
    event PlatformWithdrawal(address indexed to, uint256 amount);
    event RoyaltyUpdated(address indexed recipient, uint96 royaltyBps);

    constructor(CollectionConfig memory cfg, address treasury, uint96 feeBps, address owner_) ERC721(cfg.name, cfg.symbol) Ownable(owner_) {
        if (cfg.creatorPayout == address(0) || treasury == address(0)) revert InvalidAddress();
        if (cfg.maxSupply == 0) revert MaxSupplyExceeded();

        maxSupply = cfg.maxSupply;
        mintPrice = cfg.mintPrice;
        maxMintPerWallet = cfg.maxMintPerWallet;
        maxMintPerTransaction = cfg.maxMintPerTransaction;
        mintStart = cfg.mintStart;
        mintEnd = cfg.mintEnd;
        baseTokenURI = cfg.baseURI;
        collectionContractURI = cfg.contractURI;
        creatorPayout = cfg.creatorPayout;
        platformTreasury = treasury;
        platformFeeBps = feeBps;
        publicMintEnabled = cfg.publicMintEnabled;

        if (cfg.royaltyBps > 0) {
            _setDefaultRoyalty(cfg.royaltyRecipient == address(0) ? cfg.creatorPayout : cfg.royaltyRecipient, cfg.royaltyBps);
        }
    }

    function mint(uint256 quantity) external payable nonReentrant whenNotPaused {
        if (!publicMintEnabled) revert MintClosed();
        if (block.timestamp < mintStart) revert MintNotStarted();
        if (mintEnd != 0 && block.timestamp > mintEnd) revert MintEnded();
        if (quantity == 0) revert BadQuantity();
        if (maxMintPerTransaction != 0 && quantity > maxMintPerTransaction) revert TxLimitExceeded();
        if (totalMinted + quantity > maxSupply) revert MaxSupplyExceeded();
        if (maxMintPerWallet != 0 && mintedByWallet[msg.sender] + quantity > maxMintPerWallet) revert WalletLimitExceeded();
        if (msg.value != mintPrice * quantity) revert IncorrectPayment();

        mintedByWallet[msg.sender] += quantity;

        uint256 platformAmount = (msg.value * platformFeeBps) / 10_000;
        uint256 creatorAmount = msg.value - platformAmount;
        creatorAccrued += creatorAmount;
        platformAccrued += platformAmount;

        for (uint256 i = 0; i < quantity; i++) {
            unchecked {
                totalMinted += 1;
            }
            _safeMint(msg.sender, totalMinted);
        }

        emit RevenueAccrued(creatorAmount, platformAmount);
        emit Minted(msg.sender, quantity, msg.value);
    }

    function withdrawCreator() external nonReentrant {
        uint256 amount = creatorAccrued;
        creatorAccrued = 0;
        (bool ok,) = payable(creatorPayout).call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit CreatorWithdrawal(creatorPayout, amount);
    }

    function withdrawPlatform() external nonReentrant {
        uint256 amount = platformAccrued;
        platformAccrued = 0;
        (bool ok,) = payable(platformTreasury).call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit PlatformWithdrawal(platformTreasury, amount);
    }

    function setPublicMintEnabled(bool enabled) external onlyOwner {
        publicMintEnabled = enabled;
        emit PublicMintUpdated(enabled);
    }

    function setMintPrice(uint256 nextPrice) external onlyOwner {
        mintPrice = nextPrice;
        emit MintPriceUpdated(nextPrice);
    }

    function setMintWindow(uint64 start, uint64 end) external onlyOwner {
        mintStart = start;
        mintEnd = end;
        emit MintWindowUpdated(start, end);
    }

    function setMetadata(string calldata nextBaseURI, string calldata nextContractURI) external onlyOwner {
        baseTokenURI = nextBaseURI;
        collectionContractURI = nextContractURI;
        emit MetadataUpdated(nextBaseURI, nextContractURI);
    }

    function setRoyalty(address recipient, uint96 royaltyBps) external onlyOwner {
        _setDefaultRoyalty(recipient, royaltyBps);
        emit RoyaltyUpdated(recipient, royaltyBps);
    }

    function pauseMinting() external onlyOwner {
        _pause();
    }

    function unpauseMinting() external onlyOwner {
        _unpause();
    }

    function contractURI() external view returns (string memory) {
        return collectionContractURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(baseTokenURI, tokenId.toString(), ".json");
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Royalty) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

