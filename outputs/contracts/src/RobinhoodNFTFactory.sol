// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {RobinhoodNFTCollection} from "./RobinhoodNFTCollection.sol";

contract RobinhoodNFTFactory is Ownable2Step, Pausable {
    error InvalidTreasury();
    error FeeTooHigh();
    error InvalidCreator();
    error InvalidSupply();

    uint96 public constant MAX_PLATFORM_FEE_BPS = 1_000;
    address public platformTreasury;
    uint96 public platformFeeBps;
    string public factoryVersion;

    address[] public collections;
    mapping(address collection => address creator) public creatorOf;

    event CollectionCreated(
        address indexed collection,
        address indexed creator,
        address indexed owner,
        string name,
        string symbol,
        uint256 maxSupply,
        uint256 mintPrice,
        string contractVersion
    );

    event PlatformTreasuryUpdated(address indexed treasury);
    event PlatformFeeUpdated(uint96 feeBps);

    constructor(address initialOwner, address treasury, uint96 feeBps, string memory version) Ownable(initialOwner) {
        if (treasury == address(0)) revert InvalidTreasury();
        if (feeBps > MAX_PLATFORM_FEE_BPS) revert FeeTooHigh();
        platformTreasury = treasury;
        platformFeeBps = feeBps;
        factoryVersion = version;
    }

    function createCollection(RobinhoodNFTCollection.CollectionConfig calldata cfg)
        external
        whenNotPaused
        returns (address collection)
    {
        if (cfg.creatorPayout == address(0)) revert InvalidCreator();
        if (cfg.maxSupply == 0) revert InvalidSupply();

        RobinhoodNFTCollection created = new RobinhoodNFTCollection(
            cfg,
            platformTreasury,
            platformFeeBps,
            msg.sender
        );

        collection = address(created);
        collections.push(collection);
        creatorOf[collection] = cfg.creatorPayout;

        emit CollectionCreated(
            collection,
            cfg.creatorPayout,
            msg.sender,
            cfg.name,
            cfg.symbol,
            cfg.maxSupply,
            cfg.mintPrice,
            factoryVersion
        );
    }

    function setPlatformTreasury(address treasury) external onlyOwner {
        if (treasury == address(0)) revert InvalidTreasury();
        platformTreasury = treasury;
        emit PlatformTreasuryUpdated(treasury);
    }

    function setPlatformFeeBps(uint96 feeBps) external onlyOwner {
        if (feeBps > MAX_PLATFORM_FEE_BPS) revert FeeTooHigh();
        platformFeeBps = feeBps;
        emit PlatformFeeUpdated(feeBps);
    }

    function pauseDeployments() external onlyOwner {
        _pause();
    }

    function unpauseDeployments() external onlyOwner {
        _unpause();
    }

    function totalCollections() external view returns (uint256) {
        return collections.length;
    }
}

