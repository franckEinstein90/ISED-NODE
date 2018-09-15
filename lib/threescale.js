'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var request = require ('request');
var tenantsList = require ('/data/serverdata.json');
var bluebird = require('bluebird');
var fs = require ('fs');

var JSONALL = {};
var tListDynamic = [];

// READ IN THE MASTERFILE (DB) TO GET THE TENANTS, 
// TOKENS, AND SERVICE LIST
var getMasterJSON = function (){
  let rawdata = fs.readFileSync('/data/serverdata.json');
  let parsedata = JSON.parse(rawdata);
  JSONALL = parsedata
}

function threescaleRoute() {
  var threescale = new express.Router();
  threescale.use(cors());
  //     origin: /df24\.ised-dev\.openshiftapps\.com$/,
  var corsOptions = {
    origin: "/df24\.ised-dev\.openshiftapps\.com$/",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE"
  };

  threescale.use(cors(corsOptions));
  
  threescale.use(bodyParser());

  // TEST BASE URL - GET ENDPOINT - query params may or may not be populated
  threescale.get('/', function(req, res) {
    console.log(new Date(), 'In threescale route GET / req.query=', req.query);
    var world = req.query && req.query.hello ? req.query.hello : 'World';
    
    res.json({msg: 'Hello ' + world});
  });

  // RETURN TENTANTS AND SERVICE API LIST FROM FILE(DB)
  threescale.get('/tenants', function (req, res){

    // READ THE MASTER FILE
    getMasterJSON();

    // FILTER BASED ON VISIBLE ATTRIBUTE ==> TRUE
    var filteredArray = JSONALL.master.tenants.filter (function (el){
      return el.visible;
    })
    
    // RETURN THE FILTERED JSON
    res.json (filteredArray);
  });

  // RETURN THE LIST OF METHODS (SWAGGER?) FOR A SPECIFID SERVICE 
  // IN THE SPECIFED TENANT - THIS CALL IS A LIVE CALL TO THE API
  threescale.get('/tenants/:tid/mappinglist/:sid', function(req, res){
    
    // GET IN BOUND PARAMETERS
    var tid = req.params.tid;
    var sid = req.params.sid;

    // READ THE MASTER FILE
    getMasterJSON();

    // GET THE TENANT
    var tenant = JSONALL.master.tenants.filter ( function (el){
      return el.id===tid;
    })

    // JUST MAKE IT AN OBJECT
    tenant = tenant[0];

    // CREATE URL AS IN ....
    // https://canada-revenue-agency-admin.df24.ised-dev.openshiftapps.com/admin/api/services/16/proxy/mapping_rules.xml?access_token=23984f40822e51fdf91512913833e7fcc5f348b1b912f663a5fdfb88ad8c2469
    var url = 'https://' + tenant.admin_domain + '/admin/api/services/' + sid + '/proxy/mapping_rules.json?access_token=' + tenant.access_token;

    request.get ({
      url: url
    }, function (error, response, body){

      return res.json (JSON.parse(body));   
    });

  });

  return threescale;
}

module.exports = threescaleRoute;
