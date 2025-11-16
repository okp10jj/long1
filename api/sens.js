// api/sens.js  (Vercel Node.js Serverless Function)

const crypto = require("crypto");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Formspree Webhook에서 넘어오는 데이터 파싱
  let bodyData = req.body;
  if (typeof bodyData === "string") {
    try {
      bodyData = JSON.parse(bodyData);
    } catch (e) {
      bodyData = {};
    }
  }

  const email = bodyData.email || "미입력";
  const message = bodyData.message || "(내용 없음)";

  const serviceId = process.env.NCP_SENS_SERVICE_ID;
  const accessKey = process.env.NCP_ACCESS_KEY;
  const secretKey = process.env.NCP_SECRET_KEY;
  const toPhoneNumber = "01067064733"; // 문자 받을 번호 (본인 번호)

  const method = "POST";
  const space = " ";
  const newLine = "\n";
  const urlPath = `/sms/v2/services/${serviceId}/messages`;
  const timestamp = Date.now().toString();

  // ------------ 서명(Signature) 생성 ------------
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(method + space + urlPath + newLine + timestamp + newLine + accessKey);
  const signature = hmac.digest("base64");

  // ------------ SMS 내용 구성 ------------
  const smsContent =
    `[LongPC 홈페이지 문의]\n\n` +
    `이메일: ${email}\n\n` +
    `내용:\n${message}`;

  const body = {
    type: "SMS",
    from: "01067064733", // NCP SENS에 등록한 발신번호
    content: smsContent,
    messages: [{ to: toPhoneNumber }]
  };

  try {
    const response = await fetch(
      `https://sens.apigw.ntruss.com${urlPath}`,
      {
        method: method,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-ncp-iam-access-key": accessKey,
          "x-ncp-apigw-timestamp": timestamp,
          "x-ncp-apigw-signature-v2": signature
        },
        body: JSON.stringify(body)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("SENS Error:", result);
      return res.status(500).json({ ok: false, error: "SENS API Error", detail: result });
    }

    return res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error("SENS Exception:", error);
    return res.status(500).json({
      ok: false,
      error: "SMS Send Failed",
      detail: error.message
    });
  }
};
