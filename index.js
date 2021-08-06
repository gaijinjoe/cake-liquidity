const axios = require("axios");
// const notifier = require('node-notifier'); //notifier is to send notifications to the pc that's running the code. uncomment this line and #90 to enable
const schedule = require("node-schedule");
const Pushover = require("pushover-notifications");
const puppeteer = require("puppeteer");
const dotenv = require("dotenv");
const blStatus = require("./borrow-limit-status");
dotenv.config();

const URL = "https://api.venus.io/api/governance/venus";

var push = new Pushover({
  token: process.env.pushTOKEN,
  user: process.env.pushUSER,
});

const launchConfigRaspberry = {
  headless: true,
  ignoreHTTPSErrors: true,
  executablePath: "chromium-browser",
  args: [
    "--disable-web-security",
    "--allow-http-screen-capture",
    "--allow-running-insecure-content",
    "--disable-features=site-per-process",
    "--no-sandbox",
  ],
};

const launchWindows = {
  headless: false,
  // ignoreDefaultArgs: ["--disable-extensions"],
  // executablePath:
  //   "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  executablePath: "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
  args: [
    // "--disable-gpu",
    // "--disable-dev-shm-usage",
    // "--disable-setuid-sandbox",
    // "--no-first-run",
    // "--no-sandbox",
    // "--no-zygote",
    // "--single-process",
    // "--no-sandbox",
    // "--disable-setuid-sandbox",
    // `--disable-extensions-except=${newEx}`,
    // `--load-extension=${newEx}`,
    "--enable-automation",
  ],
};
const balanceX = "/html/body/div[1]/main/div[4]/div[3]/div/div/div[2]";
let cakePrev = 0;

async function start() {
  try {
    const browser = await puppeteer.launch(launchWindows);
    const page = await browser.newPage();
    page.setViewport({
      width: 1280,
      height: 800,
      isMobile: false,
    });

    await page.goto(
      "https://bscscan.com/token/0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82?a=0x86ac3974e2bd0d60825230fa6f355ff11409df5c",
      {
        // waitUntil: "networkidle0",
      }
    );

    await page.waitForXPath(balanceX);
    const priceX = await page.$x(balanceX);
    const balance = await page.evaluate((el) => el.textContent, priceX[0]);
    const realBalance = balance.slice(0, -6); // removing word Cake
    const finalBalance = realBalance.slice(8); //removing word Balance
    console.log("balance ", Number(finalBalance));
    if (Number(finalBalance) > 10 && Number(finalBalance) !== cakePrev) {
      //send notification if balance over 10 cake and notification not already sent
      cakePrev = Number(finalBalance);
      push.send(
        "CAKE on Venus",
        `CAKE Liquidity: ${Number(finalBalance)} CAKE`
      ); //sends notification to phone
    }
  } catch (err) {
    console.log("error with bscscan page");
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
              push.send(
                "CAKE on Venus",
                `CAKE Liquidity: $ ${Number(
                  res.data.data.markets[i].liquidity
                ).toFixed(2)}`
              );
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
  // console.log('running bot')

  await start();
});

var runBorrowLimitChecker = schedule.scheduleJob(
  "*/2 * * * *",
  async function () {
    //runs every 15 min

    await blStatus.blStatus();
  }
);

runBot;
runBorrowLimitChecker;
