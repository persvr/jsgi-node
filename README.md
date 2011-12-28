# JSGI 0.3 Adapter for Node

JSGI-Node provides an interface for running [JSGI](http://wiki.commonjs.org/wiki/JSGI/Level0/A/Draft2) middleware on Node.
JSGI is an asynchronous middleware interface based on solid mature middleware design
principles, and the asynchronous design fits perfectly with Node. JSGI uses idiomatic JavaScript,
leveraging closures for [simple and fast](http://www.sitepen.com/blog/2010/06/11/jsgi-vs-connect-for-node-middleware/) middleware connectivity.
This project does not include any JSGI components itself, but 
a substantial set of JSGI middleware components that are available, many can be found
in [Pintura](https://github.com/persvr/pintura).

# Installation

JSGI-Node can be installed with NPM:

    npm install jsgi-node

# Usage

To use, provide a JSGI application (can be application stack) to the start 
function:

    require("jsgi-node").start(function(request){
      return {
        status:200,
        headers:{},
        body:["Hello World!"]
      };
    });

This adapter should conform to the JSGI 0.3 (with promises) for full 
asynchronous support. For example, here is an echo server that asynchronously
waits for the request and asynchonously provides it as the response:


    require("jsgi-node").start(function(request){
      return request.body.join().then(function(requestBody){
        return {
          status:200,
          headers:{},
          body:["echo: " + requestBody]
        };
      });
    });

And here is an example of using a promises from another source (from [promised-io's fs](http://github.com/persvr/promised-io)) and piping them to the
response:

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


File objects returned from [promised-io's fs](http://github.com/persvr/promised-io) can be directly provided as body for 
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

## WebSocket with JSGI

JSGI middleware can be used to handle incoming WebSocket messages. While JSGI
is designed for HTTP, WebSocket includes HTTP elements and JSGI's streaming capabilities
are well-suited for socket communication. JSGI delegation can be achieved by using
the "ws-jsgi" module in conjunction with the node-websocket-server package. 
This "ws-jsgi" module exports a function that can be called with a socket server and
a JSGI handler. For example:
<pre>
	var http = require("http").createServer(
			require("jsgi-node").Listener(jsgiApp)
		);
	http.listen(80);
	require("jsgi/ws-jsgi")(ws.createServer({
		server: http
	}), jsgiApp);
</pre>

Licensing
--------

The JSGI-Node package is an implementation of JSGI. JSGI is a standard that was 
developed in collaboration by many developers through the forums of JackJS, 
CommonJS, and Persevere. The implementation in this package is part of the Persevere 
project, and therefore is licensed under the
AFL or BSD license. The Persevere project is administered under the Dojo foundation,
and all contributions require a Dojo CLA.

Authors include Kris Zyp and Jed Schmidt. 