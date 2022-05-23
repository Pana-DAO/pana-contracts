// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "../libraries/SafeERC20.sol";
import "../interfaces/IpPana.sol";
import "../interfaces/IPana.sol";
import "../interfaces/ITreasury.sol";

contract PPanaRedeem {
    using SafeMathUpgradeable for uint;
    using SafeERC20 for IERC20;
    using SafeERC20 for IPana;

    address public owner;
    address public newOwner;

    // Addresses
    IPana internal immutable PANA; // the base token
    IpPana internal immutable pPANA; // pPANA token
    ITreasury internal immutable treasury; // the purchaser of quote tokens

    address internal immutable DAI;
    address internal immutable dao; 

    struct Term {
        bool supplyBased;  // True if the redeemable is based on total supply.
        uint percent; // 6 decimals ( 500000 = 0.5% )  eg: If person X has 4% of teams total allocation(7.8%), then this would be = 0.00312 * 1e6 = 3120
        uint max;     // In pPana (with 1e18 decimal) eg: pPana team supply = 300 Million. If person X has 4% of teams total allocation, then this would be = 12 Million * 1e18
        uint256 lockDuration; // In seconds. For 5 days it would be 5*24*60*60= 432000
        uint exercised; // In pPana (with 1e18 decimal)
        uint locked; // In pana (with 1e18 decimal)
        uint lockExpiry; // end of warmup period
        bool active;
    }
    mapping( address => Term ) public terms;

    mapping( address => address ) public walletChange;

    constructor( address _pPANA, address _PANA, 
        address _dai, address _treasury, address _dao ) {
        owner = _dao;
        require( _pPANA != address(0) );
        pPANA = IpPana(_pPANA);
        require( _PANA != address(0) );
        PANA = IPana(_PANA);
        require( _dai != address(0) );
        DAI = _dai;
        require( _treasury != address(0) );
        treasury = ITreasury(_treasury);
        require( _dao != address(0) );
        dao = _dao;
    }

    // Sets terms for a new wallet
    function setTerms(address _vester, uint _amountCanClaim, uint _rate, uint _lockDuration ) external returns ( bool ) {
        require( msg.sender == owner, "Sender is not owner" );
        if(terms[ _vester ].active) {
            require( terms[ _vester ].supplyBased == true, "Vesting terms already set for this address" );
        }        
        require( _amountCanClaim >= terms[ _vester ].max, "cannot lower amount claimable" );
        require( _rate >= terms[ _vester ].percent, "cannot lower vesting rate" );

        terms[ _vester ].max = _amountCanClaim;
        terms[ _vester ].percent = _rate;
        terms[ _vester ].lockDuration = _lockDuration;
        terms[ _vester ].supplyBased = true;
        terms[ _vester ].active = true;

        return true;
    }

    // Sets terms for a new wallet
    function setLaunchParticipantTerms(address _vester, uint _lockDuration ) external returns ( bool ) {
        require( msg.sender == owner, "Sender is not owner" );
        if(terms[ _vester ].active) {
            require( terms[ _vester ].supplyBased == false, "Vesting terms already set for this address" );
        }

        terms[ _vester ].lockDuration = _lockDuration;
        terms[ _vester ].supplyBased = false;
        terms[ _vester ].active = true;
        return true;
    }

    // Allows wallet to redeem pPana for Pana
    function exercise( uint _amount ) external returns ( bool ) {
        Term memory info = terms[ msg.sender ];
        require( info.active == true, 'Account not setup for pPana redemption');
        require( redeemableFor( msg.sender ) >= _amount, 'Not enough vested' );
        require( info.locked == 0, 'Account has locked or unclaimed pana' );
        if(info.supplyBased) {
            require( info.max.sub( info.exercised ) >= _amount, 'Exercised over max' );
        }

        IERC20( DAI ).safeTransferFrom( msg.sender, address( this ), _amount );
        pPANA.burnFrom( msg.sender, _amount );

        IERC20( DAI ).approve( address(treasury), _amount );
        uint panaRedeemed = treasury.deposit( _amount, DAI, 0 );

        terms[ msg.sender ].lockExpiry = block.timestamp.add(info.lockDuration);
        terms[ msg.sender ].exercised = info.exercised.add( _amount );
        terms[ msg.sender ].locked = panaRedeemed;
        return true;
    }

    // Allow wallet owner to claim Pana after the lock duration is over
    function claimRedeemable() external returns (uint256) {
        Term memory info = terms[ msg.sender ];
        require( info.locked > 0 , 'Account does not have locked or unclaimed pana' );
        require( block.timestamp >= info.lockExpiry , 'Pana is in lock period' );
        
        uint panaRedeemed = info.locked;
        PANA.safeTransfer(msg.sender, panaRedeemed); 
        terms[ msg.sender ].locked = 0;
        terms[ msg.sender ].lockExpiry = 0;
        return panaRedeemed;
    }

    // Allows wallet owner to transfer rights to a new address
    function pushWalletChange( address _newWallet ) external returns ( bool ) {
        require( terms[ msg.sender ].percent != 0 );
        walletChange[ msg.sender ] = _newWallet;
        return true;
    }

    // Allows wallet to pull rights from an old address
    function pullWalletChange( address _oldWallet ) external returns ( bool ) {
        require( walletChange[ _oldWallet ] == msg.sender, "wallet did not push" );

        walletChange[ _oldWallet ] = address(0);
        terms[ msg.sender ] = terms[ _oldWallet ];
        delete terms[ _oldWallet ];

        return true;
    }

     // Amount a wallet can redeem based on current supply
    function redeemableFor( address _vester ) public view returns (uint) {
        Term memory info = terms[ _vester ];
        require( info.active == true, 'Account not setup as pPana redemption');
        uint256 pPanaBalance = pPANA.balanceOf(_vester);

        if(pPanaBalance > 0 && info.supplyBased) {
            uint256 redeemableBalance = supplyBasedRedeemable( terms[ _vester ]);
            if(redeemableBalance > pPanaBalance) 
                return pPanaBalance;
            else
                return redeemableBalance;
        }
        return pPanaBalance;
    }

    function supplyBasedRedeemable( Term memory _info ) internal view returns ( uint ) { // returns interms of pPana
        return ( circulatingSupply().mul( _info.percent ).div( 1e8 ) ) //(6 digits for Term.percent + 2 digits for pana to pPana conversion)
            .sub( _info.exercised );
    }

    function circulatingSupply() public view returns (uint256) {
        return treasury.baseSupply().sub(PANA.balanceOf(dao));
    } 

    function pushOwnership( address _newOwner ) external returns ( bool ) {
        require( msg.sender == owner, "Sender is not owner" );
        require( _newOwner != address(0) );
        newOwner = _newOwner;
        return true;
    }

    function pullOwnership() external returns ( bool ) {
        require( msg.sender == newOwner );
        owner = newOwner;
        newOwner = address(0);
        return true;
    }
}