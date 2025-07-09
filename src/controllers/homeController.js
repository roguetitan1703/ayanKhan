import connection from "../config/connectDB.js";
import axios from 'axios';
import querystring from 'querystring';

const homePage = async (req, res) => {
  const [settings] = await connection.query("SELECT `app` FROM admin_ac");
  let app = settings[0].app;
  return res.render("home/index.ejs", { app });
};

const slotspribePage = async (req, res) => {
  return res.render("spribe/slots.ejs");
}

const slotjiliCasinoPage = async (req, res) => {
  return res.render("jili/slotjiliCasino.ejs");
}

const activityPage = async (req, res) => {
  return res.render("checkIn/activity.ejs");
};

const supportPage = async (req, res) => {
  let auth = req.cookies.auth;

  const [users] = await connection.query(
    "SELECT `level`, `ctv` FROM users WHERE token = ?",
    [auth],
  );

  let telegram = "";
  if (users.length == 0) {
    let [settings] = await connection.query(
      "SELECT `telegram`, `cskh` FROM admin_ac",
    );
    telegram = settings[0].telegram;
  } else {
    if (users[0].level != 0) {
      var [settings] = await connection.query("SELECT * FROM admin_ac");
    } else {
      var [check] = await connection.query(
        "SELECT `telegram` FROM point_list WHERE phone = ?",
        [users[0].ctv],
      );
      if (check.length == 0) {
        var [settings] = await connection.query("SELECT * FROM admin_ac");
      } else {
        var [settings] = await connection.query(
          "SELECT `telegram` FROM point_list WHERE phone = ?",
          [users[0].ctv],
        );
      }
    }
    telegram = settings[0].telegram;
  }

  return res.render("member/support.ejs", { telegram });
};

const attendancePage = async (req, res) => {
  return res.render("checkIn/attendance.ejs");
};
const firstDepositBonusPage = async (req, res) => {
  return res.render("checkIn/firstDepositBonus.ejs");
};
const promotionRebateRatioPage = async (req, res) => {
  return res.render("promotion/rebateRadio.ejs");
};

const rebatePage = async (req, res) => {
  return res.render("checkIn/rebate.ejs");
};

const vipPage = async (req, res) => {
  return res.render("checkIn/vip.ejs");
};

const jackpotPage = async (req, res) => {
  return res.render("checkIn/jackpot.ejs");
};

const dailytaskPage = async (req, res) => {
  return res.render("checkIn/dailytask.ejs");
};

const invibonusPage = async (req, res) => {
  return res.render("checkIn/invibonus.ejs");
};
const invitationRulesPage = async (req, res) => {
  return res.render("checkIn/invitationRules.ejs");
};

const jackpotRulesPage = async (req, res) => {
  return res.render("checkIn/rules.ejs");
};

const aviatorBettingRewardPage = async (req, res) => {
  return res.render("checkIn/aviator_betting_reward.ejs");
};
const socialVideoAwardPagePage = async (req, res) => {
  return res.render("checkIn/social_video_award.ejs");
};

const jackpotWiningStarPage = async (req, res) => {
  return res.render("checkIn/wining_star.ejs");
};

const checkInPage = async (req, res) => {
  return res.render("checkIn/checkIn.ejs");
};

const checkDes = async (req, res) => {
  return res.render("checkIn/checkDes.ejs");
};

const checkRecord = async (req, res) => {
  return res.render("checkIn/checkRecord.ejs");
};

const addBank = async (req, res) => {
  return res.render("wallet/addbank.ejs");
};

const selectBank = async (req, res) => {
  return res.render("wallet/selectBank.ejs");
};
const invitationRecord = async (req, res) => {
  return res.render("checkIn/invitationRecord.ejs");
};
const rechargeAwardCollectionRecord = async (req, res) => {
  return res.render("checkIn/rechargeAwardCollectionRecord.ejs");
};
const attendanceRecordPage = async (req, res) => {
  return res.render("checkIn/attendanceRecord.ejs");
};
const attendanceRulesPage = async (req, res) => {
  return res.render("checkIn/attendanceRules.ejs");
};

const changeAvatarPage = async (req, res) => {
  return res.render("member/change_avatar.ejs");
};

// promotion
const promotionPage = async (req, res) => {
  return res.render("promotion/promotion.ejs");
};

const subordinatesPage = async (req, res) => {
  return res.render("promotion/subordinates.ejs");
};

const promotion1Page = async (req, res) => {
  return res.render("promotion/promotion1.ejs");
};

const promotionmyTeamPage = async (req, res) => {
  return res.render("promotion/myTeam.ejs");
};

const promotionDesPage = async (req, res) => {
  return res.render("promotion/promotionDes.ejs");
};

const comhistoryPage = async (req, res) => {
  return res.render("promotion/comhistory.ejs");
};

const tutorialPage = async (req, res) => {
  return res.render("promotion/tutorial.ejs");
};

const bonusRecordPage = async (req, res) => {
  return res.render("promotion/bonusrecord.ejs");
};

// wallet

const transactionhistoryPage = async (req, res) => {
  return res.render("wallet/transactionhistory.ejs");
};
const gameHistoryPage = async (req, res) => {
  return res.render("member/game_history.ejs");
};

const walletPage = async (req, res) => {
  return res.render("wallet/index.ejs");
};

const rechargePage = async (req, res) => {
  return res.render("wallet/recharge.ejs", {
    MINIMUM_MONEY_USDT: process.env.MINIMUM_MONEY_USDT,
    MINIMUM_MONEY_INR: process.env.MINIMUM_MONEY_INR,
    USDT_INR_EXCHANGE_RATE: process.env.USDT_INR_EXCHANGE_RATE,
  });
};

const addBonus = (amount) => {
  return amount + (amount / 100) * 20;
};

const rechargerecordPage = async (req, res) => {
  console.log("Get Request Found");
  let auth = req.cookies.auth;
  const [user] = await connection.query('SELECT `level`, `phone` FROM users WHERE `token` =? ', [auth]);

  const [rechargePending] = await connection.query('SELECT * FROM recharge where `phone` =? and status = 0',[user[0].phone]);

  const promises = rechargePending.map(async (element) => {
    const id = element.id; // assuming that `id` is the primary key of the `recharge` table
    const order_id = element.id_order;
    const money = element.money;
    const dataToSend = querystring.stringify({
      user_token: process.env.JAIPAY_PAYMENT_KEY,
      order_id: order_id
    });

    try {
      const api = axios.create({
        baseURL: 'https://jaipay.in/api',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const response = await api.post('/check-order-status', dataToSend);

      if (response.data && response.data.result) {
        if (response.data.result.txnStatus === "SUCCESS" || response.data.result.status === "Transaction Successfully") {
          // update database and redirect user
          const utr = response.data.result.utr;
          const orderId = element.id_order;
          const amount = element.money;
          const userId = user[0].phone;

          // Add 20% bonus to the recharge amount only if transaction is successful
          const totalAmount = addBonus(amount);

  // Fetch invite code from users table
  const inviteQuery = "SELECT invite FROM users WHERE phone = ?";
  const inviteResult = await connection.query(inviteQuery, [userId]);
  const inviteCode = inviteResult[0].invite;

  // Add invite bonus if applicable and recharge is successful
  if (inviteCode) {
    const inviterMoney = (amount / 100) * 20;
    await connection.query("UPDATE users SET money = money + ?, total_money = total_money + ? WHERE `invite` = ? AND `phone` = ?", [inviterMoney, inviterMoney, inviteCode, userId]);
    console.log("Invite bonus added to inviter's account:", inviterMoney);
  }

          const updateQuery1 = "UPDATE recharge SET utr = ?, status = '1' WHERE id_order = ?";
          await connection.query(updateQuery1, [utr, orderId]);

          const updateQuery2 = "UPDATE users SET money = money + ?, total_money = total_money + ? WHERE phone = ?";
          await connection.query(updateQuery2, [totalAmount, totalAmount, userId]);

        } else {
          // API call failed, do not add bonus
          const errorMessage = response.data.message;
          console.log("API Error: " + errorMessage);
        }
      } else {
        console.log("API Error: No response data");
      }
    } catch (e) {
      console.log("Error: ", e);
    }
  });

  try {
    await Promise.all(promises);
  } catch (e) {
    // console.log("Error: ", e);
  }

  return res.render("wallet/rechargerecord.ejs");
};

const withdrawalPage = async (req, res) => {
  return res.render("wallet/withdrawal.ejs", {
    MINIMUM_MONEY_USDT: process.env.MINIMUM_WITHDRAWAL_MONEY_USDT,
    MINIMUM_MONEY_INR: process.env.MINIMUM_WITHDRAWAL_MONEY_INR,
    USDT_INR_EXCHANGE_RATE: process.env.USDT_INR_EXCHANGE_RATE,
  });
};

const withdrawalrecordPage = async (req, res) => {
  return res.render("wallet/withdrawalrecord.ejs");
};
const transfer = async (req, res) => {
  return res.render("wallet/transfer.ejs");
};

// member page
const mianPage = async (req, res) => {
  let auth = req.cookies.auth;
  const [user] = await connection.query(
    "SELECT `level` FROM users WHERE `token` = ? ",
    [auth],
  );
  const [settings] = await connection.query("SELECT `cskh` FROM admin_ac");
  let cskh = settings[0].cskh;
  let level = user[0].level;
  return res.render("member/index.ejs", { level, cskh });
};

const settingsPage = async (req, res) => {
  let auth = req.cookies.auth;
  const [user] = await connection.query(
    "SELECT * FROM users WHERE `token` = ? ",
    [auth],
  );

  return res.render("member/settings.ejs", {
    NICKNAME: user[0].name_user,
    USER_ID: user[0].id_user,
  });
};

const aboutPage = async (req, res) => {
  return res.render("member/about/index.ejs");
};

const guidePage = async (req, res) => {
  return res.render("member/guide.ejs");
};

const feedbackPage = async (req, res) => {
  return res.render("member/feedback.ejs");
};

const notificationPage = async (req, res) => {
  return res.render("member/notification.ejs");
};

const loginNotificationPage = async (req, res) => {
  return res.render("member/login_notification.ejs");
};

const recordsalary = async (req, res) => {
  return res.render("member/about/recordsalary.ejs");
};

const privacyPolicy = async (req, res) => {
  return res.render("member/about/privacyPolicy.ejs");
};

const newtutorial = async (req, res) => {
  return res.render("member/newtutorial.ejs");
};

const forgot = async (req, res) => {
  let auth = req.cookies.auth;
  const [user] = await connection.query(
    "SELECT `time_otp` FROM users WHERE token = ? ",
    [auth],
  );
  let time = user[0].time_otp;
  return res.render("member/forgot.ejs", { time });
};

const redenvelopes = async (req, res) => {
  return res.render("member/redenvelopes.ejs");
};

const riskAgreement = async (req, res) => {
  return res.render("member/about/riskAgreement.ejs");
};

const myProfilePage = async (req, res) => {
  return res.render("member/myProfile.ejs");
};

const getSalaryRecord = async (req, res) => {
  const auth = req.cookies.auth;

  const [rows] = await connection.query(`SELECT * FROM users WHERE token = ?`, [
    auth,
  ]);
  let rowstr = rows[0];
  if (!rows) {
    return res.status(200).json({
      message: "Failed",
      status: false,
    });
  }
  const [getPhone] = await connection.query(
    `SELECT * FROM salary WHERE phone = ? ORDER BY time DESC`,
    [rowstr.phone],
  );
  

  console.log("asdasdasd : " + [rows.phone]);
  return res.status(200).json({
    message: "Success",
    status: true,
    data: {},
    rows: getPhone,
  });
};

const myGameHistory = async (req, res) => {
  const auth = req.cookies.auth;

  console.log(auth);

  const [rows] = await connection.query(`SELECT * FROM users WHERE token = ?`, [
    auth,
  ]);
  let rowstr = rows[0];
  if (!rows) {
    return res.status(200).json({
      message: "Failed",
      status: false,
    });
  }

  // Get pagination parameters (page and limit), with defaults
  const page = parseInt(req.query.page) || 1;   // Default to page 1 if not provided
  const limit = parseInt(req.query.limit) || 10; // Default to 10 records per page if not provided
  const offset = (page - 1) * limit;            // Calculate the offset for pagination

  let history;
  let totalRecords;

  try {
    // Fetch the total number of records for pagination
    if (req.query.game == "smartSoft") {
      [totalRecords] = await connection.query(
        `SELECT COUNT(*) AS total FROM smartSofttransaction WHERE phone = ?`,
        [rowstr.phone]
      );

      // Fetch the paginated history data
      [history] = await connection.query(
        `SELECT * FROM smartSofttransaction WHERE phone = ? ORDER BY time DESC LIMIT ? OFFSET ?`,
        [rowstr.phone, limit, offset]
      );
    } else if (req.query.game == "spribe") {
      [totalRecords] = await connection.query(
        `SELECT COUNT(*) AS total FROM spribetransaction WHERE phone = ?`,
        [rowstr.phone]
      );

      // Fetch the paginated history data
      [history] = await connection.query(
        `SELECT * FROM spribetransaction WHERE phone = ? ORDER BY time DESC LIMIT ? OFFSET ?`,
        [rowstr.phone, limit, offset]
      );
    } else if(req.query.game == "Lottery"){

      [totalRecords] = await connection.query(
        `SELECT COUNT(*) AS total FROM minutes_1 WHERE phone = ? AND status != 0`,
        [rowstr.phone]
      );

      // Fetch the paginated history data
      [history] = await connection.query(
        `SELECT * FROM minutes_1 WHERE phone = ? AND status != 0 ORDER BY time DESC LIMIT ? OFFSET ?`,
        [rowstr.phone, limit, offset]
      );
      
    }

    // Return the response with paginated data and total record count
    return res.status(200).json({
      message: "Success",
      status: true,
      data: {
        totalRecords: totalRecords[0].total, // Total records count for pagination
        rows: history,                       // Paginated history data
      },
    });

  } catch (e) {
    console.error("Error fetching game history:", e);
    return res.status(500).json({
      message: "Error fetching game history",
      status: false,
    });
  }
};


const homeController = {
  gameHistoryPage,
  homePage,
  checkInPage,
  invibonusPage,
  rebatePage,
  jackpotPage,
  vipPage,
  activityPage,
  dailytaskPage,
  promotionPage,
  subordinatesPage,
  promotion1Page,
  walletPage,
  mianPage,
  myProfilePage,
  promotionmyTeamPage,
  promotionDesPage,
  comhistoryPage,
  tutorialPage,
  bonusRecordPage,
  rechargePage,
  rechargerecordPage,
  withdrawalPage,
  withdrawalrecordPage,
  aboutPage,
  privacyPolicy,
  riskAgreement,
  newtutorial,
  redenvelopes,
  forgot,
  checkDes,
  checkRecord,
  addBank,
  transfer,
  recordsalary,
  getSalaryRecord,
  transactionhistoryPage,
  jackpotRulesPage,
  jackpotWiningStarPage,
  attendancePage,
  firstDepositBonusPage,
  aviatorBettingRewardPage,
  socialVideoAwardPagePage,
  promotionRebateRatioPage,
  settingsPage,
  guidePage,
  feedbackPage,
  notificationPage,
  loginNotificationPage,
  selectBank,
  invitationRecord,
  rechargeAwardCollectionRecord,
  attendanceRecordPage,
  attendanceRulesPage,
  changeAvatarPage,
  invitationRulesPage,
  supportPage,
  slotspribePage,
  slotjiliCasinoPage,
  myGameHistory
  
};

export default homeController;
