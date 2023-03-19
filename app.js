const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
// const encrypt = require('mongoose-encryption');
require('dotenv').config();
// const md5 = require('md5');
// const bcrypt = require('bcrypt');
// const saltRounds = 10;
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');


const app = express();

const port = process.env.PORT || 3000;

app.set("views", "./views");
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));

mongoose.set("strictQuery", false);

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

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

// userSchema.plugin(encrypt, { secret: secret, encryptedFields: ['password']});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/secrets", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("secrets");
  } else {
    res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if(err) {
      console.log(err);
    } else {
      res.redirect('/');
    }
  });
});

app.post("/register", async (req, res) => {
  // try {
  //   const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
  //   const newUser = new User({
  //     email: req.body.username,
  //     password: hashedPassword
  //   });
  //   await newUser.save();
  //   console.log("User saved to DB");
  //   res.render("secrets");
  // } catch (err) {
  //   console.log(err);
  //   res.status(500).send("Internal Server Error");
  // }

  User.register({ username: req.body.username }, req.body.password, (err, user) => {
    if (err) {
      console.log(err);
      res.status(500).send("Internal Server Error");
      res.redirect('/register');
    } else {
      passport.authenticate("local")(req, res, () => {
        res.redirect('/secrets');
      })
    }
  });

});

app.post('/login', async (req, res) => {
  // try {
  //   const username = req.body.username;
  //   const password = req.body.password;
  //   const foundUser = await User.findOne({ email: username }).exec();
  //   if (foundUser) {
  //     const passwordMatch = bcrypt.compare(password, foundUser.password);
  //     if (passwordMatch) {
  //       res.render('secrets');
  //     } else {
  //       res.status(401).send('Incorrect username or password.');
  //     }
  //   } else {
  //     res.status(401).send('Incorrect username or password.');
  //   }
  // } catch (err) {
  //   console.error(err);
  //   res.status(500).send('Internal Server Error');
  // }

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, (err) => {
    if(err) {
      console.log(err);
      res.status(500).send('Internal Server Error');
    } else {
      passport.authenticate('local')(req, res, () => {
        res.redirect('/secrets');
      });
    }
  });

});

app.listen(port, function () {
  console.log(`App listening at http://localhost:${port}`);
});
