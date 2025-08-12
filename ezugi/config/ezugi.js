require("dotenv").config();

const ezugiConfig = {
  // Operator Configuration
  operatorId: parseInt(process.env.EZUGI_OPERATOR_ID),
  secretKey: process.env.EZUGI_SECRET_KEY,
  currency: process.env.EZUGI_CURRENCY || "INR",

  // URLs
  integrationUrl: process.env.EZUGI_INTEGRATION_URL,
  boUrl: process.env.EZUGI_BO_URL,
  callbackBaseUrl: process.env.CALLBACK_BASE_URL,

  // Callback Endpoints
  callbacks: {
    authentication: `${process.env.CALLBACK_BASE_URL}/authentication`,
    debit: `${process.env.CALLBACK_BASE_URL}/debit`,
    credit: `${process.env.CALLBACK_BASE_URL}/credit`,
    rollback: `${process.env.CALLBACK_BASE_URL}/rollback`,
    getNewToken: `${process.env.CALLBACK_BASE_URL}/get-new-token`,
  },

  // Whitelisted IPs from Ezugi
  whitelistedIPs: [
    "52.16.138.24",
    "52.16.33.81",
    "52.16.124.91",
    "178.16.20.237",
    "109.102.212.194",
    "145.239.222.15",
    "109.102.212.192/29",
    "109.97.118.250",
    "109.97.118.248/29",
    "82.76.44.56/32",
    "84.247.82.40/29",
    "89.149.2.70",
    "3.226.141.106",
    "23.226.141.106",
    "5.2.134.244",
    "52.212.240.157",
    "52.208.99.3",
    "34.248.209.61",
  ],

  // Token Configuration
  tokenConfig: {
    launchTokenExpiry: 60, // seconds
    sessionTokenExpiry: 2400, // 40 minutes in seconds
    tokenLength: 32,
  },

  // Error Codes as per Ezugi Documentation
  errorCodes: {
    SUCCESS: 0,
    GENERAL_ERROR: 1,
    SAVED_FOR_FUTURE: 2,
    INSUFFICIENT_FUNDS: 3,
    OPERATOR_LIMIT_1: 4,
    OPERATOR_LIMIT_2: 5,
    TOKEN_NOT_FOUND: 6,
    USER_NOT_FOUND: 7,
    USER_BLOCKED: 8,
    TRANSACTION_NOT_FOUND: 9,
    TRANSACTION_TIMEOUT: 10,
    INSUFFICIENT_BALANCE_FOR_TIP: 11,
  },

  // Game IDs
  gameIds: {
    // Card Games
    BLACKJACK: 1,
    BACCARAT: 2,
    AMERICAN_BLACKJACK: 10,
    AMERICAN_HYBRID_BLACKJACK: 11,
    UNLIMITED_BLACKJACK: 12,
    BACCARAT_KO: 20,
    BACCARAT_SUPER_6: 21,
    NO_COMMISSION_BACCARAT: 25,
    BACCARAT_DRAGON_BONUS: 26,
    BACCARAT_QUEENCO: 27,
    BJ_SALON_PRIVE: 46,

    // Roulette Games
    ROULETTE: 3,
    AUTOMATIC_ROULETTE: 7,
    ROULETTE_PORTOMASO: 29,
    BET_ON_ROULETTE: 30,
    AMERICAN_ROULETTE: 31,
    TRIPLE_ROULETTE: 32,
    EZ_DEALER_ROULETTE: 48,
    ULTIMATE_ROULETTE: 54,

    // Asian/Indian Games
    DRAGON_TIGER: 24,
    ANDAR_BAHAR: 38,
    OTT_ANDAR_BAHAR: 39,
    ULTIMATE_ANDAR_BAHAR: 55,
    BET_ON_TEEN_PATTI: 16,
    THREE_CARD_POKER: 17,
    ONE_DAY_TEEN_PATTI: 43,
    ONE_DAY_TEEN_PATTI_BACK_LAY: 50,
    CARDS_32: 19,
    XOC_DIA: 60,

    // Poker Games
    CASINO_HOLDEM: 15,
    ROYAL_POKER: 53,
    THREE_CARD_POKER_NJ: 17,

    // Dice Games
    SIC_BO: 14,
    ULTIMATE_SIC_BO: 52,

    // Specialty Games
    LUCKY_7: 13,
    CRICKET_WAR: 45,
    DREAM_CATCHER: 47,
  },

  // Bet Type IDs
  betTypes: {
    GENERAL_BET_DEBIT: 1,
    GENERAL_BET_CREDIT: 101,
    TIP_DEBIT: 3,
    TIP_CREDIT: 103,
    INSURANCE_DEBIT: 4,
    INSURANCE_CREDIT: 104,
    DOUBLE_DEBIT: 5,
    DOUBLE_CREDIT: 105,
    SPLIT_DEBIT: 6,
    SPLIT_CREDIT: 106,
    SWAP: 8,
    BUY_PLAYER_CARD: 9,
    ROYAL_POKER_INSURANCE: 10,
    BUY_DEALER_CARD: 11,
    CALL_DEBIT: 24,
    CALL_CREDIT: 124,
  },

  // Platform IDs
  platformIds: {
    HTML_DESKTOP: 0,
    SMARTPHONE: 2,
    TABLET: 3,
  },

  // Return Reason Codes
  returnReasons: {
    SUCCESSFUL_BET: 0,
    CANCEL_BET: 1,
    CANCELED_ROUND: 2,
  },

  // Languages
  languages: {
    ENGLISH: "en",
    SPANISH: "es",
    RUSSIAN: "ru",
    CHINESE: "zh",
  },
};

module.exports = ezugiConfig;
