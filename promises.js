/* promises.js
 *
 * This file was authored by Chris Drost of drostie.org in the year 2011. To
 * the extent possible by all laws in all countries, I hereby waive all
 * copyright and any related rights under the Creative Commons Zero (CC0)
 * waiver/license, which you may read online at:
 *
 *     http://creativecommons.org/publicdomain/zero/1.0/legalcode
 *
 * This means that you may copy, distribute, modify, and use my code without
 * any fear of lawsuits from me. It also means that my code is provided with NO
 * WARRANTIES of any kind, so that I may have no fear of lawsuits from you.
 */

/* A `promise` is an object which embodies a promise to later asynchronously
 * compute something. This enables a sort of lazy evaluation designed to work
 * nicely with Node.js.
 */

/*global exports */

// scope declaration to consolidate "use strict" pragmas.
(function () {
    "use strict";
    /** current underlying implementation: not exposed, as it may change. **/
    function Promise(fn) {
        this.call_in = fn;
    }
        
    /** low-level API **/

    // finishing decoration for functions which can already be called promises.
    function promise(fn) {
        return new Promise(fn);
    }

    // test if something actually is a promise.
    function is_promise(obj) {
        return obj instanceof Promise;
    }

    // This element of the low-level API will asynchronously evaluate `obj`,
    // which may or may not be a promise. Promises get called in, objects get
    // searched for promises, and anything else gets called back directly.
    // Either way, this is the proper way to handle something which might be,
    // or might contain, a promise.
    function evaluate(obj, callback) {
        if (is_promise(obj)) {
            obj.call_in(callback);
        } else if (typeof obj === "object") {
            var done = 0,      // the number of promises which have called back
                error = null,  // accumulated error message.
                promises = []; // [parent, key] locations of promises

            // Walk the object as a tree to discover any promises within.
            (function descend(d, cycle_check) {
                var k;
                if (cycle_check.indexOf(d) === -1) {
                    cycle_check.push(d);
                    for (k in d) {
                        if (d.hasOwnProperty(k)) {
                            if (is_promise(d[k])) {
                                promises.push([d, k]);
                            } else if (typeof d[k] === "object") {
                                descend(d[k], cycle_check);
                            }
                        }
                    }
                    cycle_check.pop();
                }
            }(obj, []));

            // Call in the promises we've collected.
            if (promises.length === 0) {
                callback(null, obj);
            } else {
                promises.map(function (x) {
                    var parent = x[0], key = x[1];
                    parent[key].call_in(function (err, data) {
                        error = error || err;
                        parent[key] = data;
                        done += 1;
                        if (done === promises.length) {
                            callback(error, obj);
                        }
                    });
                });
            }
        } else { // not a promise, not an object
            callback(null, obj);
        }
    }


    /** higher-level API **/


    /* This decorator makes an asynchronous function promise-aware: so that
     * `fn(params..., callback)` becomes `curried(fn)(params...)(callback)`.
     * There is only one essential difference: in the second case, if `params`
     * contains promises, they will be evaluated. This decorator preserves
     * `this` if `self` remains `undefined`. To be precise: if you say
     * `lib = {f: curried(fn, self)};` and then `lib.f(params...)(callback)`,
     * the `this` inside of `fn` is `self || lib`.
     */
    function curried(fn, self) {
        return function () {
            var params = {
                self: self || this,
                args: Array.prototype.slice.call(arguments, 0)
            };
            return promise(function (callback) {
                evaluate(params, function (err, p) {
                    if (err) {
                        callback(err);
                    } else {
                        fn.apply(p.self, p.args.concat(callback));
                    }
                });
            });
        };
    }
    /* This decorator makes a synchronous function promise-aware. While you
     * write `fn` with statements like `return` and `throw`, and assuming
     * normal arguments, `lazy(fn)(args...)` creates a promise to evaluate
     * those arguments and callback(error, fn(args...)). The dynamics of `this`
     * and `self` are identical to their dynamics in `curried`. Lazy does one
     * thing which curried doesn't: if you return a promise from the function,
     * it evaluates that too. 
     */
    function lazy(fn, self) {
        return curried(function () {
            var args = Array.prototype.slice.call(arguments, 0),
                callback = args.pop(),
                fn_exception = false,
                out;
            try {
                out = fn.apply(this, args);
            } catch (e) {
                fn_exception = true;
                callback(e);
            }
            // I could also have put this in the try {}, saving two variable
            // declarations, but then the try{} would catch errors thrown by
            // callback and send them back to callback. o_O.
            if (!fn_exception) {
                evaluate(out, callback);
            }
        }, self);
    }
    // Operators allowed on Promises.
    Promise.prototype = {
        toString: function () {
            throw new Error("Javascript operators are not lazy, use promise operators instead.");
        },
        get: lazy(function (property) {
            return this[property];
        }),
        set: lazy(function (property, value) {
            this[property] = value;
            return this;
        }),
        eq:  lazy(function (that) {
            return this === that;
        }),
        not_eq: lazy(function (opcode, that) {
            return this !== that;
        }),
        then: function (then, or_else) {
            var self = this;
            return promise(function (callback) {
                evaluate(self, function (err, data) {
                    if (err) {
                        callback(err);
                    } else {
                        if (data) {
                            evaluate(then, callback);
                        } else {
                            evaluate(or_else, callback);
                        }
                    }
                });
            });
        },
        and: function () {
            var self = this, args = arguments;
            return promise(function (callback) {
                function check_index(i) {
                    // returns a callback which will check index i.
                    return (i > args.length) ? callback : function (e, d) {
                        if (e) {
                            callback(e);
                        } else if (d) {
                            evaluate(args[i], function (err, data) {
                                check_index(i + 1)(err, d && data);
                            });
                        } else {
                            callback(null, d);
                        }
                    };
                }
                evaluate(self, check_index(0));
            });
        },
        or: function () {
            var self = this, args = arguments;
            return promise(function (callback) {
                function check_index(i) {
                    // returns a callback which will check index i.
                    return (i > args.length) ? callback : function (e, d) {
                        if (e) {
                            callback(e);
                        } else if (!d) {
                            evaluate(args[i], function (err, data) {
                                check_index(i + 1)(err, d || data);
                            });
                        } else {
                            callback(null, d);
                        }
                    };
                }
                evaluate(self, check_index(0));
            });
        },
        plus: lazy(function () {
            var sum = this, i;
            for (i = 0; i < arguments.length; i += 1) {
                sum += arguments[i];
            }
            return sum;
        }),
        minus: lazy(function () {
            var sum = this, i;
            for (i = 0; i < arguments.length; i += 1) {
                sum -= arguments[i];
            }
            return sum;
        }),
        times: lazy(function () {
            var prod = this, i;
            for (i = 0; i < arguments.length; i += 1) {
                prod *= arguments[i];
            }
            return prod;
        }),
        over: lazy(function () {
            var prod = this, i;
            for (i = 0; i < arguments.length; i += 1) {
                prod /= arguments[i];
            }
            return prod;
        }),
        call: lazy(function (fn) {
            var params = Array.prototype.slice.call(arguments, 1);
            if (typeof fn === "string") {
                return this[fn].apply(this, params);
            } else {
                return fn.apply(this, params);
            }
        }),
        not: lazy(function () {
            return ! this;
        }),
        gt: lazy(function (that) {
            return this > that;
        }),
        lt: lazy(function (that) {
            return this < that;
        }),
        ge: lazy(function (that) {
            return this >= that;
        }),
        le: lazy(function (that) {
            return this <= that;
        })
    };
    
    /** exported API **/
    exports.promise = promise;
    exports.is_promise = is_promise;
    exports.evaluate = evaluate;
    exports.lazy = lazy;
    exports.curried = curried;
    exports.add = lazy(function () {
        var s = arguments[0], i;
        for (i = 1; i < arguments.length; i += 1) {
            s += arguments[i];
        }
        return s;
    });
}());