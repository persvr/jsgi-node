/*
JSGI 0.3 Adapter for Node

To use provide a JSGI application (can be application stack) to the start 
function:

require("jsgi-node").start(function(request){
    var requestBody = request.input.read();
    return {
        status:200,
        headers:{},
        body:["echo: " + requestBody]
    };
});

This adapter should conform to the JSGI 0.3 (with promises) for full 
asynchronous support. For example:

var posix = require("posix");
require("jsgi-node").start(function(request){
   var promise = new process.Promise();
   posix.cat("jsgi-node.js").addCallback(function(body){
       promise.emitSuccess({
	       status: 200,
		   headers: {},
		   body: [body]
	   });
   });
   return promise;
});
*/

var sys = require("sys"),
    http = require("http");

exports.start = function(app, options){
    options = options || {};
    var jsgi = {
                version: [0,3],
                multithread: false,
                multiprocess: true,
                async: true,
                runOnce: false,
                errors: {
                    print: sys.puts,
                    flush: function(){}
                }
        };
    http.createServer(function (request, response) {
        var uri = request.uri;
        request.queryString = uri.queryString;
        request.pathInfo = uri.path;
        request.jsgi = jsgi;
        request.node = {
            request: request,
            response: response
        };
        var inputBuffer = [],
            inputLength = 0,
            inputPromise,
            waitingForLength = Infinity,
            requestCompletePromise = new process.Promise();
        request.addListener("body", function(data){
            inputBuffer.push(data);
            inputLength += data.length;
            if (inputLength >= waitingForLength) {
                inputPromise.emitSuccess();
            }
        })
        .addListener("complete", function(){
            requestCompletePromise.emitSuccess()
        });

        request.input = {
            read: function(length){
                if(!length){
                    if(!requestCompletePromise.hasFired){
                        requestCompletePromise.wait();
                    }
                }
                else if(length > inputLength) {
                    waitingForLength = length;
                    inputPromise = new process.Promise();
                    inputPromise.wait();
                    waitingForLength = Infinity;
                }
                var chunk = inputBuffer.join("");
                var keepInBuffer = length ? chunk.substring(length) : "";
                inputBuffer = [keepInBuffer];
                inputLength = keepInBuffer.length;
                return length ? chunk.substring(0,length) : chunk;
            }
        };
        var jsgiResponse, output, responseStarted = false;
        setTimeout(function(){
            try{
                jsgiResponse = app(request);
            }
            catch(error){
                handleResponse({status:500, headers:{}, body:[error.message]});
                return;
            }

            if(typeof jsgiResponse.then === "function"){
                jsgiResponse.then(handleResponse,
                function(error){
                handleResponse({status:500, headers:{}, body:[error.message]});
                },
                function(jsgiResponse){
                handleResponse(jsgiResponse, true);
                });
            }
            else{
                handleResponse(jsgiResponse);

            }
        },0);
        function handleResponse(jsgiResponse, notDone){
            if(!responseStarted){
                responseStarted = true;
                // set the status
                response.sendHeader(jsgiResponse.status, jsgiResponse.headers);
            }
            try{
                if(typeof jsgiResponse.body.forEach !== "function"){
                    throw new Error("The body does not have a forEach function");
                }
                // output the body, flushing after each write if it's chunked
                var forEachResult = jsgiResponse.body.forEach(function(chunk) {
                    response.sendBody(chunk);
                });
                if(!notDone && forEachResult && (forEachResult.then === "function")){
                    forEachResult.then(function(){
                        response.finish();
                    });
                }
                else if(!notDone){
                    response.finish();
                }
            }
            catch(e){
                response.sendBody("Error: " + e);
                response.finish();
            }
        
        }
    }).listen(options.port || 8080);
    sys.puts("Server running on port " + (options.port || 8080));
};

// Patch the Promise constructor if it is not correct, this is a very minimal 
// fix for promises in Node
if(typeof process.Promise.prototype.then !== "function"){
   process.Promise.prototype.then = function(ok, error){
       this.addCallback(ok);
       this.addErrback(error);
       return this;
   };
}