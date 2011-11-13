# Ducky

Ducky is an implementation of lazy evaluation built into the callbacks of 
[Node.js](http://nodejs.org/). What this means is that a Ducky server program
looks like conventional synchronous programming, even though Node.js provides
asynchronous callback-based methods. 

## Exploratory usage case

Here's the sort of code that I aspire to write:

    var server = require('ducky').open_server(1337);
    
    server.add_url("/hello.txt", function () { 
        this.serve_page("text/plain", "Hello, World!");
    });
    
    server.add_url(/^\/hello(\d+)\.html$/i, function (match) {
        this.serve_page("text/html", 
            server.template.fill(
                server.read_file("./hello.html"),
                {"text": server.subprocess(
                    "./repeat -n " + match[1] + " 'Hello, world!'"
                )}
            );
        );
    });

As you can see, the first example just gets you familiar with the sort of 
basic idioms that any web framework should make easy. It's the second one 
where you see something new: reading from files and calling processes, treated
as if they were synchronous/blocking.

## How it's meant to work

In node, things like reading files and database queries and executing a 
subprocess tend to be *asynchronous*. The above code would have to therefore 
look more or less like this:

    function handle(response) {
        read_file("./hello.html", function (t) {
            run_subprocess("echo 'Hello, world!'", function (s) {
                response.send(template.fill(t, {"text": s}));
            });
        });
    }

I don't mind this code, and even find it somewhat pretty, but it's *inside out*
-- it follows the machine's internal architecture, "first I have to read this
file, then I have to run that subprocess, okay, now I can put these results 
back together with the template.fill function, and now I can send it."

*It doesn't have to be this way*. I wouldn't want to write it this way, either.
Because I want to say, "this page comes from filling in this template with that
data." I want something which just looks like this:

    template.fill(
        read_file("./hello.html"),
        {"text": run_subprocess("echo 'Hello, world!'")}
    );

We can do this with *promises*. To understand this snippet you simply need to 
understand that `read_file` *doesn't read a file*. It returns a *promise* to 
read a file -- a promise is just a special kind of function that we can "call 
in" sometime later. Similarly, `run_subprocess` here *doesn't run the 
subprocess*, it just leaves a promise to run the subprocess.

This is called **lazy evaluation**. How lazy does it get? Well, you can choose:
if you want, `template.fill` could return a promise to fill in the template. 
Otherwise, it will have to actually call in the promises made, and fill in the
template: in which case it must have been written with a callback in mind. This
would make the above code say: 

    function handle(response) {
        template.fill(
            read_file("./hello.html"),
            {"text": run_subprocess("echo 'Hello, world!'")},
            function (result) {
                response.send(result);
            }
        );
    }

The lesson is that there has to be a final callback *somewhere*. But look at 
how generic this final callback is. Why don't we write that into our web 
server...?

Ergo, Ducky.

>   Littlefoot: (*sniffing the air*) "Can you smell something?"  
>   Petrie: "I-I-I-I smell... I smell... I SMELL... hmm. Ducky."  
>   Ducky: "You smell me?!" (*giggles*)  
>   -- *The Land Before Time*  

# License

This project was authored by Chris Drost of drostie.org. To the extent 
possible by all laws in all countries, I hereby waive all copyright and any 
related rights under the Creative Commons Zero (CC0) waiver/license, which 
you may read online at:

    http://creativecommons.org/publicdomain/zero/1.0/legalcode

This means that you may copy, distribute, modify, and use my code without 
any fear of lawsuits from me. It also means that my code is provided with NO
WARRANTIES of any kind, so that I may have no fear of lawsuits from you. 
