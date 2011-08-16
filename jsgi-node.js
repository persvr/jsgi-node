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
*/

var
  sys = require( "sys" ),
  url = require( "url" ),
  defer = require("./promise").defer;

function Request( request ) {
  var url = request.url;
  var questionIndex = url.indexOf("?");
  this.method = request.method;
  this.nodeRequest = request;
  this.headers = request.headers;
  if(questionIndex > -1){
    this.pathInfo = url.substring(0, questionIndex);
    this.queryString = url.substring(questionIndex + 1);
  }
  else{
    this.pathInfo = url;
    this.queryString = "";
  }
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
  get host(){
  	var host = this.headers.host;
  	return host ? host.split(":")[0] : "";
  },
  get port(){
  	var host = this.headers.host;
  	return host ? (host.split(":")[1] || 80) : 80;
  },
  get remoteAddr(){
  	return this.nodeRequest.connection.remoteAddress;
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
        stream.removeAllListeners("close");
        canceller = function(){
          stream.removeListener("close", canceller);
          cancel && cancel();
        }
        stream.addListener("close", canceller);
      }
      cancel = data.cancel;
      data.then(
        handle,
        function( error ) {
          sys.puts("Error: " + error.stack);
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
      	try{
          response.write( chunk, data.body.encoding || "utf8" );
      	}catch(e){
      	  sys.puts( "error writing " + chunk + e);
      	}
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
      try{
      	// if it is not too late, set the status
      	response.writeHead(500, {});
      }catch(e2){}
      try{
	    response.write( "Error: " + e.stack );
	    response.end();
      }catch(e3){
      	sys.puts(e3.stack);
      }
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
start.Request = Request;
start.Listener = Listener;
start.start = start;

function start( app, options ) {
  app = new Listener( app );
  options = options || {};
  
  var port = options.port || 8080,
      http;
  
  if ( options.ssl ) {
    http = require( "https" ).createServer( options.ssl, app ).listen( port );
  } else {
    http = require( "http" ).createServer( app ).listen( port );
  }

  sys.puts( "Server running on port " + port );
  return http; 
};
module.exports = start;
