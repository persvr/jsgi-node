var sys = require("sys"),
	http = require("http");

exports.run = function(app, options){
	http.createServer(function (request, response) {
		var uri = request.uri;
		request.queryString = uri.queryString;
		request.pathInfo = uri.path;
		request.jsgi={version: [0,3],
            multithread: false,
            multiprocess: true,
            async: true,
            runOnce: false};
        var jsgiResponse, output, responseStarted = false;
        try{
        	jsgiResponse = app(request);
        }
		catch(e){
			handleResponse({status:500, headers:{}, body:[error.message]});
			response.finish();
			return;
		}
		
		if(typeof jsgiResponse.then === "function"){
			jsgiResponse.then(function(jsgiResponse){
				handleResponse(jsgiResponse);
				response.finish();
			},
			function(error){
				handleResponse({status:500, headers:{}, body:[error.message]});
				response.finish();
			},
			handleResponse);
		}
		else{
			handleResponse(jsgiResponse);
			response.finish();
		} 
        function handleResponse(jsgiResponse){
	        if(!responseStarted){
	            responseStarted = true;
	            // set the status
	            response.setHeader(jsgiResponse.status, jsgiResponse.headers);
	        }
	        try{
	            // output the body, flushing after each write if it's chunked
	            jsgiResponse.body.forEach(function(chunk) {
	                response.body(chunk);
	            });
	        }
	        catch(e){
	            response.write(e);
	        }
        
        }
	}).listen(options.port || 8080);
	sys.puts("Server running on port " + (options.port || 8080));
};