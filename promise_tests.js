/*global require, console, setTimeout */

var promises = require("./promises.js");

/* This file is meant to test the promises framework with a couple of simple
 * queries and an idea of what an application might look like.
 *
 * First we start with some convenience functions:
 */

function random_name(len) {
    var i, s = "", alphabet = "abcdefghijklmnopqrstuvwxyz0123456789-_.~";
    for (i = 0; i < len; i += 1) {
        s += alphabet[Math.floor(alphabet.length * Math.random())];
    }
    return s;
}
function async(name, value) {
    var self = name + "[" + random_name(5) + "]",
        delay = 100 + Math.floor(Math.random() * 200);
    return promises.promise(function (callback) {
        console.log("begin " + self);
        setTimeout(function () {
            console.log("end " + self);
            callback(null, value);
        }, delay);
    });
}
function read_file() {
    return async("read_file", 
        "<html>\n  <head>\n    <title>boo.</title>\n  </head>\n  <body>" +
        "\n%%\n  </body>\n</html>"
    );
}
function db_logged_in() {
    return async("db_logged_in", Math.random() > 0.5);
}
function db_names() {
    return async("db_names", ["Alice", "Bob", "Carol", "Dylan", "Eve", "Fracois"]);
}
var template_fill = promises.lazy(function (template, data) {
    return template.replace("%%", data);
});

// and now here is the logic:

var out_body;
function trial_run() {
    setTimeout(function () {
        console.log();
        var time = new Date().getTime();
        promises.evaluate(template_fill(
            read_file(), 
            db_logged_in().not().then(
                "    <p>Error: You are not logged in!</p>",
                promises.add(
                    "    <p>Logged in. Currently online:</p>\n    <ol>\n",
                    db_names().call("map", function (x, y) {
                        return promises.add(
                            "      <li>" + x + ": ", 
                            db_logged_in(), 
                            "</li>"
                        )
                    }).call("join", "\n"),
                    "\n    </ol>"
                )
            )
        ), function (err, data) {
            if (err) {
                throw err; 
            } else {
                console.log("--- done in " + 
                    (new Date().getTime() - time)/1000 + 
                    " s ---");
                console.log(data);
            }
        });
    }, 0);
};
trial_run();
