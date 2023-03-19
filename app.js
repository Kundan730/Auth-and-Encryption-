// Import necessary modules
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
require("dotenv").config();
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

// Create a new Express application
const app = express();

// Set the port to listen on
const port = process.env.PORT || 3000;

// Set the view engine to EJS and specify the views directory
app.set("views", "./views");
app.set("view engine", "ejs");

// Use body-parser middleware to parse URL-encoded data
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files in the public directory
app.use(express.static("public"));

// Set MongoDB options
mongoose.set("strictQuery", false);

// Use session middleware to manage user sessions
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Initialize Passport and use session middleware to persist user authentication state
app.use(passport.initialize());
app.use(passport.session());

// Connect to the MongoDB server and log success or error
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

// Define a Mongoose schema for users and their secrets
const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
});

// Set the authentication plugins for Passport.js
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// Create a Mongoose model for users based on the defined schema
const User = mongoose.model("User", userSchema);

// Use the local strategy for Passport.js authentication
passport.use(User.createStrategy());

// Serialize and deserialize user data for authentication and session management
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      const userObject = {
        googleId: user.googleId,
        id: user.id,
        username: user.username,
      };
      done(null, userObject);
    })
    .catch((err) => {
      done(err, null);
    });
});

// Use the Google strategy for Passport.js authentication
// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.CLIENT_ID,
//       clientSecret: process.env.CLIENT_SECRET,
//       callbackURL: "http://localhost:3000/auth/google/secrets",
//       userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
//     },
//     async function (accessToken, refreshToken, profile, cb) {
//       try {
//         const user = await User.findOne({ googleId: profile.id });
//         if (user) {
//           return cb(null, user);
//         } else {
//           const newUser = new User({
//             displayName: profile.displayName,
//             googleId: profile.id,
//           });
//           await newUser.save();
//           return cb(null, newUser);
//         }
//       } catch (err) {
//         return cb(err, null);
//       }
//     }
//   )
// );

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async function (accessToken, refreshToken, profile, done) {
      try {
        console.log(profile);
        // Find or create user in your database
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          // Create new user in database
          const username =
            Array.isArray(profile.emails) && profile.emails.length > 0
              ? profile.emails[0].value.split("@")[0]
              : "";
          const newUser = new User({
            googleId: profile.id,
            username: username,
            displayName: profile.displayName,
          });
          user = await newUser.save();
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

app.get("/", (req, res) => {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/secrets");
  }
);

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/secrets", function (req, res) {
  User.find({
    secret: {
      $ne: null,
    },
  })
    .then((foundUsers) => {
      res.render("secrets", {
        usersWithSecrets: foundUsers,
      });
    })
    .catch((err) => {
      console.log(err);
    });
});

app
  .route("/submit")
  .get(function (req, res) {
    if (req.isAuthenticated()) {
      res.render("submit");
    } else {
      res.redirect("/login");
    }
  })
  .post(function (req, res) {
    const submittedsecret = req.body.secret;
    User.findById(req.user.id)
      .then((foundUser) => {
        if (foundUser) {
          foundUser.secret = submittedsecret;
          foundUser
            .save()
            .then(() => {
              res.redirect("/secrets");
            })
            .catch((err) => {
              console.log(err);
            });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  });

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/");
    }
  });
});

app.post("/register", async (req, res) => {

  User.register(
    { username: req.body.username },
    req.body.password,
    (err, user) => {
      if (err) {
        console.log(err);
        res.status(500).send("Internal Server Error");
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/secrets");
        });
      }
    }
  );
});

app.post("/login", async (req, res) => {

  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, (err) => {
    if (err) {
      console.log(err);
      res.status(500).send("Internal Server Error");
    } else {
      passport.authenticate("local")(req, res, () => {
        res.redirect("/secrets");
      });
    }
  });
});

app.listen(port, function () {
  console.log(`App listening at http://localhost:${port}`);
});
