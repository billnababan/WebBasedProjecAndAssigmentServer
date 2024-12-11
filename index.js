const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { testConnection } = require("./database/db");
const Router = require("./router/index");

dotenv.config();
const app = express();

app.use(
  cors({
    origin: process.env.CORS,
    credentials: true,
    methods: ["GET", "POST", "PUT", , "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(Router);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.listen(process.env.APP_PORT, async () => {
  console.log(await testConnection(), `⚡️[server]: Server is running at http://localhost:${process.env.APP_PORT}`);
});
