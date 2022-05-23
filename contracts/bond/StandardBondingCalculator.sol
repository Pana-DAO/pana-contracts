/**
  * @notice 
  * This bonding calculator is intended to return the final valuation of an LP token in terms 
  * of the token with higher number of decimals from the pair. It may produce unexpected results
  * if that is not what is desired. Eg: If valuation is desired in terms of Pana, 
  *  then the other token in the pair should have decimals less than or equal to Pana (i.e. 18)
  */   
// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.7.5;

import "../libraries/SafeMath.sol";
import "../libraries/FixedPoint.sol";
import "../libraries/SafeERC20.sol";

import "../interfaces/IERC20Metadata.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IBondingCalculator.sol";
import "../interfaces/IUniswapV2ERC20.sol";
import "../interfaces/IUniswapV2Pair.sol";

contract PanaBondingCalculator is IBondingCalculator {
    using FixedPoint for *;
    using SafeMath for uint256;

    IERC20 internal immutable PANA;

    constructor(address _PANA) {
        require(_PANA != address(0), "Zero address: PANA");
        PANA = IERC20(_PANA);
    }

    function getKValue(address _pair) public view returns (uint256 k_) {        
        (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(_pair).getReserves();
        k_ = reserve0.mul(reserve1);
    }

    function getTotalValue(address _pair, uint256 _baseValue) public view returns (uint256 _value) {
        _value = getKValue(_pair).mul(10**9).div(_baseValue).sqrrt().mul(2);
    }

    function valuation(address _pair, uint256 amount_, uint256 _baseValue) external view override returns (uint256 _value) {
        uint256 totalValue = getTotalValue(_pair, _baseValue);
        uint256 totalSupply = IUniswapV2Pair(_pair).totalSupply();

        uint256 numerator = totalValue.mul(amount_);

        // A multiplier to compensate for adjustments in the end
        uint256 m = 10;
        {
            uint256 token0 = IERC20Metadata(IUniswapV2Pair(_pair).token0()).decimals();
            uint256 token1 = IERC20Metadata(IUniswapV2Pair(_pair).token1()).decimals();
            uint256 pair = IERC20Metadata( _pair ).decimals();
            uint256 tokTotal = token0.add(token1);

            /*
             *  Total supply calculated in Sushi may have different decimals than 18,
             *  but is always represented as 18 decimal. So it is necessary to factor 
             *  this in for accurate calculations.
             */    
            uint256 totSupply = tokTotal.div(2);
            
            uint256 decimals;

            if(token0 > token1) {
                decimals = token0.sub(token1);
            } else {
                decimals = token1.sub(token0);
            }

            if(totSupply != pair) {
                decimals = decimals.sub(pair-totSupply);
            }

            numerator = numerator.mul(10**decimals).mul(_baseValue).div(10**9);

            /*
             *  3162277660168379331999 ~ sqrt(10) to be factored in when one 
             *  of the tokens in the pair has odd number of decimals
             */
            if(tokTotal % 2 != 0){

                if(numerator < (10**13)) {
                    // Avoids underflow for small numbers
                    numerator = numerator.mul(3162277660168379331999).div(10**22);
                } else {
                    // Avoids multiplication and fixed point fraction overflow
                    numerator = numerator.div(10**13).mul(3162277660168379331999).div(10**9);
                }
            }
            else {
                // Avoids fixed point fraction overflow for even decimal pairs
                numerator = numerator.div(10);
            }
        }

        _value = FixedPoint.fraction(numerator, totalSupply).decode112().mul(m);
    }
}