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
