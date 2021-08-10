const Web3 = require("web3");
var web3 = new Web3("https://bsc-dataseed1.binance.org:443");
const fs = require("fs");
const dotenv = require("dotenv");
const blStatus = require("./borrow-limit-status");
const Pushover = require("pushover-notifications");
dotenv.config();

// push notification setup
var push = new Pushover({
  token: process.env.pushTOKEN,
  user: process.env.pushUSER,
});

// Your BSC wallet private key
const privateKey = process.env.privateKey;

// vCAKE contract
const ABIjson = fs.readFileSync("./contracts/contract.json");
const ABI = JSON.parse(ABIjson);
const vCAKEcontract = "0x86ac3974e2bd0d60825230fa6f355ff11409df5c";

async function borrowCake(amountAvail, usdOrCake = "bnb") {
  try {
    if ((await blStatus.borrowLimitCalc()) < process.env.borrowLimitDesired) {
      // Add your BSC wallet to the Web3 object
      web3.eth.accounts.wallet.add("0x" + privateKey);
      const myWalletAddress = web3.eth.accounts.wallet[0].address;

      // contract for vCAKE
      const vToken = new web3.eth.Contract(ABI, vCAKEcontract);
      const underlyingDecimals = 18; // Number of decimals defined in this token's contract

      // Web3 transaction information, we'll use this for every transaction we'll send
      const fromMyWallet = {
        from: myWalletAddress,
        gasLimit: web3.utils.toHex(500000),
        gasPrice: web3.utils.toHex(5000000000), // use https://explorer.bitquery.io/bsc for average gwei. using 5gwei here
      };

      // process Amount Available
      let valueAvailableCAKE = amountAvail;
      if (usdOrCake === "usd") {
        const cakePrice = await blStatus.cakePriceFunction();
        valueAvailableCAKE = (amountAvail / cakePrice).toFixed(7);
      }

      // Borrow
      const borrowAmount =
        blStatus.borrowLimitFutureAllowance(valueAvailableCAKE); //retrieve amount we need to borrow
      if (borrowAmount > 0 && borrowAmount !== null) {
        //we run this only if the borrow Amount needed is superior to 0 and the borrow Amount didnt throw null
        const scaledUpBorrowAmount = (
          borrowAmount * Math.pow(10, underlyingDecimals)
        ).toString();
        console.log("scaledUpBorrowAmount ", scaledUpBorrowAmount);

        await vToken.methods.borrow(scaledUpBorrowAmount).send(fromMyWallet);
        console.log("Borrow Transaction successful");
        var msg = {
          message: `The BOT has automatically borrowed CAKE from Venus`,
          title: "🤖 Automatically borrowed CAKE",
        };
        push.send(msg);
      } else {
        // if there is an error with the borrow amount we will throw an error
        throw new Error("Error with Borrow Amount ", borrowAmount);
      }
    }
  } catch (err) {
    console.log("error with borrow transaction ", err);
    const msg = {
      message: `The BOT has failed borrowing CAKE from Venus. Available ${amountAvail.toFixed(
        2
      )} ${usdOrCake.toUpperCase()}`,
      title: "🤖 Failed borrowing CAKE",
    };
    push.send(msg);
  }
}

exports.borrowCake = borrowCake;
