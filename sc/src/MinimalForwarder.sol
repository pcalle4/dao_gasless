// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title MinimalForwarder
 * @notice Simple forwarder for ERC2771 meta-transactions.
 * @dev Modeled after OpenZeppelin's MinimalForwarder but customized for 0.8.x and specific prompt requirements.
 */
contract MinimalForwarder is EIP712 {
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    bytes32 private constant _TYPEHASH =
        keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)");

    mapping(address => uint256) private _nonces;

    event MetaTxExecuted(address indexed from, address indexed to, bytes4 selector, bool success);

    error InvalidSignature();
    error InvalidNonce();
    error ExecutionFailed();

    constructor() EIP712("MinimalForwarder", "0.0.1") {}

    /**
     * @notice Returns the next expected nonce for a given address.
     */
    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    /**
     * @notice Verifies the signature of a ForwardRequest.
     * @dev Checks that the nonce matches the current nonce of the sender and that the signature is valid.
     */
    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        address signer = _hashTypedDataV4(
                keccak256(abi.encode(_TYPEHASH, req.from, req.to, req.value, req.gas, req.nonce, keccak256(req.data)))
            ).recover(signature);

        return _nonces[req.from] == req.nonce && signer == req.from;
    }

    /**
     * @notice Executes a meta-transaction via the forwarder.
     * @dev Verifies signature, updates nonce, and calls the target with appended original sender.
     */
    function execute(ForwardRequest calldata req, bytes calldata signature)
        public
        payable
        returns (bool, bytes memory)
    {
        if (!verify(req, signature)) {
            revert InvalidSignature();
        }

        _nonces[req.from]++; // Update nonce prevents replay

        // EIP-2771: Append the original sender address to the calldata
        // The target contract (inheriting ERC2771Context) will extract this address as '_msgSender()'
        bytes memory dataWithSender = abi.encodePacked(req.data, req.from);

        // Execute the call
        (bool success, bytes memory returndata) = req.to.call{gas: req.gas, value: req.value}(dataWithSender);

        // Extract function selector for event (first 4 bytes of data)
        bytes4 selector;
        if (req.data.length >= 4) {
            selector = bytes4(req.data[0]);
            selector |= bytes4(req.data[1]) >> 8;
            selector |= bytes4(req.data[2]) >> 16;
            selector |= bytes4(req.data[3]) >> 24;
            // or simply: assembly { selector := mload(add(req.data, 32)) }
        }

        // Simpler extraction for selector if data length is sufficient
        if (req.data.length >= 4) {
            // We can just cast if we want, but let's do it cleanly
            selector = bytes4(req.data);
        }

        emit MetaTxExecuted(req.from, req.to, selector, success);

        // We do strictly revert if the inner call fails?
        // The prompt says "methods: ... execute ...". Usually forwarders return success/returndata.
        // However, standard OZ Forwarder does require success check if we want to bubble up errors easily.
        // But prompt just asked for "execute" and event.
        // I will return (success, returndata) and NOT revert on inner failure so the forwarder transaction itself succeeds.
        // But if the validation fails, I revert (see checks above).

        return (success, returndata);
    }
}
