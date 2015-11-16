var http      = require('http');
var httpProxy = require('http-proxy');
var redis = require('redis')
var express = require('express')
var app = express()
var client = redis.createClient(6379, '127.0.0.1', {})
var socket_io = require('socket.io')
var os = require('os')

ports = ['3000','3001'];
client.del('hosts')

//Canary = 3001
//Stable = 3000

for(i in ports)
{
	console.log('http://127.0.0.1:'+ports[i])
	client.lpush(['hosts','http://127.0.0.1:'+ports[i]],function(err, value) {
		console.log("VALUE : ",value)
	})
}

var options = {};
var proxy   = httpProxy.createProxyServer(options);

var server  = http.createServer(function(req, res)
{
	client.rpoplpush('hosts','hosts',function(err,value) {
		proxy.web( req, res, {target: value } );
		console.log("VALUE rpoplpush: ",value)
	})
});
server.listen(8080);

var monitoring_server = app.listen(4000, function () {

          var host = monitoring_server.address().address
          var port = monitoring_server.address().port

        console.log('Example app listening at http://%s:%s', host, port)
})
var io = socket_io.listen(monitoring_server);

io.sockets.on('connection', function (socket) {
		console.log('Client connected')
        socket.on('heartbeat',function(data){
              console.log(data);
              if(data.Name=='canary' && data.cpu > 10)
              {
              		console.log("NOW STOP Canary")
              		client.del('hosts')
              		client.lpush(['hosts','http://127.0.0.1:3000'],function(err, value) {})
              }
		});
	})

