require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcrypt");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

// MODELS
const userModel = require("./modules/user");
const transactionModel = require("./modules/transaction");

const app = express();

// ----------------------
// MIDDLEWARE
// ----------------------

app.use(
  cors({
    origin: process.env.CLIENT_URL,       // MUST set in .env
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// ----------------------
// DATABASE
// ----------------------

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("🔥 MongoDB Connected"))
  .catch((err) => console.log("❌ DB Error:", err));

// ----------------------
// AUTH MIDDLEWARE
// ----------------------

function userVerify(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).send("Access Denied");

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch {
    return res.status(403).send("Invalid or Expired Token");
  }
}

// ----------------------
// ROUTES
// ----------------------

app.get("/", (req, res) => res.render("index"));
app.get("/create", (req, res) => res.render("create"));
app.get("/login", (req, res) => res.render("login"));

// REGISTER
app.post("/created", async (req, res) => {
  let { name, email, password, age } = req.body;

  if (!name || !email || !password || !age)
    return res.send("All fields required");

  let user = await userModel.findOne({ email });
  if (user) return res.send("Email Already Exists");

  const hash = await bcrypt.hash(password, 10);

  await userModel.create({ name, email, password: hash, age });

  res.redirect("/login");
});

// LOGIN
app.post("/loggedin", async (req, res) => {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email });
  if (!user) return res.send("User Does Not Exist");

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.send("Incorrect Password");

  const token = jwt.sign(
    { email: user.email },        // Keep payload small for security
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: true,                // IMPORTANT: Requires HTTPS in production
    sameSite: "none",            // Allows cross-site cookie for frontend
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.redirect("/profile");
});

// LOGOUT
app.post("/loggedout", (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    expires: new Date(0),
  });
  res.redirect("/");
});

// PROFILE
app.get("/profile", userVerify, (req, res) => {
  const { email } = req.user;
  res.render("profile", { email });
});

// ADD TRANSACTION
app.post("/TransactionAdded", async (req, res) => {
  const { amount, description } = req.body;
  const token = req.cookies.token;

  if (!token) return res.status(401).send("You Don't Have Access");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    if (!amount || amount <= 0 || !description)
      return res.send("Transaction Field Empty");

    await transactionModel.create({
      email,
      transaction: { amount, description },
    });

    res.redirect("/profile");
  } catch {
    res.status(403).send("Invalid or expired token");
  }
});

// SHOW TRANSACTIONS
app.get("/transactions", async (req, res) => {
  try {
    const transactions = await transactionModel.find();

    const totalAmount = transactions.reduce(
      (sum, t) => sum + t.transaction.amount,
      0
    );

    res.render("transactions", { transactions, totalAmount });
  } catch {
    res.status(500).send("Server error");
  }
});

// DELETE TRANSACTION
app.post("/delete/:transaction_id", async (req, res) => {
  try {
    await transactionModel.findByIdAndDelete(req.params.transaction_id);
    res.redirect("/transactions");
  } catch {
    res.send("Something Went Wrong");
  }
});

// ----------------------
// START SERVE
// ----------------------

app.listen(process.env.PORT || 3000, () =>
  console.log(`🚀 Server Running on PORT ${process.env.PORT || 3000}`)
);
