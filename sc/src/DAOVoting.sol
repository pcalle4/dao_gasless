// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DAOVoting
 * @notice A simple execution DAO with gasless voting support via EIP-2771.
 */
contract DAOVoting is ERC2771Context, ReentrancyGuard {
    // --- State Variables ---

    uint256 public constant SECURITY_DELAY = 1 hours;
    uint256 public constant MIN_VOTING_BALANCE = 0.01 ether;
    uint256 public nextProposalId = 1;
    uint256 public totalDaoBalance;

    struct Proposal {
        uint256 id;
        address recipient;
        uint256 amount;
        uint256 deadline;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 votesAbstain;
        bool executed;
        uint256 createdAt;
        uint256 executableAt;
    }

    enum VoteType {
        A_FAVOR,
        EN_CONTRA,
        ABSTENCION
    }

    mapping(address => uint256) public userBalances;
    mapping(uint256 => Proposal) public proposals;
    // proposalId => user => hasVoted (we need to track vote type to allow changing votes)
    // To allow changing votes, we need to know the previous vote.
    // 0: Not Voted (technically we can use struct or mapping(uint=>mapping(address=>VoteStatus)))
    // Let's use a nested mapping to store the actual vote cast.
    // But since VoteType is 0-indexed, we need a way to distinguish "Not Voted".
    // We can add a "HAS_VOTED" boolean or similar, or just reserve a value?
    // Prompt says: "A_FAVOR, EN_CONTRA, ABSTENCION".
    // I will store struct { bool hasVoted; VoteType option; }

    struct UserVote {
        bool hasVoted;
        VoteType vote;
    }

    mapping(uint256 => mapping(address => UserVote)) intUserVotes;

    // --- Events ---

    event Funded(address indexed from, uint256 amount);
    event ProposalCreated(
        uint256 indexed id, address indexed creator, address indexed recipient, uint256 amount, uint256 deadline
    );
    event Voted(uint256 indexed id, address indexed voter, VoteType voteType);
    event VoteChanged(uint256 indexed id, address indexed voter, VoteType previous, VoteType current);
    event ProposalExecuted(uint256 indexed id, address indexed recipient, uint256 amount);

    // --- Errors ---

    error NotEnoughBalance();
    error InvalidDeadline();
    error NotEnoughDAOBalance();
    error NotAuthorizedToCreate();
    error ProposalDoesNotExist();
    error VotingEnded();
    error AlreadyExecuted();
    error NotExecutableYet();
    error ExecutionFailed();
    error VoteRejected(); // Generic for failing logic

    // --- Constructor ---

    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}

    // --- Core Functions ---

    /**
     * @notice Fund the DAO. Keeps track of user balance and total DAO balance.
     */
    function fundDao() external payable {
        address sender = _msgSender();
        userBalances[sender] += msg.value;
        totalDaoBalance += msg.value;
        emit Funded(sender, msg.value);
    }

    /**
     * @notice Create a new proposal.
     * @param recipient Address to receive funds if executed.
     * @param amount Amount of ETH to transfer.
     * @param deadline Timestamp when voting ends.
     */
    function createProposal(address recipient, uint256 amount, uint256 deadline) external {
        address sender = _msgSender();

        // 1. Check Creator Threshold: >= 10% of Total DAO Balance at moment of creation.
        // If total balance is 0, logic says 0 >= 0 is true, but practically usually means no funds.
        // Let's assume strict > 0 check isn't explicitly asked but "10% of balance" implies balance exists.
        // However, if total is 100, needs 10. If total 0, needs 0.
        if (userBalances[sender] < (totalDaoBalance * 10) / 100) {
            revert NotAuthorizedToCreate();
        }

        // 2. Validate amount <= DAO Balance
        if (amount > totalDaoBalance) {
            revert NotEnoughDAOBalance();
        }

        // 3. Validate deadline > block.timestamp
        if (deadline <= block.timestamp) {
            revert InvalidDeadline();
        }

        uint256 pId = nextProposalId++;
        Proposal storage p = proposals[pId];
        p.id = pId;
        p.recipient = recipient;
        p.amount = amount;
        p.deadline = deadline;
        p.createdAt = block.timestamp;
        p.executableAt = deadline + SECURITY_DELAY;
        // executed initialized to false

        emit ProposalCreated(pId, sender, recipient, amount, deadline);
    }

    /**
     * @notice Vote on a proposal. Allows changing vote before deadline.
     */
    function vote(uint256 proposalId, VoteType voteType) external {
        address sender = _msgSender();

        // Check Minimum Balance
        if (userBalances[sender] < MIN_VOTING_BALANCE) {
            revert NotEnoughBalance();
        }

        Proposal storage p = proposals[proposalId];
        if (p.createdAt == 0) revert ProposalDoesNotExist();
        if (block.timestamp >= p.deadline) revert VotingEnded();
        if (p.executed) revert AlreadyExecuted();

        UserVote storage uv = intUserVotes[proposalId][sender];

        if (uv.hasVoted) {
            // Changing Vote
            if (uv.vote == voteType) {
                // Same vote, do nothing or revert?
                // Let's just return to save gas or allow idempotence.
                return;
            }

            // Undo previous vote
            if (uv.vote == VoteType.A_FAVOR) p.votesFor--;
            else if (uv.vote == VoteType.EN_CONTRA) p.votesAgainst--;
            else p.votesAbstain--;

            emit VoteChanged(proposalId, sender, uv.vote, voteType);
        } else {
            // First time voting
            uv.hasVoted = true;
            emit Voted(proposalId, sender, voteType);
        }

        // Apply new vote
        uv.vote = voteType;
        if (voteType == VoteType.A_FAVOR) p.votesFor++;
        else if (voteType == VoteType.EN_CONTRA) p.votesAgainst++;
        else p.votesAbstain++;
    }

    /**
     * @notice Execute a successful proposal.
     */
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage p = proposals[proposalId];

        if (p.createdAt == 0) revert ProposalDoesNotExist();
        if (p.executed) revert AlreadyExecuted();

        // Validar deadline pasado
        if (block.timestamp < p.deadline) revert NotExecutableYet(); // technically "VotingNotEnded" but same logic

        // Validar Security Delay
        if (block.timestamp < p.executableAt) revert NotExecutableYet();

        // Validar Votes: For > Against (Abstain ignored for result)
        if (p.votesFor <= p.votesAgainst) revert VoteRejected();

        // Check DAO balance again (funds track total, but ensures liquidity)
        if (address(this).balance < p.amount) revert NotEnoughDAOBalance();

        // Update state BEFORE external call
        p.executed = true;
        totalDaoBalance -= p.amount; // update "bookkeeping" balance

        // Transfer ETH
        (bool success,) = p.recipient.call{value: p.amount}("");
        if (!success) revert ExecutionFailed();

        emit ProposalExecuted(proposalId, p.recipient, p.amount);
    }

    // --- View Functions ---

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function getUserBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }

    // Explicit override for ERC2771Context context which might conflict if we had other inheritance,
    // but here it's clean. Just to be safe and satisfy best practices:

    function _msgSender() internal view override(ERC2771Context) returns (address sender) {
        return super._msgSender();
    }

    function _msgData() internal view override(ERC2771Context) returns (bytes calldata) {
        return super._msgData();
    }
}
