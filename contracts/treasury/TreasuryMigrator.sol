pragma solidity ^0.7.5;

import "../libraries/SafeMath.sol";
import "../libraries/SafeERC20.sol";

import "../interfaces/IERC20.sol";
import "../interfaces/IERC20Metadata.sol";
import "../interfaces/IPana.sol";
import "../interfaces/IsPana.sol";
import "../interfaces/IBondingCalculator.sol";
import "../interfaces/ITreasury.sol";
import "../interfaces/ISupplyContoller.sol";

import "../access/PanaAccessControlled.sol";

contract TreasuryMigrator is PanaAccessControlled {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== MIGRATION ========== */    
    event Migrated(address treasury);    

    /* ========== STATE VARIABLES ========== */
    
    ITreasury public immutable oldTreasury;
    ITreasury public newTreasury;

    constructor(       
        address _oldTreasury,
        address _authority
    ) PanaAccessControlled(IPanaAuthority(_authority)) {
        require(_oldTreasury != address(0), "Zero address: Treasury");
        oldTreasury = ITreasury(_oldTreasury);
    }

    function migrateContracts(
        address _newTreasury
    ) external onlyGovernor {     
        require(_newTreasury != address(0), "Zero address: Treasury");
        require(address(newTreasury) == address(0), "New Treasury already intialized");
        newTreasury = ITreasury(_newTreasury);
        emit Migrated(_newTreasury);
    }

    // call internal migrate token function
    function migrateToken(address token) external onlyGovernor {
        require(address(newTreasury) != address(0), "New Treasury not intialized"); 
        _migrateToken(token);
    }
    /**
     *   @notice Migrate token from old treasury to new treasury
     */
    function _migrateToken(address token) internal {         
        uint256 balance = IERC20(token).balanceOf(address(oldTreasury));
        oldTreasury.manage(token, balance);
        IERC20(token).safeTransfer(address(newTreasury), balance);
    }
}