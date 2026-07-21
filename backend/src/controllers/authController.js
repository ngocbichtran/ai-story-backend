const jwt = require("jsonwebtoken");
const db = require("../config/db");
const axios = require("axios");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.getMe = async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, username, email
       FROM users
       WHERE id = ?`,
      [req.user.id],
    );

    if (results.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      message: "User data",
      user: results[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { token, credential } = req.body;

    let email = "";
    let username = "";

    // 1. TRƯỜNG HỢP NHẬN ACCESS TOKEN (TỪ HOOK useGoogleLogin TRÊN FRONTEND)
    if (token) {
      const googleRes = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });

      email = googleRes.data.email;
      username = googleRes.data.name;
    }
    // 2. TRƯỜNG HỢP NHẬN ID TOKEN / CREDENTIAL (TỪ COMPONENT <GoogleLogin /> MẶC ĐỊNH)
    else if (credential) {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      email = payload.email;
      username = payload.name;
    } else {
      return res.status(400).json({
        message: "Missing Google Token or Credential",
      });
    }

    if (!email) {
      return res.status(400).json({
        message: "Failed to retrieve email from Google Account",
      });
    }

    // 3. KIỂM TRA TÀI KHOẢN TRONG DATABASE MYSQL
    const [results] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (results.length > 0) {
      const user = results[0];

      const appToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

      return res.json({
        message: "Google login success",
        token: appToken,
      });
    }

    // 4. KHỞI TẠO TÀI KHOẢN MỚI NẾU CHƯA TỒN TẠI
    const [result] = await db.query("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", [username, email, null]);

    const appToken = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      message: "Google register success",
      token: appToken,
    });
  } catch (error) {
    console.error("GOOGLE ERROR:", error.response?.data || error.message || error);

    res.status(500).json({
      message: "Google login failed",
      error: error.message,
    });
  }
};
