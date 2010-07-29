JSGI 0.3 Adapter for Node

To use, provide a JSGI application (can be application stack) to the start 
function:

    require("jsgi-node").start(function(request){
      return request.body.join().then(function(requestBody){
        return {
          status:200,
          headers:{},
          body:["echo: " + requestBody]
        };
      });
    });

This adapter should conform to the JSGI 0.3 (with promises) for full 
asynchronous support. For example:

    var fs = require("promised-io/fs");
    require("jsgi-node").start(function(request){
      return fs.readFile("jsgi-node.js").then(function(body){
        return {
          status: 200,
          headers: {},
          body: [body]
        };
      });
    });


File objects returned from promised-io's fs can be directly provided as body for 
automated streaming of data to the client from the filesystem:

    var fs = require("promised-io/fs");
    require("jsgi-node").start(function(request){
      return {
        status: 200,
        headers: {},
        body: fs.open("some-file.txt","r")
      };
    });

This package also includes an adapter for running Node HTTP apps on top of JSGI middleware:

    var fs = require("promised-io/fs"),
        Node = require("jsgi/node").Node;
    require("jsgi-node").start(
      SomeJSGIMiddleWare(
        OtherJSGIMiddleWare(
          Node(function(request, response){
           // request and response conform to Node's HTTP API
          })
        )
      )
    );

 