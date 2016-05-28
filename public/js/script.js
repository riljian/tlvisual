$(document).ready(function () {
    $("ul.nav.navbar-nav.side-nav > li:eq(0) > a").click();
});

function renderDashboard(a) {
    $(a).parent("li").siblings().removeClass("active");
    $(a).parent("li").addClass("active");
    $.ajax({
        method: "POST",
        url: "/renderDashboard",
        contentType: "application/json",
        data: JSON.stringify({
        }),
        success: function (obj) {
            if (obj.status === "FAIL") {
                window.alert(obj.content);
            } else {
                $("#page-wrapper > .container-fluid").html(obj);
            }
        }
    });
}

function renderUpload(a) {
    $(a).parent("li").siblings().removeClass("active");
    $(a).parent("li").addClass("active");
    $.ajax({
        method: "POST",
        url: "/renderUpload",
        contentType: "application/json",
        data: JSON.stringify({
        }),
        success: function (obj) {
            if (obj.status === "FAIL") {
                window.alert(obj.content);
            } else {
                $("#page-wrapper > .container-fluid").html(obj);
            }
        }
    });
}

function upload() {
    var reader = new FileReader();
    var counter = 0;

    reader.onload = function (eve) {
        $.ajax({
            method: "POST",
            url: "/upload",
            contentType: "text/plain",
            data: eve.target.result,
            success: function (obj) {
                counter += 1;
                window.console.log(obj);
                window.console.log(counter);
            }
        });
    };

    reader.readAsText($("#logs-file").get(0).files[0]);
}

function signout() {
    $.ajax({
        method: "POST",
        url: "/signout",
        contentType: "application/json",
        data: JSON.stringify({
        }),
        success: function (obj) {
            if (obj.status === "FAIL") {
                window.alert(obj.content);
            } else {
                window.location = obj.content;
            }
        }
    });
}
