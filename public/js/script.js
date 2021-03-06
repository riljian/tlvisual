var nav_actived;

$(document).ready(function () {
    $("ul.nav.navbar-nav.side-nav > li:eq(0) > a").click();
});

function renderDashboard(a) {
    nav_actived = a;
    $(a).parent("li").siblings().removeClass("active");
    $(a).parent("li").addClass("active");
    $("#navbar-collapse-primary").collapse("hide");
    $.ajax({
        method: "POST",
        url: "/renderDashboard",
        contentType: "application/json",
        data: JSON.stringify({
        }),
        success: function (obj) {
            if (nav_actived !== a) {
                return;
            }
            if (obj.status === "FAIL") {
                window.alert(obj.content);
            } else {
                $("#page-wrapper > .container-fluid").html(obj);
            }
        }
    });
}

function renderUpload(a) {
    nav_actived = a;
    $(a).parent("li").siblings().removeClass("active");
    $(a).parent("li").addClass("active");
    $("#navbar-collapse-primary").collapse("hide");
    $.ajax({
        method: "POST",
        url: "/renderUpload",
        contentType: "application/json",
        data: JSON.stringify({
        }),
        success: function (obj) {
            if (nav_actived !== a) {
                return;
            }
            if (obj.status === "FAIL") {
                window.alert(obj.content);
            } else {
                $("#page-wrapper > .container-fluid").html(obj);
            }
        }
    });
}

function renderChart(a) {
    nav_actived = a;
    $(a).parent("li").siblings().removeClass("active");
    $(a).parent("li").addClass("active");
    $("#navbar-collapse-primary").collapse("hide");
    $.ajax({
        method: "POST",
        url: "/renderChart",
        contentType: "application/json",
        data: JSON.stringify({
        }),
        success: function (obj) {
            if (nav_actived !== a) {
                return;
            }
            if (obj.status === "FAIL") {
                window.alert(obj.content);
            } else {
                $("#page-wrapper > .container-fluid").html(obj);
                $("form").submit(function (eve) {
                    eve.preventDefault();
                });
            }
        }
    });
}

function upload() {
    var reader = new FileReader();

    $("#upload-btn").html(
        '<i class="fa fa-spinner fa-spin fa-2x fa-fw"></i>'
    ).prop("disabled", true);

    reader.onload = function (eve) {
        $.ajax({
            method: "POST",
            url: "/upload",
            contentType: "text/plain",
            data: eve.target.result,
            success: function (obj) {
                $("#upload-btn").html("Complete")
                    .switchClass("btn-default", "btn-success", function () {
                        $("#upload-btn").html("Upload").prop("disabled", false)
                            .switchClass("btn-success", "btn-default", 1000);
                    });
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
