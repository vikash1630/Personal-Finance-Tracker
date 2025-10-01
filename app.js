const cookieParser = require('cookie-parser');
const express = require('express');
const path = require('path');
const cors = require('cors');
const userModel = require('./modules/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const transactionModel = require('./modules/transaction');

// ❌ Removed duplicate import of transaction model
// const transaction = require('./modules/transaction'); // ← removed

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/create", (req, res) => {
    res.render("create");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/created", async (req, res) => {
    let { name, email, password, age } = req.body;
    if (name === '') return res.send("Name required");
    if (email === '') return res.send("email required");
    if (password === '') return res.send("password required");
    if (age === '' || age <= 0) return res.send("Age invalid");

    let user = await userModel.findOne({ email });
    if (user) return res.send("Email Already Exists");

    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            await userModel.create({ name, email, password: hash, age }); // ✅ added await for consistency
        });
    });

    res.render("login");
});

app.post("/loggedin", async (req, res) => {
    let { email, password } = req.body;
    let user = await userModel.findOne({ email });
    if (!user) return res.send("User Does Not Exist");

    bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
            // ✅ moved token creation before rendering
            let token = jwt.sign(
                { email: user.email, name: user.name, age: user.age }, // ✅ added name and age to token
                "secretKey"
            );
            res.cookie("token", token);
            res.redirect("/profile"); // ✅ changed from res.render to res.redirect for proper flow
        } else {
            res.send("Incorrect Password");
        }
    });
});

app.post("/loggedout", (req, res) => {
    res.cookie("token", "");
    res.redirect("/");
});

app.get("/profile", userVerify, (req, res) => {
    const { email, name, age } = req.user; // ✅ simplified destructuring

    console.log(email);
    console.log(name);
    console.log(age);

    res.render('profile', { email, name, age });
});

app.post("/TransactionAdded", async (req, res) => {
    const { amount, description } = req.body;
    const token = req.cookies.token;

    if (!token) return res.status(401).send("You Don't Have Access");

    try {
        const decodedData = jwt.verify(token, "secretKey");
        const email = decodedData.email;

        if (!amount || amount <= 0 || !description) {
            return res.status(400).send("Transaction Field Empty");
        }

        const createdTransaction = await transactionModel.create({
            email,
            transaction: { amount, description }
        });

        console.log("Transaction Created:", createdTransaction);

        res.send(`
            <html>
                <head>
                    <meta http-equiv="refresh" content="5;url=/profile" />
                    <style>
                        body {
                            background-color: #1e1e1e;
                            color: white;
                            font-family: sans-serif;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                        }
                    </style>
                </head>
                <body>
                    <h1>✅ Transaction Created Successfully</h1>
                    <p>Redirecting to Profile Page in <span id="countdown">5</span> seconds...</p>
                    <a href="/profile">Profile<a/>
                    <script>
                        let count = 5;
                        const countdown = document.getElementById('countdown');
                        const timer = setInterval(() => {
                            count--;
                            countdown.textContent = count;
                            if (count === 0) clearInterval(timer);
                        }, 1000);
                    </script>
                </body>
            </html>
        `);
    } catch (err) {
        console.error("Transaction error:", err);
        res.status(401).send("Invalid or expired token");
    }
});

app.get('/transactions', async (req, res) => {
  try {
    const transactions = await transactionModel.find();
    const sum = 0;
    const totalAmount = transactions.reduce((sum, t) => sum + t.transaction.amount, 0);
    res.render('transactions', { transactions, totalAmount }); // 👈 this is key
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


app.post("/delete/:transaction_id", async (req, res) => {
  try {
    const transaction_Id = req.params.transaction_id;
    const delete_transaction = await transactionModel.findByIdAndDelete(transaction_Id);

    console.log(delete_transaction.amount); // ✅ Accessing deleted transaction's amount

    res.redirect("/transactions"); // ✅ Correct redirect
  } catch (err) {
    console.error(err);
    res.status(500).send("Something Went Wrong");
  }
});

function userVerify(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.send("Access Denied !!!");

    try {
        const user = jwt.verify(token, "secretKey");
        req.user = user;
        next();
    } catch (err) {
        res.send("Invalid Token");
    }
}

app.listen(3000, () => {
    console.log("Server Started Running");
});