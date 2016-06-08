/*global d3:false, topojson:false*/

var MAX_R = 8, MIN_R = 1;
var max, min;
var svg = d3.select("#d3-map");
var width = $("#d3-map").width(),
    height = $("#d3-map").height();
var projection =  d3.geo.mercator().center([120.7, 23.6]).scale(5000).translate([width / 2, height / 2]);
var path = d3.geo.path().projection(projection);
var data;
var centered;

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
        .attr("stroke", "#000")
        .on("click", zoom);
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

    svg.selectAll("path")
        .style("fill", centered && function (d) {
            if (d === centered) {
                return "orange";
            } else {
                return "none";
            }
        });

    svg.transition()
        .duration(750)
        .attr("transform", transform)
        .style("stroke-width", (1.5 / k) + "px");
}
