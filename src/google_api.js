const axios = require("axios");
const { pool } = require("../initial");

// ✅ แปลงเลขให้มีช่องว่าง เช่น 100 → "1 0 0"
function formatQueueNumber(num) {
  return num.toString().split("").join(" ");
}

// ✅ เรียก Google Translate TTS แล้วส่งเสียงแบบ base64 กลับ
async function getGoogleTextToSpeech(text, transaction_id, language = "en") {
  console.log("🔊 Google TTS:", text);
  try {
    const googleTtsUrl = "https://translate.google.com/translate_tts";
    const params = new URLSearchParams({
      ie: "UTF-8",
      q: text,
      tl: language,
      client: "tw-ob",
    });

    const response = await axios.get(googleTtsUrl, {
      params,
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });

    if (response.status !== 200) {
      console.log("❌ ERROR GOOGLE API : ", response.status);
      return { status: response.status, msg: null };
    }

    // ✅ แปลงเสียงเป็น Base64 แล้วส่งกลับ
    const audioBase64 = Buffer.from(response.data, "binary").toString("base64");
    await upDataTransactionCallQueue(transaction_id);
    return { status: 200, msg: audioBase64 };
  } catch (error) {
    console.log("❌ ERROR FUNCTION (GOOGLE API): " + error.message);
    return { status: 400, msg: null };
  }
}
const upDataTransactionCallQueue = async (transaction_id) => {
  try {
    await pool.query("BEGIN");
    const queryStr = `
     UPDATE tg_transaction SET status = '2' WHERE transaction_id = $1;
    `;
    const queryValues = [transaction_id];

    await pool.query(queryStr, queryValues);
    await pool.query("COMMIT");

    return { status: 200, msg: "success" };
  } catch (error) {
    await pool.query("ROLLBACK");
    console.log(error);
    return { status: 400, msg: "ERROR", error };
  }
};

const upDataTransactionSucess = async (transaction_id) => {
  try {
    await pool.query("BEGIN");
    const queryStr = `
     UPDATE tg_transaction SET status = '3' WHERE transaction_id = $1;
    `;
    const queryValues = [transaction_id.transaction_id];

    await pool.query(queryStr, queryValues);
    await pool.query("COMMIT");

    return { status: 200, msg: "success" };
  } catch (error) {
    await pool.query("ROLLBACK");
    console.log(error);
    return { status: 400, msg: "ERROR", error };
  }
};

const upDataTransactionstatus = async (status, transaction_id) => {
  console.log("status", status);
  try {
    await pool.query("BEGIN");
    const queryStr = `
     UPDATE tg_transaction SET status = $1 WHERE transaction_id = $2;
    `;
    const queryValues = [status, transaction_id];

    await pool.query(queryStr, queryValues);
    await pool.query("COMMIT");

    return { status: 200, msg: "success" };
  } catch (error) {
    await pool.query("ROLLBACK");
    console.log(error);
    return { status: 400, msg: "ERROR", error };
  }
};

const UpdateJsonTRansaction = async (json, status_payment, transaction_id) => {
  try {
    await pool.query("BEGIN");
    const queryStr = `
     UPDATE tg_transaction SET json = $1  , status_payment = $2 WHERE transaction_id = $3;
    `;
    const queryValues = [json, status_payment, transaction_id];

    await pool.query(queryStr, queryValues);
    await pool.query("COMMIT");

    return { status: 200, msg: "success" };
  } catch (error) {
    await pool.query("ROLLBACK");
    console.log(error);
    return { status: 400, msg: "ERROR", error };
  }
};

const getQueue = async () => {
  const queryStr = `SELECT tg_transaction.transaction_id , amount , tg_transaction.date , tg_transaction.time ,status , order_number , queue  FROM tg_transaction
INNER JOIN tg_queue ON tg_transaction.transaction_id = tg_queue.transaction_id
WHERE  tg_transaction.date = CURRENT_DATE AND status IN ('1','2')
ORDER BY queue ASC`;
  try {
    return pool
      .query(queryStr)
      .then((result) => {
        if (result.rows.length < 1) {
          return { status: 200, msg: [] };
        }
        return { status: 200, msg: result.rows };
      })
      .catch((error) => {
        console.log("Error Funtions getQueue" + error);
        return { status: 201, msg: error };
      });
  } catch (error) {
    console.log("Error Connect : " + error);
    return { status: 400, msg: error };
  }
};

const getCallQ = async () => {
  const queryStr = `SELECT tg_transaction.transaction_id , amount , tg_transaction.date , tg_transaction.time ,status , order_number , queue  FROM tg_transaction
INNER JOIN tg_queue ON tg_transaction.transaction_id = tg_queue.transaction_id
WHERE  tg_transaction.date = CURRENT_DATE AND status = '2' ORDER BY time ASC`;
  try {
    return pool
      .query(queryStr)
      .then((result) => {
        if (result.rows.length < 1) {
          return { status: 200, msg: [] };
        }
        return { status: 200, msg: result.rows };
      })
      .catch((error) => {
        console.log("Error Funtions getCallQ" + error);
        return { status: 201, msg: error };
      });
  } catch (error) {
    console.log("Error Connect : " + error);
    return { status: 400, msg: error };
  }
};
const getWaitingQueue = async () => {
  const queryStr = `SELECT tg_transaction.transaction_id , amount , tg_transaction.date , tg_transaction.time ,status , order_number , queue  FROM tg_transaction
INNER JOIN tg_queue ON tg_transaction.transaction_id = tg_queue.transaction_id
WHERE  tg_transaction.date = CURRENT_DATE AND status = '4' ORDER BY time ASC`;
  try {
    return pool
      .query(queryStr)
      .then((result) => {
        if (result.rows.length < 1) {
          return { status: 200, msg: [] };
        }
        return { status: 200, msg: result.rows };
      })
      .catch((error) => {
        console.log("Error Funtions getWaitingQueue" + error);
        return { status: 201, msg: error };
      });
  } catch (error) {
    console.log("Error Connect : " + error);
    return { status: 400, msg: error };
  }
};
///----------------------------------BackHome------------------------------------------
const GetdataPayment = async (startDate, endDate, startTime, endTime) => {
  const queryStr = `SELECT 
    t.transaction_id, t.amount, t.date, t.time, t.status, s.status_name, 
    t.order_number, t.payment, t.charge_id, t.status_payment
FROM tg_transaction t
INNER JOIN tg_status s ON t.status::int = s.status_id
WHERE
    (t.date + t.time) >= COALESCE(NULLIF($1, '')::timestamp, date_trunc('day', CURRENT_TIMESTAMP))
    AND (t.date + t.time) <= COALESCE(NULLIF($2, '')::timestamp, date_trunc('day', CURRENT_TIMESTAMP) + INTERVAL '1 day' - INTERVAL '1 second');
;`;
  const values = [startDate, endDate];
  try {
    return pool
      .query(queryStr, values)
      .then((result) => {
        if (result.rows.length < 1) {
          return { status: 200, msg: [] };
        }
        return { status: 200, msg: result.rows };
      })
      .catch((error) => {
        console.log("Error Funtions GetdataPayment" + error);
        return { status: 201, msg: error };
      });
  } catch (error) {
    console.log("Error Connect : " + error);
    return { status: 400, msg: error };
  }
};
const GetdataPaymentByData = async (transaction_id, startDate, endDate) => {
  const queryStr = `SELECT json, slips , amount , charge_id
FROM tg_transaction
WHERE   (transaction_id IS NULL OR transaction_id = $1)

  AND date >= COALESCE(NULLIF($2, '')::timestamp, CURRENT_DATE)
  AND date <= COALESCE(NULLIF($3, '')::timestamp, CURRENT_DATE);
`;
  const values = [transaction_id, startDate, endDate];
  try {
    return pool
      .query(queryStr, values)
      .then((result) => {
        if (result.rows.length < 1) {
          return { status: 200, msg: [] };
        }
        return { status: 200, msg: result.rows };
      })
      .catch((error) => {
        console.log("Error Funtions GetdataPaymentByData" + error);
        return { status: 201, msg: error };
      });
  } catch (error) {
    console.log("Error Connect : " + error);
    return { status: 400, msg: error };
  }
};

const getWaitingCountQueue = async () => {
  const queryStr = `SELECT COUNT(*) FROM "public"."tg_transaction"
                      WHERE status::int = 1 AND date = CURRENT_DATE;`;
  try {
    return pool
      .query(queryStr)
      .then((result) => {
        if (result.rows.length < 1) {
          return { status: 200, msg: [] };
        }
        return { status: 200, msg: result.rows };
      })
      .catch((error) => {
        console.log("Error Funtions getWaitingQueue" + error);
        return { status: 201, msg: error };
      });
  } catch (error) {
    console.log("Error Connect : " + error);
    return { status: 400, msg: error };
  }
};
//----------------------------------Dashboard------------------------------------------
const getDataBestseller = async (startDate, endDate) => {
  const queryStr = `SELECT 
  tg_product.product_id,
  tg_product.product_name,
  SUM(tg_index.qty) AS total_qty,
  tg_product.unit_price,
  (SUM(tg_index.qty)* unit_price) as amount
FROM tg_index
INNER JOIN tg_product 
  ON tg_index.product_id = tg_product.product_id
INNER JOIN tg_transaction 
  ON tg_index.transaction_id = tg_transaction.transaction_id
WHERE tg_transaction.date >= COALESCE(NULLIF($1, '')::timestamp, CURRENT_DATE)
  AND tg_transaction.date <= COALESCE(NULLIF($2, '')::timestamp, CURRENT_DATE)
GROUP BY tg_product.product_id, tg_product.product_name, tg_product.unit_price
ORDER BY total_qty DESC;`;
  const values = [startDate, endDate];
  try {
    return pool
      .query(queryStr, values)
      .then((result) => {
        if (result.rows.length < 1) {
          return { status: 200, msg: [] };
        }
        return { status: 200, msg: result.rows };
      })
      .catch((error) => {
        console.log("Error Funtions getDataBestseller" + error);
        return { status: 201, msg: error };
      });
  } catch (error) {
    console.log("Error Connect : " + error);
    return { status: 400, msg: error };
  }
};

const getAllData = async () => {
  const queryStr = ` SELECT product_id,
        product_name,
        unit_price,
        foot_type,
        active
 FROM tg_product
 WHERE foot_type IN (1,2,3,4)
 ORDER BY product_id ASC;`;
  try {
    return pool
      .query(queryStr)
      .then((result) => {
        if (result.rows.length < 1) {
          return { status: 200, msg: [] };
        }
        return { status: 200, msg: result.rows };
      })
      .catch((error) => {
        console.log("Error Funtions getDataBestseller" + error);
        return { status: 201, msg: error };
      });
  } catch (error) {
    console.log("Error Connect : " + error);
    return { status: 400, msg: error };
  }
};

const upProductActive = async (data) => {
  console.log("data", data);
  try {
    for (let item of data) {
      let activeValue = item.active ? "true" : "false";

      await pool.query("BEGIN");
      const queryStr = `
   UPDATE tg_product
   SET active = $1
   WHERE product_id = $2    `;
      const queryValues = [activeValue, item.product_id];

      await pool.query(queryStr, queryValues);
      await pool.query("COMMIT");
    }
    return { status: 200, msg: "success" };
  } catch (error) {
    await pool.query("ROLLBACK");
    console.log(error);
    return { status: 400, msg: "ERROR", error };
  }
};

module.exports = {
  getGoogleTextToSpeech,
  formatQueueNumber,
  getQueue,
  getCallQ,
  upDataTransactionSucess,
  upDataTransactionstatus,
  getWaitingQueue,
  getWaitingCountQueue,

  //-----------------------BackHome----------------
  GetdataPayment,
  GetdataPaymentByData,

  UpdateJsonTRansaction,
  //----------------------------------Dashboard------------------------------------------
  getDataBestseller,
  upProductActive,
  getAllData,
};
