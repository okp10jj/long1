// api/sens.js
// Vercel Node.js Serverless Function

const crypto = require("crypto");

module.exports = async (req, res) => {
  // 🔹 GET으로 직접 열었을 때는 안내만 하고 종료
  if (req.method !== "POST") {
    return res
      .status(200)
      .json({
        ok: false,
        step: "method",
        message:
          "이 주소는 브라우저에서 직접 여는 대신, 홈페이지 문의 폼을 통해 전송될 때만 동작합니다.(POST 전용)"
      });
  }

  // 🔹 body 파싱 (문자열/객체 모두 대응)
  let bodyData = req.body;
  if (typeof bodyData === "string") {
    try {
      bodyData = JSON.parse(bodyData);
    } catch (e) {
      bodyData = {};
    }
  }

  // ✅ 폼에서 넘어온 값들
  // 현재 HTML 폼에는 email 필드가 없으니 phone + message만 사용
  const phone = bodyData?.phone || "미입력";
  const message = bodyData?.message || "(내용 없음)";

  const serviceId = process.env.NCP_SENS_SERVICE_ID;
  const accessKey = process.env.NCP_ACCESS_KEY;
  const secretKey = process.env.NCP_SECRET_KEY;
  const toPhoneNumber = "01067064733"; // 받을 번호

  // 🔹 환경변수 체크 (빠뜨렸으면 바로 알려주기)
  if (!serviceId || !accessKey || !secretKey) {
    return res.status(200).json({
      ok: false,
      step: "env",
      message:
        "NCP_SENS_SERVICE_ID / NCP_ACCESS_KEY / NCP_SECRET_KEY 환경변수를 확인해주세요."
    });
  }

  const method = "POST";
  const space = " ";
  const newLine = "\n";
  const urlPath = `/sms/v2/services/${serviceId}/messages`;
  const timestamp = Date.now().toString();

  // 🔹 서명(Signature) 생성
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(method + space + urlPath + newLine + timestamp + newLine + accessKey);
  const signature = hmac.digest("base64");

  // 🔹 문자 내용 (연락처 + 문의내용)
  const smsContent =
    `[LongPC 홈페이지 문의]\n\n` +
    `연락처: ${phone}\n\n` +
    `내용:\n${message}`;

  const body = {
    type: "SMS",
    from: "01067064733", // NCP SENS에 등록된 발신번호 그대로
    content: smsContent,
    messages: [{ to: toPhoneNumber }]
  };

  try {
    const response = await fetch(
      `https://sens.apigw.ntruss.com${urlPath}`,
      {
        method,
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

    // 🔹 NCP SENS 응답 그대로 내려보내서 프론트에서 보이게
    if (!response.ok || result.status === "fail") {
      console.error("SENS Error:", result);
      return res.status(200).json({
        ok: false,
        step: "sens",
        message: "NCP SENS 문자 발송 중 오류가 발생했습니다.",
        result
      });
    }

    return res.status(200).json({
      ok: true,
      step: "done",
      message: "문자 발송 성공",
      result
    });
  } catch (error) {
    console.error("SENS Exception:", error);
    return res.status(200).json({
      ok: false,
      step: "exception",
      message: "서버에서 예외가 발생했습니다.",
      error: error.message
    });
  }
};
