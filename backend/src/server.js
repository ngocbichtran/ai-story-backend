require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");

const app = express();

require("./config/db");

app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://baostory.fun",
        "https://www.baostory.fun",
        "https://app.baostory.fun",
        "https://n8n.baostory.fun"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
}));

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Backend Running");
});

app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});