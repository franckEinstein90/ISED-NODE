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
                var docsPromise = getActiveDocsForTenant(tenant.id, lang);
                docsPromise.then(function(payload) {

                    var activeDocsBelongingToTenant = JSON.parse(payload).api_docs;
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
                    tenantToAdd.apis = [];
                    //var apiPromise = getAPISByTenant(tenant.id);
                    getAPISByTenant_(tenant);
                   




              /*      apiPromise.then(function(payload) {
                        var apisBelongingToTenant = JSON.parse(payload).services;


                        myAPIFunction(apisBelongingToTenant,activeDocsBelongingToTenant,tenant).then(function(doc) {
                            if (doc) {
                                var n = new Date()
                                console.log('Adding doc to tenant ' + n.getHours() + ":" + n.getMinutes() + ":" + n.getSeconds());
                                addDocOrig(api, tenantToAdd, lang, doc)
                            }
                        }).catch(function(err) {
                            console.log("ERROR : ", err);
                        })


                        var n = new Date()
                        console.log('pushing to master ' + n.getHours() + ":" + n.getMinutes() + ":" + n.getSeconds());
                        pushToMasterTenant(tenants, tenantToAdd);
                        callback(null);

                    })*/
                    
                    tenantToAdd.apis = eligible;
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

    function myAPIFunction(apis, activeDocsBelongingToTenant, tenant) {
        const promises = [];
        for (var i in apis) {
            const promise = getAssociatedDoc(i.service.system_name + '-' + lang, activeDocsBelongingToTenant, i, tenant);
            promises.push(promise)
        }
        return Promise.all(promises);
    }



    /**
     * Add the swagger content to the api
     */
    function addDocOrig(api, tenantToAdd, lang, doc) {

        var swaggerbody = JSON.parse(doc.api_doc.body);
        console.log(" The following api is being added " + swaggerbody);
        var apiToAdd = {};

        apiToAdd.name = swaggerbody.info.title;
        apiToAdd.description = swaggerbody.info.description;
        apiToAdd.contact = {};
        if (checkApiValue(swaggerbody.info.contact)) {
            apiToAdd.contact.FN = swaggerbody.info.contact.name;
            apiToAdd.contact.email = swaggerbody.info.contact.email
        }
        apiToAdd.baseURL = 'https://' + swaggerbody.host + swaggerbody.basePath;
        apiToAdd.humanUrl = 'https://' + tenantToAdd.name + '.beta.api.canada.ca/' + lang + '/products/detail?api=' + api.service.system_name;
        tenantToAdd.apis.push(apiToAdd);




    }




    function checkApiValue(data) {
        if (data !== null && data !== undefined) {
            return true;
        } else {
            return false;
        }
    }


    /**
     * check if an active doc exists for the api
     */
    function getAssociatedDoc(system_name, activeDocsBelongingToTenant, api, tenant) {
        return new Promise(function(resolve, reject) {
            for (var doc of activeDocsBelongingToTenant) {
                if (doc.api_doc.system_name === system_name) {
                    var visibilityPromise = getAPIVisibility(api.service.id, tenant);
                    visibilityPromise.then(function(payload) {
                        var add = true;
                        var featureData = JSON.parse(payload);
                        if (featureData.features.length != 0) {
                            featureData.features.forEach(function(element) {
                                if (element.feature.scope === 'service_plan') {
                                    if (element.feature.system_name === 'gc-internal' || element.feature.system_name === tenant.name + '-internal') {
                                        console.log(" found an api that is restricted " + api.service.system_name);
                                        add = false;
                                    }
                                }
                            })
                        }
                        if (add) {
                            console.log("returning doc for " + api.service.system_name);
                            resolve(doc);
                        } else {
                            resolve(null);
                        }

                    });




                }
            }
        });
    }




    /**
     * *************************************************************** 3scale
     * api calls
     * ******************************************************************************
     */



    function getAPIVisibility(id, tenant) {

        return new Promise(function(resolve, reject) {
            var url = 'https://' + tenant.admin_domain + '/admin/api/services/' + id + '/features.json?access_token=' + tenant.access_token;
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
     * get the api(s) tied to a tenant
     */
    function getAPISByTenant_(tenant) {
      


       
            var url = 'https://' + tenant.admin_domain + '/admin/api/services.json?access_token=' + tenant.access_token;
            
           

            
            
            
            
            //     var url = 'https://' + tenant.admin_domain + '/admin/api/services/' + id + '/features.json?access_token=' + tenant.access_token;

            request(url, function(err, response, body) {
           
        	
        	doOther(JSON.parse(body).services,tenant);
        	
            });
    }
    
    var eligible  = [];
    
    function doOther(apis,tenant)
    {
	
	 apis.forEach(function(api)
	 {
	      console.log("iterating over " +  api.service.system_name);
	      var url = 'https://' + tenant.admin_domain + '/admin/api/services/' + api.service.id + '/features.json?access_token=' + tenant.access_token;
		  console.log("this is the url " + url);
		  request(url, function(err, response, body) {
		      
		      var add = true;
                      var featureData = JSON.parse(body);
                      if (featureData.features.length != 0) {
                          featureData.features.forEach(function(element) {
                              if (element.feature.scope === 'service_plan') {
                                  if (element.feature.system_name === 'gc-internal' || element.feature.system_name === tenant.name + '-internal') {
                                      console.log(" found an api that is restricted " + api.service.system_name);
                                      add = false;
                                  }
                              }
                          })
                      }
                      if (add) {
                	  console.log("pushing to eligible");
                	  var elApi = {};
                	  elApi.tenant = tenant.name;
                	  elApi.api = api
                	  eligible.push(elApi)
                      }
	       });
	  })
	 
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