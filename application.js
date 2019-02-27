var express = require('express');
var cors = require('cors');

var app = express();

// Enable CORS for all requests
app.use(cors());

// allow serving of static files from the public directory
app.use(express.static(__dirname + '/public'));


app.use('/apidocs', require('./lib/apidocs.js')());

app.use('/userinfo', require('./lib/userinfo.js')());

// test e.p
app.use('/apidocstest', require('./lib/apidocs_test3.js')());



// default port is 8001
var port = process.env.FH_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080;
var host = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
app.listen(port, function() {
  console.log("App started at: " + new Date() + " on port: " + port); 
});
