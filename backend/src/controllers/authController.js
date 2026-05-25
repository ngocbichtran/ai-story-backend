const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const sql =
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";

        db.query(
            sql,
            [username, email, hashedPassword],
            (err, result) => {
                if (err) {
                    return res.status(500).json(err);
                }

                const token = jwt.sign(
                    { id: result.insertId },
                    process.env.JWT_SECRET,
                    { expiresIn: "7d" }
                );

                res.json({
                    message: "Register success",
                    token,
                });
            }
        );
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

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(400).json({
                message: "Wrong password",
            });
        }

        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login success",
            token,
        });
    });
};

exports.getMe = (req, res) => {
    res.json({
        message: "User data",
        user: req.user,
    });
};