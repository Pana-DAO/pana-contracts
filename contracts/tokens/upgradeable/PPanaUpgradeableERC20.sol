// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

contract PPanaUpgradeableERC20 is Initializable, ERC20Upgradeable, OwnableUpgradeable, ERC20BurnableUpgradeable {

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    using SafeMathUpgradeable for uint256;

    bool public requireSellerApproval;

    mapping( address => bool ) public isApprovedSeller;

    function initialize(address _Panaadmin) initializer public {
        requireSellerApproval = true;
        _addApprovedSeller( address(this) );
        _addApprovedSeller( _Panaadmin );
        _addApprovedSeller(address(0x0000));
        __ERC20_init("pPana", "pPANA");
        __ERC20Burnable_init();
        __Ownable_init();

        _mint(_Panaadmin, 1000000000 * 1e18);
        transferOwnership(_Panaadmin);
    }

    function allowOpenTrading() external onlyOwner() returns ( bool ) {
        requireSellerApproval = false;
        return requireSellerApproval;
    }

    function _addApprovedSeller( address approvedSeller_ ) internal {
        isApprovedSeller[approvedSeller_] = true;
    }

    function addApprovedSeller( address approvedSeller_ ) external onlyOwner() returns ( bool ) {
        _addApprovedSeller( approvedSeller_ );
        return isApprovedSeller[approvedSeller_];
    }

    function addApprovedSellers( address[] calldata approvedSellers_ ) external onlyOwner() returns ( bool ) {

        for( uint256 iteration_; approvedSellers_.length > iteration_; iteration_++ ) {
            _addApprovedSeller( approvedSellers_[iteration_] );
        }
        return true;
    }

    function _removeApprovedSeller( address disapprovedSeller_ ) internal {
        isApprovedSeller[disapprovedSeller_] = false;
    }

    function removeApprovedSeller( address disapprovedSeller_ ) external onlyOwner() returns ( bool ) {
        _removeApprovedSeller( disapprovedSeller_ );
        return isApprovedSeller[disapprovedSeller_];
    }

    function removeApprovedSellers( address[] calldata disapprovedSellers_ ) external onlyOwner() returns ( bool ) {

        for( uint256 iteration_; disapprovedSellers_.length > iteration_; iteration_++ ) {
            _removeApprovedSeller( disapprovedSellers_[iteration_] );
        }
        return true;
    }

    function _beforeTokenTransfer(address from_, address to_, uint256 amount_) internal view override {
        require( (balanceOf(to_) > 0 || isApprovedSeller[from_] == true || !requireSellerApproval), 
            "Account not approved to transfer pPANA." );
    }

}