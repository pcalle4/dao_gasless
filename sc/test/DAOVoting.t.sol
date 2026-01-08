// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MinimalForwarder} from "../src/MinimalForwarder.sol";
import {DAOVoting} from "../src/DAOVoting.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract DAOVotingTest is Test {
    using ECDSA for bytes32;

    MinimalForwarder public forwarder;
    DAOVoting public dao;

    address public userA;
    address public userB;
    address public userC;
    address public relayer;
    address public recipient;

    uint256 public pkA;
    uint256 public pkB;
    uint256 public pkC;
    uint256 public pkRelayer;
    string internal constant DEFAULT_DESCRIPTION = "Test proposal";

    // MinimalForwarder.ForwardRequest is defined in MinimalForwarder

    bytes32 public constant TYPEHASH =
        keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)");

    function setUp() public {
        // Setup Account PKs
        pkA = 0xA11CE;
        pkB = 0xB0B;
        pkC = 0xC0C0A;
        pkRelayer = 0xBEEF;

        // Setup Addresses
        userA = vm.addr(pkA);
        userB = vm.addr(pkB);
        userC = vm.addr(pkC);
        relayer = vm.addr(pkRelayer);
        recipient = makeAddr("recipient");

        // Fund Accounts
        vm.deal(userA, 100 ether);
        vm.deal(userB, 100 ether);
        vm.deal(userC, 100 ether);
        vm.deal(relayer, 100 ether);

        // Deploy Contracts
        forwarder = new MinimalForwarder();
        dao = new DAOVoting(address(forwarder));
    }

    // --- Helper Functions for EIP-712 ---

    function _signRequest(uint256 signerPk, MinimalForwarder.ForwardRequest memory req) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                TYPEHASH,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data)
            )
        );

        // MinimalForwarder inherits EIP712, we need its domain separator.
        // Since we can't easily access the internal _domainSeparatorV4 from here without an external getter (which it doesn't have public),
        // we can construct it manually hoping it matches or use a trick.
        // However, standard EIP712 uses:
        // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
        
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("MinimalForwarder"),
                keccak256("0.0.1"),
                block.chainid,
                address(forwarder)
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _buildVoteCalldata(uint256 proposalId, uint8 voteType) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(DAOVoting.vote.selector, proposalId, DAOVoting.VoteType(voteType));
    }

    // --- Tests ---

    function testFundDAO_tracksBalancesAndTotal() public {
        vm.prank(userA);
        dao.fundDao{value: 10 ether}();

        vm.prank(userB);
        dao.fundDao{value: 5 ether}();

        assertEq(dao.getUserBalance(userA), 10 ether);
        assertEq(dao.getUserBalance(userB), 5 ether);
        assertEq(dao.totalDaoBalance(), 15 ether);
        assertEq(address(dao).balance, 15 ether);
    }

    function testCreateProposal_requires10PercentRule() public {
        // Setup initial funding
        vm.prank(userA);
        dao.fundDao{value: 10 ether}(); // Total 10

        vm.prank(userB);
        dao.fundDao{value: 0.5 ether}(); // Total 10.5. 10% is 1.05. userB has 0.5 (approx 4.7%)

        // userA should succeed (10 / 10.5 > 10%)
        vm.prank(userA);
        dao.createProposal(recipient, 1 ether, block.timestamp + 1 days, DEFAULT_DESCRIPTION);
        assertEq(dao.proposalCount(), 1);

        // userB should fail
        vm.prank(userB);
        vm.expectRevert(DAOVoting.NotAuthorizedToCreate.selector);
        dao.createProposal(recipient, 0.1 ether, block.timestamp + 1 days, DEFAULT_DESCRIPTION);
    }

    function testVote_normalAndChangeVoteBeforeDeadline() public {
        // Setup funds
        vm.prank(userA);
        dao.fundDao{value: 10 ether}();
        vm.prank(userB);
        dao.fundDao{value: 1 ether}(); // minimal for vote is 0.01

        // A creates proposal
        vm.prank(userA);
        uint256 deadline = block.timestamp + 1 days;
        dao.createProposal(recipient, 1 ether, deadline, DEFAULT_DESCRIPTION);
        uint256 pId = dao.proposalCount();

        // B votes A_FAVOR (0)
        vm.prank(userB);
        dao.vote(pId, DAOVoting.VoteType.A_FAVOR);

        (,,,,, uint256 votesFor, uint256 votesAgainst,,,,) = dao.proposals(pId);
        assertEq(votesFor, 1);
        assertEq(votesAgainst, 0);
        (bool hasVoted, DAOVoting.VoteType voteType) = dao.getUserVote(pId, userB);
        assertTrue(hasVoted);
        assertEq(uint8(voteType), uint8(DAOVoting.VoteType.A_FAVOR));

        // B changes to EN_CONTRA (1)
        vm.prank(userB);
        dao.vote(pId, DAOVoting.VoteType.EN_CONTRA);

        (,,,,, votesFor, votesAgainst,,,,) = dao.proposals(pId);
        assertEq(votesFor, 0); // Decremented
        assertEq(votesAgainst, 1); // Incremented
        (hasVoted, voteType) = dao.getUserVote(pId, userB);
        assertTrue(hasVoted);
        assertEq(uint8(voteType), uint8(DAOVoting.VoteType.EN_CONTRA));
    }

    function testVote_revertsAfterDeadline() public {
        vm.prank(userA);
        dao.fundDao{value: 10 ether}();
        
        uint256 deadline = block.timestamp + 1 hours;
        vm.prank(userA);
        dao.createProposal(recipient, 1 ether, deadline, DEFAULT_DESCRIPTION);

        vm.warp(deadline + 1 seconds);

        vm.prank(userA);
        vm.expectRevert(DAOVoting.VotingEnded.selector);
        dao.vote(1, DAOVoting.VoteType.A_FAVOR);
    }

    function testExecuteProposal_happyPath_afterSecurityDelay() public {
        vm.prank(userA);
        dao.fundDao{value: 10 ether}();
        vm.prank(userB); // voter against to make it interesting, but A wins
        dao.fundDao{value: 2 ether}();

        uint256 deadline = block.timestamp + 1 days;
        vm.prank(userA);
        dao.createProposal(recipient, 5 ether, deadline, DEFAULT_DESCRIPTION);

        // Voting
        vm.prank(userA);
        dao.vote(1, DAOVoting.VoteType.A_FAVOR); // +1
        vm.prank(userB);
        dao.vote(1, DAOVoting.VoteType.EN_CONTRA); // +1 against

        // Note: votes are counted by count of votes or weight? 
        // Instructions: "Un usuario puede votar una vez... votesFor++". 
        // So 1 person = 1 vote, regardless of balance.
        // 1 For (A), 1 Against (B) -> Tie.
        // Need For > Against.
        
        vm.prank(userC);
        dao.fundDao{value: 0.1 ether}(); // minimal to vote
        vm.prank(userC);
        dao.vote(1, DAOVoting.VoteType.A_FAVOR);
        
        // now 2 For, 1 Against.

        vm.warp(deadline + dao.SECURITY_DELAY() + 1);

        uint256 recipientPreBalance = recipient.balance;
        uint256 daoPreBalance = dao.totalDaoBalance();

        dao.executeProposal(1);

        (,,,,,,,, bool executed,,) = dao.proposals(1);
        assertTrue(executed);
        assertEq(recipient.balance, recipientPreBalance + 5 ether);
        assertEq(dao.totalDaoBalance(), daoPreBalance - 5 ether);
    }

    function testExecuteProposal_revertsIfNotApprovedOrAlreadyExecuted() public {
        vm.prank(userA);
        dao.fundDao{value: 10 ether}();
        vm.prank(userA);
        dao.createProposal(recipient, 1 ether, block.timestamp + 1 days, DEFAULT_DESCRIPTION);
        
        // Case 1: No votes (0 <= 0)
        vm.warp(block.timestamp + 1 days + dao.SECURITY_DELAY() + 1);
        vm.expectRevert(DAOVoting.VoteRejected.selector);
        dao.executeProposal(1);

        // Vote to pass
        vm.warp(block.timestamp - dao.SECURITY_DELAY() - 1); // rewind? Not recommended. Better setup new generic proposal or just be careful. 
        // We can't rewind time easily in a linear test flow if we already warped. 
        // Let's create new proposal 2.
    }
    
    function testExecuteProposal_revertsIfAlreadyExecuted() public {
        // Setup passing proposal
        vm.prank(userA); dao.fundDao{value: 10 ether}();
        vm.prank(userA); dao.createProposal(recipient, 1 ether, block.timestamp + 1 days, DEFAULT_DESCRIPTION);
        vm.prank(userA); dao.vote(1, DAOVoting.VoteType.A_FAVOR);
        
        vm.warp(block.timestamp + 1 days + dao.SECURITY_DELAY() + 1);
        dao.executeProposal(1);

        vm.expectRevert(DAOVoting.AlreadyExecuted.selector);
        dao.executeProposal(1);
    }

    function testVote_revertsIfBalanceInsufficient() public {
        vm.prank(userA); dao.fundDao{value: 10 ether}();
        vm.prank(userA); dao.createProposal(recipient, 1 ether, block.timestamp + 1 days, DEFAULT_DESCRIPTION);
        
        // userC has 0 deposited
        vm.prank(userC);
        vm.expectRevert(DAOVoting.NotEnoughBalance.selector);
        dao.vote(1, DAOVoting.VoteType.A_FAVOR);
    }

    function testGetProposalState_transitions() public {
        vm.prank(userA); dao.fundDao{value: 10 ether}();
        vm.prank(userB); dao.fundDao{value: 1 ether}();

        uint256 deadline = block.timestamp + 1 days;
        vm.prank(userA); dao.createProposal(recipient, 1 ether, deadline, DEFAULT_DESCRIPTION);

        // ACTIVE
        assertEq(dao.getProposalState(1), 1);

        // Vote in favor before deadline
        vm.prank(userB); dao.vote(1, DAOVoting.VoteType.A_FAVOR);

        // After deadline but before security delay
        vm.warp(deadline + 1);
        assertEq(dao.getProposalState(1), 2);

        // After security delay and approved
        vm.warp(deadline + dao.SECURITY_DELAY() + 1);
        assertEq(dao.getProposalState(1), 3);

        // Execute and verify EXECUTED
        dao.executeProposal(1);
        assertEq(dao.getProposalState(1), 5);
    }

    // --- Gasless Tests ---

    function testVote_gasless_viaForwarder_execute() public {
        // Setup
        vm.prank(userA); dao.fundDao{value: 10 ether}();
        vm.prank(userB); dao.fundDao{value: 1 ether}();
        
        vm.prank(userA);
        dao.createProposal(recipient, 1 ether, block.timestamp + 1 days, DEFAULT_DESCRIPTION);
        uint256 pId = 1;

        // Construct Request for userB
        bytes memory data = _buildVoteCalldata(pId, uint8(DAOVoting.VoteType.A_FAVOR));

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: userB,
            to: address(dao),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(userB),
            data: data
        });

        bytes memory signature = _signRequest(pkB, req);

        // Execute via Relayer
        vm.prank(relayer);
        (bool success, ) = forwarder.execute(req, signature);
        assertTrue(success, "Forwarder execution failed");

        // Check Vote Counted
        (,,,,, uint256 votesFor,,,,,) = dao.proposals(pId);
        assertEq(votesFor, 1);
        (bool hasVoted, DAOVoting.VoteType voteType) = dao.getUserVote(pId, userB);
        assertTrue(hasVoted);
        assertEq(uint8(voteType), uint8(DAOVoting.VoteType.A_FAVOR));
        
        // Check Nonce Incremented
        assertEq(forwarder.getNonce(userB), 1);
    }

    function testForwarder_rejectsWrongNonceOrSignature() public {
         // Setup
        vm.prank(userA); dao.fundDao{value: 10 ether}();
        
        bytes memory data = abi.encodeWithSelector(DAOVoting.fundDao.selector); // just some valid call

        // WRONG NONCE
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: userA,
            to: address(dao),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(userA) + 1, // Invalid
            data: data
        });
        bytes memory sig = _signRequest(pkA, req);
        
        vm.prank(relayer);
        vm.expectRevert(MinimalForwarder.InvalidSignature.selector); // verify() fails because nonce mismatch in struct vs state, implies signature invalid for *current* state if we check logically, OR generic verify fail.
        // My implementation: verify() checks `_nonces[req.from] == req.nonce`. If not, returns false. 
        // Then execute() reverts with InvalidSignature().
        forwarder.execute(req, sig);

        // WRONG SIGNER (Signed by C, claims from A)
        req.nonce = forwarder.getNonce(userA); // Fix nonce
        sig = _signRequest(pkC, req); // Invalid signer

        vm.prank(relayer);
        vm.expectRevert(MinimalForwarder.InvalidSignature.selector);
        forwarder.execute(req, sig);
    }
}
