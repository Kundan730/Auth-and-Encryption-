const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const encrypt = require('mongoose-encryption');
require('dotenv').config();

const app = express();

const port = process.env.PORT || 3000;

app.set("views", "./views");
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));

mongoose.set("strictQuery", false);

mongoose
  .connect("mongodb://127.0.0.1:27017/userDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log(err);
  });

const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: String,
  password: String,
});

const secret = process.env.SECRET;

userSchema.plugin(encrypt, { secret: secret, encryptedFields: ['password']});

const User = mongoose.model("User", userSchema);

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  const newUser = new User({
    email: req.body.username,
    password: req.body.password
  });

  newUser.save()
  .then(() => {
    console.log('User saved to DB');
    res.render("secrets");
  })
  .catch((err) => {
    console.log(err);
  })
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const foundUser = await User.find({ email: username }).exec();
    if (foundUser.some(user => user.password === password)) {
      res.render('secrets');
    } else {
      res.status(401).send('Incorrect username or password');
    }
  } catch(err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, function () {
  console.log(`App listening at http://localhost:${port}`);
});
