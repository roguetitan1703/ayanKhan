const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

const secretKey = process.env.EZUGI_SECRET_KEY;

/**
 * Crypto utilities for Ezugi API integration
 * Handles hash signature generation and verification as per Ezugi documentation
 */
class CryptoUtils {
  
  /**
   * CRITICAL: Calculate hash as per Ezugi documentation
   * This is the MISSING method that controller was calling!
   */
  static calculateHash(requestBody, secretKey) {
    try {
      console.log("=== calculateHash Debug ===");
      console.log("Request body:", requestBody);
      console.log("Secret key exists:", !!secretKey);

      if (!requestBody || !secretKey) {
        throw new Error('Request body and secret key are required for hash calculation');
      }

      // Step 1: Remove hash field if it exists (as per Ezugi docs)
      const bodyForHash = { ...requestBody };
      delete bodyForHash.hash;

      console.log("Body for hash calculation:", bodyForHash);

      // Step 2: Sort keys alphabetically (as per Ezugi specification)
      const sortedKeys = Object.keys(bodyForHash).sort();
      console.log("Sorted keys:", sortedKeys);

      // Step 3: Create query string from sorted parameters
      const queryString = sortedKeys
        .map(key => `${key}=${bodyForHash[key]}`)
        .join('&');

      console.log("Query string for hash:", queryString);

      // Step 4: Create HMAC SHA256 hash
      const hmac = crypto.createHmac('sha256', secretKey);
      hmac.update(queryString);
      
      // Step 5: Return base64 encoded hash
      const hash = hmac.digest('base64');
      
      console.log("Generated hash:", hash);
      console.log("Hash length:", hash.length);
      
      logger.info('Hash calculated successfully', {
        queryStringLength: queryString.length,
        hashLength: hash.length,
        paramCount: sortedKeys.length
      });
      
      return hash;

    } catch (error) {
      console.error("=== calculateHash Error ===");
      console.error("Error message:", error.message);
      console.error("Request body keys:", requestBody ? Object.keys(requestBody) : 'null');
      
      logger.errorLog(error, { 
        context: 'calculateHash',
        hasRequestBody: !!requestBody,
        hasSecretKey: !!secretKey,
        bodyKeys: requestBody ? Object.keys(requestBody) : []
      });
      throw new Error(`Failed to calculate hash: ${error.message}`);
    }
  }

  /**
   * Generate hash signature (alternative method name for compatibility)
   */
  static generateHashSignature(message, secretKey) {
    try {
      if (!message || !secretKey) {
        throw new Error('Message and secret key are required for hash generation');
      }

      // Create HMAC SHA256 hash
      const hmac = crypto.createHmac('sha256', secretKey);
      hmac.update(message);
      
      // Return base64 encoded hash
      const signature = hmac.digest('base64');
      
      logger.info('Hash signature generated', {
        messageLength: message.length,
        signatureLength: signature.length
      });
      
      return signature;
    } catch (error) {
      logger.errorLog(error, { 
        context: 'generateHashSignature',
        messageLength: message?.length || 0
      });
      throw new Error('Failed to generate hash signature');
    }
  }

  /**
   * Verify hash signature from incoming Ezugi requests
   */
  static verifyHashSignature(receivedHash, requestBody, secretKey) {
    try {
      console.log("=== verifyHashSignature Debug ===");
      console.log("Received hash:", receivedHash);
      console.log("Request body:", requestBody);
      console.log("Secret key exists:", !!secretKey);

      if (!receivedHash || !requestBody || !secretKey) {
        logger.securityLog('Hash verification failed - missing parameters', null, null, {
          hasReceivedHash: !!receivedHash,
          hasRequestBody: !!requestBody,
          hasSecretKey: !!secretKey
        });
        return false;
      }

      // Generate expected hash using the same method as calculateHash
      const expectedHash = this.calculateHash(requestBody, secretKey);
      
      console.log("Expected hash:", expectedHash);
      console.log("Received hash:", receivedHash);
      console.log("Hashes match:", receivedHash === expectedHash);

      // Compare hashes (simple string comparison is sufficient for base64)
      const isValid = receivedHash.trim() === expectedHash.trim();

      if (!isValid) {
        logger.securityLog('Hash signature mismatch', null, null, {
          receivedHashLength: receivedHash.length,
          expectedHashLength: expectedHash.length,
          receivedHash: receivedHash.substring(0, 10) + '...',
          expectedHash: expectedHash.substring(0, 10) + '...'
        });
      } else {
        logger.info('Hash signature verified successfully');
      }

      return isValid;
    } catch (error) {
      console.error("=== verifyHashSignature Error ===");
      console.error("Error message:", error.message);
      
      logger.errorLog(error, {
        context: 'verifyHashSignature',
        receivedHashLength: receivedHash?.length || 0,
        hasRequestBody: !!requestBody
      });
      return false;
    }
  }

  /**
   * Generate secure random token for user sessions
   */
  static generateToken(length = 32) {
    try {
      // Generate random bytes
      const randomBytes = crypto.randomBytes(Math.ceil(length * 3 / 4));
      
      // Convert to base64 and remove non-alphanumeric characters
      const token = randomBytes
        .toString('base64')
        .replace(/[+/=]/g, '')
        .substring(0, length);

      // Ensure we have the required length
      if (token.length < length) {
        return this.generateToken(length); // Retry if too short
      }

      return token;
    } catch (error) {
      logger.errorLog(error, { context: 'generateToken', length });
      throw new Error('Failed to generate secure token');
    }
  }

  /**
   * Generate UUID v4 for transaction IDs
   */
  static generateUUID() {
    return uuidv4();
  }

  /**
   * Generate transaction ID with prefix as per Ezugi format
   */
  static generateTransactionId(type = 'debit', baseUuid = null) {
    try {
      let uuid;
      
      if (type === 'credit' && baseUuid) {
        // For credit, use the same UUID as the corresponding debit
        uuid = baseUuid.startsWith('d') ? baseUuid.substring(1) : baseUuid;
        return 'c' + uuid;
      } else if (type === 'debit') {
        uuid = this.generateUUID();
        return 'd' + uuid;
      } else {
        // Default UUID without prefix
        return this.generateUUID();
      }
    } catch (error) {
      logger.errorLog(error, { context: 'generateTransactionId', type, baseUuid });
      throw new Error('Failed to generate transaction ID');
    }
  }

  /**
   * Encrypt sensitive data for storage
   */
  static encrypt(text, key) {
    try {
      const algorithm = 'aes-256-cbc';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, key);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex')
      };
    } catch (error) {
      logger.errorLog(error, { context: 'encrypt' });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedText, key, iv) {
    try {
      const algorithm = 'aes-256-cbc';
      const decipher = crypto.createDecipher(algorithm, key);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.errorLog(error, { context: 'decrypt' });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate secure hash for password storage
   */
  static hashPassword(password) {
    try {
      const saltRounds = 12;
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, saltRounds, 64, 'sha512').toString('hex');
      
      return `${salt}:${hash}`;
    } catch (error) {
      logger.errorLog(error, { context: 'hashPassword' });
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password against hash
   */
  static verifyPassword(password, hashedPassword) {
    try {
      const [salt, hash] = hashedPassword.split(':');
      const hashVerify = crypto.pbkdf2Sync(password, salt, 12, 64, 'sha512').toString('hex');
      
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashVerify));
    } catch (error) {
      logger.errorLog(error, { context: 'verifyPassword' });
      return false;
    }
  }

  /**
   * Create hash from string message (utility method)
   */
  static createHash(message, algorithm = 'sha256') {
    try {
      return crypto.createHash(algorithm).update(message).digest('hex');
    } catch (error) {
      logger.errorLog(error, { context: 'createHash', algorithm });
      throw new Error('Failed to create hash');
    }
  }
}

module.exports = CryptoUtils;