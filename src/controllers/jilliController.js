import crypto from 'crypto';
import request from 'request';
import connection from "../config/connectDB.js";
import moment from 'moment-timezone'
import axios from "axios";

const getRechargeOrderId = () => {
    const date = new Date();
    let id_time = date.getUTCFullYear() + '' + date.getUTCMonth() + 1 + '' + date.getUTCDate();
    let id_order = Math.floor(Math.random() * (99999999999999 - 10000000000000 + 1)) + 10000000000000;
    return id_time + id_order
}
function getCurrentTimeFormatted() {
    let currentDate = moment().tz('America/Santo_Domingo');
    let formattedDate = currentDate.format('YYMMD');
    return formattedDate;
}

function generateKeyG(agentId, agentKey) {
    const now = getCurrentTimeFormatted();
    const hash = crypto.createHash('md5');
    hash.update(now + agentId + agentKey);
    return hash.digest('hex');
}

function generateValidationKey(paramsString, keyG) {
    const hash = crypto.createHash('md5');
    hash.update(paramsString + keyG);
    const md5string = hash.digest('hex');
    const randomText1 = "123456";
    const randomText2 = "abcdef";
    const key = randomText1 + md5string + randomText2;
    return key;
}

const agentId = "Reddysbook_Seayan";
const agentKey = "e3bafbe6d48d8af49cec469d160515c86719d9b2";
const lang = 'en-US';
const api = `https://uat-wb-api-2.jiscc88.com/api1`

async function login(account, gameId, retryCount = 0) {
    const maxRetries = 3;
    const paramsString = `Account=${account}&GameId=${gameId}&Lang=${lang}&AgentId=${agentId}`;
    const keyG = generateKeyG(agentId, agentKey);
    const key = generateValidationKey(paramsString, keyG);
    const payload = {
        Account: account,
        GameId: gameId,
        Lang: lang,
        AgentId: agentId,
        Key: key
    };

    const apiUrl = `${api}/Login`;
    try {
        const response = await new Promise((resolve, reject) => {
            request.post({
                url: apiUrl,
                form: payload,
                followRedirect: true
            }, (error, response, body) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ response, body });
                }
            });
        });

        if (response.response.statusCode === 200) {
            let responseBody;

            try {
                responseBody = JSON.parse(response.body);
            } catch (error) {
                console.error("Error parsing JSON:", error);
                console.log(response.body);
            }
            if (responseBody && responseBody.ErrorCode === 14 && responseBody.Message === "User not exist or not enabled!") {
                if (retryCount < maxRetries) {
                    console.log("User does not exist or is not enabled. Creating member...");
                    await createMember(account);
                    console.log("Retrying login after member creation...");
                    return await login(account, gameId, retryCount + 1);
                } else {
                    console.log("Maximum retry attempts reached. Login failed.");
                    return {};
                }
            } else {
                return response.body;
            }
        } else if (response.response.statusCode === 302) {
            return {
                url: response.response.headers.location
            };
        } else {
            // console.log("Login failed with status code: ", response.response.statusCode);
            // console.log("Response body: ", response.body);
            return {};
        }
    } catch (error) {
        console.log("Error during login: ", error);
        return null;
    }
}
async function createMember(account) {
    const paramsString = `Account=${account}&AgentId=${agentId}`;
    const keyG = generateKeyG(agentId, agentKey);
    const key = generateValidationKey(paramsString, keyG);
    const payload = {
        Account: account,
        AgentId: agentId,
        Key: key
    };
    const apiUrl = `${api}/CreateMember`;

    try {
        const response = await new Promise((resolve, reject) => {
            request.post({ url: apiUrl, form: payload }, (error, response, body) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ response, body });
                }
            });
        });
        return response.body;
    } catch (error) {
        // console.log("Error creating member: ", error);
        throw error;
    }
}

async function exchangeTransferByAgentId(account, amount, TransferType, TransactionId) {
    const paramsString = `Account=${account}&TransactionId=${TransactionId}&Amount=${amount}&TransferType=${TransferType}&AgentId=${agentId}`;
    const keyG = generateKeyG(agentId, agentKey);
    const key = generateValidationKey(paramsString, keyG);
    const payload = {
        Account: account,
        TransactionId,
        Amount: amount,
        TransferType,
        AgentId: agentId,
        Key: key
    };
    const apiUrl = `${api}/ExchangeTransferByAgentId`;

    try {
        const response = await new Promise((resolve, reject) => {
            request.post({ url: apiUrl, form: payload }, (error, response, body) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ response, body });
                }
            });
        });
        return JSON.parse(response.body);
    } catch (error) {
        // console.log("Error creating member: ", error);
        throw error;
    }
}

function formateT(params) {
    let result = (params < 10) ? "0" + params : params;
    return result;
}

function timerJoin(params = '', addHours = 0) {
    let date = '';
    if (params) {
        date = new Date(Number(params));
    } else {
        date = new Date();
    }

    date.setHours(date.getHours() + addHours);

    let years = formateT(date.getFullYear());
    let months = formateT(date.getMonth() + 1);
    let days = formateT(date.getDate());

    let hours = date.getHours() % 12;
    hours = hours === 0 ? 12 : hours;
    let ampm = date.getHours() < 12 ? "AM" : "PM";

    let minutes = formateT(date.getMinutes());
    let seconds = formateT(date.getSeconds());

    return years + '-' + months + '-' + days + ' ' + hours + ':' + minutes + ':' + seconds + ' ' + ampm;
}

function roundDecimal(number, precision) {
    const multiplier = Math.pow(10, precision);
    return Math.round(number * multiplier) / multiplier;
}

async function getMemberInfo(account) {
    const paramsString = `Accounts=${account}&AgentId=${agentId}`;
    const keyG = generateKeyG(agentId, agentKey);
    const key = generateValidationKey(paramsString, keyG);
    const payload = {
        Accounts: account,
        AgentId: agentId,
        Key: key
    };
    const apiUrl = `${api}/GetMemberInfo`;

    try {
        const response = await new Promise((resolve, reject) => {
            request.post({ url: apiUrl, form: payload }, (error, response, body) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ response, body: JSON.parse(body) });
                }
            });
        });
        return response.body; //'{"ErrorCode":0,"Message":"","Data":[{"Account":"Testss0ssssa6","Balance":0,"Status":2}]}'
    } catch (error) {
        // console.log("Error creating member: ", error);
        throw error;
    }
}

const boardGame = async (req, res) => {
    let auth = req.cookies.auth;
    let gameId = req.params.gameId;
try{
    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
        });
    }
    if (!gameId) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
        });
    }
    gameId = parseInt(gameId)
    const [rows] = await connection.query('SELECT * FROM users WHERE `token` = ? ', [auth]);

    if (!rows) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
        });
    }
    const { id, password, ip, veri, ip_address, status, time, token, ...others } = rows[0];
    let username = `${others.id_user}${others.phone}`
    let response = await login(username, gameId);
    if (response && response.url && response.url.length) {
        let transactionId = getRechargeOrderId()
        let money = others.money
        const sql = `INSERT INTO withdrawgame SET 
                    id_order = ?,
                    phone = ?,
                    money = ?,
                    gameName=?,
                    status = ?,
                    today = ?,
                    time = ?`;
        let dates = new Date().getTime();
        let checkTime = timerJoin(dates);
        let { Data } = await exchangeTransferByAgentId(username, money, 2, transactionId);
        if (Data && Object.keys(Data)) {
            await connection.execute(sql, [transactionId, others.phone, money, 'jilli', Data.Status, checkTime, dates]);
            await connection.query('UPDATE users SET money = money - ? WHERE phone = ? ', [money, others.phone]);
        }
    }
    return res.status(200).json({
        message: 'Send SMS regularly.',
        status: true,
        data: response,
    });
    
}catch(error){
  return res.status(500).json({
        message: 'Send SMS regularly.',
        status: false,
       error:error.message
    });   
}

}

const getboardGameInfo = async (req, res) => {
    let auth = req.cookies.auth;


    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
        });
    }

    const [rows] = await connection.query('SELECT * FROM users WHERE `token` = ? ', [auth]);

    if (!rows) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
        });
    }
    const { id, password, ip, veri, ip_address, status, time, token, ...others } = rows[0];
    let username = `${others.id_user}${others.phone}`
    let response = await getMemberInfo(username);

    return res.status(200).json({
        message: 'Send SMS regularly.',
        status: true,
        data: response,
    });
}

const transferMoneyToMainWallet = async (req, res) => {
    let auth = req.cookies.auth;


    if (!auth) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
        });
    }

    const [rows] = await connection.query('SELECT * FROM users WHERE `token` = ? ', [auth]);

    if (!rows) {
        return res.status(200).json({
            message: 'Failed',
            status: false,
        });
    }
    const { id, password, ip, veri, ip_address, status, time, token, ...others } = rows[0];
    let username = `${others.id_user}${others.phone}`
    let response = await getMemberInfo(username);
    if (response.Data && response.Data.length) {
        let data = response.Data[0]
        let transactionId = getRechargeOrderId()
        let aaa = await exchangeTransferByAgentId(username, data.Balance, 1, transactionId)
        let { Data } = aaa
        if (Data && Object.keys(Data)) {//Data: {TransactionId: '2024413166526384000408', CoinBefore: 525, CoinAfter: 0, CurrencyBefore: 525, CurrencyAfter: 0, …}
            const sql = `INSERT INTO rechargefromgame SET 
            transaction_id = ?,
            phone = ?,
            money = ?,
            type = ?,
            status = ?,
            today = ?,
            url = ?,
            time = ?`;
            let dates = new Date().getTime();
            let checkTime = timerJoin(dates);
            await connection.execute(sql, [transactionId, others.phone, data.Balance, 'jilli', Data.Status, checkTime, 111, dates]);
            await connection.query('UPDATE users SET money = money + ? WHERE phone = ? ', [data.Balance, others.phone]);
            return res.status(200).json({
                message: 'Send SMS regularly.',
                status: true,
                data: aaa,
            });
        }
        return res.status(200).json({
            message: 'Send SMS regularly.',
            status: true,
            data: aaa,
        });
    }
}







// LaunchURL
// https://dev-test.spribe.io/games/launch/{game}
// operator_key: reddysbookstg
// currencies: USD, INR
// games: aviator, balloon, fortune-wheel, hi-lo, mini-roulette, mines, dice, mini-aviator, keno, plinko, hotline, goal, multikeno, starline
// GameApi URL
// https://secure-ga.staging.spribe.io/v3
// secret_token: JAWOE4wM1IsNYEtcwZ912lN6n48v8qYK
// Game details URL:
// https://games-info.staging.spribe.dev
// Demo URL https://demo.spribe.io/launch/{game}?currency=UAH&lang=EN&return_url=https://spribe.co
// Our support email: mailto:support@spribe.co
const agCode = "reddysbookstg";
const agToken = "JAWOE4wM1IsNYEtcwZ912lN6n48v8qYK";


function generateTransactionID() {
  return crypto.randomBytes(4).toString("hex"); // Generates an 8-character hexadecimal string
}



const stribes = async (req, res) => {
  try {
    let auth = req.cookies.auth;

    // Query the database to get the user based on the token
    const [rows] = await connection.query(
      "SELECT * FROM users WHERE `token` = ?",
      [auth]
    );

    if (!rows || rows.length === 0) {
      return res.status(200).json({
        message: "Account does not exist",
        status: false,
        timeStamp: new Date().toISOString(),
      });
    }

    const user = rows[0];
    const currency = "INR";
    const return_url = "https:// 75club.games";
    const lang = "EN";
    const game = "dice";


    // Construct the URL for the Game Launch API
    const url = `https://dev-test.spribe.io/games/launch/${game}?user=${auth}&token=${agToken}&lang=${lang}&currency=${currency}&operator=${agCode}&return_url=${return_url}`;

    // Use GET request instead of POST
    const response = await axios.get(url);

    // Log the response data
    // console.log("response.data", response.data);

    // Return the response data from the API
    return res.status(200).json({ redirectUrl: url });

  } catch (error) {
    // Return an error response to the client
    return res.status(500).json({
      error: "Internal server error",
      errorMessage: error.message,
    });
  }
};




const spribeApi = axios.create({
  baseURL: "https://dev-test.spribe.io", // Define the base URL in your .env
  headers: {
    'Content-Type': 'application/json',
    'X-Spribe-Client-X':agCode,
    'X-Spribe-Client-T': new Date().toISOString(),
    'X-Spribe-Client-Signature': agToken,
  },
});


const rollbackTransaction = async (req, res) => {  // Ensure req and res are passed here
  const payload = {
    user_id: 'user123',
    amount:100,
    provider:agCode,
    rollback_provider_tx_id: '99982783',
  };

  try {
    return await debugApiCall('/rollback', payload);
  } catch (error) {
    console.error('Rollback failed:', error);
  }
  
};

async function debugApiCall(path, payload) {
  try {
    const response = await spribeApi.post(path, payload);
    console.log(`Success for ${path}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error for ${path}:`, error.response?.data || error.message);
    throw error;
  }
}



async function handleGameLaunch(game, userToken, sessionToken, platform, currency) {
  const payload = {
    game,
    user_token: userToken,
    session_token: sessionToken,
    platform,
    currency,
  };

  try {
    const response = await debugApiCall('/games/launch', payload);

    // Assuming the response contains the HTML or redirection URL
    const launchUrlMatch = response.match(/window\.location\.replace\(['"](.+?)['"]\)/);
    if (launchUrlMatch) {
      const launchUrl = launchUrlMatch[1];
      console.log('Extracted Game Launch URL:', launchUrl);
      // Open the URL or return it
      return launchUrl;
    } else {
      console.error('No redirection URL found in response.');
    }
  } catch (error) {
    console.error('Game launch failed:', error);
  }
}


// (async () => {
//   const launchLink = await handleGameLaunch('aviator', 'user123', agToken, 'desktop', 'USD');
//   console.log('Launch Link:', launchLink);
// })();



async function authenticate(userToken, sessionToken, platform, currency) {
  try {
    const response = await spribeApi.post('/auth', {
      user_token: userToken,
      session_token: sessionToken,
      platform,
      currency,
    });
    return response.data;
  } catch (error) {
    console.error('Authentication Error:', error.response?.data || error.message);
    throw error;
  }
}


async function rollbackTransactions(userId, amount, provider, transactionId) {
  try {
    const response = await spribeApi.post('/rollback', {
      user_id: userId,
      amount,
      provider,
      rollback_provider_tx_id: transactionId,
    });
    return response.data;
  } catch (error) {
    console.error('Rollback Error:', error.response?.data || error.message);
    throw error;
  }
}


async function withdraw(playerId, amount, provider) {
  try {
    const response = await spribeApi.post('/withdraw', {
      player_id: playerId,
      amount,
      provider,
    });
    return response.data;
  } catch (error) {
    console.error('Withdraw Error:', error.response?.data || error.message);
    throw error;
  }
}

async function getPlayerInfo(playerId) {
  try {
    const response = await spribeApi.get(`/player-info/${playerId}`);
    return response.data;
  } catch (error) {
    console.error('Player Info Error:', error.response?.data || error.message);
    throw error;
  }
}

async function notifyPlayer(playerId, message) {
  try {
    const response = await spribeApi.post('/player-notification', {
      player_id: playerId,
      message,
    });
    return response.data;
  } catch (error) {
    console.error('Notification Error:', error.response?.data || error.message);
    throw error;
  }
}

// (async () => {
//   try {
//     // Authenticate a player
//     const authResponse = await authenticate('user123', agToken, 'desktop', 'USD');
//     console.log('Auth Response:', authResponse);

//     // Rollback a transaction
//     const rollbackResponse = await rollbackTransactions('user123', 100, agCode, 'tx123');
//     console.log('Rollback Response:', rollbackResponse);

//     // Withdraw funds
//     const withdrawResponse = await withdraw('user123', 50, agCode);
//     console.log('Withdraw Response:', withdrawResponse);

//     // Get Player Info
//     const playerInfo = await getPlayerInfo('user123');
//     console.log('Player Info:', playerInfo);

//     // Notify a player
//     const notificationResponse = await notifyPlayer('user123', 'Your game session has started.');
//     console.log('Notification Response:', notificationResponse);
//   } catch (error) {
//     console.error('Error:', error.message);
//   }
// })();


const jilliController = {
    boardGame,
    getboardGameInfo,
    transferMoneyToMainWallet,
       stribes,
       rollbackTransaction,
}
export default jilliController