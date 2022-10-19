// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.10;

import "./BaseSupplyController.sol";

contract PanaSupplyController is BaseSupplyController {

    constructor(
        address _PANA,
        address _pair, 
        address _router, 
        address _supplyControlCaller,
        address _authority
    ) BaseSupplyController(_PANA, _pair, _router, _supplyControlCaller, _authority) {

    }

function computePana(uint256 _targetSupply, uint256 _panaInPool, uint256 _dt) internal override pure returns (int256) {
        return int256(_targetSupply) - int256(_panaInPool);
    }
}