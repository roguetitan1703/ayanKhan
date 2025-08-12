const joi = require("joi");
const ezugiConfig = require("../config/ezugi");
const Joi = require("joi");

// Base validation schemas
const baseSchemas = {
  operatorId: Joi.number().integer().positive().required(),
  timestamp: Joi.number().integer().positive().required(),
  token: Joi.string()
    .min(20)
    .max(250)
    .pattern(/^[A-Za-z0-9._-]+$/)
    .required(),
  uid: Joi.string()
    .min(1)
    .max(50)
    .pattern(/^[A-Za-z0-9._-]+$/)
    .required(),
  transactionId: Joi.string().min(1).max(50).required(),
  roundId: Joi.number().integer().positive().required(),
  gameId: Joi.number().integer().min(1).max(99).required(),
  tableId: Joi.number().integer().positive().required(),
  serverId: Joi.number().integer().positive().required(),
  platformId: Joi.number().integer().valid(0, 2, 3).required(),
  currency: Joi.string().length(3).uppercase().required(),
  amount: Joi.number().precision(2).positive().required(),
  seatId: Joi.string().max(10).optional(),
  betTypeID: Joi.number().integer().positive().required(),
  balance: Joi.number().precision(2).min(0).required(),
  nickName: Joi.string()
    .min(1)
    .max(100)
    .pattern(/^[A-Za-z0-9\s]+$/)
    .optional(),
  errorCode: Joi.number().integer().min(0).max(11).required(),
  errorDescription: Joi.string().max(100).required(),
};

//Auth request validation
const authenticationRequestSchema = Joi.object({
  platformId: baseSchemas.platformId,
  operatorId: baseSchemas.operatorId,
  token: baseSchemas.token,
  timestamp: baseSchemas.timestamp,
});

//Auth response validation
const authenticationResponseSchema = Joi.object({
  operatorId: baseSchemas.operatorId,
  uid: baseSchemas.uid,
  nickName: baseSchemas.nickName,
  token: baseSchemas.token,
  playerTokenAtLaunch: baseSchemas.token,
  balance: baseSchemas.balance,
  currency: baseSchemas.currency,
  language: Joi.string().length(2).lowercase().default("en"),
  VIP: Joi.string().valid("0", "1", "2", "3", "4", "5").default("0"),
  errorCode: baseSchemas.errorCode,
  errorDescription: baseSchemas.errorDescription,
  timestamp: baseSchemas.timestamp,
  clientIp: Joi.string().ip().required(),
});

//Debit req validation
const debitRequestSchema = Joi.object({
  gameId: baseSchemas.gameId,
  debitAmount: baseSchemas.amount,
  platformId: baseSchemas.platformId,
  serverId: baseSchemas.serverId,
  transactionId: baseSchemas.transactionId.pattern(/^d/),
  token: baseSchemas.token,
  betTypeID: baseSchemas.betTypeID,
  tableId: baseSchemas.tableId,
  seatId: baseSchemas.seatId,
  currency: baseSchemas.currency,
  operatorId: baseSchemas.operatorId,
  roundId: baseSchemas.roundId,
  timestamp: baseSchemas.timestamp,
});

// Debit reponse validation
const debitResponseSchema = Joi.object({
  uid: baseSchemas.uid,
  operatorId: baseSchemas.operatorId,
  nickName: baseSchemas.nickName,
  token: baseSchemas.token,
  balance: baseSchemas.balance,
  transactionId: baseSchemas.transactionId,
  timestamp: baseSchemas.timestamp,
  currency: baseSchemas.currency,
  errorCode: baseSchemas.errorCode,
  roundId: baseSchemas.roundId,
  bonusAmount: Joi.number().precision(2).min(0).optional(),
  errorDescription: baseSchemas.errorDescription,
});

//Credit req validation
const creditRequestSchema = Joi.object({
  gameId: baseSchemas.gameId,
  debitTransactionId: baseSchemas.transactionId.pattern(/^d/),
  isEndRound: Joi.boolean().required(),
  creditIndex: Joi.string()
    .pattern(/^\d+\|\d+$/)
    .required(),
  gameDataString: Joi.string().allow("").optional(),
  platformId: baseSchemas.platformId,
  serverId: baseSchemas.serverId,
  transactionId: baseSchemas.transactionId.pattern(/^c/),
  token: baseSchemas.token,
  uid: baseSchemas.uid,
  returnReasons: Joi.number().integer().valid(0, 1, 2).required(),
  betTypeId: baseSchemas.betTypeID,
  tableId: baseSchemas.tableId,
  seatId: baseSchemas.seatId,
  currency: baseSchemas.currency,
  creditAmount: Joi.number().precision(2).min(0).required(),
  operatorId: baseSchemas.operatorId,
  roundId: baseSchemas.roundId,
  timestamp: baseSchemas.timestamp,
});

//Credit response validation
const creditResponseSchema = Joi.object({
  operatorId: baseSchemas.operatorId,
  uid: baseSchemas.uid,
  nickName: baseSchemas.nickName,
  token: baseSchemas.token,
  balance: baseSchemas.balance,
  transactionId: baseSchemas.transactionId,
  currency: baseSchemas.currency,
  timestamp: baseSchemas.timestamp,
  errorCode: baseSchemas.errorCode,
  roundId: baseSchemas.roundId,
  bonusAmount: Joi.number().precision(2).min(0).optional(),
  errorDescription: baseSchemas.errorDescription,
});

//Rollback request validation
const rollbackRequestSchema = Joi.object({
  operatorId: baseSchemas.operatorId,
  uid: baseSchemas.uid,
  transactionId: baseSchemas.transactionId,
  gameId: baseSchemas.gameId,
  token: baseSchemas.token,
  rollbackAmount: baseSchemas.amount,
  betTypeID: baseSchemas.betTypeID,
  serverId: baseSchemas.serverId,
  roundId: baseSchemas.roundId,
  currency: baseSchemas.currency,
  seatId: baseSchemas.seatId,
  platformId: baseSchemas.platformId,
  tableId: baseSchemas.tableId,
  timestamp: baseSchemas.timestamp,
});

//Rollback response validation
const rollbackResponseSchema = Joi.object({
  errorCode: baseSchemas.errorCode,
  errorDescription: baseSchemas.errorDescription,
  timestamp: baseSchemas.timestamp,
  operatorId: baseSchemas.operatorId,
  roundId: baseSchemas.roundId,
  uid: baseSchemas.uid,
  token: baseSchemas.token,
  balance: baseSchemas.balance,
  transactionId: baseSchemas.transactionId,
  currency: baseSchemas.currency,
});

//Get new token request validation
const getTokenRequestSchema = Joi.object({
  currentToken: baseSchemas.token,
  gameId: baseSchemas.gameId,
  uid: baseSchemas.uid,
  tableId: baseSchemas.tableId,
  operatorId: baseSchemas.operatorId,
  timestamp: baseSchemas.timestamp,
});

//Get new token response validation
const getTokenResponseSchema = Joi.object({
  errorCode: baseSchemas.errorCode,
  errorDescription: baseSchemas.errorDescription,
  operatorId: baseSchemas.operatorId,
  token: baseSchemas.token,
  balance: baseSchemas.balance,
  uid: baseSchemas.uid,
  timestamp: baseSchemas.timestamp,
});

//Launch URL parameters validation
const launchUrlParamsSchema = Joi.object({
  operatorId: baseSchemas.operatorId,
  token: baseSchemas.token,
  language: Joi.string().length(2).lowercase().optional(),
  clientType: Joi.string().valid("html5").optional(),
  selectGame: Joi.string().max(30).optional(),
  openTable: Joi.number().integer().positive().optional(),
  tableLimits: Joi.number().integer().positive().optional(),
  homeUrl: Joi.string().uri().optional(),
  cashierUrl: Joi.string().uri().optional(),
});

//Validation utility class
class ValidationUtils {
  static validateRequests(data, schema) {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      const errorDetails = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
      }));

      return {
        isValid: false,
        errors: errorDetails,
        sanitizedData: null,
      };
    }
    return {
      isValid: true,
      errors: null,
      sanitizedData: value,
    };
  }

  //Validate IP address against whitelist
  static isWhiteListedIP(clientIp) {
    if (!clientIp) return false;

    const whitelistedIPs = ezugiConfig.whitelistedIPs;

    for (const allowedIP of whitelistedIPs) {
      if (allowedIP.includes("/")) {
        if (this.isPInCIDR(clientIp, allowedIP)) {
          return true;
        }
      } else {
        if (clientIp === allowedIP) {
          return true;
        }
      }
    }
    return false;
  }

  //Check if ip is in CIDR range
  static isPInCIDR(ip, cidr) {
    const [range, bits = 32] = cidr.split("/");
    const mask = -(2 ** (32 - bits) - 1);
    return (this.ip2int(ip) & mask) === (this.ip2int(range) & mask);
  }

  //Convert ip to integer
  static ip2int(ip) {
    return;
    ip.split(".").reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;
  }

  //validate currency
  static isValidCurrency(currency) {
    const supportedCurrencies = ["INR", "USD", "EUR", "GBP"];
    return supportedCurrencies.includes(currency?.toUpperCase());
  }

  //Validate game ID
  static isValidGameId(gameId) {
    const validGameIds = Object.values(ezugiConfig.gameIds);
    return validGameIds.includes(parseInt(gameId));
  }

  //Validate bet type ID
  static isValidBetTypeId(betTypeId) {
    const validBetTypeIds = Object.values(ezugiConfig.betTypeIds);
    return validBetTypeIds.includes(parseInt(betTypeId));
  }

  //Validate Platform ID
  static isValidPlatformId(platformId) {
    const validPlatformIds = Object.values(ezugiConfig.platformIds);
    return validPlatformIds.includes(parseInt(platformId));
  }

  //Sanitize string input
  static sanitizeString(input, maxLength = 255) {
    if (!input || typeof input !== "string") return "";

    return input
      .trim()
      .substring(0, maxLength)
      .replace(/[<>\"']/g, "");
  }

  //Validate amount format
  static isValidAmount(amount) {
    if (typeof amount !== "number") return false;

    return Number.isFinite(amount) && amount >= 0 && (amount * 100) % 1 === 0;
  }

  //Validate timestamp
  static isValidTimestamp(timestamp, maxAgeMinutes = 30) {
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000;

    return timestamp && timestamp <= now && timestamp >= now - maxAge;
  }
}

module.exports = {
  schemas: {
    authenticationRequest: authenticationRequestSchema,
    authenticationResponse: authenticationResponseSchema,
    debitRequest: debitRequestSchema,
    debitResponse: debitResponseSchema,
    creditRequest: creditRequestSchema,
    creditResponse: creditResponseSchema,
    rollbackRequest: rollbackRequestSchema,
    rollbackResponse: rollbackResponseSchema,
    getNewTokenRequest: getTokenRequestSchema,
    getNewTokenResponse: getTokenResponseSchema,
    launchUrlParams: launchUrlParamsSchema,
  },
  ValidationUtils,
};
