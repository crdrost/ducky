var http = require('http');

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
        callback(c);
    });
}

function dict_promise(dict) {
    "use strict";
    return new_promise(function (callback) {
        var dict_promise_error, k;
        // this is a function constructor used to save the value of 'key' in
        // a closure when we send off the asynchronous calls.
        function replacer(key) {
            return function (data, err) {
                // combine error flags, replace the promise with data
                dict_promise_error = dict_promise_error || err;
                dict[key] = data;
                // then, if there are no more promises, callback.
                for (key in dict) {
                    if (dict[key].is_promise) {
                        return;
                    }
                }
                callback(dict, dict_promise_error);
            };
        }
        // establish recursion:
        for (k in dict) {
            if (dict.hasOwnProperty(k) && typeof dict[k] === "object") {
                dict[k] = dict_promise(dict[k]);
            }
        }
        // then we call in all of the promises.
        for (k in dict) {
            if (dict[k].is_promise) {
                dict[k](replacer(k));
            }
        }
    });
}

//base64-encodes a number; used to make the Duck name work.
function base64(n) {
    "use strict";
    var alphabet = 
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.:";
    return (n === 0) ? '' : base64(Math.floor(n / 64)) + alphabet[n % 64];
}

function Duck() {
    this.time = new Date().getTime();
    this.name = 'ducky/' + make_id();
}

Duck.prototype = {
    template: {
    },
    _log_fn: function (text) {
        console.log(text);
    },
    log: function (text) {
        this._log_fn(
            '[' + this.name + " " + (new Date().getTime() - this.time)/1000 + '] ' + text);
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

export.open_server = function ducky_open_server(port) {
    var duck = new Duck();
    http.createServer(function (req, res) {
        duck.log_request(req);
        duck.handle(req, res);
    }).listen(port, "127.0.0.1");
    duck.log("First quack at " + new Date().toISOString());
    return duck;
};
