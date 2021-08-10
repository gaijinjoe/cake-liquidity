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
    await blStatus.netAPY();
  }
);

runBot;
runBorrowLimitChecker;
runAPYBrief;
