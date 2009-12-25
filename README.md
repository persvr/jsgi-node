JSGI 0.3 Adapter for Node

To use, provide a JSGI application (can be application stack) to the start 
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
