const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";

    db.query(sql, [username, email, hashedPassword], (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }

      const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, { expiresIn: "7d" });

      res.json({
        message: "Register success",
        token,
      });
    });
  } catch (error) {
    res.status(500).json(error);
  }
};

exports.login = (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM users WHERE email = ?";

  db.query(sql, [email], async (err, results) => {
    if (err) {
      return res.status(500).json(err);
    }

    if (results.length === 0) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    const user = results[0];

    const isMatch = await bcrypt.compare(password, user.password);

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
  });
};

exports.getMe = (req, res) => {
  const sql = `
        SELECT id, username, email
        FROM users
        WHERE id = ?
    `;

  db.query(sql, [req.user.id], (err, results) => {
    if (err) {
      console.log(err);

      return res.status(500).json({
        message: "Server error",
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      message: "User data",
      user: results[0],
    });
  });
};

exports.googleLogin = async (req, res) => {
  try {
    console.log("STEP 1");
    console.log("BODY =", req.body);

    const { credential } = req.body;

    console.log("STEP 2");

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    console.log("STEP 3");

    const payload = ticket.getPayload();

    console.log("STEP 4", payload);

    const email = payload.email;
    const username = payload.name;

    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
      console.log("STEP 5");

      if (err) {
        console.error("MYSQL SELECT ERROR:", err);
        return res.status(500).json(err);
      }

      console.log("STEP 6", results.length);

      if (results.length > 0) {
        const user = results[0];

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        return res.json({
          message: "Google login success",
          token,
        });
      }

      console.log("STEP 7");

      db.query("INSERT INTO users(username,email,password) VALUES(?,?,?)", [username, email, null], (err, result) => {
        if (err) {
          console.error("MYSQL INSERT ERROR:", err);
          return res.status(500).json(err);
        }

        console.log("STEP 8");

        const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.json({
          message: "Google register success",
          token,
        });
      });
    });
  } catch (error) {
    console.error("GOOGLE ERROR:", error);

    res.status(500).json({
      message: "Google login failed",
    });
  }
};
