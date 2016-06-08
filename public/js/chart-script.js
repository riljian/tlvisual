/*global d3:false, topojson:false*/

var MAX_R = 8, MIN_R = 1;
var max, min;
var g = d3.select("#d3-map").append("g");
var width = $("#d3-map").width(),
    height = $("#d3-map").height();
var projection =  d3.geo.mercator().center([120.7, 23.6]).scale(5000).translate([width / 2, height / 2]);
var path = d3.geo.path().projection(projection);
var data;
var centered;
var chart;

d3.json("/static/js/taiwan-topojson.json", function (error, tw) {
    "use strict";
    if (error) {
        throw error;
    }
    
    var features = topojson.feature(tw, tw.objects.TW).features;
    
    g.selectAll("path")
        .data(features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#fff")
        .attr("stroke", "#000")
        .on("click", zoom);

    $("#chart-div").height(500);

    chart = new AmCharts.AmSerialChart();

    chart.dataProvider = [];
    chart.categoryField = "time";

    var categoryAxis = chart.categoryAxis;
    categoryAxis.parseDates = true;
    categoryAxis.minPeriod = "hh";

    var valueAxisTemp = new AmCharts.ValueAxis();
    valueAxisTemp.axisColor = "#FF6600";
    valueAxisTemp.gridAlpha = 0;
    chart.addValueAxis(valueAxisTemp);

    var valueAxisTaxi = new AmCharts.ValueAxis();
    valueAxisTaxi.position = "right";
    valueAxisTaxi.axisColor = "#FCD202";
    valueAxisTaxi.gridAlpha = 0;
    chart.addValueAxis(valueAxisTaxi);

    var valueAxisRain = new AmCharts.ValueAxis();
    valueAxisRain.position = "right";
    valueAxisRain.axisColor = "#B0DE09";
    valueAxisRain.gridAlpha = 0;
    valueAxisRain.offset = 50;
    chart.addValueAxis(valueAxisRain);

    var graphTemp = new AmCharts.AmGraph();
    graphTemp.valueAxis = valueAxisTemp;
    graphTemp.type = "smoothedLine";
    graphTemp.title = "Temperature";
    graphTemp.lineColor = "#FF6600";
    graphTemp.valueField = "temp";
    chart.addGraph(graphTemp);

    var graphTaxi = new AmCharts.AmGraph();
    graphTaxi.valueAxis = valueAxisTaxi;
    graphTaxi.type = "smoothedLine";
    graphTaxi.title = "Taxi";
    graphTaxi.lineColor = "#FCD202";
    graphTaxi.valueField = "taxi";
    chart.addGraph(graphTaxi);

    var graphRain = new AmCharts.AmGraph();
    graphRain.valueAxis = valueAxisRain;
    graphRain.type = "column";
    graphRain.title = "Rain";
    graphRain.lineColor = "#B0DE09";
    graphRain.valueField = "rain";
    chart.addGraph(graphRain);

    var chartCursor = new AmCharts.ChartCursor();
    chart.addChartCursor(chartCursor);

    var chartScrollbar = new AmCharts.ChartScrollbar();
    chartScrollbar.offset = 15;
    chart.addChartScrollbar(chartScrollbar);

    var legend = new AmCharts.AmLegend();
    legend.useGraphSettings = true;
    chart.addLegend(legend);

    chart.write("chart-div");
});

function fetchData() {
    var tip = d3.tip().html(function (d) { return d.area; });
    $.ajax({
        method: "POST",
        url: "/data",
        contentType: "application/json",
        data: JSON.stringify({
            duration: [
                $("#duration-start").val(),
                $("#duration-end").val()
            ]
        }),
        success: function (obj) {
            data = obj.content;

            max = -Infinity;
            min = Infinity;

            for (var no in data.taxi_logs) {
                var sum = 0;
                data.taxi_logs[no].forEach(function (o) {
                    for (var sta in o) {
                        if (!isNaN(sta)) {
                            sum += o[sta];
                        }
                    }
                });
                max = Math.max(max, sum);
                min = Math.min(min, sum);
            }

            g.call(tip);

            g.selectAll("circle").remove();
            g.selectAll("circle")
                .data(data.stations)
                .enter()
                .append("circle")
                .attr("cx", function (d) {
                    return projection([d.lng, d.lat])[0];
                })
                .attr("cy", function (d) {
                    return projection([d.lng, d.lat])[1];
                })
                .attr("r", function (d) {
                    var sum = 0;

                    data.taxi_logs[d.no].forEach(function (o) {
                        for (var sta in o) {
                            if (!isNaN(sta)) {
                                sum += o[sta];
                            }
                        }
                    });

                    if (sum === 0) {
                        return 0;
                    } else {
                        return MIN_R + (sum - min) * (MAX_R - MIN_R) / (max - min);
                    }
                })
                .attr("fill", "#000")
                .attr("fill-opacity", "0.4")
                .on("click", function (d) {
                    var sData = [];

                    data.weather_logs[d.no].forEach(function (o) {
                        sData.push({
                            rain: o.rain,
                            temp: o.temp,
                            taxi: (function (t) {
                                var num = 0;
                                data.taxi_logs[d.no].forEach(function (tl) {
                                    if (tl.time === t) {
                                        if (tl["2"]) {
                                            num = tl["2"];
                                        }
                                    }
                                });
                                return num;
                            })(o.time),
                            time: (function (t) {
                                return new Date(
                                    Number(t.substr(0, 4)),
                                    Number(t.substr(4, 2)) - 1,
                                    Number(t.substr(6, 2)),
                                    Number(t.substr(8, 2))
                                );
                            })(o.time)
                        });
                    });

                    chart.dataProvider = sData;
                    chart.validateData();
                })
                .on("mouseover", tip.show)
                .on("mouseout", tip.hide);
        }
    });

}

function zoom(d) {
    var x, y, k;
    if (d && centered !== d) {
        var centroid = path.centroid(d);
        x = centroid[0];
        y = centroid[1];
        k = 4;
        centered = d;
    } else {
        x = width / 2;
        y = height / 2;
        k = 1;
        centered = null;
    }

    var transform = [
        "translate(",
        width / 2,
        ",",
        height / 2,
        ")scale(",
        k,
        ")translate(",
        -x,
        ",",
        -y,
        ")"
    ].join("");

    g.selectAll("path")
        .style("fill", centered && function (d) {
            if (d === centered) {
                return "orange";
            } else {
                return "transparent";
            }
        });

    g.transition()
        .duration(750)
        .attr("transform", transform)
        .style("stroke-width", (1.5 / k) + "px");
}
