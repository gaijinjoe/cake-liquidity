const Web3 = require("web3");
const fs = require("fs");

var web3 = new Web3("https://bsc-dataseed1.binance.org:443");
const BNObject = Web3.utils.BN;
const BN = (x) => new BNObject(x);

const ABIjson = fs.readFileSync("./pancakeswapContract.json"); // pool contract
const CakeABIJson = fs.readFileSync("./cakeContract.json"); //cake contract
const ABI = JSON.parse(ABIjson);
const CakeABI = JSON.parse(CakeABIJson);

const contractAdd = "0x73feaa1eE314F8c655E354234017bE2193C9E24E";
const cakeContractAdd = "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82";

async function pancakeAPR() {
  const contract = new web3.eth.Contract(ABI, contractAdd);
  const poolInfo = await contract.methods.poolInfo("0").call();
  const allocPoints = poolInfo.allocPoint;

  let result = await contract.methods.cakePerBlock().call();
  const cakePerBlock = BN(result);

  const poolAllocPoint = BN(allocPoints);

  result = await contract.methods.totalAllocPoint().call();
  const totalAllocPoint = BN(result);

  const blockReward = cakePerBlock.mul(poolAllocPoint).div(totalAllocPoint);
  const numberOfBlocks = 20 * 60 * 24 * 365;
  const annualBlockReward = blockReward
    .mul(BN(numberOfBlocks.toString()))
    .mul(BN("1000000000000"));

  const cakeContract = new web3.eth.Contract(CakeABI, cakeContractAdd);
  result = await cakeContract.methods
    .balanceOf(contract.options.address)
    .call();
  const lpSupply = BN(result);
  const apr =
    annualBlockReward.div(lpSupply).divRound(BN("100000000")).toNumber() / 100;
  return apr;
}

exports.pancakeAPR = pancakeAPR;
