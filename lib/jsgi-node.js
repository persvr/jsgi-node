/*
JSGI 0.3 Adapter for Node

To use provide a JSGI application (can be application stack) to the start 
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

    var fs = require("commonjs-utils/fs-promise");
    require("jsgi-node").start(function(request){
      return fs.readFile("jsgi-node.js").then(function(body){
        return {
          status: 200,
          headers: {},
          body: [body]
        };
      });
    });
*/

var
  sys = require( "sys" ),
  url = require( "url" ),
  defer = require("./promise").defer;

function Request( request ) {
  var url = request.url.split("?");
  this.method = request.method;
  this.nodeRequest = request;
  this.pathInfo = url[0];
  this.queryString = url[1] || "";
  if(this.method != "GET"){ // optimize GET
  	this.body = new Input( request );
  }
  
}

Request.prototype = {
  jsgi:{
    version: [ 0, 3 ],
    multithread: false,
    multiprocess: true,
    async: true,
    runOnce: false,
    errors: {
      print: sys.puts,
      flush: function(){}
    }
  },
  env:{},
  scriptName: "",
  scheme:"http",
  get serverName(){
  	var host = this.nodeRequest.headers.host;
  	return host ? host.split(":")[0] : "";
  },
  get serverPort(){
  	var host = this.nodeRequest.headers.host;
  	return host ? (host.split(":")[1] || 80) : 80;
  },
  get remoteAddr(){
  	return this.nodeRequest.connection.remoteAddress;
  },
  get headers(){
  	if(this._headers){
  		return this._headers;
  	}
  	var headers = this.nodeRequest.headers;
  	var lowerCaseHeaders = {};
  	for(var i in headers){
      lowerCaseHeaders[i.toLowerCase()] = headers[i];
  	}
  	return this._headers = lowerCaseHeaders;
  },
  set headers(value){
  	this._headers = value;
  },
  get version(){
  	return [ this.nodeRequest.httpVersionMajor, this.nodeRequest.httpVersionMinor ]
  }
};


function Input( request ) {
  var 
    inputBuffer = [],
    waitingForLength = Infinity;
  function callback(data){
    inputBuffer.push(data);	
  }
  var deferred = defer();
  request
      .addListener( "data", function( data ) {
         callback(data);
      })
      .addListener( "end", function() {
        deferred.resolve();
      });
	
  this.forEach = function (each) {
    if (this.encoding) {
      request.setBodyEncoding( this.encoding );
    }
    inputBuffer.forEach(each);
    callback = each;
    return deferred.promise;
  };
}

Input.prototype.join = function(token){
  var parts = [];
  return this.forEach(function(part){
    parts.push(part);
  }).then(function(){
    return parts.join(token || ""); // yeah, I know Array.prototype.join defaults to ",", but clearly "" is more useful here
  });
}

function Response( response, stream ) {
  var started = false, canceller, cancel;
  return handle;

  function handle( data, notDone ) {
    var forEachResult;
    if ( typeof data.then === "function" ) {
      if(!canceller){
        canceller = function(){
          cancel && cancel();
        }
        stream.addListener("close", canceller);
      }
      cancel = data.cancel;
      data.then(
        handle,
        function( error ) {
          handle({ status:500, headers:{}, body:[error.message] });
        },
        function( data ){
          handle( data, true);
        }
      );

      return;
    }

    if ( !started ) {
      started = true;
      response.writeHead( data.status, data.headers );
    }

    try {
      if ( typeof data.body === "string" ) {
        response.write(data.body);
      }
      else if ( typeof data.body.forEach !== "function" ) {
        throw new Error("The body does not have a forEach function");
      }

      forEachResult = data.body.forEach( function( chunk ) {
        response.write( chunk, data.body.encoding || "utf8" );
      });

      if ( !notDone && forEachResult && ( typeof forEachResult.then === "function" ) ) {
        cancel = forEachResult.cancel;
        forEachResult.then( function() {
          if(canceller){
            stream.addListener("close", canceller);
          }
          response.end();
        });
      }

      else if ( !notDone ) {
        if(canceller){
          stream.addListener("close", canceller);
        }
        response.end();
      }
    }

    catch( e ) {
      if(canceller){
        stream.addListener("close", canceller);
      }
      response.write( "Error: " + e.stack );
      response.end();
    }    
  }
}

function Listener( app ) {
  return function( request, response ) {
  	var connection = request.connection;
    request = new Request( request );
    var respond = new Response( response, connection );
    process.nextTick(function(){
      var jsgiResponse;
      try {
        jsgiResponse = app( request )
      } catch( error ) {
        jsgiResponse = { status:500, headers:{}, body:[error.stack] };
      }      
      respond( jsgiResponse );
    });
  }
}

exports.Listener = Listener;

exports.start = function( app, options ) {
  app = new Listener( app );
  options = options || {};
  
  var port = options.port || 8080;
  
  require( "http" ).createServer( app ).listen( port );
  sys.puts( "Server running on port " + port );
};