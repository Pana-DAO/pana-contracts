/**
   * @notice 
    This supply controller is intended to return amount of Pana neeeded to be added/removed 
    to/from the liquidity pool to match the target pana supply in pool at any given point in time
    during the control regime. The treasury then calls the burn and add operations from this 
    contract to perform the Burn/Supply as determined to maintain the target supply in pool

    CAUTION: Since the control mechanism is based on a percentage and Pana is an 18 decimal token,
    any supply of Pana less or equal to 10^^-17 will lead to underflow
**/   
// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.10;

import "../libraries/SafeERC20.sol";
import "../interfaces/IERC20Metadata.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IPana.sol";
import "../interfaces/ISupplyContoller.sol";
import "../interfaces/IUniswapV2ERC20.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Router02.sol";
import "../access/PanaAccessControlled.sol";

contract PanaSupplyController is ISupplyContoller, PanaAccessControlled {

    using SafeERC20 for IERC20;            
    
    address public pair; // The LP pair for which this controller will be used
    address public router; // The address of the UniswapV2Router02 router contract for the given pair
    address public supplyControlCaller; // The address of the contract that is responsible for invoking control

    bool public override supplyControlEnabled; // Switch to start/stop supply control at anytime
    bool public override paramsSet; // Flag that indicates whether the params were set for current control regime

    // Loss Ratio, calculated as lossRatio = deltaPS/deltaTS.
    // Where deltaPS = Target Pana Supply in Pool - Current Pana Supply in Pool
    // deltaTS = Increase in total Pana supply
    // Percentage specified to 4 precision digits. 2250 = 22.50% = 0.2250
    uint256 public lossRatio;

    // cf = Channel floor
    // tlr = Target loss ratio
    // Control should take action only when Pana supply in pool at a point falls such that lossRatio < tlr - cf
    // Percentage specified to 4 precision digits. 100 = 1% = 0.01
    uint256 public cf;

    // cc = Channel Ceiling
    // tlr = Target loss ratio
    // Control should take action only when Pana supply in pool at a point grows such that lossRatio > tlr + cc
    // Percentage specified to 4 precision digits. 100 = 1% = 0.01
    uint256 public cc;

    // Maximum SLPs that the current control regime is allowed burn    
    uint256 public mslp;
    uint256 public cslp; // Count of SLPs burnt by current control regime

    uint256 public lastTotalSupply; // Pana Total Supply when previous control triggered
    uint256 public lastPanaInPool; // Pana supply in pool when previous control triggered

    IERC20 internal immutable PANA;
    IERC20 internal immutable TOKEN;

    constructor(
        address _PANA,
        address _pair, 
        address _router, 
        address _supplyControlCaller,
        address _authority
    ) PanaAccessControlled(IPanaAuthority(_authority)){
        require(_PANA != address(0), "Zero address: PANA");
        require(_pair != address(0), "Zero address: PAIR");
        require(_router != address(0), "Zero address: ROUTER");
        require(_supplyControlCaller != address(0), "Zero address: CALLER");
        require(_authority != address(0), "Zero address: AUTHORITY");

        PANA = IERC20(_PANA);
        TOKEN = (IUniswapV2Pair(_pair).token0() == address(PANA)) ?  
                    IERC20(IUniswapV2Pair(_pair).token1()) : 
                        IERC20(IUniswapV2Pair(_pair).token0());
        pair = _pair;
        router = _router;
        supplyControlCaller = _supplyControlCaller;
        paramsSet = false;
    }

    modifier supplyControlCallerOnly() {
        require(msg.sender == supplyControlCaller ||
                msg.sender == authority.policy(), 
                "CONTROL: Only invokable by policy or a contract authorized as caller");
        _;
    }

    function setSupplyControlParams(uint256 _lossRatio, uint256 _cf, uint256 _cc, uint256 _mslp) 
    external onlyGovernor {
        uint256 old_lossRatio = paramsSet ? lossRatio : 0;
        uint256 old_cf = paramsSet ? cf : 0;
        uint256 old_cc = paramsSet ? cc : 0;
        uint256 old_mslp = paramsSet ? mslp : 0;

        lossRatio = _lossRatio;
        cf = _cf;
        cc = _cc;
        mslp = _mslp;
        cslp = 0;

        setPrevControlPoint();
        paramsSet = true;

        emit SetSupplyControlParams(PANA.totalSupply(), old_lossRatio, old_cf,
                                         old_cc, old_mslp, lossRatio, cf, cc, mslp);
    }

    function enableSupplyControl() external override onlyGovernor {
        require(supplyControlEnabled == false, "CONTROL: Control already in progress");
        require(paramsSet == true, "CONTROL: Control parameters are not set, please set control parameters");
        supplyControlEnabled = true;
    }

    function disableSupplyControl() external override onlyGovernor {
        require(supplyControlEnabled == true, "CONTROL: No control in progress");
        supplyControlEnabled = false;
        paramsSet = false; // Control Params should be set for new control regime whenever it is started
    }

    function getPanaReserves() internal view returns(uint256 _reserve) {
        (uint256 _reserve0, uint256 _reserve1, ) = IUniswapV2Pair(pair).getReserves();
        _reserve = (IUniswapV2Pair(pair).token0() == address(PANA)) ? _reserve0 : _reserve1;
    }

    // Returns the target pana supply in pool to be achieved at a given totalSupply point
    function getTargetSupply() public view returns (uint256 _targetPanaSupply) {
        uint256 _totalSupply = PANA.totalSupply();
        _targetPanaSupply = lastPanaInPool + ((lossRatio * (_totalSupply - lastTotalSupply)) / (10**4));
    }

    // Returns the pana supply floor for the pool at a given totalSupply point
    function getSupplyFloor() public view returns (uint256 _panaSupplyFloor) {
        uint256 _totalSupply = PANA.totalSupply();
        _panaSupplyFloor = lastPanaInPool + (((lossRatio - cf) * (_totalSupply - lastTotalSupply)) / (10**4));
    }

    // Returns the pana supply ceiling for the pool at a given totalSupply point
    function getSupplyCeiling() public view returns (uint256 _panaSupplyCeiling) {
        uint256 _totalSupply = PANA.totalSupply();
        _panaSupplyCeiling = lastPanaInPool + (((lossRatio + cc) * (_totalSupply - lastTotalSupply)) / (10**4));
    }

    /**
     * @notice returns the amounts of tokens to be expended for supply control
     * @return _pana uint256 - returns amount of Pana to be added in case of add. 0 in case of burn.
     * @return _slp uint256 - returns amount of SLPs to be burnt in case of burn. 0 in case of add.
     * @return _burn bool - boolean indicating burn/add
    */
    function getSupplyControlAmount() external view 
    override returns (uint256 _pana, uint256 _slp, bool _burn) {
        require(paramsSet == true, "CONTROL: Control parameters are not set, please set control parameters");

        (_pana, _slp, _burn) = (0, 0, false);

        if (supplyControlEnabled && cslp < mslp) {
            uint256 _panaInPool = getPanaReserves();
            uint256 _ts = getTargetSupply();
            uint256 _channelFloor = getSupplyFloor();
            uint256 _channelCeiling = getSupplyCeiling();

            if ((_panaInPool < _channelFloor || _panaInPool > _channelCeiling)) {
                _burn = _panaInPool > _ts;

                if (_burn) {
                    _pana = _panaInPool - _ts;
                    // Burn SLPs containing 1/2 the Pana needed to be burnt. 
                    // Other half will be be burnt through swap
                    _slp = (_pana * IUniswapV2Pair(pair).totalSupply()) / (2 * _panaInPool);

                    // Burn upto max if max SLP is being breached
                    if (((cslp + _slp) > mslp)) {
                        _slp = mslp - cslp;
                    }
                 } else {
                    _pana = _ts - _panaInPool;
                    _slp = 0;
                }
            }
        }
    }

    function setPrevControlPoint() internal {
        lastTotalSupply = PANA.totalSupply();
        lastPanaInPool = getPanaReserves();
    }

    /**
     * @notice burns Pana from the pool using SLP
     * @param _pana uint256 - amount of pana to burn
     * @param _slp uint256 - amount of slp to burn
    */
    function burn(uint256 _pana, uint256 _slp) external override supplyControlCallerOnly {
        
        IUniswapV2Pair(pair).approve(router, _slp);

        // Half the amount of Pana to burn comes out alongwith the other half in the form of token
        (uint _panaOut, uint _tokenOut) = 
            IUniswapV2Router02(router).removeLiquidity(
                address(PANA),
                address(TOKEN),
                _slp,
                0,
                0,
                address(this),
                type(uint256).max
            );

        cslp = cslp + _slp;

        TOKEN.approve(router, _tokenOut);

        address[] memory _path = new address[](2);
        _path[0] = address(TOKEN);
        _path[1] = address(PANA);

        // Swap the token to remove the other half
        (uint[] memory _amounts) = IUniswapV2Router02(router).swapExactTokensForTokens(
            _tokenOut, 
            0, 
            _path,
            address(this), 
            type(uint256).max
        );

        setPrevControlPoint();

        // Residual amounts need to be transferred to treasury
        uint256 _panaResidue = _panaOut + _amounts[1];
        uint256 _tokenResidue = _tokenOut - _amounts[0];

        PANA.safeTransfer(msg.sender, _panaResidue);

        if (_tokenResidue > 0) {
            TOKEN.safeTransfer(msg.sender, _tokenResidue);
        }

        emit Burnt(PANA.totalSupply(), getPanaReserves(), _slp, _panaResidue, _tokenResidue);
    }

    /**
     * @notice adds Pana to the pool
     * @param _pana uint256 - amount of pana to add
    */
    function add(uint256 _pana) external override supplyControlCallerOnly {
        
        PANA.approve(router, _pana);

        address[] memory _path = new address[](2);
        _path[0] = address(PANA);
        _path[1] = address(TOKEN);

        // Pana gets added but token gets withdrawn
        (uint[] memory _amounts_1) = IUniswapV2Router02(router).swapExactTokensForTokens(
            _pana / 2, 
            0, 
            _path,
            address(this), 
            type(uint256).max
        );

        TOKEN.approve(router, _amounts_1[1]);

        uint256 _tokForAdd = _amounts_1[1];
        uint256 _panaForAdd = _pana - _amounts_1[0];

        PANA.approve(router, _panaForAdd);

        // Add the other half token amount back to the pool alongwith Pana
        (uint _panaAdded, uint _tokenAdded, uint _slp) = IUniswapV2Router02(router).addLiquidity(
            address(PANA),
            address(TOKEN),
            _panaForAdd,
            _tokForAdd,
            0,
            0,
            address(this),
            type(uint256).max
        );

        uint256 _netPanaAddedToPool = _amounts_1[0] + _panaAdded;

        // Residual amounts need to be transferred to treasury
        uint256 _panaResidue = _panaForAdd - _panaAdded;
        uint256 _tokenResidue = _tokForAdd - _tokenAdded;

        setPrevControlPoint();

        // Transfer SLP to treasury
        IUniswapV2Pair(pair).transfer(msg.sender, _slp);

        PANA.safeTransfer(msg.sender, _panaResidue);

        TOKEN.safeTransfer(msg.sender, _tokenResidue);

        emit Supplied(PANA.totalSupply(), getPanaReserves(), _slp, _netPanaAddedToPool, _panaResidue, _tokenResidue);
    }
}