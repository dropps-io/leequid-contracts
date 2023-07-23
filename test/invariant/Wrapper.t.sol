pragma solidity 0.8.20;

// solhint-disable no-console

import {ILSP1UniversalReceiver} from "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/ILSP1UniversalReceiver.sol";

import "contracts/mocks/BeaconDepositMock.sol";
import "contracts/tokens/Rewards.sol";
import "contracts/tokens/StakedLyxToken.sol";
import "contracts/pool/Pool.sol";
import "contracts/pool/PoolValidators.sol";
import "contracts/merkles/MerkleDistributor.sol";
import "contracts/pool/FeesEscrow.sol";
import "contracts/Oracles.sol";

import "forge-std/console.sol";
import "forge-std/Test.sol";

bytes32 constant MERKLE_ROOT = 0x98bbb4ca0d3258b1fcb91ada0d5df554c1b6bf94a31fdd6a9e8d35d1678891be;

address constant _owner = 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38;

contract Wrapper is Test, ERC165, ILSP1UniversalReceiver {
    bytes4 private constant _INTERFACE_ID_LSP1 = 0x6bb56a14;
    bytes4 private constant _INTERFACE_ID_ERC165 = 0x01ffc9a7;

    address constant MOCKBEACON_ADDRESS = 0x5FbDB2315678afecb367f032d93F642f64180aa3; // Replace with the correct address
    address constant REWARDS_ADDRESS = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512; // Replace with the correct address
    address constant STAKEDLYXTOKEN_ADDRESS = 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0; // Replace with the correct address
    address constant POOL_ADDRESS = 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9; // Replace with the correct address
    address constant POOLVALIDATORS_ADDRESS = 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9; // Replace with the correct address
    address constant MERKLEDISTRIBUTOR_ADDRESS = 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707; // Replace with the correct address
    address constant ORACLES_ADDRESS = 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853; // Replace with the correct address
    DepositContract public mockBeacon;
    Rewards public rewards;
    StakedLyxToken public stakedLyxToken;
    Pool public pool;
    PoolValidators public poolValidators;
    MerkleDistributor public merkleDistributor;
    FeesEscrow public feesEscrow;
    Oracles public oracles;

    function isContract(address _addr) public view returns (bool) {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }

    function universalReceiver(
        bytes32 typeId,
        bytes memory data
    ) public payable returns (bytes memory) {
        emit UniversalReceiver(msg.sender, msg.value, typeId, data, abi.encodePacked(msg.sender));
        return abi.encodePacked(msg.sender);
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == _INTERFACE_ID_ERC165 || interfaceId == _INTERFACE_ID_LSP1;
    }

    function setUp() public {
        require(isContract(STAKEDLYXTOKEN_ADDRESS), "No contract at STAKEDLYXTOKEN_ADDRESS");

        mockBeacon = DepositContract(MOCKBEACON_ADDRESS);
        rewards = Rewards(payable(REWARDS_ADDRESS));
        stakedLyxToken = StakedLyxToken(STAKEDLYXTOKEN_ADDRESS);
        pool = Pool(payable(POOL_ADDRESS));
        poolValidators = PoolValidators(POOLVALIDATORS_ADDRESS);
        merkleDistributor = MerkleDistributor(MERKLEDISTRIBUTOR_ADDRESS);
        feesEscrow = FeesEscrow(payable(REWARDS_ADDRESS));
        oracles = Oracles(ORACLES_ADDRESS);
    }

    function testFuzz_stake(uint256 value) public payable {
        console.log("Entered testFuzz_stake function.");

        // Assume a positive value and sufficient balance for the sender
        vm.assume(value > 0);
        vm.assume(address(msg.sender).balance >= value);

        // Capture previous balances for verification
        uint256 previousBalance = stakedLyxToken.balanceOf(address(this));
        uint256 prevPoolBalance = address(pool).balance;

        console.log("Captured previous balances.");

        // Perform the stake operation
        pool.stake{value: value}();

        console.log("Performed stake operation.");

        // Capture new balances to verify changes
        uint256 newBalance = stakedLyxToken.balanceOf(address(this));
        uint256 newPoolBalance = address(pool).balance;

        console.log("Captured new balances.");

        uint256 unstakeMatchedAmount;
        if (stakedLyxToken.unstakeProcessing()) {
            // hitUnstakeProcessing = true;

            console.log("Unstake processing...");
            unstakeMatchedAmount = 0;
        } else {
            console.log("Executing prank operation on pool address...");
            //set up the mock for the unstake function
            bytes4 selector = bytes4(keccak256(bytes("matchUnstake(uint256)"))); // Function selector
            bytes memory data = abi.encodeWithSelector(selector, value); // Full call data
            bytes memory retdata = abi.encode(unstakeMatchedAmount); // Mocked return value

            vm.prank(address(pool));
            vm.mockCall(address(stakedLyxToken), data, retdata);
            unstakeMatchedAmount = abi.decode(retdata, (uint256)); // Decode mocked return value
            console.log("Unstake matched amount: ");
            console.log(unstakeMatchedAmount);
        }
        uint256 _valueToDeposit = value - unstakeMatchedAmount;

        // Assert that the total value staked is reflected in the pool balance
        console.log("Asserting total value staked is reflected in the pool balance.");
        assertEq(_valueToDeposit, newPoolBalance - prevPoolBalance);

        // mint tokens for small deposits immediately
        if (_valueToDeposit <= pool.minActivatingDeposit()) {
            // hitMintingForSmallDeposits = true;
            console.log("Minting tokens for small deposits immediately.");
            assertEq(newBalance, previousBalance + value);
            return;
        }

        // mint tokens if current pending validators limit is not exceeded
        console.log("Checking if current pending validators limit is not exceeded.");
        uint256 _pendingValidators = pool.pendingValidators() +
            (address(pool).balance / pool.VALIDATOR_TOTAL_DEPOSIT());
        uint256 _activatedValidators = pool.activatedValidators();
        uint256 validatorIndex = _activatedValidators + _pendingValidators;
        if (
            validatorIndex * 1e4 <=
            _activatedValidators * 1e4 + pool.effectiveValidators() * pool.pendingValidatorsLimit()
        ) {
            // hitMintingForPendingValidatorsLimit = true;
            console.log("Minting tokens, pending validators limit not exceeded.");
            assertEq(newBalance, previousBalance + value);
        } else {
            if (unstakeMatchedAmount > 0) {
                console.log("Asserting unstake matched amount...");
                // hitUnstakeMatchedAmount = true;
                assertEq(newBalance, previousBalance + unstakeMatchedAmount);
            }
        }
        console.log("Finished testFuzz_stake function.");
    }

    function testFuzz_unstake(uint256 value) public {
        vm.assume(value > 0);
        vm.assume(address(msg.sender).balance >= value);
    }
}
