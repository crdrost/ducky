var http = require('http'), fs = require('fs');




var Server, new_name;

new_name = (function () {
    "use strict";
    return function () {
        return base64(Math.floor(two52 * Math.random()), 8) + 
            base64(Math.floor(two52 * Math.random()), 8);
    };
}());

Server= (function () {
    "use strict"; 
    var alphabet = "abcdefghijklmnopqrstuvwxyz0123456789-_.~";
    function Handler(req, res, regex, fn) {
        this.request = req;
        this.response = res;
        this.regex = regex;
    }
    Handler.prototype = {
        serve_page: function x_serve_page(mime, promise) {
            // If 'promise' is not a function, wrap it in one. 
            if (typeof promise !== "function") {
                promise = constant_promise(promise);
            }
            var handler = this;
            // call in the promise.
            promise(function (error, string) {
                if (error) {
                    handler.throw500(string);
                } else {
                    handler.response.writeHead(200, {"Content-Type": mime});
                    handler.response.end(string);
                }
            });
        }
    };
    function Server() {
        this.time = new Date().getTime();
        this.name = 'ducky/' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function () {
            return alphabet[Math.floor(alphabet.length * Math.random())];
        }).join("");
    }
    Server.prototype = {
        template: {
        },
        _log_fn: function (text) {
            console.log(text);
        },
        log: function (text) {
            this._log_fn(
                '[' + this.name + " " + 
                (new Date().getTime() - this.time)/1000 + '] ' + text
            );
        },
        log_request: function (req) {
            this.log("request received!");
        },
        read_file: fn_promise(fs, fs.readFile),
        write_file: fn_promise(fs, fs.writeFile),
        domains: {"": []},
        add_url: function (domain, rule, action) {
            if (typeof action === "undefined") { // optional domain
                action = rule;
                rule = domain;
                domain = "";
            }
            if (typeof this.domains[domain] === "undefined") {
                this.domains[domain] = [];
            }
            this.domains[domain].push([rule, action]);
        }
    };
    return Server;
}());

export.open_server = function ducky_open_server(port, address) {
    address = address || "127.0.0.1";
    var duck = new Server();
    http.createServer(function (req, res) {
        duck.log_request(req);
        duck.handle(req, res);
    }).listen(port, "127.0.0.1");
    duck.log("First quack at " + new Date().toISOString());
    return duck;
};
