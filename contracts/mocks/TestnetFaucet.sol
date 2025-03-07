// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../security/IporOwnableUpgradeable.sol";
import "../libraries/errors/MocksErrors.sol";
import "../interfaces/ITestnetFaucet.sol";

contract TestnetFaucet is
    Initializable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IporOwnableUpgradeable,
    ITestnetFaucet
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint256 private constant _SECONDS_IN_DAY = 60 * 60 * 24;

    mapping(address => uint256) internal _lastClaim;
    /// @dev  need to stay because of proxy compatibility
    /// @dev deprecated
    address internal _dai;
    /// @dev  need to stay because of proxy compatibility
    /// @dev deprecated
    address internal _usdc;
    /// @dev  need to stay because of proxy compatibility
    /// @dev deprecated
    address internal _usdt;

    address[] internal _assets;
    mapping(address => uint256) internal _amountToTransfer;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address dai,
        address usdc,
        address usdt,
        address ipor
    ) public initializer {
        __Ownable_init_unchained();
        __UUPSUpgradeable_init_unchained();

        require(dai != address(0), IporErrors.WRONG_ADDRESS);
        require(usdc != address(0), IporErrors.WRONG_ADDRESS);
        require(usdt != address(0), IporErrors.WRONG_ADDRESS);
        require(ipor != address(0), IporErrors.WRONG_ADDRESS);

        _assets.push(dai);
        _amountToTransfer[dai] = 10_000 * 10**uint256(IERC20MetadataUpgradeable(dai).decimals());

        _assets.push(usdt);
        _amountToTransfer[usdt] = 10_000 * 10**uint256(IERC20MetadataUpgradeable(usdt).decimals());

        _assets.push(usdc);
        _amountToTransfer[usdc] = 10_000 * 10**uint256(IERC20MetadataUpgradeable(usdc).decimals());

        _assets.push(ipor);
        _amountToTransfer[ipor] = 1_000 * 10**uint256(IERC20MetadataUpgradeable(ipor).decimals());
    }

    //solhint-disable no-empty-blocks
    fallback() external payable {}

    //solhint-disable no-empty-blocks
    receive() external payable {}

    function getVersion() external pure virtual returns (uint256) {
        return 2;
    }

    function claim() external override nonReentrant {
        uint256 secondsToNextClaim = _couldClaimInSeconds();
        require(
            secondsToNextClaim == 0,
            string(
                abi.encodePacked(
                    MocksErrors.CAN_CLAIM_ONCE_EVERY_24H,
                    ": ",
                    Strings.toString(secondsToNextClaim)
                )
            )
        );
        uint256 lengthAssets = _assets.length;
        for (uint256 i; i < lengthAssets; ++i) {
            _transfer(_assets[i]);
        }
        _lastClaim[_msgSender()] = block.timestamp;
    }

    function transfer(address asset, uint256 amount) external onlyOwner {
        require(asset != address(0), IporErrors.WRONG_ADDRESS);
        require(amount > 0, IporErrors.VALUE_NOT_GREATER_THAN_ZERO);

        IERC20Upgradeable token = IERC20Upgradeable(asset);
        uint256 maxValue = token.balanceOf(address(this));
        require(amount <= maxValue, IporErrors.NOT_ENOUGH_AMOUNT_TO_TRANSFER);
        IERC20Upgradeable(asset).safeTransfer(_msgSender(), amount);
        emit Claim(_msgSender(), asset, amount);
    }

    function transferEth(address payable recipient, uint256 value) external payable onlyOwner {
        recipient.transfer(value);
    }

    function balanceOfEth() external view returns (uint256) {
        return address(this).balance;
    }

    function couldClaimInSeconds() external view override returns (uint256) {
        return _couldClaimInSeconds();
    }

    function hasClaimBefore() external view override returns (bool) {
        return _lastClaim[_msgSender()] != 0;
    }

    function balanceOf(address asset) external view override returns (uint256) {
        return IERC20Upgradeable(asset).balanceOf(address(this));
    }

    function addAsset(address asset, uint256 amount) external override onlyOwner {
        require(asset != address(0), IporErrors.WRONG_ADDRESS);
        uint256 assetsLength = _assets.length;
        for (uint256 i; i < assetsLength; ++i) {
            if (_assets[i] == asset) {
                _amountToTransfer[asset] = amount;
                return;
            }
        }
        _assets.push(asset);
        _amountToTransfer[asset] = amount;
    }

    function updateAmountToTransfer(address asset, uint256 amount) external override onlyOwner {
        _amountToTransfer[asset] = amount;
    }

    function getAmountToTransfer(address asset) external view override returns (uint256) {
        return _amountToTransfer[asset];
    }

    function _transfer(address asset) internal {
        uint256 amountToTransfer = _amountToTransfer[asset];
        uint256 balanceOfFaucet = IERC20Upgradeable(asset).balanceOf(address(this));
        if (amountToTransfer == 0) {
            return;
        }
        if (balanceOfFaucet < amountToTransfer) {
            emit TransferFailed(_msgSender(), address(asset), amountToTransfer);
            return;
        }
        IERC20Upgradeable(asset).safeTransfer(_msgSender(), amountToTransfer);
        emit Claim(_msgSender(), asset, amountToTransfer);
    }

    function _couldClaimInSeconds() internal view returns (uint256) {
        uint256 lastDraw = _lastClaim[_msgSender()];
        uint256 blockTimestamp = block.timestamp;
        if (blockTimestamp - lastDraw > _SECONDS_IN_DAY) {
            return 0;
        }
        return _SECONDS_IN_DAY - (blockTimestamp - lastDraw);
    }

    //solhint-disable no-empty-blocks
    function _authorizeUpgrade(address) internal override onlyOwner {} //solhint-disable no-empty-blocks
}
