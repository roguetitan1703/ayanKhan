import connection from "../config/connectDB.js";
import GameRepresentationIds from "../constants/game_representation_id.js";
import {
  generateCommissionId,
  generatePeriods,
  yesterdayTime,
} from "../helpers/games.js";

// helper functions
function generateProductId() {
  const date = new Date();
  const years = formatTime(date.getFullYear());
  const months = formatTime(date.getMonth() + 1);
  const days = formatTime(date.getDate());
  return years + months + days + Math.floor(Math.random() * 1000000000000000);
}

function determineColor(join) { 
  return JOIN_COLOR_MAP[join] || (join % 2 === 0 ? "red" : "green");
}

function generateCheckJoin(join) {
  if ((!isNumber(join) && join === "l") || join === "n") {
    return `
      <div data-v-a9660e98="" class="van-image" style="width: 30px; height: 30px;">
          <img src="/images/${join === "n" ? "small" : "big"}.png" class="van-image__img">
      </div>
      `;
  } else {
    return `
      <span data-v-a9660e98="">${isNumber(join) ? join : ""}</span>
      `;
  }
}
// end helper functions

const winGoPage = async (req, res) => {
  return res.render("bet/wingo/win.ejs");
};

const winGoPage3 = async (req, res) => {
  return res.render("bet/wingo/win3.ejs");
};

const winGoPage5 = async (req, res) => {
  return res.render("bet/wingo/win5.ejs");
};

const winGoPage10 = async (req, res) => {
  return res.render("bet/wingo/win10.ejs");
};

const isNumber = (params) => {
  let pattern = /^[0-9]*\d$/;
  return pattern.test(params);
};

function formateT(params) {
  let result = params < 10 ? "0" + params : params;
  return result;
}

function timerJoin(params = "", addHours = 0) {
  let date = "";
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

  return (
    years +
    "-" +
    months +
    "-" +
    days +
    " " +
    hours +
    ":" +
    minutes +
    ":" +
    seconds +
    " " +
    ampm
  );
}

const rosesPlus = async (phone, money, levels = [], timeNow = "") => {
  try {
    const [userResult] = await connection.query(
      "SELECT `phone`, `code`, `invite`, `money` FROM users WHERE phone = ? AND veri = 1 LIMIT 1",
      [phone],
    );
    const userInfo = userResult[0];

    if (!userInfo) {
      return;
    }

    let userReferrer = userInfo.invite;
    let commissionsToInsert = [];
    let usersToUpdate = [];

    for (let i = 0; i < levels.length; i++) {
      const levelCommission = levels[i] * money;
      const [referrerRows] = await connection.query(
        "SELECT phone, money, code, invite FROM users WHERE code = ?",
        [userReferrer],
      );
      const referrerInfo = referrerRows[0];

      if (referrerInfo) {
        const commissionId = generateCommissionId();

        commissionsToInsert.push([
          commissionId,
          referrerInfo.phone,
          userInfo.phone,
          levelCommission,
          i + 1,
          timeNow,
        ]);
        usersToUpdate.push([levelCommission, referrerInfo.phone]);
        userReferrer = referrerInfo.invite;
      } else {
        console.log(`Level ${i + 1} referrer not found.`);
        break;
      }
    }

    if (commissionsToInsert.length > 0) {
      await connection.query(
        "INSERT INTO commissions (commission_id, phone, from_user_phone, money, level, time) VALUES ?",
        [commissionsToInsert],
      );
    }

    if (usersToUpdate.length > 0) {
      const updatePromises = usersToUpdate.map(([money, phone]) =>
        connection.query("UPDATE users SET money = money + ? WHERE phone = ?", [
          money,
          phone,
        ]),
      );
      await Promise.all(updatePromises);
    }

    return {
      success: true,
      message: "Commissions calculated and inserted successfully.",
    };
  } catch (error) {
    console.error(error);
    return { success: false, message: error.message };
  }
};



function timerJoin2(params = '', addHours = 0) {
  let date = params ? new Date(Number(params)) : new Date();
  if (addHours !== 0) {
    date.setHours(date.getHours() + addHours);
  }

  const options = {
    timeZone: 'Asia/Kolkata', // Specify the desired time zone
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // 24-hour format
  };

  const formatter = new Intl.DateTimeFormat('en-GB', options);
  const parts = formatter.formatToParts(date);

  const getPart = (type) => parts.find(part => part.type === type).value;

  const formattedDate = `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;

  return formattedDate;
}


const commissions = async (auth, money) => {
  const [user] = await connection.query('SELECT `phone`, `code`, `invite`, `user_level`, `total_money` FROM users WHERE token = ?', [auth]);
  let userInfo = user

  // commission


  const [level] = await connection.query('SELECT * FROM level ');

  let checkTime2 = timerJoin2(Date.now());


  let uplines2 = userInfo;
  let count = 0
  for (let i = 0; i < 6; i++) {
    const rosesFs = (money / 100) * level[i].f1

    if (uplines2.length !== 0) {
      let [upline1] = await connection.query('SELECT * FROM users WHERE code = ?', [uplines2[0].invite]);

      if (upline1.length > 0) {
        count++
        await connection.query('INSERT INTO subordinatedata SET phone = ?, bonusby=?, type = ?, commission=?, amount = ?, level=?, `date` = ?', [upline1[0].phone, uplines2[0].phone, "bet commission", rosesFs, money, count, checkTime2]);
        await connection.query('UPDATE users SET money = money + ? WHERE phone = ? ', [rosesFs, upline1[0].phone]);
        uplines2 = upline1;
      } else {
        break; // Exit the loop if no further uplines are found
      }
    } else {
      break; // Exit the loop if uplines2 is empty
    }
  }

}


const distributeCommission = async () => {
  try {
    const { startOfYesterdayTimestamp, endOfYesterdayTimestamp } =
      yesterdayTime();
    const [levelResult] = await connection.query("SELECT f1 FROM level");
    const levels = levelResult.map((row) => row.f1 / 100);

    // const [bets] = await connection.query('SELECT phone, SUM(money + fee) AS total_money FROM minutes_1 WHERE time > ? AND time <= ? GROUP BY phone', [startOfDay, endTime]);

    const [bets] = await connection.query(
      `
      SELECT phone, SUM(total_money) AS total_money
      FROM (
        SELECT phone, SUM(money + fee) AS total_money
        FROM minutes_1
        WHERE time > ? AND time <= ?
        GROUP BY phone
        UNION ALL
        SELECT phone, SUM(money + fee) AS total_money
        FROM trx_wingo_bets
        WHERE time > ? AND time <= ?
        GROUP BY phone
      ) AS combined
      GROUP BY phone
      `,
      [
        startOfYesterdayTimestamp,
        endOfYesterdayTimestamp,
        startOfYesterdayTimestamp,
        endOfYesterdayTimestamp,
      ],
    );

    const promises = bets.map((bet) =>
      rosesPlus(bet.phone, bet.total_money, levels, endOfYesterdayTimestamp),
    );
    const response = await Promise.all(promises);
    return {
      success: true,
      message: "Commissions distributed successfully.",
    };
  } catch (error) {
    console.error(error);
    return { success: false, message: error.message };
  }
};

const VALID_TYPE_IDS = [1, 3, 5, 10];
const GAME_JOIN_MAP = {
  1: "wingo",
  3: "wingo3",
  5: "wingo5",
  10: "wingo10",
};
const JOIN_COLOR_MAP = {
  l: "big",
  n: "small",
  t: "violet",
  d: "red",
  x: "green",
  0: "red-violet",
  5: "green-violet",
};

const betWinGo = async (req, res) => {
  let { typeid, join, x, money } = req.body;
  let auth = req.cookies.auth;

  if (typeid != 1 && typeid != 3 && typeid != 5 && typeid != 10) {
    return res.status(200).json({
      message: "Error!",
      status: true,
    });
  }

  let gameJoin = "";
  if (typeid == 1) gameJoin = "wingo";
  if (typeid == 3) gameJoin = "wingo3";
  if (typeid == 5) gameJoin = "wingo5";
  if (typeid == 10) gameJoin = "wingo10";
  const [winGoNow] = await connection.query(
    "SELECT period FROM wingo WHERE status = 0 AND game = ? ORDER BY id DESC LIMIT 1",
    [gameJoin],
  );
  const [user] = await connection.query(
    "SELECT `phone`,`needbet`, `code`, `invite`, `level`, `money`,`isdemo`, `bonus_money` FROM users WHERE token = ? AND veri = 1  LIMIT 1 ",
    [auth],
  );

  if (!winGoNow[0] || !user[0] || !isNumber(x) || !isNumber(money)) {
    return res.status(200).json({
      message: "Error!",
      status: true,
    });
  }

  let userInfo = user[0];
  let period = winGoNow[0].period;
  let fee = x * money * 0.02;
  let total = x * money - fee;
  let timeNow = Date.now();
  let check = userInfo.money - total;

  console.log("fee", fee);
  console.log("total", total);
  console.log("check", check);
  console.log("timeNow", timeNow);

  let date = new Date();
  let years = formateT(date.getFullYear());
  let months = formateT(date.getMonth() + 1);
  let days = formateT(date.getDate());
  let id_product =
    years + months + days + Math.floor(Math.random() * 1000000000000000);

  let formatTime = timerJoin();

  let color = "";
  if (join == "l") {
    color = "big";
  } else if (join == "n") {
    color = "small";
  } else if (join == "t") {
    color = "violet";
  } else if (join == "d") {
    color = "red";
  } else if (join == "x") {
    color = "green";
  } else if (join == "0") {
    color = "red-violet";
  } else if (join == "5") {
    color = "green-violet";
  } else if (join % 2 == 0) {
    color = "red";
  } else if (join % 2 != 0) {
    color = "green";
  }

  let checkJoin = "";

  if ((!isNumber(join) && join == "l") || join == "n") {
    checkJoin = `
        <div data-v-a9660e98="" class="van-image" style="width: 30px; height: 30px;">
            <img src="/images/${join == "n" ? "small" : "big"}.png" class="van-image__img">
        </div>
        `;
  } else {
    checkJoin = `
        <span data-v-a9660e98="">${isNumber(join) ? join : ""}</span>
        `;
  }

  let result = `
    `;

  function timerJoin(params = "", addHours = 0) {
    let date = "";
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

    return (
      years +
      "-" +
      months +
      "-" +
      days +
      " " +
      hours +
      ":" +
      minutes +
      ":" +
      seconds +
      " " +
      ampm
    );
  }

  let checkTime = timerJoin(date.getTime());

  if (check >= 0) {
    const sql = `INSERT INTO minutes_1 SET 
        id_product = ?,
        phone = ?,
        code = ?,
        invite = ?,
        stage = ?,
        level = ?,
        money = ?,
        amount = ?,
        fee = ?,
        get = ?,
        game = ?,
        bet = ?,
        status = ?,
        today = ?,
        time = ?,
        isdemo=?
        `;
    let dataRes = await connection.query(sql, [
      id_product,
      userInfo.phone,
      userInfo.code,
      userInfo.invite,
      period,
      userInfo.level,
      total,
      x,
      fee,
      0,
      gameJoin,
      join,
      0,
      checkTime,
      timeNow,
      userInfo.isdemo
    ]);

    const previous_bonus_money = userInfo.bonus_money;

    const totalBetMoney = money * x;
    let mainWalletBetMoney = totalBetMoney * 0.98;
    let bonusWalletBetMoney = totalBetMoney * 0.02;

    if (!(previous_bonus_money >= bonusWalletBetMoney)) {
      mainWalletBetMoney = totalBetMoney;
      bonusWalletBetMoney = 0;
    }
    
    
   let total_needbet = Math.max(userInfo.needbet - mainWalletBetMoney, 0);
    await connection.query(
      "UPDATE users SET money = money - ?, total_money = total_money - ?,needbet=?, bonus_money = bonus_money - ? WHERE token = ?",
      [mainWalletBetMoney, mainWalletBetMoney,total_needbet, bonusWalletBetMoney, auth],
    );

 
    const [users] = await connection.query(
      "SELECT `money`, `bonus_money`, `level` FROM users WHERE token = ? AND veri = 1  LIMIT 1 ",
      [auth],
    );

   

    // rosesPlus(auth, money * x);
    await commissions(auth, money * x)
    return res.status(200).json({
      message: "Successful bet",
      status: true,
      data: result,
      change: users[0].level,
      money: users[0].money,
      bonus_money: users[0].bonus_money,
      user: userInfo.isdemo
    });
  } else {
    return res.status(200).json({
      message: "The amount is not enough",
      status: false,
    });
  }
};
const listOrderOld = async (req, res) => {
  let { typeid, pageno, pageto } = req.body;

  if (typeid != 1 && typeid != 3 && typeid != 5 && typeid != 10)
    return res.status(200).json({
      message: "Error!",
      status: true,
    });

  if (pageno < 0 || pageto < 0)
    return res.status(200).json({
      code: 0,
      msg: "No more data",
      data: {
        gameslist: [],
      },
      page: 1,
      status: false,
    });

  let auth = req.cookies.auth;

  const [user] = await connection.query(
    "SELECT `phone`, `code`, `invite`, `level`, `money` FROM users WHERE token = ? AND veri = 1  LIMIT 1 ",
    [auth],
  );
  if (!user[0]) {
    return res.status(200).json({
      message: "Authentication failed!",
      status: true,
    });
  }

  let game = "";
  if (typeid == 1) game = "wingo";
  if (typeid == 3) game = "wingo3";
  if (typeid == 5) game = "wingo5";
  if (typeid == 10) game = "wingo10";

  const [wingo] = await connection.query(
    "SELECT * FROM wingo WHERE status != 0 AND game = ? ORDER BY id DESC LIMIT ?, ?",
    [game, Number(pageno), Number(pageto)],
  );
  const [wingoAll] = await connection.query(
    "SELECT COUNT(*) as game_length FROM wingo WHERE status != 0 AND game = ?",
    [game],
  );
  const [period] = await connection.query(
    "SELECT period FROM wingo WHERE status = 0 AND game = ? ORDER BY id DESC LIMIT 1",
    [game],
  );

  if (wingo.length == 0 && period.length !== 0)
    return res.status(200).json({
      code: 0,
      msg: "No more data",
      data: {
        gameslist: [],
      },
      period: period[0].period,
      page: 1,
      status: false,
    });

  if (period.length == 0)
    return res.status(200).json({
      message: "Unable to get previous period",
      status: true,
    });

  let page = Math.ceil(wingoAll[0].game_length / 10);

  return res.status(200).json({
    code: 0,
    msg: "Receive success",
    data: {
      gameslist: wingo,
    },
    period: period[0].period,
    page: page,
    status: true,
  });
};

const GetMyEmerdList = async (req, res) => {
  let { typeid, pageno, pageto } = req.body;

  // if (!pageno || !pageto) {
  //     pageno = 0;
  //     pageto = 10;
  // }

  if (typeid != 1 && typeid != 3 && typeid != 5 && typeid != 10) {
    return res.status(200).json({
      message: "Error!",
      status: true,
    });
  }

  if (pageno < 0 || pageto < 0) {
    return res.status(200).json({
      code: 0,
      msg: "No more data",
      data: {
        gameslist: [],
      },
      page: 1,
      status: false,
    });
  }
  let auth = req.cookies.auth;

  let game = "";
  if (typeid == 1) game = "wingo";
  if (typeid == 3) game = "wingo3";
  if (typeid == 5) game = "wingo5";
  if (typeid == 10) game = "wingo10";

  const [user] = await connection.query(
    "SELECT `phone`, `code`, `invite`, `level`, `money` FROM users WHERE token = ? AND veri = 1 LIMIT 1",
    [auth],
  );
  const [minutes_1] = await connection.query(
    "SELECT * FROM minutes_1 WHERE phone = ? AND game = ? ORDER BY id DESC LIMIT ?, ?",
    [user[0].phone, game, Number(pageno), Number(pageto)],
  );
  const [minutes_1All] = await connection.query(
    "SELECT COUNT(*) as bet_length FROM minutes_1 WHERE phone = ? AND game = ?",
    [user[0].phone, game],
  );

  if (!minutes_1[0]) {
    return res.status(200).json({
      code: 0,
      msg: "No more data",
      data: {
        gameslist: [],
      },
      page: 1,
      status: false,
    });
  }
  if (!pageno || !pageto || !user[0] || !minutes_1[0]) {
    return res.status(200).json({
      message: "Error!",
      status: true,
    });
  }
  let page = Math.ceil(minutes_1All[0].bet_length / 10);

  let datas = minutes_1.map((data) => {
    let { id, phone, code, invite, level, game, ...others } = data;
    return others;
  });

  return res.status(200).json({
    code: 0,
    msg: "Receive success",
    data: {
      gameslist: datas,
    },
    page: page,
    status: true,
  });
};

const addWinGo = async (game) => {
  try {
    let join = "";
    if (game == "10") join = "wingo10";
    if (game == 1) join = "wingo";
    if (game == 3) join = "wingo3";
    if (game == 5) join = "wingo5";

    const [winGoNow] = await connection.query(
      "SELECT period FROM wingo WHERE status = 0 AND release_status =0 AND game = ? ORDER BY id DESC LIMIT 1",
      [join],
    );
     
      const [setting] = await connection.query("SELECT * FROM `admin_ac` ");
           let previousPeriod;
           
        //   console.log("winGoNow[0]",winGoNow[0])
if(winGoNow?.length===0){
    previousPeriod = "567878989"; 
}else{
  previousPeriod = winGoNow[0].period; 
}
 
      let amount = Math.floor(Math.random() * 10);

      const [minPlayers] = await connection.query(
        "SELECT * FROM minutes_1 WHERE status = 0 AND isdemo=0 AND game = ?",
        [join],
      );

      if (minPlayers.length >= 2) {
        const betColumns = [
          // red_small
          { name: "red_0", bets: ["0", "t", "d", "n"] },
          { name: "red_2", bets: ["2", "d", "n"] },
          { name: "red_4", bets: ["4", "d", "n"] },
          // green small
          { name: "green_1", bets: ["1", "x", "n"] },
          { name: "green_3", bets: ["3", "x", "n"] },
          // green big
          { name: "green_5", bets: ["5", "x", "t", "l"] },
          { name: "green_7", bets: ["7", "x", "l"] },
          { name: "green_9", bets: ["9", "x", "l"] },
          // red big
          { name: "red_6", bets: ["6", "d", "l"] },
          { name: "red_8", bets: ["8", "d", "l"] },
        ];

        const totalMoneyPromises = betColumns.map(async (column) => {
          // Generate placeholders for the array elements
          const placeholders = column.bets.map(() => "?").join(",");
          // Prepare the query, using placeholders for the array
          const query = `
                   SELECT SUM(money) AS total_money
                   FROM minutes_1
                   WHERE game = ? AND status = 0 AND isdemo=0 AND bet IN (${placeholders})
               `;
          // Execute the query, spreading the array into the parameters
          const [result] = await connection.query(query, [
            join,
            ...column.bets,
          ]);
          return {
            name: column.name,
            total_money: (result[0] && result[0].total_money)
              ? parseInt(result[0].total_money, 10)
              : 0,
          };

        });

        const categories = await Promise.all(totalMoneyPromises);
        let smallestCategory = categories.reduce(
          (smallest, category) =>
            smallest === null || category.total_money < smallest.total_money
              ? category
              : smallest,
          null,
        );
        const colorBets = {
          red_6: [6],
          red_8: [8],
          red_2: [2], //0 removed
          red_4: [4],
          green_3: [3],
          green_7: [7], //5 removed
          green_9: [9], //
          green_1: [1],
          green_5: [5],
          red_0: [0],
        };

        const betsForCategory = colorBets[smallestCategory.name] || [];
        const availableBets = betsForCategory.filter(
          (bet) =>
            !categories.find(
              (category) =>
                category.name === smallestCategory.name &&
                category.total_money < smallestCategory.total_money,
            ),
        );
        let lowestBet;
        if (availableBets.length > 0) {
          lowestBet = availableBets[0];
        } else {
          lowestBet = betsForCategory.reduce((lowest, bet) =>
            bet < lowest ? bet : lowest,
          );
        }

        amount = lowestBet;
      } else if (
        minPlayers.length === 1 && parseFloat(minPlayers[0].money) >= 1
      ) {
        const betColumns = [
          { name: "red_small", bets: ["0", "2", "4", "d", "n"] },
          { name: "red_big", bets: ["6", "8", "d", "l"] },
          { name: "green_big", bets: ["5", "7", "9", "x", "l"] },
          { name: "green_small", bets: ["1", "3", "x", "n"] },
          { name: "violet_small", bets: ["0", "t", "n"] },
          { name: "violet_big", bets: ["5", "t", "l"] },
        ];

        const categories = await Promise.all(
          betColumns.map(async (column) => {
            const [result] = await connection.query(
              `
                     SELECT SUM(money) AS total_money
                     FROM minutes_1
                     WHERE game = ? AND status = 0 AND isdemo=0 AND bet IN (?)
                     `,
              [join, column.bets],
            );
            return {
              name: column.name,
              total_money: parseInt(result[0] && result[0].total_money) || 0,
            };

          }),
        );

        const colorBets = {
          red_big: [6, 8],
          red_small: [2, 4], //0 removed
          green_big: [7, 9], //5 removed
          green_small: [1, 3],
          violet_big: [5],
          violet_small: [0],
        };

        const smallestCategory = categories.reduce((smallest, category) =>
          !smallest || category.total_money < smallest.total_money
            ? category
            : smallest,
        );

        const betsForCategory = colorBets[smallestCategory.name] || [];
        const availableBets = betsForCategory.filter(
          (bet) =>
            !categories.find(
              (category) =>
                category.name === smallestCategory.name &&
                category.total_money < smallestCategory.total_money,
            ),
        );

        const lowestBet =
          availableBets.length > 0
            ? availableBets[0]
            : Math.min(...betsForCategory);
        amount = lowestBet;
      }

      let nextResult = "";
      if (game == 1) nextResult = setting[0].wingo1;
      if (game == 3) nextResult = setting[0].wingo3;
      if (game == 5) nextResult = setting[0].wingo5;
      if (game == "10") nextResult = setting[0].wingo10;

      let newArr = "";
      if (nextResult == "-1") {
        // game algorithm generate result
        await connection.query(
          "UPDATE wingo SET amount = ?, status = 1, release_status = 1 WHERE period = ? AND game = ?",
          [amount, previousPeriod, join],
        );
        newArr = "-1";
      } else {
        // admin set result
        let result = "";
        let arr = nextResult.split("|");
        let check = arr.length;
        if (check == 1) {
          newArr = "-1";
        } else {
          for (let i = 1; i < arr.length; i++) {
            newArr += arr[i] + "|";
          }
          newArr = newArr.slice(0, -1);
        }
        result = arr[0];
        await connection.query(
          "UPDATE wingo SET amount = ?, status = 1, release_status = 1 WHERE period = ? AND game = ?",
          [result, previousPeriod, join],
        );
      }

      let adminWingoKey = "";
      if (game == "10") adminWingoKey = "wingo10";
      if (game == 1) adminWingoKey = "wingo1";
      if (game == 3) adminWingoKey = "wingo3";
      if (game == 5) adminWingoKey = "wingo5";

      await connection.query(`UPDATE admin_ac SET ${adminWingoKey} = ?`, [
        newArr,
      ]);
  

     let timeNow = Date.now();
    // let gameRepresentationId = GameRepresentationIds.WINGO[game];
    // console.log(gameRepresentationId)
    // let NewGamePeriod = generatePeriods(gameRepresentationId);

    // console.log(NewGamePeriod, join);

   let d  = await connection.query(
      `
         INSERT INTO wingo
         SET period = ?, amount = 0, game = ?, status = 0, time = ?
      `,
      [Number(previousPeriod) + 1, join, timeNow],
    );
  } catch (error) {
    if (error) {
      console.log(error);
    }
  }
};

const handlingWinGo1P = async (typeid) => {
  try {
    let game = "";
    if (typeid == "10") game = "wingo10";
    if (typeid == 1) game = "wingo";
    if (typeid == 3) game = "wingo3";
    if (typeid == 5) game = "wingo5";

    const [winGoNow] = await connection.query(
      "SELECT * FROM wingo WHERE status = 1 AND release_status = 1 AND game = ? ORDER BY id DESC LIMIT 1",
      [game],
    );

    if (winGoNow.length === 0) {
      return;
    }

    // update ket qua
    await connection.query(
      "UPDATE minutes_1 SET result = ? WHERE status = 0 AND game = ?",
      [winGoNow[0].amount, game],
    );
    let result = Number(winGoNow[0].amount);

    // Using a template string for dynamic SQL generation with fixed parts to prevent SQL injection
    const updateStatusSQL =
      "UPDATE minutes_1 SET status = 2 WHERE status = 0 AND game = ? AND bet != ? AND bet != ? AND bet != ? AND bet != ?";

    switch (result) {
      case 0:
        await connection.query(updateStatusSQL, [game, "l", "n", "d", "0"]);
        if (!["t"].includes(result.toString()))
          await connection.query(
            "UPDATE minutes_1 SET status = 2 WHERE status = 0 AND game = ? AND bet = ?",
            [game, "t"],
          );
        break;
      case 1:
        await connection.query(updateStatusSQL, [game, "l", "n", "x", "1"]);
        break;
      case 2:
        await connection.query(updateStatusSQL, [game, "l", "n", "d", "2"]);
        break;
      case 3:
        await connection.query(updateStatusSQL, [game, "l", "n", "x", "3"]);
        break;
      case 4:
        await connection.query(updateStatusSQL, [game, "l", "n", "d", "4"]);
        break;
      case 5:
        await connection.query(updateStatusSQL, [game, "l", "n", "x", "5"]);
        if (!["t"].includes(result.toString()))
          await connection.query(
            "UPDATE minutes_1 SET status = 2 WHERE status = 0 AND game = ? AND bet = ?",
            [game, "t"],
          );
        break;
      case 6:
        await connection.query(updateStatusSQL, [game, "l", "n", "d", "6"]);
        break;
      case 7:
        await connection.query(updateStatusSQL, [game, "l", "n", "x", "7"]);
        break;
      case 8:
        await connection.query(updateStatusSQL, [game, "l", "n", "d", "8"]);
        break;
      case 9:
        await connection.query(updateStatusSQL, [game, "l", "n", "x", "9"]);
        break;
      default:
        break;
    }

    if (result < 5) {
      await connection.query(
        "UPDATE minutes_1 SET status = 2 WHERE status = 0 AND game = ? AND bet = 'l'",
        [game],
      );
    } else {
      await connection.query(
        "UPDATE minutes_1 SET status = 2 WHERE status = 0 AND game = ? AND bet = 'n'",
        [game],
      );
    }

    // lấy ra danh sách đặt cược chưa xử lý
    const [order] = await connection.query(
      "SELECT * FROM minutes_1 WHERE status = 0 AND game = ?",
      [game],
    );
    for (let i = 0; i < order.length; i++) {
      let orders = order[i];
      let result = orders.result;
      let bet = orders.bet;
      let total = orders.money;
      let id = orders.id;
      let phone = orders.phone;
      var nhan_duoc = 0;
      // x - green
      // t - Violet
      // d - red

      // Sirf 1-4 aur 6-9 tk hi *9 aana chahiye
      // Aur 0 aur 5 pe *4.5
      // Aur red aur green pe *2
      // 1,2,3,4,6,7,8,9

      if (bet == "l" || bet == "n") {
        nhan_duoc = total * 2;
      } else {
        if (result == 0 || result == 5) {
          if (bet == "d" || bet == "x") {
            nhan_duoc = total * 1.5;
          } else if (bet == "t") {
            nhan_duoc = total * 4.5;
          } else if (bet == "0" || bet == "5") {
            nhan_duoc = total * 4.5;
          }
        } else {
          if (result == 1 && bet == "1") {
            nhan_duoc = total * 9;
          } else {
            if (result == 1 && bet == "x") {
              nhan_duoc = total * 2;
            }
          }
          if (result == 2 && bet == "2") {
            nhan_duoc = total * 9;
          } else {
            if (result == 2 && bet == "d") {
              nhan_duoc = total * 2;
            }
          }
          if (result == 3 && bet == "3") {
            nhan_duoc = total * 9;
          } else {
            if (result == 3 && bet == "x") {
              nhan_duoc = total * 2;
            }
          }
          if (result == 4 && bet == "4") {
            nhan_duoc = total * 9;
          } else {
            if (result == 4 && bet == "d") {
              nhan_duoc = total * 2;
            }
          }
          if (result == 6 && bet == "6") {
            nhan_duoc = total * 9;
          } else {
            if (result == 6 && bet == "d") {
              nhan_duoc = total * 2;
            }
          }
          if (result == 7 && bet == "7") {
            nhan_duoc = total * 9;
          } else {
            if (result == 7 && bet == "x") {
              nhan_duoc = total * 2;
            }
          }
          if (result == 8 && bet == "8") {
            nhan_duoc = total * 9;
          } else {
            if (result == 8 && bet == "d") {
              nhan_duoc = total * 2;
            }
          }
          if (result == 9 && bet == "9") {
            nhan_duoc = total * 9;
          } else {
            if (result == 9 && bet == "x") {
              nhan_duoc = total * 2;
            }
          }
        }
      }
      const [users] = await connection.query(
        "SELECT `money` FROM `users` WHERE `phone` = ?",
        [phone],
      );
      let totals = parseFloat(users[0].money) + parseFloat(nhan_duoc);
      await connection.query(
        "UPDATE `minutes_1` SET `get` = ?, `status` = 1 WHERE `id` = ?",
        [parseFloat(nhan_duoc), id],
      );
      const sql = "UPDATE `users` SET `money` = ? WHERE `phone` = ?";
      await connection.query(sql, [totals, phone]);
    }

    await connection.query(
      "UPDATE wingo SET release_status = 2 WHERE period = ? AND game = ?",
      [winGoNow[0].period, game],
    );
  } catch (error) {
    console.log(error);
  }
};

const winGoController = {
  winGoPage,
  betWinGo,
  listOrderOld,
  GetMyEmerdList,
  handlingWinGo1P,
  addWinGo,
  distributeCommission,
  winGoPage3,
  winGoPage5,
  winGoPage10,
};

export default winGoController;
