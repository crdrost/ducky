var http = require('http'),
    fs = require('fs');
// a promise is a special kind of function. When you call it in, you call it 
// with a function callback(data, error), and it does whatever it's supposed 
// to do and then might report the error.

function new_promise(fn) {
    "use strict";
    fn.is_promise = true;
    return fn;
}

function constant_promise(c) {
    "use strict";
    return new_promise(function (callback) {
        callback(null, c);
    });
}

// I would have liked to do this without manufacturing special 'dict promises', // but recursion gets much more complicated if subdicts are not treated as 
// promises in their own right. 
function dict_promise(dict) {
    "use strict";
    return new_promise(function (callback) {
        var error = null, key;
        function replacer(k) { // callback maker; saves 'key' in a closure.
            return function (err, data) {
                error = error || err;
                dict[k] = data;
                for (k in dict) {
                    if (dict[k].is_promise) {
                        return;
                    }
                }
                callback(error, dict);
            };
        }
        for (key in dict) { // establishes recursion
            if (dict.hasOwnProperty(key) && typeof dict[key] === "object") {
                dict[key] = dict_promise(dict[key]);
            }
        }
        for (key in dict) { // calls in all the subpromises
            if (dict[key].is_promise) {
                dict[key](replacer(key));
            }
        }
    });
}

// This wraps a normal Node callback-based function with promises; the usage 
// pattern is a little odd. Instead of module.node_fn(args... , callback) 
// we say:
//
//  wa   var node_fn_promise = fn_promise(module, module.node_fn),
//         promise = node_fn_promise(args...);
//     promise(callback);
//
// ...which looks a bit weird as fn_promise(node_fn)(args...)(callback), but
// you can see that this is what's needed.

function fn_promise(module, fn) {
    return function () {
        var args = arguments;
        return new_promise(function (callback) {
            // append the callback
            args[args.length] = callback;
            args.length += 1;
            fn.apply(module, args);
        });
    };
}

// base64-encodes a number; it's used to give different names to different 
// servers based on the millisecond of their inception.
function base64(n) {
    "use strict";
    var alphabet = 
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.:";
    return (n === 0) ? '' : base64(Math.floor(n / 64)) + alphabet[n % 64];
}

function Server() {
    this.time = new Date().getTime();
    this.name = 'ducky/' + base64(this.time);
}

Server.prototype = {
    template: {
    },
    _log_fn: function (text) {
        console.log(text);
    },
    log: function (text) {
        this._log_fn(
            '[' + this.name + " " + (new Date().getTime() - this.time)/1000 + '] ' + text);
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
