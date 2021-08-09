const axios = require("axios");
// const notifier = require('node-notifier'); //notifier is to send notifications to the pc that's running the code. uncomment this line and #76 to enable
const schedule = require("node-schedule");
const Pushover = require("pushover-notifications");
const dotenv = require("dotenv");
const Web3 = require("web3");
const blStatus = require("./borrow-limit-status");
dotenv.config();

var web3 = new Web3("https://bsc-dataseed1.binance.org:443");
const URL = "https://api.venus.io/api/governance/venus";

const tokenAddress = "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82"; //cake contract
const walletAddress = "0x86ac3974e2bd0d60825230fa6f355ff11409df5c"; //venus cake contract address

var push = new Pushover({
  token: process.env.pushTOKEN,
  user: process.env.pushUSER,
});

// The minimum ABI to get ERC20 Token balance
const minABI = [
  // balanceOf
  {
    constant: true,

    inputs: [{ name: "_owner", type: "address" }],

    name: "balanceOf",

    outputs: [{ name: "balance", type: "uint256" }],

    type: "function",
  },
];

let cakePrev = 0;

async function start() {
  try {
    const contract = new web3.eth.Contract(minABI, tokenAddress);
    const result = await contract.methods.balanceOf(walletAddress).call(); // 29803630997051883414242659

    const format = web3.utils.fromWei(result); // 29803630.997051883414242659

    console.log(format);
    if (format > 10 && format !== cakePrev) {
      //send notification if balance over 10 cake and notification not already sent
      cakePrev = format;
      var msg = {
        message: `CAKE Liquidity: ${Number(format).toFixed(2)} CAKE`,
        title: "CAKE on Venus",
      };
      push.send(msg);
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
            if (Number(res.data.data.markets[i].liquidity) > 150) {
              //notify if over 150 usd
              var msg = {
                message: `CAKE Liquidity: $ ${Number(
                  res.data.data.markets[i].liquidity
                ).toFixed(2)}`,
                title: "CAKE on Venus",
              };
              push.send(msg);
              // notifier.notify('time to get in Venus Protocol CAKE!');
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
