var when = require("../promise").when,
	defer = require("../promise").defer;
// takes a Node HTTP app and runs it on top of a JSGI stack  
exports.Node = function(nodeApp){
	return function(request){
		var endListeners = [];
		var bodyDeferred;
		var responseDeferred = defer();
		nodeApp({
			headers: request.headers,
			httpVersionMajor: request.version[0],
			httpVersionMinor: request.version[1],
			addListener: function(event, callback){
				if(event == "data"){
					when(request.body && request.body.forEach(function(data){
						callback(data);
					}), function(){
						endListeners.forEach(function(listener){
							listener();
						});
						endListeners = null;
					});
				}
				if(event == "end"){
					if(endListeners){
						endListeners.push(callback);
					}else{
						callback();
					}
				}
				return this;
			},
			pause: function(){
				
			},
			resume: function(){
				
			}
		},
		{
			writeHead: function(status, headers){
				var write;
				bodyDeferred = defer();
				responseDeferred.resolve({
					status: status,
					headers: headers,
					body: {
						forEach: function(callback){
							write = callback;							
							return bodyDeferred.promise;
						}
					}
				});
			},
			write: function(data){
				write(data);
			},
			end: function(data){
				write(data);
				bodyDeferred.resolve();
			}
		});
		return responseDeferred.promise;
	}
};