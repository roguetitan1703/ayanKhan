import connection from "../config/connectDB.js";
import jwt from 'jsonwebtoken';
import md5 from "md5";
import axios from 'axios';
import CryptoJS from 'crypto-js';

const API_URL = 'https://uat-wb-api-2.huuykk865s.com/api1/';

const AGENT_ID = 'Reddysbook_Seayan';
const AGENT_KEY = 'e3bafbe6d48d8af49cec469d160515c86719d9b2';


// Here are the calculation results for your reference:
 
// 1. dateStr = 25019
// 2. agentId = Metaplay_seamless
// 3. agentKey = e07927f140013ba728c1deb94b63d5658d1c80f1
// 4. keyG = MD5(25019Metaplay_seamlesse07927f140013ba728c1deb94b63d5658d1c80f1)
// = 3951cae95ea6bdfe5f35abeae1c1580c
// 5. params= Token=a04578e41168be05cba6389e63df10b0&GameId=148&Lang=en-US&AgentId=Metaplay_seamless
// 6. key = 000000 + MD5(params + keyG) + 000000 
// = 00000046c84a5dee7ffa1f7c021a55f4ec8fb9000000 

// Final: 
// https://uat-wb-api.jlfafafa2.com/api1/singleWallet/LoginWithoutRedirect?Token=a04578e41168be05cba6389e63df10b0&GameId=148&Lang=en-US&AgentId=Metaplay_seamless&Key=00000046c84a5dee7ffa1f7c021a55f4ec8fb9000000


const jillieAuth = async (req, res) => {
    const { reqId, token } = req.body;
    console.log(req.body)
    try {
        // Find the user in the database using the provided token
        console.log("token", token)
        const [userRows] = await connection.query('SELECT * FROM users WHERE token = ?', [token]);

        // Check if user exists
        if (!userRows.length) {
            return res.status(404).json({
                errorCode: 4,
                message: 'Token expired or invalid',
            });
        }

        const user = userRows[0];
        // Send a success response with INR currency
        const response = {
            errorCode: 0,
            message: 'Success',
            username: user.name_user,
            currency: 'INR', // Always send INR in currency
            balance: user.money, // Assuming balance is a field in the users table
            token: token
        };

        return res.status(200).json(response);
    } catch (error) {
        return res.status(500).json({
            errorCode: 5,
            message: 'Other errors; see message for detail',
            detail: error.message
        });
    }
};

// const jillieBet = async (req, res) => {
//     const { reqId, token, currency, game, round, wagersTime, betAmount, winloseAmount, isFreeRound, userId, transactionId } = req.body;
//     console.log(req.body, "jilliebet")
//     try {
//         // Find the user in the database using the provided token
//         const [userRows] = await connection.query('SELECT * FROM users WHERE token = ?', [token]);

//         if (!userRows.length) {
//             return res.status(404).json({
//                 errorCode: 4,
//                 message: 'Token expired or invalid',
//             });
//         }

//         const user = userRows[0];
//         let updatedBalance = user.money;
//         console.log(user.name_user)

//         if (updatedBalance >= betAmount) {
//             // Place the bet and settle it
//             updatedBalance = updatedBalance - betAmount + winloseAmount;

//             // Update user balance in the database
//             await connection.query('UPDATE users SET money = ? WHERE token = ?', [updatedBalance, token]);
//             const response = {
//                 errorCode: 0,
//                 message: 'Bet placed successfully',
//                 username: user.name_user,
//                 currency: 'INR', // Ensure the currency is always INR as specified
//                 balance: updatedBalance,
//                 txId: transactionId,
//                 token: token
//             };

//             return res.status(200).json(response);
//         } else {
//             return res.status(400).json({
//                 errorCode: 2,
//                 message: 'Not enough balance',
//             });
//         }
//     } catch (error) {
//         return res.status(500).json({
//             errorCode: 5,
//             message: 'Other errors; see message for detail',
//             detail: error.message
//         });
//     }
// };

const jillieBet = async (req, res) => {
    const { reqId, token, currency, game, round, wagersTime, betAmount, winloseAmount, isFreeRound, userId, transactionId } = req.body;
    console.log(req.body, "jilliebet")
    try {
        // Find the user in the database using the provided token
        const [userRows] = await connection.query('SELECT * FROM users WHERE token = ?', [token]);

        if (!userRows.length) {
            return res.status(404).json({
                errorCode: 4,
                message: 'Token expired or invalid',
            });
        }

        const user = userRows[0];
        const currentBalance = user.money;
        let updatedBalance = user.money;

        let winning_wallet_balance = Number(user.winning_wallet_balance);
        let jillie_total_winning_amount = Number(user.jillie_totalWinningAmount);
        let totalWinningAmountbalance = Number(user.totalWinningAmount);



        // Fetch the admin commission percentage
        // const [adminRows] = await connection.query('SELECT apiAdminCommission FROM admin LIMIT 1');

        // if (!adminRows.length) {
        //     return res.status(500).json({
        //         errorCode: 5,
        //         message: 'Admin configuration not found',
        //     });
        // }

        // const adminCommission = adminRows[0].apiAdminCommission ;
        const adminCommission = 0;
        console.log(adminCommission, "adminCommission")
        let netWinAmount = winloseAmount;

        // Calculate net win amount after subtracting admin commission
        if (adminCommission > 0) {
            netWinAmount = winloseAmount - (winloseAmount * adminCommission / 100);
            console.log(netWinAmount, "netWinAmount in >0")
        }

        // Ensure the user has enough balance to place the bet
        if (updatedBalance >= betAmount) {
            // Update the balance by subtracting the bet amount and adding the net win amount
            updatedBalance = updatedBalance - betAmount + netWinAmount;

           
            const new_winning_wallet_balance = Number(winning_wallet_balance) + Number(winloseAmount);
            const new_jillie_total_winning_amount = Number(jillie_total_winning_amount) + Number(winloseAmount);
            const new_totalWinningAmount = Number(totalWinningAmountbalance) + Number(winloseAmount);

            console.log(updatedBalance, "updatedBalance")
            console.log(new_winning_wallet_balance, "new_winning_wallet_balance")
            console.log(new_jillie_total_winning_amount, "new_winning_wallet_balance")
            console.log(new_totalWinningAmount, "new_winning_wallet_balance")

            // Update user balance in the database
            await connection.query('UPDATE users SET money = ?,winning_wallet_balance = ?, jillie_totalWinningAmount = ?,totalWinningAmount = ? WHERE token = ?', [updatedBalance, new_winning_wallet_balance, new_jillie_total_winning_amount, new_totalWinningAmount, token]);
            // await connection.query(
            //     'INSERT INTO jillieBetHistory (id_user, phone, token, name_user, gameCode, betAmount, moneyAfterBet, moneyBeforeBet,winAmount, adminCommission, round, wagersTime, today) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            //     [user.id_user, user.phone, token, user.name_user, game, betAmount, updatedBalance, currentBalance,winloseAmount, adminCommission, round, wagersTime, new Date()]
            // );
            console.log("done isertation")
            const response = {
                errorCode: 0,
                message: 'Bet placed successfully',
                username: user.name_user,
                currency: 'INR', // Ensure the currency is always INR as specified
                balance: updatedBalance,
                txId: transactionId,
                token: token
            };

            return res.status(200).json(response);
        } else {
            return res.status(400).json({
                errorCode: 2,
                message: 'Not enough balance',
            });
        }
    } catch (error) {
        return res.status(500).json({
            errorCode: 5,
            message: 'Other errors; see message for detail',
            detail: error.message
        });
    }
};


const jillieCancelBet = async (req, res) => {
    const { reqId, currency, game, round, betAmount, winloseAmount, userId, token } = req.body;
    console.log(req.body, "cancelBet")
    try {
        // Find the user in the database using the provided token
        const [userRows] = await connection.query('SELECT * FROM users WHERE token = ?', [token]);

        if (!userRows.length) {
            return res.status(404).json({
                errorCode: 4,
                message: 'Token expired or invalid',
            });
        }

        const user = userRows[0];
        let updatedBalance = user.money + betAmount - winloseAmount;

        if (updatedBalance < 0) {
            return res.status(400).json({
                errorCode: 6,
                message: 'Cancel refused: insufficient balance',
            });
        }

        // Update the user balance in the database
        await connection.query('UPDATE users SET money = ? WHERE token = ?', [updatedBalance, token]);

        const response = {
            errorCode: 0,
            message: 'Success',
            username: user.name_user,
            currency: 'INR',
            balance: updatedBalance,
            txId: round // Assuming txId is the same as round for simplicity
        };

        return res.status(200).json(response);
    } catch (error) {
        return res.status(500).json({
            errorCode: 5,
            message: 'Other errors; see message for detail',
            detail: error.message
        });
    }
};
// const jillieSessionBet = async (req, res) => {
//     const { reqId, token, currency, game, round, wagersTime, betAmount, winloseAmount, userId, sessionId, type, turnover, preserve } = req.body;
//     console.log(req.body, "session bet")
//     try {
//         // Find the user in the database using the provided token
//         const [userRows] = await connection.query('SELECT * FROM users WHERE token = ?', [token]);

//         // Check if user exists
//         if (!userRows.length) {
//             return res.status(404).json({
//                 errorCode: 4,
//                 message: 'Token expired or invalid',
//             });
//         }

//         const user = userRows[0];
//         let updatedBalance = user.money;

//         if (type === 1) {
//             // Bet placement logic
//             if (preserve > 0) {
//                 // With preserve
//                 if (updatedBalance < preserve) {
//                     return res.status(400).json({
//                         errorCode: 2,
//                         message: 'Insufficient balance',
//                     });
//                 }
//                 console.log("preserver is greater then 0 ")
//                 updatedBalance -= preserve;
//                 console.log("preserver is greater then 0 ", updatedBalance)
//             } else if (preserve === 0 && betAmount > 0 && winloseAmount === 0) {
//                 // No preserve
//                 if (updatedBalance < betAmount) {
//                     return res.status(400).json({
//                         errorCode: 2,
//                         message: 'Insufficient balance',
//                     });
//                 }
//                 console.log("preserver is 0 ")
//                 updatedBalance -= betAmount;
//                 console.log("preserver is 0 ", updatedBalance)
//             } else {
//                 console.log("Invalid values for bet placement ",)
//                 return res.status(400).json({
//                     errorCode: 3,
//                     message: 'Invalid values for bet placement',
//                 });
//             }
//         }
//         else if (type === 2) {
//             console.log("type 2 data",)
//             // Bet settlement logic
//             if (preserve > 0 && betAmount >= 0 && winloseAmount >= 0) {
//                 updatedBalance = updatedBalance + preserve - betAmount + winloseAmount;
//             } else if (preserve === 0 && betAmount === 0 && winloseAmount >= 0) {
//                 updatedBalance += winloseAmount;
//             } else {
//                 return res.status(400).json({
//                     errorCode: 3,
//                     message: 'Invalid values for bet settlement',
//                 });
//             }
//         } else {
//             return res.status(400).json({
//                 errorCode: 3,
//                 message: 'Invalid type value',
//             });
//         }

//         // Update user balance in the database
//         await connection.query('UPDATE users SET money = ? WHERE token = ?', [updatedBalance, token]);
//         console.log("UPDATE users SET money ", updatedBalance)
//         const response = {
//             errorCode: 0,
//             message: type === 1 ? 'Session bet placed successfully' : 'Session bet settled successfully',
//             username: user.name_user,
//             currency: 'INR',
//             balance: updatedBalance,
//             token: token
//         };

//         return res.status(200).json(response);

//     } catch (error) {
//         return res.status(500).json({
//             errorCode: 5,
//             message: 'Other errors; see message for detail',
//             detail: error.message
//         });
//     }
// };

// const jillieSessionBet = async (req, res) => {
//     const { reqId, token, currency, game, round, wagersTime, betAmount, winloseAmount, userId, sessionId, type, turnover, preserve } = req.body;
//     // console.log(req.body, "session bet")
//     try {
//         // Find the user in the database using the provided token
//         const [userRows] = await connection.query('SELECT * FROM users WHERE token = ?', [token]);

//         // Check if user exists
//         if (!userRows.length) {
//             return res.status(404).json({
//                 errorCode: 4,
//                 message: 'Token expired or invalid',
//             });
//         }

//         const user = userRows[0];
//         let updatedBalance = user.money;

//         // Fetch the admin commission percentage
//         const [adminRows] = await connection.query('SELECT apiAdminCommission FROM admin LIMIT 1');

//         if (!adminRows.length) {
//             return res.status(500).json({
//                 errorCode: 5,
//                 message: 'Admin configuration not found',
//             });
//         }

//         // const adminCommission = parseFloat(adminRows[0].apiAdminCommission).toFixed(2);
//         const adminCommission = 0;
//         console.log(adminCommission, "adminCommission")
//         let netWinAmount = winloseAmount;

//         if (type === 1) {
//             // Bet placement logic
//             if (preserve > 0) {
//                 // With preserve
//                 if (updatedBalance < preserve) {
//                     return res.status(400).json({
//                         errorCode: 2,
//                         message: 'Insufficient balance',
//                     });
//                 }
//                 console.log("preserver is greater than 0 ");
//                 updatedBalance -= preserve;
//                 console.log("preserver is greater than 0 ", updatedBalance);
//             } else if (preserve === 0 && betAmount > 0 && winloseAmount === 0) {
//                 // No preserve
//                 if (updatedBalance < betAmount) {
//                     return res.status(400).json({
//                         errorCode: 2,
//                         message: 'Insufficient balance',
//                     });
//                 }
//                 console.log("preserve is 0 ");
//                 updatedBalance -= betAmount;
//                 console.log("preserve is 0 ", updatedBalance);
//             } else {
//                 console.log("Invalid values for bet placement ",);
//                 return res.status(400).json({
//                     errorCode: 3,
//                     message: 'Invalid values for bet placement',
//                 });
//             }
//         } else if (type === 2) {
//             console.log("type 2 data",);
//             // Bet settlement logic
//             if (preserve > 0 && betAmount >= 0 && winloseAmount >= 0) {
//                 if (adminCommission > 0) {
//                     netWinAmount = winloseAmount - (winloseAmount * adminCommission / 100);
//                     console.log(netWinAmount, "netWinAmount if preserve is >0")
//                 }
//                 updatedBalance = updatedBalance + preserve - betAmount + netWinAmount;
//                 console.log(updatedBalance, "updatedBalance if preserve is >0")
//             } else if (preserve === 0 && betAmount === 0 && winloseAmount >= 0) {
//                 if (adminCommission > 0) {
//                     netWinAmount = winloseAmount - (winloseAmount * adminCommission / 100);
//                     console.log(netWinAmount, "netWinAmount if preserve is 0")
//                 }

//                 updatedBalance += netWinAmount;
//                 console.log(updatedBalance, "updatedBalance if preserve is 0")
//             } else {
//                 return res.status(400).json({
//                     errorCode: 3,
//                     message: 'Invalid values for bet settlement',
//                 });
//             }
//         } else {
//             return res.status(400).json({
//                 errorCode: 3,
//                 message: 'Invalid type value',
//             });
//         }

//         // Update user balance in the database
//         await connection.query('UPDATE users SET money = ? WHERE token = ?', [updatedBalance, token]);
//         console.log("UPDATE users SET money ", updatedBalance);

//         const response = {
//             errorCode: 0,
//             message: type === 1 ? 'Session bet placed successfully' : 'Session bet settled successfully',
//             username: user.name_user,
//             currency: 'INR',
//             balance: updatedBalance,
//             token: token
//         };

//         return res.status(200).json(response);

//     } catch (error) {
//         console.log(error)
//         return res.status(500).json({
//             errorCode: 5,
//             message: 'Other errors; see message for detail',
//             detail: error.message
//         });
//     }
// };

const jillieSessionBet = async (req, res) => {
    const { reqId, token, currency, game, round, wagersTime, betAmount, winloseAmount, userId, sessionId, type, turnover, preserve } = req.body;
    try {
        const [userRows] = await connection.query('SELECT * FROM users WHERE token = ?', [token]);

        if (!userRows.length) {
            return res.status(404).json({
                errorCode: 4,
                message: 'Token expired or invalid',
            });
        }

        const user = userRows[0];
        let updatedBalance = parseFloat(user.money); // Ensure this is a number

        // const [adminRows] = await connection.query('SELECT apiAdminCommission FROM admin LIMIT 1');

        // if (!adminRows.length) {
        //     return res.status(500).json({
        //         errorCode: 5,
        //         message: 'Admin configuration not found',
        //     });
        // }

        const adminCommission = 0; // Admin commission set to 0
        let netWinAmount = parseFloat(winloseAmount); // Ensure this is a number

        if (type === 1) {
            if (preserve > 0) {
                if (updatedBalance < preserve) {
                    return res.status(400).json({
                        errorCode: 2,
                        message: 'Insufficient balance',
                    });
                }
                updatedBalance -= preserve;
            } else if (preserve === 0 && betAmount > 0 && winloseAmount === 0) {
                if (updatedBalance < betAmount) {
                    return res.status(400).json({
                        errorCode: 2,
                        message: 'Insufficient balance',
                    });
                }
                updatedBalance -= betAmount;
            } else {
                return res.status(400).json({
                    errorCode: 3,
                    message: 'Invalid values for bet placement',
                });
            }
        } else if (type === 2) {
            if (preserve > 0 && betAmount >= 0 && winloseAmount >= 0) {
                if (adminCommission > 0) {
                    netWinAmount = netWinAmount - (netWinAmount * adminCommission / 100);
                }
                updatedBalance = updatedBalance + preserve - betAmount + netWinAmount;
            } else if (preserve === 0 && betAmount === 0 && winloseAmount >= 0) {
                if (adminCommission > 0) {
                    netWinAmount = netWinAmount - (netWinAmount * adminCommission / 100);
                }
                updatedBalance += netWinAmount;
            } else {
                return res.status(400).json({
                    errorCode: 3,
                    message: 'Invalid values for bet settlement',
                });
            }
        } else {
            return res.status(400).json({
                errorCode: 3,
                message: 'Invalid type value',
            });
        }

        // Ensure updatedBalance is a valid number with 2 decimal places
        updatedBalance = parseFloat(updatedBalance.toFixed(2)); // Round to two decimal places

        // Update user balance in the database
        await connection.query('UPDATE users SET money = ? WHERE token = ?', [updatedBalance, token]);

        const response = {
            errorCode: 0,
            message: type === 1 ? 'Session bet placed successfully' : 'Session bet settled successfully',
            username: user.name_user,
            currency: 'INR',
            balance: updatedBalance,
            token: token
        };

        return res.status(200).json(response);

    } catch (error) {
        return res.status(500).json({
            errorCode: 5,
            message: 'Other errors; see message for detail',
            detail: error.message
        });
    }
};



// const jillieSessionBet = async (req, res) => {
//     const { reqId, token, currency, game, round, wagersTime, betAmount, winloseAmount, userId, sessionId, type, turnover, preserve } = req.body;
//     console.log(req.body, "session bet")
//     try {
//         // Find the user in the database using the provided token
//         const [userRows] = await connection.query('SELECT * FROM users WHERE token = ?', [token]);

//         // Check if user exists
//         if (!userRows.length) {
//             return res.status(404).json({
//                 errorCode: 4,
//                 message: 'Token expired or invalid',
//             });
//         }

//         const user = userRows[0];
//         let updatedBalance = user.money;

//         let winning_wallet_balance = Number(user.winning_wallet_balance);
//         let jillie_total_winning_amount = Number(user.jillie_totalWinningAmount);
//         let totalWinningAmountbalance = Number(user.totalWinningAmount);

//         // Fetch the admin commission percentage
//         const [adminRows] = await connection.query('SELECT apiAdminCommission FROM admin LIMIT 1');

//         if (!adminRows.length) {
//             return res.status(500).json({
//                 errorCode: 5,
//                 message: 'Admin configuration not found',
//             });
//         }

//         // const adminCommission = adminRows[0].apiAdminCommission;
//         const adminCommission = 0;
//         console.log(adminCommission, "adminCommission")

//         let netWinAmount = winloseAmount;
//         let new_winning_wallet_balance;
//         let new_jillie_total_winning_amount;
//         let new_totalWinningAmount;
        
//         if (type === 1) {
//             // Bet placement logic
//             if (preserve > 0) {
//                 // With preserve
//                 if (updatedBalance < preserve) {
//                     return res.status(400).json({
//                         errorCode: 2,
//                         message: 'Insufficient balance',
//                     });
//                 }
//                 console.log("preserver is greater than 0 ");
//                 updatedBalance -= preserve;
//                 console.log("preserver is greater than 0 ", updatedBalance);
//             } else if (preserve === 0 && betAmount > 0 && winloseAmount === 0) {
//                 // No preserve
//                 if (updatedBalance < betAmount) {
//                     return res.status(400).json({
//                         errorCode: 2,
//                         message: 'Insufficient balance',
//                     });
//                 }
//                 console.log("preserve is 0 ");
//                 updatedBalance -= betAmount;
//                 console.log("preserve is 0 ", updatedBalance);
//             } else {
//                 console.log("Invalid values for bet placement ",);
//                 return res.status(400).json({
//                     errorCode: 3,
//                     message: 'Invalid values for bet placement',
//                 });
//             }
//         } else if (type === 2) {
//             console.log("type 2 data",);
//             // Bet settlement logic
//             console.log(preserve, "preserve")
     


//             if (preserve > 0 && betAmount >= 0 && winloseAmount >= 0) {
//                 if (adminCommission > 0) {
//                     netWinAmount = winloseAmount - (winloseAmount * adminCommission / 100);
//                     console.log(netWinAmount, "netWinAmount if preserve is >0")
//                 }
//                 updatedBalance = updatedBalance + preserve - betAmount + netWinAmount;

//                  new_winning_wallet_balance = Number(winning_wallet_balance) + Number(netWinAmount);
//                  new_jillie_total_winning_amount = Number(jillie_total_winning_amount) + Number(netWinAmount);
//                  new_totalWinningAmount = Number(totalWinningAmountbalance) + Number(netWinAmount);
    
//                 console.log(updatedBalance, "updatedBalance")
//                 console.log(new_winning_wallet_balance, "new_winning_wallet_balance")
//                 console.log(new_jillie_total_winning_amount, "new_winning_wallet_balance")
//                 console.log(new_totalWinningAmount, "new_winning_wallet_balance")

//                 console.log(updatedBalance, "updatedBalance if preserve is >0")
//             } else if (preserve === 0 && betAmount === 0 && winloseAmount >= 0) {
//                 if (adminCommission > 0) {
//                     netWinAmount = winloseAmount - (winloseAmount * adminCommission / 100);

//                     console.log(netWinAmount, "netWinAmount if preserve is 0")
//                 }

//                 updatedBalance += netWinAmount;
//                 new_winning_wallet_balance = Number(winning_wallet_balance) + Number(netWinAmount);
//                 new_jillie_total_winning_amount = Number(jillie_total_winning_amount) + Number(netWinAmount);
//                 new_totalWinningAmount = Number(totalWinningAmountbalance) + Number(netWinAmount);

//                 console.log(updatedBalance, "updatedBalance if preserve is 0")
//             } else {
//                 return res.status(400).json({
//                     errorCode: 3,
//                     message: 'Invalid values for bet settlement',
//                 });
//             }
//         } else {
//             return res.status(400).json({
//                 errorCode: 3,
//                 message: 'Invalid type value',
//             });
//         }

//         // Update user balance in the database
//         // await connection.query('UPDATE users SET money = ? WHERE token = ?', [updatedBalance, token]);
//         await connection.query('UPDATE users SET money = ?,winning_wallet_balance = ?, jillie_totalWinningAmount = ?,totalWinningAmount = ? WHERE token = ?', [updatedBalance, new_winning_wallet_balance, new_jillie_total_winning_amount, new_totalWinningAmount, token]);


//         const response = {
//             errorCode: 0,
//             message: type === 1 ? 'Session bet placed successfully' : 'Session bet settled successfully',
//             username: user.name_user,
//             currency: 'INR',
//             balance: updatedBalance,
//             token: token
//         };

//         return res.status(200).json(response);

//     } catch (error) {
//         return res.status(500).json({
//             errorCode: 5,
//             message: 'Other errors; see message for detail',
//             detail: error.message
//         });
//     }
// };


const jillieCancelSessionBet = async (req, res) => {
    const { reqId, currency, game, round, betAmount, winloseAmount, userId, token, sessionId, type, preserve } = req.body;
    // console.log(req.body, "cancelSessionBet")
    try {
        // Find the user in the database using the provided token
        const [userRows] = await connection.query('SELECT * FROM users WHERE token = ?', [token]);

        if (!userRows.length) {
            return res.status(404).json({
                errorCode: 4,
                message: 'Token expired or invalid',
            });
        }

        const user = userRows[0];
        let updatedBalance;

        if (type === 1) {
            // Handle session bet cancellation
            if (preserve) {
                // Calculate balance after cancel with preserve
                updatedBalance = user.money + preserve;
            } else {
                // Calculate balance after cancel without preserve
                updatedBalance = user.money + betAmount;
            }

            if (updatedBalance < 0) {
                return res.status(400).json({
                    errorCode: 6,
                    message: 'Cancel refused: insufficient balance',
                });
            }

            // Update the user balance in the database
            await connection.query('UPDATE users SET money = ? WHERE token = ?', [updatedBalance, token]);

            const response = {
                errorCode: 0,
                message: 'Session bet canceled successfully',
                username: user.name_user,
                currency: 'INR',
                balance: updatedBalance,
                txId: sessionId // Assuming txId is the same as sessionId for simplicity
            };

            return res.status(200).json(response);
        } else {
            return res.status(400).json({
                errorCode: 5,
                message: 'Cancel refused: only type 1 sessional bets can be cancelled',
            });
        }
    } catch (error) {
        res.status(500).json({
            errorCode: 5,
            message: 'Other errors; see message for detail',
            detail: error.message
        });
    }
};


const getAllJillieGames = async (req, res) => {
    const params = {
        AgentId: AGENT_ID,
        Key: generateKey({ AgentId: AGENT_ID })
    };

    try {
        const response = await axios.post(`${API_URL}GetGameList`, params);
        return res.json(response.data); // Assuming you want to return JSON response
    } catch (error) {
        console.error('Error fetching game list', error);
        return res.status(500).json({ error: 'Error fetching game list' });
    }
};

const playJillieGame = async (req, res) => {
    const { gameId } = req.body; // Extract gameId from request body
    const userToken = req.userToken;
    // console.log(userToken)
    console.log(gameId, "gameId",userToken); // Check if gameId is correctly received
    const params = {
        Token: String(userToken),  // Replace with your actual access token
        GameId: Number(gameId), // Fixed to correctly access gameId
        Lang: 'en-US',
        HomeUrl: 'https://metaplay.club',
        Platform: 'web',
        AgentId: AGENT_ID,
        Key: generateKey({
            Token: String(userToken),
            GameId: String(gameId), // Fixed to correctly access gameId
            Lang: 'en-US',
            AgentId: AGENT_ID
        })
    };

    try {

        console.log(`${API_URL}singleWallet/LoginWithoutRedirect`, params)
       
        const response = await axios.post(`${API_URL}singleWallet/LoginWithoutRedirect`, params);
        console.log(response.data)
        if (response.data && response.data.Data) {
            console.log(response.data.Data)
            return res.json({ Data: response.data.Data });
        } else {
            console.error('Game URL not found');
            return res.status(400).json({ error: 'Game URL not found' });
        }
    } catch (error) {
        console.error('Error playing game', error);
        return res.status(500).json({ error: 'Error playing game' });
    }
};

const generateKey = (params) => {
    const now = new Date();
    const year = (now.getUTCFullYear() % 100).toString().padStart(2, '0');
    const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = now.getUTCDate().toString();

    // Determine if the day is single digit (1-9) or double digit (10-31)
    const formattedDay = day.length === 1 ? day : day.slice(-2);

    const formattedDate = `${year}${month}${formattedDay}`;
    console.log(formattedDate)
    const keyG = md5(`${formattedDate}${AGENT_ID}${AGENT_KEY}`);
    const querystring = Object.keys(params).map(key => `${key}=${params[key]}`).join('&');
    const md5string = md5(querystring + keyG);
    const randomText1 = '123456'; // Replace with a random string generator if needed
    const randomText2 = 'abcdef'; // Replace with a random string generator if needed
    return `${randomText1}${md5string}${randomText2}`;
};


const jillieSinglePlayerHistoryPage = async (req, res) => {
    return res.render("gameApis/jillieGameHistory.ejs");
}

const getSinglePlyerBetRecord = async (req, res) => {
    const userToken = req.userToken;

    const params = {
        Token: String(userToken),
        AgentId: AGENT_ID,
        StartTime: "2024-06-15T03:00:00",
        EndTime: "2024-07-03T03:23:00",
        Page: 1,
        PageLimit: 10002,
        Account: "Member51404",
        Key: generateKey({
            Page: 1,
            StartTime: "2024-06-15T03:00:00",
            EndTime: "2024-07-03T03:23:00",
            Account: "Member51404",
            PageLimit: 10002
        })

    };
    try {
        const response = await axios.post(`${API_URL}GetUserBetRecordByTime`, params);
        console.log(response)
        return response.data;
    } catch (error) {
        console.error('Error fetching bet record summary', error);
        throw error;
    }
};


const JilliGameController = {
    jillieAuth,
    jillieBet,
    jillieCancelBet,
    jillieSessionBet,
    jillieCancelSessionBet,
    getAllJillieGames,
    playJillieGame,
    jillieSinglePlayerHistoryPage,
    getSinglePlyerBetRecord
};

export default JilliGameController;

