
/**
 * Module dependencies.
 */

var express = require('express'),
  routes = require('./routes'),
  user = require('./routes/user'),
  http = require('http'),
  path = require('path'),
  io = require('socket.io-client'),
  os = require('os'),
  redis = require('redis'),
  nodemailer = require('nodemailer');

var app = express();
var alert_flag = 0


if(app.get('port') == '3000')
  name = 'production'
else
  name = 'canary'

var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.argv[3],
        pass: process.argv[4]
    }
});

var mailOptions = {
    from: process.argv[3], // sender address 
    to: 'rsmandao@ncsu.edu', // list of receivers 
    subject: 'Alert from '+name, // Subject line 
    text: 'CPU overload!', // plaintext body 
    html: '<b>Check the release ✔</b>' // html body 
};


app.configure(function(){
  app.set('port', process.env.PORT || process.argv[2]);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

/*app.get('/', function(req, res){
  res.render('index', {
    title: 'Home'
  })
});*/
if(app.get('port') == '3000')
  var message = 'Production! (Stable)'
else
  var message = 'Canary'

app.get('/',function(req, res) { 
  res.writeHead(200, {'content-type':'text/html'});
    res.write(message);
});

app.get('/home',function(req, res) {
  res.render('index', {
    title: 'Home'
  });
});

app.get('/about', function(req, res){
  res.render('about', {
    title: 'About'
  });
});

app.get('/contact', function(req, res){
  res.render('contact', {
    title: 'Contact'
  });
});

var socket = io.connect('http://127.0.0.1:4000');
socket.on('connect', function () { 
  console.log("socket connected"); 
  setInterval(function() 
  {
    socket.emit('heartbeat',
    {
      Name: name, cpu: cpuAverage(), memoryLoad: memoryLoad(),
    });
  },2000);
});

function memoryLoad()
{
  console.log( os.totalmem(), os.freemem() );
  var mem_used = (os.totalmem() - os.freemem())/os.totalmem();
  console.log(mem_used * 100);
  mem_used = mem_used*100;
  return mem_used;
}

function cpuTicksAcrossCores() 
{
  //Initialise sum of idle and time of cores and fetch CPU info
  var totalIdle = 0, totalTick = 0;
  var cpus = os.cpus();
 
  //Loop through CPU cores
  for(var i = 0, len = cpus.length; i < len; i++) 
  {
    //Select CPU core
    var cpu = cpus[i];
    //Total up the time in the cores tick
    for(type in cpu.times) 
    {
      totalTick += cpu.times[type];
    }     
    //Total up the idle time of the core
    totalIdle += cpu.times.idle;
  }
 
  //Return the average Idle and Tick times
  return {idle: totalIdle / cpus.length,  total: totalTick / cpus.length};
}

var startMeasure = cpuTicksAcrossCores();

function cpuAverage()
{
  var endMeasure = cpuTicksAcrossCores(); 
 
  //Calculate the difference in idle and total time between the measures
  var idleDifference = endMeasure.idle - startMeasure.idle;
  var totalDifference = endMeasure.total - startMeasure.total;
 
  avg_cpu_usage = ((totalDifference - idleDifference) / totalDifference) * 100;
  //Calculate the average percentage CPU usage
  console.log(avg_cpu_usage)
  if(avg_cpu_usage > 5)
  {
    if(alert_flag == 0)
    {
      console.log("SEND")
      transporter.sendMail(mailOptions, function(error, info){
        if(error){
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
      });
      alert_flag = 1
    }
  }
  return avg_cpu_usage;
}

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

