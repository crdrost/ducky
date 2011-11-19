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
                if (cycle_check.indexOf(d) === -1) {
                    cycle_check.push(d);
                    for (var k in d) {
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
                        if (done === tracking.length) {
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
            var new_this = self || this, 
                args = Array.prototype.slice.call(arguments, 0);
            return promise(function (callback) {
                evaluate(args, function (err, evaluated_args) {
                    if (err) {
                        callback(err);
                    } else {
                        fn.apply(self, evaluated_args.concat(callback));
                    }
                });
            });
        };
    }
    /* This decorator makes a synchronous function promise-aware. While you
     * write `fn` with statements like `return` and `throw`, and assuming
     * normal arguments, `lazy(fn)(args...)` creates a promise to evaluate 
     * those arguments and callback(error, fn(args...)). The dynamics of `this`
     * and `self` are identical to their dynamics in `curried`.
     */
    function lazy(fn, self) {
        return curried(function () {
            var args = Array.prototype.slice.call(arguments, 0),
                callback = args.pop(),
                fn_exception = false, out;
            try {
                out = fn.apply(this, evaluated_args);
            } catch (e) {
                fn_exception = true;
                callback(e);
            }
            // I could also have put this in the try {}, saving two variable 
            // declarations, but then the try{} would catch errors thrown by
            // callback and send them back to callback. o_O.
            if (! fn_exception) {
                callback(null, out);
            }
        }, self);
    };
    
    /** precomputed functions **/

    var lib = {
        len: lazy(function (x) { return x.length; }),
        sum: lazy(function (x) {
            for (var i = 0, out = 0; i < x.length; i += 1) {
                out += x[i];
            }
            return out;
        }
    };
    
    /** exported API **/
    (function () {
        var key, promises = {
            base: {
                promise: promise,
                is_promise: is_promise,
                evaluate: evaluate
            },
            lazy: lazy,
            curried: curried,
            lib: lib
        };
        for (key in promises) {
            if (promises.hasOwnProperty(key)) {
                exports[key] = promises[key];
            }
        }
    }());
}());