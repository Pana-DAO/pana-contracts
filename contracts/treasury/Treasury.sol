// SPDX-License-Identifier: AGPL-3.0
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

contract PanaTreasury is PanaAccessControlled, ITreasury {
    /* ========== DEPENDENCIES ========== */

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== EVENTS ========== */

    event Deposit(address indexed token, uint256 amount, uint256 value);
    event DepositForRedemption(address indexed token, uint256 amount, uint256 value);
    event Withdrawal(address indexed token, uint256 amount, uint256 value);
    event CreateDebt(address indexed debtor, address indexed token, uint256 amount, uint256 value);
    event RepayDebt(address indexed debtor, address indexed token, uint256 amount, uint256 value);
    event Managed(address indexed token, uint256 amount);
    event ReservesAudited(uint256 indexed totalReserves);
    event Minted(address indexed caller, address indexed recipient, uint256 amount);
    event PermissionQueued(STATUS indexed status, address queued);
    event Permissioned(address addr, STATUS indexed status, bool result);

    /* ========== DATA STRUCTURES ========== */

    enum STATUS {
        RESERVEDEPOSITOR,
        RESERVESPENDER,
        RESERVETOKEN,
        RESERVEMANAGER,
        LIQUIDITYDEPOSITOR,
        LIQUIDITYTOKEN,
        LIQUIDITYMANAGER,
        RESERVEDEBTOR,
        REWARDMANAGER,
        SPANA,
        PANADEBTOR,
        PANAREDEEMER
    }

    struct Queue {
        STATUS managing;
        address toPermit;
        address calculator;
        address supplyController;
        uint256 timelockEnd;
        bool nullify;
        bool executed;
    }

    /* ========== STATE VARIABLES ========== */

    IPana public immutable PANA;
    IsPana public sPANA;

    mapping(STATUS => address[]) public registry;
    mapping(STATUS => mapping(address => bool)) public permissions;
    mapping(address => address) public bondCalculator;
    mapping(address => address) public supplyController;

    mapping(address => uint256) public debtLimit;

    uint256 public totalReserves;
    uint256 public totalDebt;
    uint256 public panaDebt;

    Queue[] public permissionQueue;
    uint256 public immutable blocksNeededForQueue;

    bool public timelockEnabled;
    bool public initialized;

    uint256 public onChainGovernanceTimelock;

    // A base (intrinsic) value of PANA token.
    // Expressed in terms of X PANA per 1 token (i.e. 100.0 = 100 PANA per 1 DAI = 0.01 DAI per 1 PANA).
    // Base value specified to 9 precision digits (9 digits caps the base price of PANA to 1bln DAI at max)
    uint256 public baseValue;

    string internal notAccepted = "Treasury: not accepted";
    string internal notApproved = "Treasury: not approved";
    string internal invalidToken = "Treasury: invalid token";
    string internal insufficientReserves = "Treasury: insufficient reserves";

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _pana,
        uint256 _timelock,
        address _authority
    ) PanaAccessControlled(IPanaAuthority(_authority)) {
        require(_pana != address(0), "Zero address: PANA");
        PANA = IPana(_pana);

        timelockEnabled = false;
        initialized = false;
        blocksNeededForQueue = _timelock;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @notice allow approved address to deposit an asset for PANA
     * @param _amount uint256
     * @param _token address
     * @param _profit uint256
     * @return send_ uint256
     */
    function deposit(
        uint256 _amount,
        address _token,
        uint256 _profit
    ) external override returns (uint256 send_) {
        if (permissions[STATUS.RESERVETOKEN][_token]) {
            require(permissions[STATUS.RESERVEDEPOSITOR][msg.sender], notApproved);
        } else if (permissions[STATUS.LIQUIDITYTOKEN][_token]) {
            require(permissions[STATUS.LIQUIDITYDEPOSITOR][msg.sender], notApproved);
        } else {
            revert(invalidToken);
        }

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        uint256 value = tokenValue(_token, _amount);
        // mint PANA needed and store amount of rewards for distribution
        send_ = value.sub(_profit);
        PANA.mint(msg.sender, send_);

        totalReserves = totalReserves.add(value);

        emit Deposit(_token, _amount, value);

        if(permissions[STATUS.LIQUIDITYTOKEN][_token] 
            && supplyController[_token] != address(0)
                && ISupplyContoller(supplyController[_token]).supplyControlEnabled()
                    && ISupplyContoller(supplyController[_token]).paramsSet()) {
            (uint256 pana, uint256 slp, bool burn) = ISupplyContoller(supplyController[_token]).getSupplyControlAmount();

            if(pana > 0) {
                if(burn && (IERC20(_token).balanceOf(address(this)) >= slp)) {
                    // Burn PANA, send SLPs to supplyController
                    IERC20(_token).safeTransfer(supplyController[_token], slp);
                    ISupplyContoller(supplyController[_token]).burn(pana, slp);
                } else if(IERC20(PANA).balanceOf(address(this)) >= pana) {
                    // Add PANA, send PANA to supplyController
                    IERC20(PANA).safeTransfer(supplyController[_token], pana);
                    ISupplyContoller(supplyController[_token]).add(pana);
                }
            }
        }
    }

    /**
     * @notice allow approved address to deposit reserve token for available PANA. No new PANA is minted.
     * @param _amount uint256
     * @param _token address
     * @return send_ uint256
     */
    function depositForRedemption(uint _amount, address _token) external override returns (uint256 send_) {
        require(permissions[STATUS.RESERVETOKEN][_token], notAccepted);
        require(permissions[STATUS.PANAREDEEMER][msg.sender], notApproved);

        // redemption is always calculated as 1:100
        send_ = _amount.mul(1e11).mul(10**IERC20Metadata(address(PANA)).decimals()).div(10**9).div(10**IERC20Metadata(_token).decimals());
        require(send_ <= PANA.balanceOf(address(this)), "Not enough PANA reserves");
       
        // reserves increased according to the current intrinsic value
        totalReserves = totalReserves.add(tokenValue(_token, _amount));
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(PANA).safeTransfer(msg.sender, send_);

        emit DepositForRedemption(_token, _amount, send_);
    }

    /**
     * @notice allow approved address to burn PANA for reserves
     * @param _amount uint256
     * @param _token address
     */
    function withdraw(uint256 _amount, address _token) external override {
        require(permissions[STATUS.RESERVETOKEN][_token], notAccepted); // Only reserves can be used for redemptions
        require(permissions[STATUS.RESERVESPENDER][msg.sender], notApproved);

        uint256 value = tokenValue(_token, _amount);
        PANA.burnFrom(msg.sender, value);

        totalReserves = totalReserves.sub(value);

        IERC20(_token).safeTransfer(msg.sender, _amount);

        emit Withdrawal(_token, _amount, value);
    }

    /**
     * @notice allow approved address to withdraw assets
     * @param _token address
     * @param _amount uint256
     */
    function manage(address _token, uint256 _amount) external override {
        if (permissions[STATUS.LIQUIDITYTOKEN][_token]) {
            require(permissions[STATUS.LIQUIDITYMANAGER][msg.sender], notApproved);
        } else {
            require(permissions[STATUS.RESERVEMANAGER][msg.sender], notApproved);
        }
        if (permissions[STATUS.RESERVETOKEN][_token] || permissions[STATUS.LIQUIDITYTOKEN][_token]) {
            uint256 value = tokenValue(_token, _amount);
            require(value <= excessReserves(), insufficientReserves);
            totalReserves = totalReserves.sub(value);
        }
        IERC20(_token).safeTransfer(msg.sender, _amount);
        emit Managed(_token, _amount);
    }

    /**
     * @notice mint new PANA using excess reserves
     * @param _recipient address
     * @param _amount uint256
     */
    function mint(address _recipient, uint256 _amount) external override {
        require(permissions[STATUS.REWARDMANAGER][msg.sender], notApproved);
        updateReserves();
        require(_amount <= excessReserves(), insufficientReserves);
        PANA.mint(_recipient, _amount);
        emit Minted(msg.sender, _recipient, _amount);
    }

    /**
     * DEBT: The debt functions allow approved addresses to borrow treasury assets
     * or PANA from the treasury, using sPANA as collateral. This might allow an
     * sPANA holder to provide PANA liquidity without taking on the opportunity cost
     * of unstaking, or alter their backing without imposing risk onto the treasury.
     * Many of these use cases are yet to be defined, but they appear promising.
     * However, we urge the community to think critically and move slowly upon
     * proposals to acquire these permissions.
     */

    /**
     * @notice allow approved address to borrow reserves
     * @param _amount uint256
     * @param _token address
     */
    function incurDebt(uint256 _amount, address _token) external override {
        uint256 value;
        if (_token == address(PANA)) {
            require(permissions[STATUS.PANADEBTOR][msg.sender], notApproved);
            value = _amount;
        } else {
            require(permissions[STATUS.RESERVEDEBTOR][msg.sender], notApproved);
            require(permissions[STATUS.RESERVETOKEN][_token], notAccepted);
            value = tokenValue(_token, _amount);
        }
        require(value != 0, invalidToken);

        sPANA.changeDebt(value, msg.sender, true);
        require(sPANA.debtBalances(msg.sender) <= debtLimit[msg.sender], "Treasury: exceeds limit");
        totalDebt = totalDebt.add(value);

        if (_token == address(PANA)) {
            PANA.mint(msg.sender, value);
            panaDebt = panaDebt.add(value);
        } else {
            totalReserves = totalReserves.sub(value);
            IERC20(_token).safeTransfer(msg.sender, _amount);
        }
        emit CreateDebt(msg.sender, _token, _amount, value);
    }

    /**
     * @notice allow approved address to repay borrowed reserves with reserves
     * @param _amount uint256
     * @param _token address
     */
    function repayDebtWithReserve(uint256 _amount, address _token) external override {
        require(permissions[STATUS.RESERVEDEBTOR][msg.sender], notApproved);
        require(permissions[STATUS.RESERVETOKEN][_token], notAccepted);
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 value = tokenValue(_token, _amount);
        sPANA.changeDebt(value, msg.sender, false);
        totalDebt = totalDebt.sub(value);
        totalReserves = totalReserves.add(value);
        emit RepayDebt(msg.sender, _token, _amount, value);
    }

    /**
     * @notice allow approved address to repay borrowed reserves with PANA
     * @param _amount uint256
     */
    function repayDebtWithPANA(uint256 _amount) external {
        require(permissions[STATUS.RESERVEDEBTOR][msg.sender] || permissions[STATUS.PANADEBTOR][msg.sender], notApproved);
        PANA.burnFrom(msg.sender, _amount);
        sPANA.changeDebt(_amount, msg.sender, false);
        totalDebt = totalDebt.sub(_amount);
        panaDebt = panaDebt.sub(_amount);
        emit RepayDebt(msg.sender, address(PANA), _amount, _amount);
    }

    /* ========== MANAGERIAL FUNCTIONS ========== */

    /**
     * @notice takes inventory of all tracked assets
     * @notice always consolidate to recognized reserves before audit
     */
    function auditReserves() external onlyGovernor {
        uint256 reserves;
        address[] memory reserveToken = registry[STATUS.RESERVETOKEN];
        for (uint256 i = 0; i < reserveToken.length; i++) {
            if (permissions[STATUS.RESERVETOKEN][reserveToken[i]]) {
                reserves = reserves.add(tokenValue(reserveToken[i], IERC20(reserveToken[i]).balanceOf(address(this))));
            }
        }
        address[] memory liquidityToken = registry[STATUS.LIQUIDITYTOKEN];
        for (uint256 i = 0; i < liquidityToken.length; i++) {
            if (permissions[STATUS.LIQUIDITYTOKEN][liquidityToken[i]]) {
                reserves = reserves.add(tokenValue(liquidityToken[i], IERC20(liquidityToken[i]).balanceOf(address(this))));
            }
        }
        totalReserves = reserves;
        emit ReservesAudited(reserves);
    }

    /**
     * @notice takes inventory of all tracked assets
     * @notice always consolidate to recognized reserves before audit
     */
    function updateReserves() internal {
        uint256 reserves;
        address[] memory reserveToken = registry[STATUS.RESERVETOKEN];
        for (uint256 i = 0; i < reserveToken.length; i++) {
            if (permissions[STATUS.RESERVETOKEN][reserveToken[i]]) {
                reserves = reserves.add(tokenValue(reserveToken[i], IERC20(reserveToken[i]).balanceOf(address(this))));
            }
        }
        address[] memory liquidityToken = registry[STATUS.LIQUIDITYTOKEN];
        for (uint256 i = 0; i < liquidityToken.length; i++) {
            if (permissions[STATUS.LIQUIDITYTOKEN][liquidityToken[i]]) {
                reserves = reserves.add(tokenValue(liquidityToken[i], IERC20(liquidityToken[i]).balanceOf(address(this))));
            }
        }
        totalReserves = reserves;
        emit ReservesAudited(reserves);
    }

    /**
     * @notice set max debt for address
     * @param _address address
     * @param _limit uint256
     */
    function setDebtLimit(address _address, uint256 _limit) external onlyGovernor {
        debtLimit[_address] = _limit;
    }

    /**
     * @notice enable permission from queue
     * @param _status STATUS
     * @param _address address
     * @param _calculator address
     */
    function enable(
        STATUS _status,
        address _address,
        address _calculator,
        address _supplyController
    ) external onlyGovernor {
        require(timelockEnabled == false, "Use queueTimelock");
        if (_status == STATUS.SPANA) {
            sPANA = IsPana(_address);
        } else {
            permissions[_status][_address] = true;

            if (_status == STATUS.LIQUIDITYTOKEN) {
                bondCalculator[_address] = _calculator;
                supplyController[_address] = _supplyController;
            }

            (bool registered, ) = indexInRegistry(_address, _status);
            if (!registered) {
                registry[_status].push(_address);
            }
        }
        emit Permissioned(_address, _status, true);
    }

    /**
     *  @notice disable permission from address
     *  @param _status STATUS
     *  @param _toDisable address
     */
    function disable(STATUS _status, address _toDisable) external {
        require(msg.sender == authority.governor() || msg.sender == authority.guardian(), "Only governor or guardian");
        permissions[_status][_toDisable] = false;
        emit Permissioned(_toDisable, _status, false);
    }

    /**
     * @notice check if registry contains address
     * @return (bool, uint256)
     */
    function indexInRegistry(address _address, STATUS _status) public view returns (bool, uint256) {
        address[] memory entries = registry[_status];
        for (uint256 i = 0; i < entries.length; i++) {
            if (_address == entries[i]) {
                return (true, i);
            }
        }
        return (false, 0);
    }

    /* ========== TIMELOCKED FUNCTIONS ========== */

    // functions are used prior to enabling on-chain governance

    /**
     * @notice queue address to receive permission
     * @param _status STATUS
     * @param _address address
     * @param _calculator address
     */
    function queueTimelock(
        STATUS _status,
        address _address,
        address _calculator,
        address _supplyController
    ) external onlyGovernor {
        require(_address != address(0));
        require(timelockEnabled == true, "Timelock is disabled, use enable");

        uint256 timelock = block.number.add(blocksNeededForQueue);
        if (_status == STATUS.RESERVEMANAGER || _status == STATUS.LIQUIDITYMANAGER) {
            timelock = block.number.add(blocksNeededForQueue.mul(2));
        }
        permissionQueue.push(
            Queue({managing: _status, toPermit: _address, calculator: _calculator, supplyController: _supplyController, timelockEnd: timelock, nullify: false, executed: false})
        );
        emit PermissionQueued(_status, _address);
    }

    /**
     *  @notice enable queued permission
     *  @param _index uint256
     */
    function execute(uint256 _index) external {
        require(timelockEnabled == true, "Timelock is disabled, use enable");

        Queue memory info = permissionQueue[_index];

        require(!info.nullify, "Action has been nullified");
        require(!info.executed, "Action has already been executed");
        require(block.number >= info.timelockEnd, "Timelock not complete");

        if (info.managing == STATUS.SPANA) {
            // 9
            sPANA = IsPana(info.toPermit);
        } else {
            permissions[info.managing][info.toPermit] = true;

            if (info.managing == STATUS.LIQUIDITYTOKEN) {
                bondCalculator[info.toPermit] = info.calculator;
                supplyController[info.toPermit] = info.supplyController;
            }
            (bool registered, ) = indexInRegistry(info.toPermit, info.managing);
            if (!registered) {
                registry[info.managing].push(info.toPermit);

                if (info.managing == STATUS.LIQUIDITYTOKEN) {
                    (bool reg, uint256 index) = indexInRegistry(info.toPermit, STATUS.RESERVETOKEN);
                    if (reg) {
                        delete registry[STATUS.RESERVETOKEN][index];
                    }
                } else if (info.managing == STATUS.RESERVETOKEN) {
                    (bool reg, uint256 index) = indexInRegistry(info.toPermit, STATUS.LIQUIDITYTOKEN);
                    if (reg) {
                        delete registry[STATUS.LIQUIDITYTOKEN][index];
                    }
                }
            }
        }
        permissionQueue[_index].executed = true;
        emit Permissioned(info.toPermit, info.managing, true);
    }

    /**
     * @notice cancel timelocked action
     * @param _index uint256
     */
    function nullify(uint256 _index) external onlyGovernor {
        permissionQueue[_index].nullify = true;
    }

    /**
     * @notice disables timelocked functions
     */
    function disableTimelock() external onlyGovernor {
        require(timelockEnabled == true, "timelock already disabled");
        if (onChainGovernanceTimelock != 0 && onChainGovernanceTimelock <= block.number) {
            timelockEnabled = false;
        } else {
            onChainGovernanceTimelock = block.number.add(blocksNeededForQueue.mul(7)); // 7-day timelock
        }
    }

    /**
     * @notice enables timelocks after initilization
     */
    function initialize() external onlyGovernor {
        require(initialized == false, "Already initialized");
        timelockEnabled = true;
        initialized = true;
    }

    /* ========== VIEW FUNCTIONS ========== */

    /**
     * @notice returns excess reserves not backing tokens
     * @return uint
     */
    function excessReserves() public view override returns (uint256) {
        return totalReserves.sub(PANA.totalSupply().sub(totalDebt));
    }

    /**
     * @notice returns PANA valuation of asset
     * @param _token address
     * @param _amount uint256
     * @return value_ uint256
     */
    function tokenValue(address _token, uint256 _amount) public view override returns (uint256 value_) {
        require(baseValue != 0, "Base value is not set");

        if (permissions[STATUS.LIQUIDITYTOKEN][_token]) {
            value_ = IBondingCalculator(bondCalculator[_token]).valuation(_token, _amount, baseValue);
        }
        else {
            value_ = _amount.mul(baseValue).mul(10**IERC20Metadata(address(PANA)).decimals()).div(10**9).div(10**IERC20Metadata(_token).decimals());
        }
    }

    /**
     * @notice returns supply metric that cannot be manipulated by debt
     * @dev use this any time you need to query supply
     * @return uint256
     */
    function baseSupply() external view override returns (uint256) {
        return PANA.totalSupply() - panaDebt;
    }

    /**
     * @notice sets PANA token base value
     * @param _baseValue base value of PANA expressed in terms of X PANA per 1 reserve token (DAI), 9 decimals 
     */
    function setBaseValue(uint256 _baseValue) external onlyGovernor {
        baseValue = _baseValue;
    }
}
