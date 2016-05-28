const path = require("path");
const express = require("express");
const session = require("express-session");
const mongo = require("mongodb").MongoClient;
const hash = require("password-hash");
const bodyParser = require("body-parser");
const readline = require("readline");

const DB_URL = "mongodb://localhost:27017/project";
const STAT = {                                                                  
    "定點": 0,
    "載客": 1,
    "空車": 2,
    "休息": 3,
    "登出": 4,
    "前往": 5,
    "未知": 6,
    "排班": 7
};

const app = new express();
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

app.post("/upload-progress", function (req, res) {
});

app.post("/upload", function (req, res) {
    var logs = [];
    req.setEncoding("utf8");

    var reader = readline.createInterface({
        input: req
    });
    
    reader.on("line", function (line) {
        var attrs = line.split(",");
        logs.push({
            no: Number(attrs[0]),
            lon: Number(attrs[1]),
            lat: Number(attrs[2]),
            sta: STAT[attrs[3]],
            time: parseTime(attrs[4])
        });
    });

    reader.on("close", function () {
        db.collection("taxi_logs")
            .insertMany(logs, { w: 1, ordered: false }, function (err, result) {
                res.json({
                    status: "SUCCESS",
                    content: result.n
                });
            });
    });
});

app.post("/renderUpload", function (req, res) {
    res.render("upload");
});

app.post("/renderDashboard", function (req, res) {
    res.render("dashboard");
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

function parseTime(timeStr) {
    var token = /^(\d{4}-\d{2}-\d{2})\s(\d{2}):(\d{2}):(\d{2})$/.exec(timeStr);
    var time = Date.parse(token[1]) / 1000;
    time += Number(token[2]) * 60 * 60;
    time += Number(token[3]) * 60;
    time += Number(token[4]);
    return time;
}

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
