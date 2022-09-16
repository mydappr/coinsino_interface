import { ethers } from "ethers";
import OperatorFunctions from "../../components/OperatorFunctions";
import { NonceManager } from "@ethersproject/experimental";
import Sinoabi from "../../utils/Coinsino.json";

import jwt from "jsonwebtoken";
import { app, database } from "./Firebase";
import { doc, getDoc } from "firebase/firestore";
const coinSinoContractAddress = "0xdC9d2bBb598169b370F12e45D97258dd34ba19C0";

const { startLottery, closeLottery, drawLottery } = OperatorFunctions();

export default async function handler(req, res) {
  // firstly, make sure client is authorized
  try {
    const authorization_key = req.headers.authorization;

    console.log(authorization_key);
    const docRef = doc(database, "authorization", authorization_key);
    const docSnap = await getDoc(docRef);

    console.log("passed authorization check");

    // console.log(docSnap.exists());

    // check if key exists move to next process
    if (!docSnap.exists())
      return res.status(401).json({ Error: "Unauthorized" });
  } catch (error) {
    return res.status(400).json({ Error: "Not Authorized!" });
  }

  // next, get current lottery status
  let lotteryStatus;

  // rnd data for close and draw fucntion
  let rngData;

  // lottery Id
  let latestLotteryId;

  try {
    // get lottery ID and status
    // operator provider,and signer
    const operatorProvider = new ethers.providers.JsonRpcProvider(
      "https://testnet.telos.net/evm"
    );
    console.log("got provider");

    // operator signer and contract
    const operatorSigner = new ethers.Wallet(
      process.env.opkey,
      operatorProvider
    );

    console.log("got signer");
    const managedSigner = new NonceManager(operatorSigner);
    const operatorcoinSinoContract = new ethers.Contract(
      coinSinoContractAddress,
      Sinoabi,
      managedSigner
    );
    console.log("got signer");

    // current lotteryid
    latestLotteryId = Number(
      await operatorcoinSinoContract.viewCurrentLotteryId()
    );
    console.log("got id");
    // current lottery details
    const getLotterystatus = await operatorcoinSinoContract.viewLottery(
      latestLotteryId
    );

    // current lottery status
    lotteryStatus = getLotterystatus.status;
    console.log("got status");
    if (lotteryStatus === 1 || lotteryStatus === 2) {
      try {
        const drandres = await fetch("https://drandapi.herokuapp.com/fetch");
        const dranddata = await drandres.json();
        rngData = dranddata;
        console.log('got drandata')
      } catch (error) {
        return res.status(400).json({ error });
      }
    }
  } catch (error) {
    return res.status(400).json({ error });
  }

  // After lottery status is retrieved, the right action is executed

  switch (lotteryStatus) {
    case 1:
      // lottery status is open, therefore close the lottery
      console.log("Closed lottery");
      await closeLottery(rngData, latestLotteryId);
      res.status(200).json({ Status: "Ok" });
      break;

    case 2:
      // lottery status is closed, therefore draw winning number and make lottery claimable
      console.log("Make lottery claimable");
      await drawLottery(rngData, latestLotteryId);
      res.status(200).json({ Status: "Ok" });
      break;
    case 3:
      // lottery status is claimable, therefore start a new lottery
      console.log("Started lottery");
      await startLottery();
      res.status(200).json({ Status: "Ok" });
      break;
    default:
      console.log(
        "Lottery is pending, no lottery has been created, create the first lottery"
      );
  }
}