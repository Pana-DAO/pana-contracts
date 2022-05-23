pragma solidity ^0.7.5;

import "./MockERC20.sol";
import "../libraries/SafeMath.sol";


contract MockKARSHA is MockERC20 {

      using SafeMath for uint256;


    uint256 public immutable index;

    constructor(uint256 _initIndex)
        MockERC20("KARSHA", "KARSHA", 18)
    {
        index = _initIndex;
    }

    function migrate(address _staking, address _sPANA) external {}

    function balanceFrom(uint256 _amount) public view returns (uint256) {
        return _amount.mul(index).div(10**decimals());
    }

    function balanceTo(uint256 _amount) public view returns (uint256) {
        return _amount.mul(10**decimals()).div(index);
    }
}