pragma solidity 0.8.9;

import "../interfaces/compound/CErc20.sol";
import "../interfaces/IPOR/IStrategy.sol";
import "../interfaces/compound/ComptrollerInterface.sol";
import "../interfaces/IPOR/IStrategy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "../../security/IporOwnableUpgradeable.sol";

import "hardhat/console.sol";
import "../../IporErrors.sol";
import "../../libraries/IporMath.sol";

contract CompoundStrategy is UUPSUpgradeable, IporOwnableUpgradeable, IStrategy {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address private _asset;
    CErc20 private _cToken;
    uint256 private _blocksPerYear;
    address private _claimAddress;

    ComptrollerInterface private _comptroller;
    IERC20Upgradeable private _compToken;

    address private _stanley;

    /**
     * @dev Deploy CompoundStrategy.
     * @notice Deploy CompoundStrategy.
     * @param asset underlying token like DAI, USDT etc.
     * @param cErc20Contract share token like cDAI
     * @param comptroller _comptroller to claim comp
     * @param compToken comp token.
     */
    function initialize(
        address asset,
        address cErc20Contract,
        address comptroller,
        address compToken,
        address claimAddress
    ) public initializer {
        __Ownable_init();
        require(claimAddress != address(0), IporErrors.WRONG_ADDRESS);
        _asset = asset;
        _cToken = CErc20(cErc20Contract);
        _comptroller = ComptrollerInterface(comptroller);
        _compToken = IERC20Upgradeable(compToken);
        IERC20Upgradeable(_asset).safeApprove(cErc20Contract, type(uint256).max);
        _blocksPerYear = 2102400;
        _claimAddress = claimAddress;
    }

    modifier onlyStanley() {
        require(msg.sender == _stanley, IporErrors.CALLER_NOT_STANLEY);
        _;
    }

    /**
     * @dev _asset return
     */
    function getAsset() public view override returns (address) {
        return _asset;
    }

    /**
     * @dev Share token to track _asset (DAI -> cDAI)
     */
    function getShareToken() external view override returns (address) {
        return address(_cToken);
    }

    /**
     * @dev get current APY.
     */
    function getApy() external view override returns (uint256 apr) {
        uint256 cRate = _cToken.supplyRatePerBlock(); // interest % per block
        apr = (cRate * _blocksPerYear) * 100;
    }

    /**
     * @dev Total Balance = Principal Amount + Interest Amount.
     * returns uint256 with 18 Decimals
     */
    function balanceOf() public view override returns (uint256) {
        return (
            IporMath.division(
                (_cToken.exchangeRateStored() * _cToken.balanceOf(address(this))),
                (10**ERC20Upgradeable(_asset).decimals())
            )
        );
    }

    /**
     * @dev Deposit into compound lending.
     * @notice deposit can only done by owner.
     * @param amount amount to deposit in compound lending.
     */
    function deposit(uint256 amount) external override onlyStanley {
        IERC20Upgradeable(_asset).safeTransferFrom(msg.sender, address(this), amount);
        _cToken.mint(amount);
    }

    /**
     * @dev withdraw from compound lending.
     * @notice withdraw can only done by owner.
     * @param amount amount to withdraw from compound lending.
     */
    function withdraw(uint256 amount) external override onlyStanley {
        _cToken.redeem(IporMath.division(amount * 1e18, _cToken.exchangeRateStored()));
        IERC20Upgradeable(address(_asset)).safeTransfer(
            msg.sender,
            IERC20Upgradeable(_asset).balanceOf(address(this))
        );
    }

    /**
     * @dev beforeClaim is not needed to implement
     */
    function beforeClaim(address[] memory assets, uint256 amount) public {
        // No implementation
    }

    /**
     * @dev Claim extra reward of Governace token(COMP).
     * @notice claim can only done by owner.
     */
    function doClaim() external override {
        address[] memory assets = new address[](1);
        assets[0] = address(_cToken);
        _comptroller.claimComp(address(this), assets);
        uint256 compBal = _compToken.balanceOf(address(this));
        _compToken.safeTransfer(_claimAddress, compBal);
        emit DoClaim(address(this), assets, _claimAddress, compBal);
    }

    function setStanley(address stanley) external onlyOwner {
        _stanley = stanley;
        emit SetStanley(msg.sender, stanley, address(this));
    }

    /**
     * @dev set blocks per year.
     * @param blocksPerYear amount to deposit in aave lending.
     */
    function setBlocksPerYear(uint256 blocksPerYear) external onlyOwner {
        require(blocksPerYear != 0, IporErrors.UINT_SHOULD_BE_GRATER_THEN_ZERO);
        _blocksPerYear = blocksPerYear;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
