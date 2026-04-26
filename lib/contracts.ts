/**
 * Contract ABIs and deployed addresses for Airena.
 * ABIs are minimal — only the functions we actually call from the frontend/backend.
 */

// ============ Addresses (fill after deployment) ============

export const CONTRACTS = {
  botRegistry: process.env.NEXT_PUBLIC_BOT_REGISTRY_ADDRESS || "",
  bettingPool: process.env.NEXT_PUBLIC_BETTING_POOL_ADDRESS || "",
} as const;

// ============ BotRegistry ABI ============

export const BOT_REGISTRY_ABI = [
  // Write
  "function registerBot(string _name, string _storageHash) external payable returns (uint256 botId)",
  "function deactivateBot(uint256 _botId) external",
  "function updateBotStats(uint256 _botId, uint256 _score, bool _won) external",
  "function setRegistrationFee(uint256 _newFee) external",
  "function withdrawFees() external",

  // Read
  "function getBot(uint256 _botId) external view returns (tuple(uint256 id, address creator, string name, string storageHash, uint256 totalRounds, uint256 wins, uint256 totalScore, uint256 createdAt, bool active))",
  "function getBotsByCreator(address _creator) external view returns (uint256[])",
  "function getBotCount() external view returns (uint256)",
  "function getBotsRange(uint256 _start, uint256 _limit) external view returns (tuple(uint256 id, address creator, string name, string storageHash, uint256 totalRounds, uint256 wins, uint256 totalScore, uint256 createdAt, bool active)[])",
  "function getActiveBots() external view returns (tuple(uint256 id, address creator, string name, string storageHash, uint256 totalRounds, uint256 wins, uint256 totalScore, uint256 createdAt, bool active)[])",
  "function registrationFee() external view returns (uint256)",
  "function botCount() external view returns (uint256)",

  // Events
  "event BotRegistered(uint256 indexed botId, address indexed creator, string name, string storageHash)",
  "event BotDeactivated(uint256 indexed botId, address indexed creator)",
  "event BotStatsUpdated(uint256 indexed botId, uint256 score, bool won, uint256 newTotalRounds)",
] as const;

// ============ BettingPool ABI ============

export const BETTING_POOL_ABI = [
  // Write (owner)
  "function createRound() external returns (uint256 roundId)",
  "function submitPrediction(uint256 _roundId, uint256 _botId, uint256 _priceLow, uint256 _priceHigh, string _reasoningHash, address _botCreator) external",
  "function openBetting(uint256 _roundId) external",
  "function settleRound(uint256 _roundId, uint256 _actualPrice) external",

  // Write (public)
  "function placeBet(uint256 _roundId, uint256 _botId) external payable",
  "function claimWinnings(uint256 _roundId) external",
  "function withdrawCreatorEarnings() external",

  // Read
  "function getRound(uint256 _roundId) external view returns (tuple(uint256 id, uint256 startTime, uint256 endTime, uint256 settlementPrice, uint256 totalPool, uint8 status))",
  "function getPrediction(uint256 _roundId, uint256 _botId) external view returns (tuple(uint256 botId, uint256 priceLow, uint256 priceHigh, string reasoningHash, uint256 score, bool scored))",
  "function getRoundBots(uint256 _roundId) external view returns (uint256[])",
  "function getRoundBetCount(uint256 _roundId) external view returns (uint256)",
  "function getBet(uint256 _roundId, uint256 _betIndex) external view returns (tuple(address bettor, uint256 botId, uint256 amount, bool claimed))",
  "function roundCount() external view returns (uint256)",
  "function creatorEarnings(address) external view returns (uint256)",
  "function botPoolSize(uint256 _roundId, uint256 _botId) external view returns (uint256)",
  "function hasClaimed(uint256 _roundId, address) external view returns (bool)",

  // Events
  "event RoundCreated(uint256 indexed roundId, uint256 startTime)",
  "event PredictionSubmitted(uint256 indexed roundId, uint256 indexed botId, uint256 priceLow, uint256 priceHigh)",
  "event BetPlaced(uint256 indexed roundId, uint256 indexed botId, address indexed bettor, uint256 amount)",
  "event RoundSettled(uint256 indexed roundId, uint256 settlementPrice, uint256 totalPool)",
  "event WinningsClaimed(uint256 indexed roundId, address indexed bettor, uint256 amount)",
] as const;
