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
            var tenants = [];
            async.each(validTenants, function(tenant, callback) {
             
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
                    
                    getApisChained(tenant.id).then(function (servicesTest) {
                	  console.log('Got the following id:'+ servicesTest)
                    });
                    
                    var apiPromise = getAPISByTenant(tenant.id);
                    apiPromise.then(function(payload) {
                	
                	 tenantToAdd.apis = payload;
                	 pushToMasterTenant(tenants, tenantToAdd);
                         callback(null);
                    })

            }, function(err) {

                if (err) {
                    // One of the iterations produced an error.
                    // All processing will now stop.
                    console.log('Failed to add a tenant..bailing out');
                } else {


                    var n = new Date()
                   
                    console.log('Final tenants' + n.getHours() + ":" + n.getMinutes() + ":" + n.getSeconds());
                    res.json(tenants);
                }
            });

        } else {
            var restriction = {};
            restriction.message = "This user has no subscriptions";
            res.json(restriction);
        }
    });


    function getApisChained(tid) {
	 var tenant = JSONALL.master.tenants.filter(function(el) {
            return el.id === tid;
        })
	  tenant = tenant[0];
	   var url = 'https://' + tenant.admin_domain + '/admin/api/services.json?access_token=' + tenant.access_token;
	   var servicesTest = [];
	   return rp(url)
	  .then(response => {
	      console.log('hahaha');
	      var apisBelongingToTenant = JSON.parse(response).services;
	      apisBelongingToTenant.forEach(function(api) {
	      if(api.service.id === 12)
	      {
		  console.log("this api has the id " + 12);
		  servicesTest.push(api);
	      }
	      else
	      {
		  console.log("this api does not have the id " + 12);
	      }
	     
	  })
	  return servicesTest}).catch(err => console.log) // Don't forget to catch errors
   }
   

    /**
     * get the api(s) tied to a tenant
     */
    function getAPISByTenant(tid) {
        return new Promise(function(resolve, reject) {
            var tenant = JSONALL.master.tenants.filter(function(el) {
                return el.id === tid;
            })
            // JUST MAKE IT AN OBJECT
            tenant = tenant[0];
            var url = 'https://' + tenant.admin_domain + '/admin/api/services.json?access_token=' + tenant.access_token;
            //     var url = 'https://' + tenant.admin_domain + '/admin/api/services/' + id + '/features.json?access_token=' + tenant.access_token;

            request(url, function(err, response, body) {
                // in addition to parsing the value, deal with possible errors
                if (err)
                    return reject(err);
                try {
                    resolve(body);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
    
    
    
    
    

    /**
     * get all the active docs tied to a tenant
     */
    function getActiveDocsForTenant(tid) {
        return new Promise(function(resolve, reject) {
            var tenant = JSONALL.master.tenants.filter(function(el) {
                return el.id === tid;
            })
            // JUST MAKE IT AN OBJECT
            tenant = tenant[0];
            var url = 'https://' + tenant.admin_domain + '/admin/api/active_docs.json?access_token=' + tenant.access_token;

            request(url, function(err, response, body) {
                // in addition to parsing the value, deal with possible errors
                if (err)

                    return reject(err);
                try {

                    resolve(body);
                } catch (e) {
                    reject(e);
                }
            });
        });
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