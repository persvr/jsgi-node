var when = require("./promise").when,
	NodeRequest = require("./jsgi-node").Request;


module.exports = function(socketServer, jsgiApp){
	socketServer.on("connection", function(connection){
		function Request(){}
		Request.prototype = new NodeRequest(connection._req);
		function Headers(){}
		Headers.prototype = Request.prototype.headers;
		connection.on("message", function(data){
			var request = new Request();
			request.body = [data];
			request.headers = new Headers();
			when(jsgiApp(request), function(response){
				when(response.body, function(body){
					body.forEach(function(data){
						connection.send(data);
					});
				})
			});
		});
		connection.on("close", function(){
		});
	});
};