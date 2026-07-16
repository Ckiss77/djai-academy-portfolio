const fs = require("fs");
const path = require("path");

const CV_PATH = path.join(__dirname, "private", "chatchai-suthapakti-full-cv.pdf");
const PASSCODE = process.env.CV_PASSCODE || "171819";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { Allow: "POST" },
      body: JSON.stringify({ message: "Method not allowed" }),
    };
  }

  let passcode = "";

  try {
    const payload = JSON.parse(event.body || "{}");
    passcode = String(payload.passcode || "").trim();
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid request" }),
    };
  }

  if (passcode !== PASSCODE) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "Invalid passcode" }),
    };
  }

  const pdf = fs.readFileSync(CV_PATH);

  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="Chatchai-Suthapakti-Full-CV.pdf"',
      "Content-Type": "application/pdf",
    },
    body: pdf.toString("base64"),
  };
};
