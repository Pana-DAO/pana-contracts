// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.4;

import "../libraries/SafeERC20.sol";
import "../interfaces/IpPana.sol";
import "../interfaces/IPana.sol";
import "../interfaces/ITreasury.sol";

contract PPanaRedeem {
    using SafeERC20 for IERC20;
    using SafeERC20 for IPana;

    event Exercised(address user, uint256 amount);

    address public owner;
    address public newOwner;

    // Addresses
    IPana internal immutable PANA; // the base token
    IpPana internal immutable pPANA; // pPANA token
    ITreasury internal immutable treasury; // the purchaser of quote tokens

    address internal immutable DAI;
    address internal immutable dao; 

    struct Term {
        uint percent; // 6 decimals (500000 = 0.5%)  eg: If person X has 4% of teams total allocation(7.8%), then this would be = 0.00312 * 1e6 = 3120
        uint max;     // In pPana (with 1e18 decimal) eg: pPana team supply = 300 Million. If person X has 4% of teams total allocation, then this would be = 12 Million * 1e18
        uint256 lockDuration; // In seconds. For 5 days it would be 5*24*60*60= 432000
        uint exercised; // In pPana (with 1e18 decimal)
        uint locked; // In pana (with 1e18 decimal)
        uint lockExpiry; // end of warmup period
        bool active;
    }
    mapping(address => Term) public terms;

    mapping(address => address) public walletChange;

    constructor(address _pPANA, address _PANA, address _dai, address _treasury, address _dao) {
        require(_dao != address(0), "Zero address: DAO");
        dao = _dao;
        owner = _dao;
        require(_pPANA != address(0), "Zero address: pPANA");
        pPANA = IpPana(_pPANA);
        require(_PANA != address(0), "Zero address: PANA");
        PANA = IPana(_PANA);
        require(_dai != address(0), "Zero address: DAI");
        DAI = _dai;
        require(_treasury != address(0), "Zero address: Treasury");
        treasury = ITreasury(_treasury);      
    }

    // Sets terms for a new wallet
    function setTerms(address _vester, uint _amountCanClaim, uint _rate, uint _lockDuration) external {
        require(msg.sender == owner, "Sender is not owner");     
        require(_amountCanClaim >= terms[_vester].max, "Cannot lower amount claimable");
        require(_rate >= terms[_vester].percent, "Cannot lower vesting rate");

        terms[_vester].max = _amountCanClaim;
        terms[_vester].percent = _rate;
        terms[_vester].lockDuration = _lockDuration;
        terms[_vester].active = true;
    }

    // Allows wallet to redeem pPana for Pana
    function exercise(uint _amount) external {
        Term memory info = terms[msg.sender];
        require(info.active == true, "Account not setup for pPana redemption");
        require(redeemableFor(msg.sender) >= _amount, "Not enough vested");
        require(info.locked == 0, "Account has locked or unclaimed pana");
        require(info.max - info.exercised >= _amount, "Exercised over max");

        terms[msg.sender].lockExpiry = block.timestamp + info.lockDuration;
        terms[msg.sender].exercised = info.exercised + _amount;

        IERC20(DAI).safeTransferFrom(msg.sender, address(this), _amount);
        pPANA.burnFrom(msg.sender, _amount);

        IERC20(DAI).approve(address(treasury), _amount);
        uint panaRedeemed = treasury.depositForRedemption(_amount, DAI);

        terms[msg.sender].locked = panaRedeemed;

        emit Exercised(msg.sender, _amount);
    }

    // Allow wallet owner to claim Pana after the lock duration is over
    function claimRedeemable() external returns (uint256) {
        Term memory info = terms[msg.sender];
        require(info.locked > 0, "Account does not have locked or unclaimed pana");
        require(block.timestamp >= info.lockExpiry, "Pana is in lock period");
        
        uint panaRedeemed = info.locked;
        terms[msg.sender].locked = 0;
        terms[msg.sender].lockExpiry = 0;

        PANA.safeTransfer(msg.sender, panaRedeemed); 

        return panaRedeemed;
    }

    // Allows wallet owner to transfer rights to a new address
    function pushWalletChange(address _newWallet) external {
        require(terms[msg.sender].percent != 0, "Cannot transfer empty wallet");
        walletChange[msg.sender] = _newWallet;
    }

    // Allows wallet to pull rights from an old address
    function pullWalletChange(address _oldWallet) external returns (bool) {
        require(walletChange[_oldWallet] == msg.sender, "Sender is not owner");

        walletChange[_oldWallet] = address(0);
        terms[msg.sender] = terms[_oldWallet];
        delete terms[_oldWallet];

        return true;
    }

     // Amount a wallet can redeem based on current supply
    function redeemableFor(address _vester) public view returns (uint) {
        Term memory info = terms[_vester];
        require(info.active == true, "Account not setup as pPana redemption");
        uint256 pPanaBalance = pPANA.balanceOf(_vester);

        if (pPanaBalance > 0) {
            uint256 redeemableBalance = supplyBasedRedeemable(terms[_vester]);
            if(redeemableBalance > pPanaBalance) 
                return pPanaBalance;
            else
                return redeemableBalance;
        }

        return pPanaBalance;
    }

    function supplyBasedRedeemable(Term memory _info) internal view returns (uint) { // returns interms of pPana
        return (circulatingSupply() * _info.percent / 1e8) - _info.exercised; //(6 digits for Term.percent + 2 digits for pana to pPana conversion)
    }

    function circulatingSupply() public view returns (uint256) {
        return treasury.baseSupply() - PANA.balanceOf(dao);
    } 

    function pushOwnership(address _newOwner) external{
        require(msg.sender == owner, "Sender is not owner");
        require(_newOwner != address(0), "Zero address: New owner");
        newOwner = _newOwner;
    }

    function pullOwnership() external {
        require(msg.sender == newOwner, "Sender is not owner");
        owner = newOwner;
        newOwner = address(0);
    }
}