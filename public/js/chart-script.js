/*global d3:false, topojson:false*/

var MAX_R = 8, MIN_R = 1;
var max, min;
var svg = d3.select("#d3-map");
var width = $("#d3-map").width(),
    height = $("#d3-map").height();
var projection =  d3.geo.mercator().center([120.7, 23.6]).scale(5000).translate([width / 2, height / 2]);
var path = d3.geo.path().projection(projection);
var data;

d3.json("/static/js/taiwan-topojson.json", function (error, tw) {
    "use strict";
    if (error) {
        throw error;
    }
    
    var features = topojson.feature(tw, tw.objects.TW).features;
    
    svg.selectAll("path")
        .data(features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#fff")
        .attr("stroke", "#000");
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

            svg.call(tip);

            svg.selectAll("circle").remove();
            svg.selectAll("circle")
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
                .attr("fill", "#222")
                .on("click", function (d) {
                    window.alert(d.no);
                })
                .on("mouseover", tip.show)
                .on("mouseout", tip.hide);
        }
    });

}
