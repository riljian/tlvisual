/*global $:false*/

$(document).ready(function () {
    "use strict";
    $("#sign-form > .input-group > input").focusin(function () {
        $(this).parent(".input-group").addClass("focused");
    });
    $("#sign-form > .input-group > input").focusout(function () {
        $(this).parent(".input-group").removeClass("focused");
    });
    $("#sign-form").submit(function (eve) {
        eve.preventDefault();
    });
    $("#sign-form .btn-primary").click(function () { // sign up
        var username = $("#username").val(),
            password = $("#password").val();
        if (username === "" || password === "") {
            window.alert("Please do not leave any attr. in blank");
            return;
        }
        $.ajax({
            method: "POST",
            url: "/signup",
            contentType: "application/json",
            data: JSON.stringify({
                username: username,
                password: password
            }),
            success: function (obj) {
                if (obj.status === "FAIL") {
                    window.alert(obj.content);
                } else {
                    window.location = obj.content;
                }
            }
        });
    });
    $("#sign-form .btn-success").click(function () { // sign in
        var username = $("#username").val(),
            password = $("#password").val();
        if (username === "" || password === "") {
            window.alert("Please do not leave any attr. in blank");
            return;
        }
        $.ajax({
            method: "POST",
            url: "/signin",
            contentType: "application/json",
            data: JSON.stringify({
                username: username,
                password: password
            }),
            success: function (obj) {
                if (obj.status === "FAIL") {
                    window.alert(obj.content);
                } else {
                    window.location = obj.content;
                }
            }
        });
    });
});
