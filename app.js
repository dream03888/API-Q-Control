const express = require("express");
const router = express.Router();

const { io, pgClient } = require("./initial");
const google_api = require("./src/google_api.js");
const axios = require("axios");

pgClient.connect();
pgClient.query("LISTEN queue_trigger");

// ✅ เมื่อ PostgreSQL trigger ทำงาน
pgClient.on("notification", (msg) => {
  // console.log("🔔 Trigger fired:", msg.payload);
  // แจ้งทุก client ให้ refresh queue
  io.emit("queue_refresh");
});

io.on("connection", (socket) => {
  // console.log(`Socket connect id: ${socket.id}`);

  // =========================================================
  // ✅ REGISTER ROOM
  // =========================================================

  // 🔌 ฝั่ง Display เข้ามา join ห้อง “display”
  socket.on("register_display", () => {
    socket.join("display");
    // console.log(`📺 Display joined: ${socket.id}`);
  });

  // 🧑‍💻 (optional) ฝั่ง operator
  socket.on("register_operator", () => {
    socket.join("operator");
    // console.log(`🧑‍💻 Operator joined: ${socket.id}`);
  });

  // =========================================================
  // ✅ NEW: CALL QUEUE (ไม่รื้อของเดิม)
  // Operator เรียก: socket.emit("call_queue", { queueNumber, transaction_id, lang })
  // - จะไปเรียก google_api.getGoogleTextToSpeech เหมือนเดิม
  // - แล้ว emit ให้ display ผ่าน "play_queue_audio" เหมือนเดิม
  // - แล้ว refresh ทุกหน้าผ่าน "queue_refresh"
  // =========================================================
  socket.on("call_queue", async (payload) => {
    try {
      const queueNumber = payload?.queueNumber ?? payload?.queue ?? null;
      const transaction_id = payload?.transaction_id ?? null;
      const lang = payload?.lang ?? "en";

      if (!queueNumber || !transaction_id) {
        socket.emit("action_ack", {
          ok: false,
          action: "call_queue",
          msg: "Missing queueNumber/transaction_id",
        });
        return;
      }

      // ✅ 1) (ถ้าคุณต้องการให้เรียกแล้วเปลี่ยนสถานะ DB) ใส่ตรงนี้ได้
      // ตัวอย่าง: รันฟังก์ชันเดิมของคุณ เช่น upDataTransactionstatus('CALLING', transaction_id)
      // await google_api.upDataTransactionstatus("CALLING", transaction_id);

      // ✅ 2) สร้างเสียงเหมือนโค้ดเดิม
      const text = `Please Number ${queueNumber}`;
      const result = await google_api.getGoogleTextToSpeech(text, transaction_id, lang);

      // ✅ 3) ส่งกลับให้คนกด (operator) เพื่อ debug ได้
      socket.emit("res_google_api", result);

      // ✅ 4) broadcast ไปให้ทุก Display (ห้อง display) เล่นเสียง
      io.to("display").emit("play_queue_audio", {
        queue: queueNumber,
        audio: result?.msg, // base64 จาก Google API
        transaction_id: transaction_id,
      });

      // ✅ 5) refresh ทุก client
      io.emit("queue_refresh");

      // ✅ ack
      socket.emit("action_ack", {
        ok: true,
        action: "call_queue",
        transaction_id,
        queue: queueNumber,
      });

    } catch (err) {
      console.error("❌ call_queue Error:", err);
      socket.emit("action_ack", {
        ok: false,
        action: "call_queue",
        msg: String(err?.message || err),
      });
    }
  });

  // =========================================================
  // ✅ NEW: CONFIRM QUEUE (ยืนยันแล้วเคลียร์ + refresh)
  // Operator เรียก: socket.emit("confirm_queue", { transaction_id })
  // - ใช้ฟังก์ชันเดิม upDataTransactionSucess
  // =========================================================
  socket.on("confirm_queue", async (payload) => {
    try {
      const transaction_id = payload?.transaction_id ?? null;
      if (!transaction_id) {
        socket.emit("action_ack", {
          ok: false,
          action: "confirm_queue",
          msg: "Missing transaction_id",
        });
        return;
      }

      const result = await google_api.upDataTransactionSucess(transaction_id);

      // ส่งผลกลับ operator
      socket.emit("return_update_transaction", result);

      // refresh ทุกหน้าจอ
      io.emit("queue_refresh");

      socket.emit("action_ack", {
        ok: true,
        action: "confirm_queue",
        transaction_id,
      });
    } catch (err) {
      console.error("❌ confirm_queue Error:", err);
      socket.emit("action_ack", {
        ok: false,
        action: "confirm_queue",
        msg: String(err?.message || err),
      });
    }
  });

  // =========================================================
  // ✅ ORIGINAL EVENTS (ของเดิมคุณทั้งหมด) - ไม่รื้อ
  // =========================================================

  // 📣 ฝั่ง Caller ขอสร้างเสียง (ของเดิม)
  socket.on("req_google_api", async (queueNumber, transaction_id) => {
    try {
      const text = `Please Number ${queueNumber}`;
      const result = await google_api.getGoogleTextToSpeech(text, transaction_id, "en");

      // 🔊 ส่งกลับเฉพาะให้คนเรียก
      socket.emit("res_google_api", result);

      // 🔔 broadcast ไปให้ทุก “Display”
      io.to("display").emit("play_queue_audio", {
        queue: queueNumber,
        audio: result.msg,
        transaction_id: transaction_id
      });

      // ✅ เพิ่ม: refresh ทุกหน้า (ช่วยให้เลขขึ้นทันที)
      io.emit("queue_refresh");

    } catch (err) {
      console.error("❌ Error:", err);
      socket.emit("res_google_api", { status: 500, msg: null });
    }
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

    // ✅ เพิ่ม: refresh ทุกหน้า
    io.emit("queue_refresh");
  });

  socket.on("update_transaction_waiting", async (status, transaction_id) => {
    const result = await google_api.upDataTransactionstatus(status, transaction_id);
    socket.emit("return_update_transaction_waiting", result);

    // ✅ เพิ่ม: refresh ทุกหน้า
    io.emit("queue_refresh");
  });

  socket.on("update_transaction_json", async (json, status_payment, transaction_id) => {
    const result = await google_api.UpdateJsonTRansaction(json, status_payment, transaction_id);
    socket.emit("return_update_transaction_json", result);

    // ✅ เพิ่ม: refresh ทุกหน้า
    io.emit("queue_refresh");
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
  socket.on("GetdataPayment", async (startDate, endDate, startTime, endTime) => {
    const result = await google_api.GetdataPayment(startDate, endDate, startTime, endTime);
    socket.emit("return_GetdataPayment", result);
  });

  socket.on("GetdataPaymentByData", async (transaction_id, startDate, endDate) => {
    const result = await google_api.GetdataPaymentByData(transaction_id, startDate, endDate);
    socket.emit("return_GetdataPaymentByData", result);
  });

  socket.on("check_charge", async (chargeId) => {
    console.log(`📡 Received charge_id: ${chargeId}`);

    try {
      const response = await axios.get(`https://api.omise.co/charges/${chargeId}`, {
        auth: { username: "skey_test_657v87y6v91cfahlmoe", password: "" },
      });

      const charge = response.data;
      console.log("✅ Charge Status:", charge.status);

      socket.emit("charge_status", { status: 200, msg: charge });
    } catch (err) {
      console.error("❌ Error:", err.response?.data || err.message);
      socket.emit("charge_status", {
        status: err.response?.status || 500,
        error: true,
        msg: err.response?.data || err.message,
      });
    }
  });







  socket.on("get_data_active", async () => {
    const result = await google_api.getAllData();
    socket.emit("return_get_data_active", result);
  });

socket.on("req_update_active", async (data) => {
  const result = await google_api.upProductActive(data);

  // ✅ แจ้ง kiosk ทุกเครื่องว่าเมนูเปลี่ยนแล้ว
  if (result?.status === 200) {
    io.emit("menu_refresh");
  }

  socket.emit("return_get_data_active", result);
});
















  //-----------------------Dashboard--------------------------
  socket.on("getDataBestseller", async (startDate, endDate) => {
    const result = await google_api.getDataBestseller(startDate, endDate);
    socket.emit("return_getDataBestseller", result);
  });







    socket.on("getDataError", async () => {
    const result = await google_api.GetdataError();
    socket.emit("return_getDataError", result);
  });
//----------Report
//    socket.on("reportData", async (startDate , endDate) => {
//     const result = await google_api.ReportData(startDate , endDate);
//     socket.emit("return_reportData", result);
//   });


// socket.on("reportDataProduct", async (startDate , endDate) => {
//     const result = await google_api.ReportDataProduct(startDate , endDate);
//     socket.emit("return_reportDataProduct", result);
//   });


// socket.on("ReportDataPayment", async (startDate , endDate) => {
//     const result = await google_api.ReportDataPayment(startDate , endDate);
//     socket.emit("return_ReportDataPayment", result);
//   });


// socket.on("ReportDataInPayment", async (payload) => {
//   try {
//     const {
//       startDate,
//       endDate,
//       payment,
//       page = 1,
//       limit = 20
//     } = payload || {};

//     const result = await google_api.ReportDataInPayment(
//       startDate,
//       endDate,
//       payment,
//       page,
//       limit
//     );

//     socket.emit("return_ReportDataInPayment", result);

//   } catch (err) {
//     socket.emit("return_ReportDataInPayment", {
//       status: 500,
//       msg: err
//     });
//   }
// });






  socket.on("disconnect", () => {
    // console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

module.exports = router;
