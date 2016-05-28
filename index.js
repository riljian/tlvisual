var path = require("path");
var express = require("express");
var session = require("express-session");
var mongo = require("mongodb").MongoClient;
var hash = require("password-hash");
var bodyParser = require("body-parser");
var DB_URL = "mongodb://localhost:27017/project";

var app = new express();
var db;

app.set("view engine", "pug");
app.use("/static", express.static(path.join(__dirname, "public")));
app.use(session({
    secret: "administrator",
    resave: false,
    saveUninitialized: false
}));

app.post(["/signin", "/signup"], bodyParser.json());

app.get(["/"], function (req, res, next) {
    if (req.session.username) {
        next();
    } else {
        res.redirect("/sign");
    }
});

app.get("/", function (req, res) {
    res.render("template", {
        username: req.session.username
    });
});

app.get("/sign", function (req, res) {
    if (req.session.username) {
        res.redirect("/");
    } else {
        res.render("sign");
    }
});

app.post("/signup", function (req, res) {
    var user = req.body;

    user.password = hash.generate(user.password);

    db.collection("users")
        .insertOne(user, { w: 1 }, function (err, result) {
            if (err) {
                if (err.message.indexOf("duplicate key") > -1) {
                    res.json({
                        status: "FAIL",
                        content: "Username duplicate"
                    });
                } else {
                    unknownErrorHandler(res, err);
                }
            } else {
                req.session.username = user.username;
                res.json({
                    status: "SUCCESS",
                    content: "/"
                });
            }
        });
});

app.post("/signin", function (req, res) {
    var user = req.body;

    db.collection("users")
        .find({ username: user.username }).limit(1)
        .next(function (err, item) {
            if (err) {
                unknownErrorHandler(res, err);
            } else {
                if (item && hash.verify(user.password, item.password)) {
                    req.session.username = user.username;
                    res.json({
                        status: "SUCCESS",
                        content: "/"
                    });
                } else {
                    res.json({
                        status: "FAIL",
                        content: "Please check your username or password"
                    });
                }
            }
        });
});

app.post("/signout", function (req, res) {
    delete req.session.username;
    res.json({
        status: "SUCCESS",
        content: "/"
    });
});

function unknownErrorHandler(res, err) {
    res.json({
        status: "FAIL",
        content: "Unknown error"
    });
    console.log(err.message);
}

mongo.connect(DB_URL, function (err, database) {
    if (err) {
        throw err;
    }

    db = database;

    app.listen(process.argv[2] || 8080, function () {
        console.log("Listen on port " + (process.argv[2] || 8080));
    });
});
