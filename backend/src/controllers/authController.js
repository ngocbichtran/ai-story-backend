const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", [username, email, hashedPassword]);

    const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Register success",
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json(error);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [results] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (results.length === 0) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    const user = results[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({
        message: "Wrong password",
      });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Login success",
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

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
    const { credential } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const email = payload.email;
    const username = payload.name;

    const [results] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (results.length > 0) {
      const user = results[0];

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

      return res.json({
        message: "Google login success",
        token,
      });
    }

    const [result] = await db.query("INSERT INTO users(username,email,password_hash) VALUES(?,?,?)", [username, email, null]);

    const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      message: "Google register success",
      token,
    });
  } catch (error) {
    console.error("GOOGLE ERROR:", error);

    res.status(500).json({
      message: "Google login failed",
    });
  }
};
