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

var sys = require( "sys" );

function Request( request ) {
  var uri = request.uri;
  
  this.method = request.method;
  this.scriptName = '';
  this.pathInfo = uri.path;
  this.queryString = uri.queryString;
  this.env = { node: { request: request } };
  this.input = new Input( request );
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
    inputLength = 0,
    inputPromise,
    waitingForLength = Infinity,
    requestCompletePromise = new process.Promise();

  request
    .addListener( "body", function( data ) {
      inputBuffer.push( data );
      inputLength += data.length;
      if ( inputLength >= waitingForLength ) {
        inputPromise.emitSuccess();
      }
    })
    .addListener( "complete", function() {
      requestCompletePromise.emitSuccess();
    });

  this.read = function( length ) {
    if ( !length ) {
      if ( !requestCompletePromise.hasFired ) {
        requestCompletePromise.wait();
      }
    }

    else if ( length > inputLength ) {
      waitingForLength = length;
      inputPromise = new process.Promise();
      inputPromise.wait();
      waitingForLength = Infinity;
    }

    var chunk = inputBuffer.join("");
    var keepInBuffer = length ? chunk.substring( length ) : "";

    inputBuffer = [ keepInBuffer ];
    inputLength = keepInBuffer.length;

    return length ? chunk.substring( 0, length ) : chunk;
  };
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

      forEachResult = data.body.forEach( function( chunk ) {
        response.sendBody( chunk );
      });

      if ( !notDone && forEachResult && ( forEachResult.then === "function" ) ) {
        forEachResult.then( function(){
          response.finish();
        });
      }

      else if ( !notDone ) {
        response.finish();
      }
    }

    catch( e ) {
      response.sendBody( "Error: " + e );
      response.finish();
    }    
  }
}

function Listener( app ) {
  return function( request, response ) {
    request = new Request( request );
    respond = new Response( response );
    
    var jsgiResponse;

    setTimeout( function() {
      try {
        jsgiResponse = app( request )
      } catch( error ) {
        jsgiResponse = { status:500, headers:{}, body:[error.message] };
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

// Patch the Promise constructor if it is not correct, this is a very minimal 
// fix for promises in Node
if ( typeof process.Promise.prototype.then !== "function" ) {
  process.Promise.prototype.then = function( ok, error ) {
    this.addCallback( ok );
    this.addErrback( error );
    return this;
  };
}