
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

const agentId = "4197";
const agentKey = "5f3c133b520cf405601bae3e24c1f64a";
const lang = 'en-US';
const api = `https://omsint.tableslive.com/agent_api`




async function GateGame(req,res) {
    
     const formData = new URLSearchParams();
  
  // Mandatory fields
  formData.append('DataSet', 'game_round_details');
  formData.append('APIID', '20004196');                  // Static API ID
  formData.append('APIUser', 'Reddysbook_INR');           // Static API User
  formData.append('RequestToken', '5f3c133b520cf405601bae3e24c1f64a');  // Static Request Token
  formData.append('TableID', '67890');                // Static Table ID

  // Optional fields with static values
  formData.append('TimePeriod', 'today');             // Example time period
  formData.append('StartTime', '2024-09-01 00:00:00'); // Static start time
  formData.append('EndTime', '2024-09-01 23:59:59');   // Static end time
  formData.append('RoundID', 'round123');              // Static round ID
  formData.append('DealerID', 'dealer456');            // Static dealer ID
  formData.append('UID', 'user789');                   // Static user ID
  formData.append('GameType', 'poker');                // Static game type
  formData.append('Limit', '100');                     // Static limit for results
  formData.append('Page', '1');                        // Static page number

  try {
    // Send POST request to the casino API
    const response = await axios.post(api, formData, {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });

    // Send the API response back to the client
    res.status(200).json(response.data);

  } catch (error) {
    console.error('Error fetching game round details:', error.message);
    res.status(500).json({ message: 'Error fetching data', error: error.message });
  }

}



const casinoController = {
  GateGame
 
}
export default casinoController