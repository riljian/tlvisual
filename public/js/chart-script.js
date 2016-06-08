/*global d3:false, topojson:false*/

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
            data = obj;

            svg.call(tip);

            svg.selectAll("circle")
                .data(data.content.stations)
                .enter()
                .append("circle")
                .attr("cx", function (d) {
                    return projection([d.lng, d.lat])[0];
                })
                .attr("cy", function (d) {
                    return projection([d.lng, d.lat])[1];
                })
                .attr("r", "4px")
                .attr("fill", "#222")
                .on('mouseover', tip.show)
                .on('mouseout', tip.hide);
        }
    });

}
