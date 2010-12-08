# JSGI 0.3 Adapter for Node

JSGI-Node provides an interface for running middleware [JSGI](http://wiki.commonjs.org/wiki/JSGI/Level0/A/Draft2) on Node.
JSGI is an asynchronous middleware interface based on solid mature middleware design
principles, and the asynchronous design fits perfectly with Node. JSGI uses idiomatic JavaScript,
leveraging closures for [simple and fast](http://www.sitepen.com/blog/2010/06/11/jsgi-vs-connect-for-node-middleware/) middleware connectivity.
There is substantial set of middleware components that can be found on the 
[Node modules page](https://github.com/ry/node/wiki/modules#middleware).

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


File objects returned from [promised-io's fs](http://github.com/kriszyp/promised-io) can be directly provided as body for 
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
	require("jsgi-node/ws-jsgi")(ws.createServer({
		server: http
	}), jsgiApp);
</pre>

JSGI-Node is licensed under the AFL or BSD license.

Authors include Kris Zyp and Jed Schmidt. 