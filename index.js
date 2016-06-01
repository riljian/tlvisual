const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const jsdom = require("jsdom");
const http = require("http");
const queryString = require("querystring");
const mongo = require("mongodb").MongoClient;
const hash = require("password-hash");
const bodyParser = require("body-parser");
const readline = require("readline");

const WT_STATION = JSON.parse(
    fs.readFileSync("station-list.json", "utf8")
);
const JQUERY = fs.readFileSync("public/js/jquery-2.2.4.min.js", "utf8");
const WT_URL = "http://e-service.cwb.gov.tw/HistoryDataQuery/DayDataController.do?";
const DB_URL = "mongodb://localhost:27017/project";
const MAX_PER_INSERT = 100000;
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
var wtFetchQ = [];
var tlQ = [];

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
        username: req.session.username,
        admin: req.session.username === "admin"
    });
});

app.get("/sign", function (req, res) {
    if (req.session.username) {
        res.redirect("/");
    } else {
        res.render("sign");
    }
});

app.post("/upload", function (req, res) {
    req.setEncoding("utf8");

    var reader = readline.createInterface({
        input: req
    });
    
    reader.on("line", function (line) {
        var attrs = line.split(",");
        tlQ.push({
            no: Number(attrs[0]),
            loc: {
                type: "Point",
                coordinates: [
                    Number(attrs[1]),
                    Number(attrs[2])
                ]
            },
            sta: STAT[attrs[3]],
            time: parseTime(attrs[4])
        });
    });

    reader.on("close", function () {
        res.json({
            status: "SUCCESS",
            content: null
        });
        tl_to_db();
    });
});

app.post("/renderUpload", function (req, res) {
    res.render("upload");
});

app.post("/renderDashboard", function (req, res) {
    db.collection("taxi_logs").stats(function (err, taxi_stats) {
        if (err) {
            console.log(err.message);
        }
        db.collection("weather_logs").stats(function (err, weather_stats) {
            if (err) {
                console.log(err.message);
            }
            res.render("dashboard", {
                taxi_logs_count: taxi_stats.count,
                weather_logs_count: weather_stats.count,
                data_size: ((taxi_stats.size + weather_stats.size) / 1048576).toFixed(2)
            });
        });
    });
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

app.post("/data", function (req, res) {
    var data = {};

    WT_STATION.forEach(function (station) {
        data[station.no] = {
            name: station.area
        };
    });
});

function fetchWeather(station, date) {
    if (wtFetchQ.length === 0) {
        return;
    }

    var para = wtFetchQ.pop();

    http.get(
        WT_URL + queryString.stringify(para),
        function (res) {
            var content = "";

            res.setEncoding("utf8");
            res.on("data", function (chunk) {
                content += chunk;
            });
            res.on("end", function () {
                jsdom.env({
                    html: content,
                    src: [JQUERY],
                    done: function (err, window) {
                        if (err) {
                            console.log(err.message);
                            return;
                        }
                        var $rows = window.$("tr");
                        var logs = [];
                        var time = Date.parse(para.datepicker) / 1000;
                        for (var i = 3; i < $rows.length; i += 1) {
                            var temp = Number($rows.eq(i).children("td").eq(3).text()),
                                humi = Number($rows.eq(i).children("td").eq(5).text()),
                                wind = Number($rows.eq(i).children("td").eq(8).text()),
                                rain = Number($rows.eq(i).children("td").eq(9).text());
                            logs.push({
                                time: time + (i - 2) * 3600,
                                station: para.station,
                                temp: temp ? temp : 0,
                                humi: humi ? humi : 0,
                                wind: wind ? wind : 0,
                                rain: rain ? rain : 0
                            });
                        }
                        if (logs.length > 0) {
                            db.collection("weather_logs")
                                .insertMany(logs, { w: 1, ordered: false }, function (err, result) {
                                    console.log([
                                        "Insert",
                                        result.insertedCount,
                                        "logs to",
                                        para.station,
                                        "on",
                                        para.datepicker
                                    ].join(" "));
                                });
                        } else {
                            para.times += 1;
                            if (para.times < 5) {
                                wtFetchQ.unshift(para);
                            } else {
                                console.log([
                                    "Station",
                                    para.station,
                                    "has tried more than 5 times"
                                ].join(" "));
                            }
                        }
                    }
                });
            });
        }
    ).on("error", function (err) {
        console.log(para);
        console.log(err.message);
    });
}

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

function tl_to_db() {
    if (tlQ.length > 0) {
        db.collection("taxi_logs")
            .insertMany(tlQ.splice(0, MAX_PER_INSERT), { w: 1, ordered: false }, function (err, result) {
                tl_to_db();
                /*
                if (result.insertedCount > 0) {
                    db.collection("taxi_logs")
                        .find({ _id: result.insertedIds[1] }).limit(1)
                        .next(function (err, item) {
                            if (err) {
                                console.log(err);
                                return;
                            }
                            var date = (new Date(item.time * 1000)).toISOString().substr(0, 10);
                            WT_STATION.forEach(function (station) {
                                wtFetchQ.push({
                                    command: "viewMain",
                                    station: station.no,
                                    datepicker: date,
                                    times: 0
                                });
                            });
                        });
                }
               */
            });
    }
}

mongo.connect(DB_URL, function (err, database) {
    if (err) {
        throw err;
    }

    db = database;

    setInterval(fetchWeather, 1000);

    app.listen(process.argv[2] || 8080, function () {
        console.log("Listen on port " + (process.argv[2] || 8080));
    });
});
