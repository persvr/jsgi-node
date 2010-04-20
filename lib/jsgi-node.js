/*
JSGI 0.3 Adapter for Node

To use provide a JSGI application (can be application stack) to the start 
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
*/

var
  sys = require( "sys" ),
  url = require( "url" ),
  defer = require("./promise").defer;

function Request( request ) {
  var
    uri = url.parse( request.url ),
    headers = request.headers,
    namePort = headers.host.split( ":" ),
    lowerCaseHeaders = {};
  
  this.method = request.method;
  this.scriptName = "";
  this.pathInfo = uri.pathname;
  this.queryString = uri.query || "";
  this.serverName = namePort[ 0 ];
  this.serverPort = namePort[ 1 ] || 80;
  this.scheme = "http";
  this.env = { node: { request: request } };
  this.input = new Input( request );
  
  for(var i in headers){
    lowerCaseHeaders[i.toLowerCase()] = headers[i];
  }
  this.headers = lowerCaseHeaders;
  this.version = [ request.httpVersionMajor, request.httpVersionMinor ];
}

Request.prototype.jsgi = {
  version: [ 0, 3 ],
  multithread: false,
  multiprocess: true,
  async: true,
  runOnce: false,
  errors: {
    print: sys.puts,
    flush: function(){}
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

function Response( response ) {
  var started = false;
  return handle;

  function handle( data, notDone ) {
    var forEachResult;

    if ( typeof data.then === "function" ) {
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
      response.sendHeader( data.status, data.headers );
    }

    try {
      if ( typeof data.body.forEach !== "function" ) {
        throw new Error("The body does not have a forEach function");
      }

      forEachResult = data.body.forEach( function( chunk, encoding ) {
        response.write( chunk, encoding );
      });

      if ( !notDone && forEachResult && ( typeof forEachResult.then === "function" ) ) {
        forEachResult.then( function() {
          response.end();
        });
      }

      else if ( !notDone ) {
        response.end();
      }
    }

    catch( e ) {
      response.write( "Error: " + e.stack );
      response.end();
    }    
  }
}

function Listener( app ) {
  return function( request, response ) {
    request = new Request( request );
    var respond = new Response( response );
    
    var jsgiResponse;

    setTimeout( function() {
      // need to do this as the next event so that the request can be in a state to feed the input properly
      try {
        jsgiResponse = app( request )
      } catch( error ) {
        jsgiResponse = { status:500, headers:{}, body:[error.stack] };
      }
      
      respond( jsgiResponse );
    }, 0 );
  }
}

exports.start = function( app, options ) {
  app = new Listener( app );
  options = options || {};
  
  var port = options.port || 8080;
  
  require( "http" ).createServer( app ).listen( port );
  sys.puts( "Server running on port " + port );
};