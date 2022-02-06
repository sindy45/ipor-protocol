// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IIpToken.sol";
import {IporErrors} from "../IporErrors.sol";

contract IpToken is Ownable, IIpToken, ERC20 {
    using SafeERC20 for IERC20;

    address private immutable _underlyingAsset;
    uint8 private immutable _decimals;
    address private _joseph;

    modifier onlyJoseph() {
        require(msg.sender == _joseph, IporErrors.MILTON_CALLER_NOT_JOSEPH);
        _;
    }

    constructor(
        address underlyingAsset,
        string memory aTokenName,
        string memory aTokenSymbol
    ) ERC20(aTokenName, aTokenSymbol) {
        require(address(0) != underlyingAsset, IporErrors.WRONG_ADDRESS);
        _underlyingAsset = underlyingAsset;
        _decimals = 18;
        _joseph = msg.sender;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function setJoseph(address newJoseph) external onlyOwner {
        _joseph = newJoseph;
    }

    function mint(address account, uint256 amount)
        external
        override
        onlyJoseph
    {
        require(amount != 0, IporErrors.IP_TOKEN_MINT_AMOUNT_TOO_LOW);
        _mint(account, amount);
        emit Transfer(address(0), account, amount);
        emit Mint(account, amount);
    }

    function burn(
        address account,
        address receiverOfUnderlying,
        uint256 amount
    ) external override onlyJoseph {
        require(amount != 0, IporErrors.MILTON_IPOT_TOKEN_BURN_AMOUNT_TOO_LOW);
        _burn(account, amount);

        emit Transfer(account, address(0), amount);
        emit Burn(account, receiverOfUnderlying, amount);
    }

    function getUnderlyingAssetAddress()
        external
        view
        override
        returns (address)
    {
        return _underlyingAsset;
    }
}
