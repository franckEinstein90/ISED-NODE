'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var request = require('request');
var tenantsList = require('/data/serverdata.json');
var bluebird = require('bluebird');
var fs = require('fs');
var JSONALL = {};
var tenants = [];
var lang = 'en';

const AWS = require('aws-sdk');




// READ IN THE MASTERFILE (DB) TO GET THE TENANTS,
// TOKENS, AND SERVICE LIST
var getMasterJSON = function() {
    let rawdata = fs.readFileSync('/data/serverdata.json');
    let parsedata = JSON.parse(rawdata);
    JSONALL = parsedata;
};

/**
 * setting up the base route
 * 
 * @returns
 */
function userinfoRoute() {
    var userinfo = new express.Router();
    userinfo.use(cors());
    userinfo.use(bodyParser());
    // TEST BASE URL - GET ENDPOINT - query params may or may not be populated
    userinfo.get('/', function(req, res) {
        var world = req.query && req.query.hello ? req.query.hello : 'World';
        res.json({
            msg: 'API  ' + world
        });
    });




    /**
     * API end point to be called by drupal app and the like
     * 
     * @param req
     * @param res
     * @returns
     */
    userinfo.get('/userinfo.json', function(req, res) {
        res.header("Content-Type", "application/json; charset=utf-8");
        getMasterJSON();
        var email = req.query.email;
        var subscriptions = {};
        subscriptions.userEmail = email;
        var tenants = [];
        var validTenants = JSONALL.master.tenants.filter(function(el) {
            return el.visible;
        });
        for (const tenant of validTenants) {
            var id = getClientIdForTenant(tenant,email); 
           // var keys = getTenantSubscriptionKeysForUser(id); // [{appid,key}]
         /*if(keys)
         {
               var tenantToAdd = {};
               tenantToAdd.id = tenant.id;
               tenantToAdd.keys = keys;
               tenants.push(tenant);
         }
       }
        subscriptions.tenants = tenants;
        res.json(subscriptions);  */
    }});
    
    
    
    function getClientIdForTenant(tenant, email)
    {
	
	// curl -v -X GET
	// "https://ised-isde-admin.beta.api.canada.ca/admin/api/accounts/find.xml?access_token=d4c76697771b79b89033c287c546bdc3e5a73fb701b05a4d287579cac173f9ac&email=dontvo%2Bsso%40gmail.com"
	  var url = 'https://' + tenant.admin_domain + '/admin/api/accounts/find.json';
	  console.log("this is the tenant token " + url);
	  console.log("this is the user email " +email);
	  
	  var propertiesObject = {access_token:tenant.access_token,email:email };
	  
	  request({url:url, qs:propertiesObject}, function(err, response, body) {
	       if(!error){
		   console.log(body)
	       }
	     
	       
	   });
    }

   return userinfo;
}
module.exports = userinfoRoute;