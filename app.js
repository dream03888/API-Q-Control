const express = require("express");
const router = express.Router();

const { io, pgClient } = require("./initial");
const google_api = require("./src/google_api.js");
const axios = require("axios");
const { error } = require("console");

pgClient.connect();
pgClient.query("LISTEN queue_trigger");

// ✅ เมื่อ PostgreSQL trigger ทำงาน
pgClient.on("notification", (msg) => {
  console.log("🔔 Trigger fired:", msg.payload);
  // แจ้งทุก client ให้ refresh queue
  io.emit("queue_refresh");
});

io.on("connection", (socket) => {
  console.log(`Socket connect id: ${socket.id}`);

  // 📣 ฝั่ง Caller ขอสร้างเสียง
  socket.on("req_google_api", async (queueNumber, transaction_id) => {
    try {
      const text = `Please Number ${queueNumber}`;
      const result = await google_api.getGoogleTextToSpeech(text, transaction_id, "en");

      // 🔊 ส่งกลับเฉพาะให้คนเรียก
      socket.emit("res_google_api", result);

      // 🔔 แต่ broadcast ไปให้ทุก “Display” ที่อยู่ในห้อง display
      io.to("display").emit("play_queue_audio", {
        queue: queueNumber,
        audio: result.msg, // base64 จาก Google API
        transaction_id : transaction_id
      });
    } catch (err) {
      console.error("❌ Error:", err);
      socket.emit("res_google_api", { status: 500, msg: null });
    }
  });

 // 🔌 ฝั่ง Display เข้ามา join ห้อง “display”
  socket.on("register_display", () => {
    socket.join("display");
    console.log(`📺 Display joined: ${socket.id}`);
  });



  socket.on("get_queue", async () => {
    const result = await google_api.getQueue();
    socket.emit("return_get_queue", result);
  });

  socket.on("get_Callqueue", async () => {
    const result = await google_api.getCallQ();
    socket.emit("return_get_Callqueue", result);
  });

  socket.on("update_transaction", async (transaction_id) => {
    const result = await google_api.upDataTransactionSucess(transaction_id);
    socket.emit("return_update_transaction", result);
  });

  socket.on("update_transaction_waiting", async (status, transaction_id) => {
    const result = await google_api.upDataTransactionstatus(
      status,
      transaction_id
    );
    socket.emit("return_update_transaction_waiting", result);
  });


   socket.on("update_transaction_json", async (json, status_payment, transaction_id) => {
    const result = await google_api.UpdateJsonTRansaction(
     json, status_payment, transaction_id
    );
    socket.emit("return_update_transaction_json", result);
  });


  socket.on("getWaitingQueue", async () => {
    const result = await google_api.getWaitingQueue();
    socket.emit("return_getWaitingQueue", result);
  });


  socket.on("getWaitingCountQueue", async () => {
    const result = await google_api.getWaitingCountQueue();
    socket.emit("return_getWaitingCountQueue", result);
  });
  // -----------------------BackHome----------------
  socket.on(
    "GetdataPayment",
    async (startDate, endDate, startTime, endTime) => {
      const result = await google_api.GetdataPayment(
        startDate,
        endDate,
        startTime,
        endTime
      );
      socket.emit("return_GetdataPayment", result);
    }
  );

  socket.on(
    "GetdataPaymentByData",
    async (transaction_id, startDate, endDate) => {
      const result = await google_api.GetdataPaymentByData(
        transaction_id,
        startDate,
        endDate
      );
      socket.emit("return_GetdataPaymentByData", result);
    }
  );

  socket.on("check_charge", async (chargeId) => {
    console.log(`📡 Received charge_id: ${chargeId}`);

    try {
      const response = await axios.get(
        `https://api.omise.co/charges/${chargeId}`,
        {
          auth: { username: "skey_test_657v87y6v91cfahlmoe", password: "" },
        }
      );

      const charge = response.data;
      console.log("✅ Charge Status:", charge.status);

      // 🔄 ส่งข้อมูลกลับพร้อม status code
      socket.emit("charge_status", {
        status: 200,
        msg: charge,
      });
    } catch (err) {
      console.error("❌ Error:", err.response?.data || err.message);
      socket.emit("charge_status", {
        status: err.response?.status || 500,
        error: true,
        msg: err.response?.data || err.message,
      });
    }
  });

//-----------------------Dashboard--------------------------
  socket.on("getDataBestseller", async (startDate, endDate) => {
    const result = await google_api.getDataBestseller(startDate, endDate);
    socket.emit("return_getDataBestseller", result);
  });







});
