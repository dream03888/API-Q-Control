const axios = require("axios");
const { pool } = require("../initial");

// ✅ แปลงเลขให้มีช่องว่าง เช่น 100 → "1 0 0"
function formatQueueNumber(num) {
  return num.toString().split("").join(" ");
}

// ✅ เรียก Google Translate TTS แล้วส่งเสียงแบบ base64 กลับ
async function getGoogleTextToSpeech(text, transaction_id, language = "en") {
  // console.log("🔊 Google TTS:", text);
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
const GetdataPayment = async () => {
  const queryStr = `SELECT 
    t.transaction_id,
    t.amount,
    t.date,
    t.time,
    t.status,
    s.status_name,
    t.order_number,
    t.payment,
    t.charge_id,
    t.status_payment
  FROM tg_transaction t
  JOIN tg_status s ON t.status::int = s.status_id
  WHERE (t.date + t.time) 
    BETWEEN date_trunc('day', CURRENT_TIMESTAMP)
    AND date_trunc('day', CURRENT_TIMESTAMP) + INTERVAL '1 day' - INTERVAL '1 second';`;

  try {
    const result = await pool.query(queryStr);

    if (result.rows.length < 1) {
      return { status: 204, msg: [] }; // ไม่มีข้อมูล
    }

    return { status: 200, msg: result.rows };
  } catch (error) {
    console.log("❌ GetdataPayment error:", error);
    return { status: 500, msg: error.message };
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
//
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
  // console.log("data", data);
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








const GetdataError = async () => {
  const queryStr = `                  WITH item_cooking AS (
        SELECT
            DISTINCT tg_log_index.ticket,
            jsonb_agg(
                json_build_object(
                   'product_name',tg_product.product_name,
           'option_name_eng',tg_option.option_name_thai ,
           'option_name_thai',tg_option.option_name_eng ,
            'qty',tg_log_index.qty ,
             'option_price',tg_log_option.unit_price ,
           'item_index',tg_log_option.item_index ,
           'unit_price',tg_product.unit_price ,
           'option_qty', CASE
            WHEN option_price = 0 THEN 0
            ELSE   tg_log_option.option_qty
            END,
           'option_sum', option_price *  tg_log_option.option_qty  
                ) ORDER BY tg_log_option.item_index ASC
            ) as items
        FROM tg_log_index
        LEFT join tg_log_option ON tg_log_index.index = tg_log_option.index
        LEFT JOIN  tg_option ON tg_log_option.option_id = tg_option.option_id
        LEFT JOIN tg_product ON tg_log_index.product_id = tg_product.product_id
        WHERE tg_product.product_id NOT IN (18)
        GROUP BY  tg_log_index.ticket 
        ORDER BY tg_log_index.ticket ASC
    )
        SELECT 
item_cooking.items,
tg_log.amount,
tg_log.status as status_payment ,
tg_log.date_time::date as date,
tg_log.date_time::time as time,
tg_log.type as payment, 
tg_log.payment as pp,
tg_log.ticket as order_number,
log_id as charge_id
FROM tg_log
LEFT JOIN item_cooking ON tg_log.ticket = item_cooking.ticket
WHERE date_time::date = CURRENT_DATE
GROUP BY tg_log.ticket ,
item_cooking.items,
tg_log.amount,
tg_log.status,
tg_log.date_time,
tg_log.type,
tg_log.payment,
tg_log.ticket,
log_id

ORDER BY tg_log.ticket ASC;`;
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


const ReportData = async (startDate , endDate) => {
  const queryStr = `                  WITH item_cooking AS (
    SELECT
        tg_index.transaction_id,
        jsonb_agg(
            jsonb_build_object(
                'product_name', tg_product.product_name,
                'option_name_eng', tg_option.option_name_thai,
                'option_name_thai', tg_option.option_name_eng,
                'qty', tg_index.qty,
                'option_price', tg_option_transaction.unit_price,
                'item_index', tg_option_transaction.item_index,
                'unit_price', tg_product.unit_price,
                'option_qty',
                    CASE
                        WHEN tg_option_transaction.unit_price = 0 THEN 0
                        ELSE tg_option_transaction.option_qty
                    END,
                'option_sum',
                    tg_option_transaction.unit_price * tg_option_transaction.option_qty
            )
            ORDER BY tg_option_transaction.item_index ASC
        ) AS items
    FROM tg_index
    LEFT JOIN tg_option_transaction ON tg_index.index = tg_option_transaction.index
    LEFT JOIN tg_option ON tg_option_transaction.option_id = tg_option.option_id
    LEFT JOIN tg_product ON tg_index.product_id = tg_product.product_id
    WHERE tg_product.product_id NOT IN (18)
    GROUP BY tg_index.transaction_id
),

bill_summary AS (
    SELECT
         t.transaction_id,
       t.amount,
        ROUND((t.amount) / 1.07, 2) AS before_vat,
        ROUND(((t.amount) - (t.amount) / 1.07), 2) AS vat_amount,
        ROUND((t.amount), 2) AS after_vat
    FROM tg_transaction t
    INNER JOIN tg_index i ON t.transaction_id = i.transaction_id
    INNER JOIN tg_product p ON i.product_id = p.product_id
WHERE t.date >= COALESCE(NULLIF($1, '')::timestamp, CURRENT_DATE)
  AND t.date <= COALESCE(NULLIF($2, '')::timestamp, CURRENT_DATE)
      GROUP BY t.transaction_id , t.amount
)

SELECT 
    t.order_number,
    q.queue,
    t.transaction_id,
    ic.items,
    bs.amount,
    bs.before_vat,
    bs.vat_amount,
    bs.after_vat,
    t.slips,
    t.payment
    
FROM tg_transaction t
LEFT JOIN item_cooking ic ON t.transaction_id = ic.transaction_id
LEFT JOIN bill_summary bs ON t.transaction_id = bs.transaction_id
LEFT JOIN tg_queue q ON t.transaction_id = q.transaction_id

WHERE t.date >= COALESCE(NULLIF($1, '')::timestamp, CURRENT_DATE)
  AND t.date <= COALESCE(NULLIF($2, '')::timestamp, CURRENT_DATE)
ORDER BY t.transaction_id ASC;
;`;
const queryValues = [startDate , endDate]
  try {
    return pool
      .query(queryStr,queryValues)
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



const ReportDataProduct = async (startDate , endDate) => {
  const queryStr = `                  
    --  Product
    SELECT
        p.product_id::text           AS item_id,
        p.product_name               AS item_name,
        SUM(i.qty)                   AS total_qty,
        p.unit_price                 AS unit_price,
        SUM(i.qty) * p.unit_price    AS amount
    FROM tg_index i
    JOIN tg_product p ON i.product_id = p.product_id
    JOIN tg_transaction t ON i.transaction_id = t.transaction_id
    WHERE t.date >= COALESCE(NULLIF($1, '')::timestamp, CURRENT_DATE)
  AND t.date <= COALESCE(NULLIF($2, '')::timestamp, CURRENT_DATE)
    GROUP BY p.product_id, p.product_name, p.unit_price

    UNION ALL

    -- Option (Cheese)
    SELECT
        o.option_id::text            AS item_id,
        o.option_name_thai           AS item_name,
        SUM(ot.option_qty)   AS total_qty,
        o.option_price                AS unit_price,
        SUM(ot.option_qty) *  o.option_price AS amount
    FROM tg_index i
    JOIN tg_option_transaction ot ON i.index = ot.index
    JOIN tg_option o ON ot.option_id = o.option_id
    JOIN tg_transaction t ON i.transaction_id = t.transaction_id
    WHERE t.date >= COALESCE(NULLIF($1, '')::timestamp, CURRENT_DATE)
  AND t.date <= COALESCE(NULLIF($2, '')::timestamp, CURRENT_DATE)
      AND o.option_id = 38
    GROUP BY o.option_id, o.option_name_thai




;
;`;
const queryValues = [startDate , endDate]
  try {
    return pool
      .query(queryStr,queryValues)
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



const ReportDataPayment = async (startDate , endDate) => {
  const queryStr = `                  
SELECT
payment,
COUNT(*) AS total_count,
SUM(amount) AS total_amount
FROM tg_transaction
 WHERE date >= COALESCE(NULLIF($1, '')::timestamp, CURRENT_DATE)
  AND date <= COALESCE(NULLIF($2, '')::timestamp, CURRENT_DATE)
GROUP BY payment;`;
const queryValues = [startDate , endDate]
  try {
    return pool
      .query(queryStr,queryValues)
      .then((result) => {
        if (result.rows.length < 1) {
          return { status: 200, msg: [] };
        }
        return { status: 200, msg: result.rows };
      })
      .catch((error) => {
        console.log("Error Funtions ReportDataPayment" + error);
        return { status: 201, msg: error };
      });
  } catch (error) {
    console.log("Error Connect : " + error);
    return { status: 400, msg: error };
  }
};


const ReportDataInPayment = async (
  startDate,
  endDate,
  payment,
  page = 1,
  limit = 20
) => {
  const offset = (page - 1) * limit;

  try {
    /* ===============================
       1) COUNT ทั้งหมด (เร็วมาก)
       =============================== */
    const countRes = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM tg_transaction t
      WHERE t.date >= COALESCE(NULLIF($1, '')::timestamp, CURRENT_DATE)
        AND t.date <= COALESCE(NULLIF($2, '')::timestamp, CURRENT_DATE)
        AND t.payment = $3
      `,
      [startDate, endDate, payment]
    );

    const total = countRes.rows[0]?.total || 0;

    /* ===============================
       2) DATA (จำกัด transaction ก่อน)
       =============================== */
    const dataRes = await pool.query(
      `
      WITH tx_page AS (
        SELECT
          t.transaction_id,
          t.order_number,
          t.payment,
          t.amount,
          t.time,
  --        t.slips
        FROM tg_transaction t
        WHERE t.date >= COALESCE(NULLIF($1, '')::timestamp, CURRENT_DATE)
          AND t.date <= COALESCE(NULLIF($2, '')::timestamp, CURRENT_DATE)
          AND t.payment = $3
        ORDER BY t.transaction_id DESC
        LIMIT $4 OFFSET $5
      ),

      item_cooking AS (
        SELECT
          i.transaction_id,
          jsonb_agg(
            jsonb_build_object(
              'product_name', p.product_name,
              'qty', i.qty,
              'unit_price', p.unit_price,
              'option_name_thai', o.option_name_thai,
              'option_qty',
                CASE
                  WHEN ot.unit_price = 0 THEN 0
                  ELSE ot.option_qty
                END,
              'option_sum', ot.unit_price * ot.option_qty
            )
            ORDER BY ot.item_index
          ) AS items
        FROM tg_index i
        JOIN tx_page tx ON tx.transaction_id = i.transaction_id
        LEFT JOIN tg_product p ON i.product_id = p.product_id
        LEFT JOIN tg_option_transaction ot ON i.index = ot.index
        LEFT JOIN tg_option o ON ot.option_id = o.option_id
        WHERE p.product_id NOT IN (18)
        GROUP BY i.transaction_id
      )

      SELECT
        tx.transaction_id,
        tx.order_number,
        q.queue,
        ic.items,
        ROUND(tx.amount / 1.07, 2) AS before_vat,
        ROUND(tx.amount - (tx.amount / 1.07), 2) AS vat_amount,
        ROUND(tx.amount, 2) AS after_vat,
        tx.payment,
        tx.time,
  --      tx.slips
      FROM tx_page tx
      LEFT JOIN item_cooking ic ON tx.transaction_id = ic.transaction_id
      LEFT JOIN tg_queue q ON tx.transaction_id = q.transaction_id
      ORDER BY tx.transaction_id DESC
      `,
      [startDate, endDate, payment, limit, offset]
    );

    return {
      status: 200,
      msg: dataRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

  } catch (error) {
    console.error('ReportDataInPayment ERROR:', error);
    return { status: 500, msg: error };
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
  //---------------------
  GetdataError,
  //----------Report
  ReportData,
  ReportDataProduct,

  ReportDataPayment,
  ReportDataInPayment

};
