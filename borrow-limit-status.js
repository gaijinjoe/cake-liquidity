const axios = require("axios");
// const notifier = require('node-notifier'); //notifier is to send notifications to the pc that's running the code. uncomment this line and #90 to enable
const Pushover = require("pushover-notifications");
const fs = require("fs");
const Web3 = require("web3");
const pancakeAPR = require("./pancakeAPR");
const dotenv = require("dotenv");
dotenv.config();

const yourAccount = process.env.BSCAddress; //insert your account
const stableCoin = 0; // stablecoin deposited
const bnbCollateralFactor = 0.8; //bnb collateral factor is 80%

var web3 = new Web3("https://bsc-dataseed1.binance.org:443");

const ABIjson = fs.readFileSync("./contracts/contract.json");
const vBNBabi = fs.readFileSync("./contracts/vbnb.json");
const ABI = JSON.parse(ABIjson);
const vbnbABI = JSON.parse(vBNBabi);

const URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd";

const contract = "0x86ac3974e2bd0d60825230fa6f355ff11409df5c";
const vbnbContract = "0xa07c5b74c9b40447a954e1466938b865b6bbea36";

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

let notificationSent = false;

let timesChecked = 0;

var push = new Pushover({
  token: process.env.pushTOKEN,
  user: process.env.pushUSER,
});

async function bnbBalanceFunction() {
  //calculating vbnb rate
  const vToken = new web3.eth.Contract(vbnbABI, vbnbContract);
  const vTokenDecimals = 8; // all vTokens have 8 decimal places
  const underlyingDecimals = 18;
  const exchangeRateCurrent = await vToken.methods.exchangeRateCurrent().call();
  const mantissa = 18 + parseInt(underlyingDecimals) - vTokenDecimals;
  const onevTokenInUnderlying = exchangeRateCurrent / Math.pow(10, mantissa);

  //retrieving user balance
  const contract = new web3.eth.Contract(minABI, vbnbContract);
  const balance = await contract.methods.balanceOf(yourAccount).call();
  const multiplier = 10 ** 8;
  const actualBalance = balance / multiplier;

  //calculating actual value
  const bnbBalance = actualBalance * onevTokenInUnderlying;
  return bnbBalance;
}

async function cakePriceFunction() {
  const cakePriceRaw = await axios.get(
    "https://api.coingecko.com/api/v3/simple/price?ids=pancakeswap-token&vs_currencies=usd"
  );
  const cakePrice = cakePriceRaw.data["pancakeswap-token"].usd;
  return cakePrice;
}

async function cakeBalanceFunction() {
  const unicorn = new web3.eth.Contract(ABI, contract);
  const balanceWithInterests = await unicorn.methods
    .borrowBalanceStored(yourAccount)
    .call();
  const multiplier = 10 ** 18;
  const actualValue = balanceWithInterests / multiplier;
  return actualValue;
}
async function blStatus() {
  await axios
    .get(URL)
    .then(async (res) => {
      if (timesChecked >= 3 && notificationSent === true) {
        // if the notification was sent 3 rounds earlier we will reset the notificationSent value so to notify again the owner
        notificationSent = false;
      }

      const bnbPrice = res.data.binancecoin.usd;
      const bnbBalance = await bnbBalanceFunction();
      const depositValue = bnbPrice * bnbBalance + stableCoin;
      console.log("tot ", depositValue);
      const actualValue = await cakeBalanceFunction();

      const cakePrice = await cakePriceFunction();
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

async function bnbSupplyAPY() {
  const bnbMantissa = 1e18;
  const blocksPerDay = 20 * 60 * 24;
  const daysPerYear = 365;

  const vToken = new web3.eth.Contract(vbnbABI, vbnbContract);
  const supplyRatePerBlock = await vToken.methods.supplyRatePerBlock().call();
  const supplyApy =
    (Math.pow(
      (supplyRatePerBlock / bnbMantissa) * blocksPerDay + 1,
      daysPerYear
    ) -
      1) *
    100;
  return supplyApy;
  console.log(`Supply APY for BNB ${supplyApy} %`);
}

async function cakeBorrowAPY() {
  const bnbMantissa = 1e18;
  const blocksPerDay = 20 * 60 * 24;
  const daysPerYear = 365;

  const vToken = new web3.eth.Contract(ABI, contract);
  const borrowRatePerBlock = await vToken.methods.borrowRatePerBlock().call();
  const borrowApy =
    (Math.pow(
      (borrowRatePerBlock / bnbMantissa) * blocksPerDay + 1,
      daysPerYear
    ) -
      1) *
    100;
  return borrowApy;
  console.log(`Borrow APY for CAKE ${borrowApy} %`);
}

async function netAPY() {
  const cakeBalance = await cakeBalanceFunction();
  const cakePrice = await cakePriceFunction();
  const cakeValue = cakeBalance * cakePrice; //CAKE value in dollars
  const cakeInterests = await cakeBorrowAPY();
  console.log("cake interests -", cakeInterests);
  const cakePaid = (cakeValue * cakeInterests) / 100;

  const bnbPriceData = await axios.get(URL);
  const bnbPrice = bnbPriceData.data.binancecoin.usd;
  const bnbBalance = await bnbBalanceFunction();
  const bnbValue = bnbPrice * bnbBalance;
  const bnbInterests = await bnbSupplyAPY();
  console.log("bnb Interests ", bnbInterests);

  const bnbEarned = (bnbValue * bnbInterests) / 100;

  //venus NET APY
  const difference = bnbEarned - cakePaid;
  const VenusAPY = (difference * 100) / bnbValue;

  console.log("net apy on Venus", VenusAPY);

  // the following is the APR from pancakeswap's manual CAKE Pool
  const cakeSwapPoolAPR = await pancakeAPR.pancakeAPR();
  console.log("the apr for cake pool is ", cakeSwapPoolAPR);
  const cakeRewardsYear = (cakeBalance * cakeSwapPoolAPR) / 100;
  const cakeRewardsYearUSD = cakeRewardsYear * cakePrice;

  const actualDifference = difference + cakeRewardsYearUSD;
  const actualAPY = (actualDifference * 100) / bnbValue;
  console.log("final net APY including PancakeSwap", actualAPY);

  //TODO: calculate the APY of the Auto CAKE Pool for a better estimate of Net APY
}

function compoundInterest(principal, annual_rate, n_times, t_years) {

  // n_times = 365 * 288 = 105120

  const intra_daily_rate = annual_rate / n_times;
  const fee = 2 / 100;
  const intra_daily_rate_net = intra_daily_rate * (1-fee);

  const compoundValue =
    principal * (Math.pow(1 + intra_daily_rate_net, n_times * t_years) - 1);

  console.log(
    principal * (Math.pow(1 + intra_daily_rate_net, n_times * t_years) - 1)
  );
}

exports.blStatus = blStatus;
exports.cakeBorrowAPY = cakeBorrowAPY;
exports.bnbSupplyAPY = bnbSupplyAPY;

// compoundInterest(1000, 67.88, 365, 1);
