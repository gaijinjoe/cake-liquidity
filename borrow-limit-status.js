const axios = require("axios");
// const notifier = require('node-notifier'); //notifier is to send notifications to the pc that's running the code. uncomment this line and #90 to enable
const Pushover = require("pushover-notifications");
const fs = require("fs");
const Web3 = require("web3");
const dotenv = require("dotenv");
dotenv.config();

const yourAccount = process.env.BSCAddress; //insert your account
const bnbBalance = 61; // i've deposited bnb. so im using this to calculate my borrow limit. change this according to the token you withdrew
const stableCoin = 0; // stablecoin deposited
const bnbCollateralFactor = 0.8; //bnb collateral factor is 80%

var web3 = new Web3("https://bsc-dataseed1.binance.org:443");

const ABIjson = fs.readFileSync("./contract.json");
const ABI = JSON.parse(ABIjson);

const URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd";

const contract = "0x86ac3974e2bd0d60825230fa6f355ff11409df5c";

let notificationSent = false;

let timesChecked = 0;

var push = new Pushover({
  token: process.env.pushTOKEN,
  user: process.env.pushUSER,
});

async function blStatus() {
  await axios
    .get(URL)
    .then(async (res) => {
      if (timesChecked >= 3 && notificationSent === true) {
        // if the notification was sent 3 rounds earlier we will reset the notificationSent value so to notify again the owner
        notificationSent = false;
      }

      const bnbPrice = res.data.binancecoin.usd;
      const depositValue = bnbPrice * bnbBalance + stableCoin;
      console.log("tot ", depositValue);
      const unicorn = new web3.eth.Contract(ABI, contract);
      const balanceWithInterests = await unicorn.methods
        .borrowBalanceStored(yourAccount)
        .call();
      const multiplier = 10 ** 18;
      const actualValue = balanceWithInterests / multiplier;

      const cakePriceRaw = await axios.get(
        "https://api.coingecko.com/api/v3/simple/price?ids=pancakeswap-token&vs_currencies=usd"
      );
      const cakePrice = cakePriceRaw.data["pancakeswap-token"].usd;
      const cakeValue = actualValue * cakePrice; //CAKE value in dollars
      const cakeM = cakeValue * 100;

      const borrowAllowance = depositValue * bnbCollateralFactor; // borrow allowance

      const borrowLimit = cakeM / borrowAllowance;
      if (borrowLimit > 88 && notificationSent === false) {
        //notify if borrowlimit is over 88%
        console.log("sending urgent notification");
        notificationSent = true;
        timesChecked = 0;
        // notification message
        var msg = {
          message: `The borrow-limit of Venus is at dangerous levels: ${borrowLimit.toFixed(
            2
          )}%`,
          title: "⚠️BORROW-LIMIT DANGER⚠️",
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
      console.log("borrowLimit  ", borrowLimit);
      timesChecked += 1;
    })
    .catch((err) => {
      console.log("axios error ", err);
    });
}

exports.blStatus = blStatus;
