// dependency
const path = require("path");
const fs = require("fs");
const d3 = require("d3");
const express = require("express");
const session = require("express-session");
const jsdom = require("jsdom");
const http = require("http");
const firebase = require("firebase");
const queryString = require("querystring");
const hash = require("password-hash");
const bodyParser = require("body-parser");
const readline = require("readline");
const favicon = require("serve-favicon");

// constant
const WT_STATION = JSON.parse(
    fs.readFileSync("station-list.json", "utf8")
);
const JQUERY = fs.readFileSync("public/js/jquery-2.2.4.min.js", "utf8");
const WT_URL = "http://e-service.cwb.gov.tw/HistoryDataQuery/DayDataController.do?";
const TX_STAT = {                                                                  
    "定點": 0,
    "載客": 1,
    "空車": 2,
    "休息": 3,
    "登出": 4,
    "前往": 5,
    "未知": 6,
    "排班": 7
};

firebase.initializeApp({
    serviceAccount: "firebase-auth.json",
    databaseURL: "https://project-4157906125252914342.firebaseio.com"
});

// static objects
var app = new express();
var db = firebase.database();
var wtFetchQ = [];
var tlUploadQ = [];

app.set("view engine", "pug");
app.use("/static", express.static(path.join(__dirname, "public")));
app.use(favicon(__dirname + "/public/favicon.ico"));
app.use(session({
    secret: "administrator",
    resave: false,
    saveUninitialized: false
}));

app.post(["/signin", "/signup", "/data"], bodyParser.json());

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
        tlUploadQ.push({
            no: Number(attrs[0]),
            station: (function (loc) {
                var min_dis = 1, min_sta;
                WT_STATION.forEach(function (station) {
                    var dis = d3.geo.distance(loc, [station.lng, station.lat]);
                    if (dis < min_dis) {
                        min_dis = dis;
                        min_sta = station.no;
                    }
                });
                return min_sta;
            })([Number(attrs[1]), Number(attrs[2])]),
            status: TX_STAT[attrs[3]],
            time: (function (str) {
                var token = /^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/.exec(str);
                return Number(token[1] + token[2] + token[3] + token[4]);
            })(attrs[4])
        });
    });

    reader.on("close", function () {
        res.json({
            status: "SUCCESS",
            content: null
        });

        var txLogSummary = d3.nest()
                            .key(function (d) { return d.time; })
                            .key(function (d) { return d.station; })
                            .key(function (d) { return d.status; })
                            .rollup(function (v) { return v.length; })
                            .entries(tlUploadQ);
        if (tlUploadQ.length > 0) {
            var dateStr = (function (t) {
                return [
                    t.substr(0, 4),
                    t.substr(4, 2),
                    t.substr(6, 2)
                ].join("-");
            })(String(tlUploadQ[0].time));
            WT_STATION.forEach(function (station) {
                wtFetchQ.push({
                    command: "viewMain",
                    station: station.no,
                    datepicker: dateStr,
                    times: 0
                });
            });
        }
        tlUploadQ = []; // clear
        txLogSummary.forEach(function (time) {
            time.values.forEach(function (station) {
                var ref_l = [
                    "taxi_logs",
                    time.key,
                    station.key
                ].join("/");
                var logs = {};

                station.values.forEach(function (stat) {
                    logs[stat.key] = stat.values;
                });

                db.ref(ref_l).set(logs);
            });
        });
        if (wtFetchQ.length > 0) {
            fetchWeather();
        }
    });
});

app.post("/renderUpload", function (req, res) {
    res.render("upload");
});

app.post("/renderChart", function (req, res) {
    res.render("chart");
});

app.post("/renderDashboard", function (req, res) {
    db.ref()
        .once("value", function (snapshot) {
            res.render("dashboard", {
                log_hour: snapshot.child("taxi_logs").numChildren(),
                user_count: snapshot.child("users").numChildren(),
                station_count: WT_STATION.length
            });
        });
});

app.post("/signup", function (req, res) {
    var user = req.body;

    user.password = hash.generate(user.password);

    db.ref("users/" + user.username)
        .once("value", function (user_snapshot) {
            if (user_snapshot.exists()) {
                res.json({
                    status: "FAIL",
                    content: "Username duplicate"
                });
            } else {
                req.session.username = user.username;
                user_snapshot.ref.set({
                    password: user.password
                });
                res.json({
                    status: "SUCCESS",
                    content: "/"
                });
            }
        });
});

app.post("/signin", function (req, res) {
    var user = req.body;

    db.ref("users/" + user.username)
        .once("value", function (user_snapshot) {
            if (user_snapshot.exists() && hash.verify(user.password, user_snapshot.val().password)) {
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
    var weather_logs = {}, taxi_logs = {}, someone_done = false;

    WT_STATION.forEach(function (station) {
        weather_logs[station.no] = [];
        taxi_logs[station.no] = [];
    });

    db.ref("stations")
        .orderByKey()
        .startAt(req.body.duration[0])
        .endAt(req.body.duration[1])
        .once("value", function (snapshot) {
            snapshot.forEach(function (snapshot_time) {
                snapshot_time.forEach(function (snapshot_station) {
                    var log = snapshot_station.val();
                    log.time = snapshot_time.key;
                    weather_logs[snapshot_station.key].push(log);
                });
            });

            if (someone_done) {
                res.json({
                    status: "SUCCESS",
                    content: {
                        stations: WT_STATION,
                        weather_logs: weather_logs,
                        taxi_logs: taxi_logs
                    }
                });
            } else {
                someone_done = true;
            }
    });

    db.ref("taxi_logs")
        .orderByKey()
        .startAt(req.body.duration[0])
        .endAt(req.body.duration[1])
        .once("value", function (snapshot) {
            snapshot.forEach(function (snapshot_time) {
                snapshot_time.forEach(function (snapshot_station) {
                    var log = snapshot_station.val();
                    if (Array.isArray(log)) {
                        log = log.reduce(function (o, v, i) {
                            o[i] = v;
                            return o;
                        }, {});
                    }
                    log.time = snapshot_time.key;
                    taxi_logs[snapshot_station.key].push(log);
                });
            });

            if (someone_done) {
                res.json({
                    status: "SUCCESS",
                    content: {
                        stations: WT_STATION,
                        weather_logs: weather_logs,
                        taxi_logs: taxi_logs
                    }
                });
            } else {
                someone_done = true;
            }
    });
});

function fetchWeather() {
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
                if (wtFetchQ.length > 0) {
                    setTimeout(fetchWeather, 1000);
                }
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
                        for (var i = 3; i < $rows.length; i += 1) {
                            var temp = Number($rows.eq(i).children("td").eq(3).text()),
                                rain = Number($rows.eq(i).children("td").eq(9).text());
                            logs.push({
                                temp: temp ? temp : 0,
                                rain: rain ? rain : 0
                            });
                        }
                        if (logs.length > 0) {
                            for (var i in logs) {
                                var ref_l = "stations/";

                                ref_l += (function (date, hour) {
                                    var d = date.replace(/-/g, "");
                                    if (hour > 9) {
                                        return d + hour;
                                    } else {
                                        return d + "0" + hour;
                                    }
                                })(para.datepicker, i);
                                ref_l += "/" + para.station;

                                db.ref(ref_l).set(logs[i]);
                            }
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

function unknownErrorHandler(res, err) {
    res.json({
        status: "FAIL",
        content: "Unknown error"
    });
    console.log(err.message);
}

app.listen(process.argv[2] || 8080, function () {
    console.log("Listen on port " + (process.argv[2] || 8080));
});
