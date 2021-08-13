const axios = require("axios");
// const notifier = require('node-notifier'); //notifier is to send notifications to the pc that's running the code. uncomment this line and #76 to enable
const schedule = require("node-schedule");
const Pushover = require("pushover-notifications");
const dotenv = require("dotenv");
const blStatus = require("./borrow-limit-status");
const borrowCake = require("./borrowCake");
dotenv.config();

const URL = "https://api.venus.io/api/governance/venus";

var push = new Pushover({
  token: process.env.pushTOKEN,
  user: process.env.pushUSER,
});

let cakePrev = 0;

async function start() {
  try {
    const format = await blStatus.availableCakeToBorrow();

    console.log(format);
    if (format > 10 && format !== cakePrev && !process.env.privateKey) {
      //send notification if balance over 10 cake and notification not already sent
      cakePrev = format;
      var msg = {
        message: `CAKE Liquidity: ${Number(format).toFixed(2)} CAKE`,
        title: "CAKE on Venus",
      };
      push.send(msg);
    } else if (format > 10 && format !== cakePrev && process.env.privateKey) {
      // if the user has added a private key, the bot will automatically borrow from pool
      borrowCake.borrowCake(format, "bnb");
    }
  } catch (err) {
    console.log("error with bsc api", err);
    // if there is an error loading bscscan we load the data from venus's api
    await axios
      .get(URL)
      .then((res) => {
        for (let i in res.data.data.markets) {
          if (
            res.data.data.markets[i].address ===
            "0x86ac3974e2bd0d60825230fa6f355ff11409df5c"
          ) {
            if (
              Number(res.data.data.markets[i].liquidity) > 150 &&
              !process.env.privateKey
            ) {
              //notify if over 150 usd
              var msg = {
                message: `CAKE Liquidity: $ ${Number(
                  res.data.data.markets[i].liquidity
                ).toFixed(2)}`,
                title: "CAKE on Venus",
              };
              push.send(msg);
              // notifier.notify('time to get in Venus Protocol CAKE!');
            } else if (
              Number(res.data.data.markets[i].liquidity) > 150 &&
              process.env.privateKey
            ) {
              // if the user has added a private key, the bot will automatically borrow from pool
              borrowCake.borrowCake(
                Number(res.data.data.markets[i].liquidity).toFixed(2),
                "usd"
              );
            }
          }
        }
      })
      .catch((err) => {
        console.log("axios err ", err);
      });
  }
}

var runBot = schedule.scheduleJob("* * * * *", async function () {
  //runs every minute
  await start();
});

var runBorrowLimitChecker = schedule.scheduleJob(
  "*/15 * * * *",
  async function () {
    //runs every 15 min
    await blStatus.blStatus();
  }
);

var runAPYBrief = schedule.scheduleJob(
  "00 07,19 * * *",
  // runs every day at 7pm and 7am
  async function () {
    const netAPY = await blStatus.netAPY();
    var msg = {
      message: `
      Borrow Limit: ${netAPY?.borrowLimit}%
      NET APY: ${netAPY?.netAPY}%
      Daily Reward: ${netAPY?.dailyRewards} USD
      `,
      title: "🤑Venus Mining Update🤑",
    };

    push.send(msg, function (err, result) {
      if (err) {
        console.log("notification error ", err);
      } // send notification
      console.log(result);
    }); // send notification
  }
);

var runAPYDangerCheck = schedule.scheduleJob("*/30 * * * *", async function () {
  //runs every 15 min
  let netAPY = await blStatus.netAPY();
  if (blStatus.cakeBalanceFunction() < 0.1) {
    // if there is no balance we will receive an expected APY Value in case we achieve our desired Borrow Limit amount and give a future expectation of APY rather than current
    netAPY = await blStatus.netAPY(true);
  }
  console.log("net APY ", netAPY?.netAPY);
  if (netAPY?.netAPY <= 3 && blStatus.cakeBalanceFunction() > 0.1) {
    // if the netAPY is 3% it will send an emergency notification and we didnt return all balance
    var msg = {
      message: `Wake up and consider to return what you borrowed`,
      title: `👮NET APY Danger ${netAPY?.netAPY}%👮`,
      sound: "persistent", //no stop
      priority: 2, //priority 2 wont go away until you interact with it
      retry: 30, //it sends the notification every 30 seconds
      expire: 10800, //keeps the notification active for 3h
    };
    push.send(msg, function (err, result) {
      if (err) {
        console.log("notification error ", err);
      } // send notification
      console.log(result);
    }); // send notification
  }
  if (netAPY?.netAPY >= 22) {
    // if the netAPY is 3% it will send an emergency notification
    var msg = {
      message: `Consider entering into the mining of CAKE`,
      title: `👌Good NET APY ${netAPY?.netAPY}%👌`,
    };
    push.send(msg, function (err, result) {
      if (err) {
        console.log("notification error ", err);
      } // send notification
      console.log(result);
    }); // send notification
  }
});

// runBot;
// runBorrowLimitChecker;
// runAPYBrief;
// runAPYDangerCheck;
