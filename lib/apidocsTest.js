'use strict';

var express = require('express');
var async = require("async");
var bodyParser = require('body-parser');
var cors = require('cors');
var request = require('request');
var tenantsList = require('/data/serverdata.json');
var bluebird = require('bluebird');
var fs = require('fs');
var JSONALL = {};
var tenants = [];
var lang = 'en';
var tenants_en = [];
var tenants_fr = [];
var rp = require('request-promise')




//READ IN THE MASTERFILE (DB) TO GET THE TENANTS,
//TOKENS, AND SERVICE LIST
var getMasterJSON = function() {
    let rawdata = fs.readFileSync('/data/serverdata.json');
    let parsedata = JSON.parse(rawdata);
    JSONALL = parsedata
}



/**
 * setting up the base route
 * 
 * @returns
 */
function apijsonRoute() {
    var apijson = new express.Router();
    apijson.use(cors());
    apijson.use(bodyParser());
    // TEST BASE URL - GET ENDPOINT - query params may or may not be populated
    apijson.get('/', function(req, res) {
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
    apijson.get('/apitest.json', function(req, res) {
        res.header("Content-Type", "application/json; charset=utf-8");
        getMasterJSON();
        lang = req.query.lang;
        var email = req.query.email;
        if (!email) {


            var validTenants = JSONALL.master.tenants.filter(function(el) {
                //return el.visible;
                return el.name == 'ised-isde';
            })
        	// starting the waterfall chain
            async.waterfall([ getApis(validTenants)],
        	            function returnJson(err, tenants) {
        	                if (err) {
        	                    res.json({result: 'Error processing'});
        	                }
        	                else {

        	                    res.json(tenants);
        	                }
        	            })
        } else {
            var restriction = {};
            restriction.message = "This user has no subscriptions";
            res.json(restriction);
        }
    });


    const  getApis = function (secretTenantResources,cb) {
	
	return new Promise(function (resolve, reject) {
	        var tenants = [];
	        let getApisForTenant = function (tenant) {
	            const url = 'https://' + tenant.admin_domain + '/admin/api/services.json?access_token=' + tenant.access_token;
	            return new Promise(function (resolve, reject) {
	               rp.get(url, {json: true})
	                    .then(function (response) {
	                	 var tenantToAdd = {};
	                         tenantToAdd.name = tenant.name;
	                         tenantToAdd.maintainers = {};
	                         if (lang === 'en') {
	                             tenantToAdd.description = tenant.description_en;
	                             tenantToAdd.maintainers.fn = "GC API Store Team";
	                         } else {
	                             tenantToAdd.description = tenant.description_fr;
	                             tenantToAdd.maintainers.fn = "Equipe du magasin API";
	                         }
	                         tenantToAdd.maintainers.email = "ic.api_store-magasin_des_apis.ic@canada.ca";
	                         tenantToAdd.maintainers.url = "https://api.canada.ca";
	                         tenantToAdd.apis = response;
	                         pushToMasterTenant(tenants, tenantToAdd);
	                         resolve();
	                    })
	            })
	        }
	        console.log('Starting tenant loop');
	        let tenantPromises  = secretTenantResources.map(getApisForTenant)
	        Promise.all(tenantPromises)
	            .then(function () {
	                cb(null, tenants);
	            })
	            .catch(function (err) {
	                console.log(err)
	            })

	    })
	
    }




  
    
   
    


    /**
     * **************************** UTIL FUNCTIONS
     * *************************************************************
     */

    /**
     * push a valid tenant into the master array
     */
    function pushToMasterTenant(arr, obj) {

        const index = arr.findIndex((e) => e.name === obj.name);
        if (index === -1) {

            arr.push(obj);
        } else {
            arr[index] = obj;
        }
    }


    return apijson;


}

module.exports = apijsonRoute;