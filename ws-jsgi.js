var when = require("./promise").when,
	NodeRequest = require("./jsgi-node").Request;


module.exports = function(socketServer, jsgiApp){
	socketServer.on("connection", function(socket){
		var req = socket.upgradeReq;
		req.setTimeout(0);
		function Request(){}
		Request.prototype = new NodeRequest(req);
		function Headers(){}
		Headers.prototype = Request.prototype.headers;
		socket.on("message", function(data){
			var request = new Request();
			request.body = [data];
			request.headers = new Headers();
			when(jsgiApp(request), function(response){
				when(response.body, function(body){
					var chunks = [],
						done = false;
					when(body.forEach(function (chunk) {
						chunks.push(chunk);
					}), function () {
						done = true;
					});
					socket.stream(function (err, send) {
						if (!err && chunks.length) {
							send(chunks.join(''), done);
							chunks = [];
						}
					});
				});
			});
		});
	});
};
