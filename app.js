require("dotenv").config();
const express = require("express");
app.set("trust proxy", 1);
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
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// ----------------------
// DATABASE CONNECT
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
  if (!token) return res.send("Access Denied !!!");

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    res.send("Invalid Token");
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
  let { email, password } = req.body;

  let user = await userModel.findOne({ email });
  if (!user) return res.send("User Does Not Exist");

  const result = await bcrypt.compare(password, user.password);

  if (!result) return res.send("Incorrect Password");

  let token = jwt.sign(
    { email: user.email, name: user.name, age: user.age },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  // *** PRODUCTION COOKIE FIX ***
  res.cookie("token", token, {
    httpOnly: true,
    secure: true,      // requires https
    sameSite: "none",  // required for cross-site cookies (Render + frontend)
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.redirect("/profile");
});

// LOGOUT
app.post("/loggedout", (req, res) => {
  // *** PRODUCTION COOKIE FIX ***
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
  const { email, name, age } = req.user;
  res.render("profile", { email, name, age });
});

// ADD TRANSACTION
app.post("/TransactionAdded", async (req, res) => {
  const { amount, description } = req.body;
  const token = req.cookies.token;

  if (!token) return res.status(401).send("You Don't Have Access");

  try {
    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    const email = decodedData.email;

    if (!amount || amount <= 0 || !description)
      return res.send("Transaction Field Empty");

    await transactionModel.create({
      email,
      transaction: { amount, description },
    });

    res.redirect("/profile");
  } catch (err) {
    res.send("Invalid or expired token");
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
  } catch (err) {
    res.send("Server error");
  }
});

// DELETE TRANSACTION
app.post("/delete/:transaction_id", async (req, res) => {
  try {
    await transactionModel.findByIdAndDelete(req.params.transaction_id);
    res.redirect("/transactions");
  } catch (err) {
    res.send("Something Went Wrong");
  }
});

// ----------------------
// START SERVER
// ----------------------
app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 Server Running on PORT", process.env.PORT || 3000)
);
