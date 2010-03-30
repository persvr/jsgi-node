JSGI 0.3 Adapter for Node

To use, provide a JSGI application (can be application stack) to the start 
function:

    require("jsgi-node").start(function(request){
      return request.input.join().then(function(requestBody){
        return {
          status:200,
          headers:{},
          body:["echo: " + requestBody]
        };
      });
    });

This adapter should conform to the JSGI 0.3 (with promises) for full 
asynchronous support. For example:

    var fs = require("fs-promise");
    require("jsgi-node").start(function(request){
      return fs.readFile("jsgi-node.js").then(function(body){
        return {
          status: 200,
          headers: {},
          body: [body]
        };
      });
    });


Hopefully, the Node API will eventually be standardized through CommonJS as the HTTP Event Interface, at which point it would make sense to rename this to hei-jsgi or something like that, to use a standard adapter for any server that implements the API.