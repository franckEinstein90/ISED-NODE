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
let xmlParser = require('xml2json');




// READ IN THE MASTERFILE (DB) TO GET THE TENANTS,
// TOKENS, AND SERVICE LIST
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
        console.log("testing the api call");
        var email = req.query.email;
        console.log("this is the email " + email);
        var validTenants = JSONALL.master.tenants.filter(function(el) {
            return el.visible;
            // return el.name == 'ised-isde';
        })
        var tenants = [];
        if (!email) {
            async.eachSeries(validTenants, function(tenant, callback) {
                async.waterfall([async.apply(getApis, tenant), addAPIDocs, validateApis],
                    function addTenant(err, tenant) {
                        if (err) {
                            res.json({
                                result: 'Error processing'
                            });
                        } else {
                            console.log("pushing this guy to master " + tenant.name);
                            pushToMasterTenant(tenants, tenant);
                            callback(null);
                        }
                    });

            }, function(err) {

                if (err) {
                    // One of the iterations produced an error.
                    // All processing will now stop.
                    console.log('Failed to add a tenant..bailing out');
                } else {
                    console.log("returning json");
                    res.json(tenants);
                }
            });
        } else {
            async.eachSeries(validTenants, function(tenant, callback) {
                tenant.authenticatedUser = email;
                async.waterfall([async.apply(getApis, tenant), addAPIDocs, getPlans, validateUserByPlans, validateApis],
                    function addTenant(err, tenant) {
                        if (err) {
                            res.json({
                                result: 'Error processing'
                            });
                        } else {
                            console.log("pushing this guy to master " + tenant.name);
                            pushToMasterTenant(tenants, tenant);
                            callback(null);
                        }
                    });

            }, function(err) {

                if (err) {
                    // One of the iterations produced an error.
                    // All processing will now stop.
                    console.log('Failed to add a tenant..bailing out');
                } else {
                    console.log("returning json");
                    res.json(tenants);
                }
            });
        }
    });


    /**
     * Get all the api(s) associated with the tenant
     */
    const getApis = function(tenant, cb) {
        return new Promise(function(resolve, reject) {

            var tenantToAdd = {};
            let getApisForTenant = function(tenant) {
                const url = 'https://' + tenant.admin_domain + '/admin/api/services.json?access_token=' + tenant.access_token;
                return new Promise(function(resolve, reject) {
                    rp.get(url, {
                            json: true
                        })
                        .then(function(response) {

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
                            tenantToAdd.authenticatedUser = tenant.authenticatedUser;
                            console.log("tenant ready 1 " + tenantToAdd.name);
                            resolve();
                        })
                })
            }
            var apiCall = getApisForTenant(tenant);
            apiCall.then(function() {
                    console.log("tenant ready 2 " + tenantToAdd.name);
                    cb(null, tenantToAdd)
                })
                .catch(function(err) {
                    console.log(err)
                })

        })
    }



    /**
     * Get all the Active Docs associated with the tenant TODO: RENAME this to
     * be addActiveDocs
     */
    const addAPIDocs = function(tenant, cb) {
        let getActiveDocsForTenant = function(tenant) {
            var tenantWithResource = JSONALL.master.tenants.filter(function(el) {
                console.log("t.n " + el.name + " " + tenant.name)
                return el.name === tenant.name;
            });
            tenantWithResource = tenantWithResource[0];
            const url = 'https://' + tenantWithResource.admin_domain + '/admin/api/active_docs.json?access_token=' + tenantWithResource.access_token;
            console.log("This is the doc url " + url);
            return new Promise(function(resolve, reject) {
                rp.get(url, {
                        json: true
                    })
                    .then(function(response) {
                        tenant.docs = response;
                        console.log("tenant docs added " + tenant.name);
                        resolve();
                    })
            })
        }
        var apiCall = getActiveDocsForTenant(tenant);
        apiCall.then(function() {
                console.log("tenant docs added 2 " + tenant.name);
                cb(null, tenant)
            })
            .catch(function(err) {
                console.log(err)
            })
    }

    /**
     * Get all the plans for the logged in user
     */
    const getPlans = function(tenant, cb) {

        let getPlansByUser = function(tenant) {

            var tenantWithResource = JSONALL.master.tenants.filter(function(el) {
                console.log("t.n " + el.name + " " + tenant.name)
                return el.name === tenant.name;
            });
            tenantWithResource = tenantWithResource[0];
            const url = 'https://' + tenantWithResource.admin_domain + '/admin/api/accounts/find?access_token=' + tenantWithResource.access_token + '&email=' + encodeURIComponent(tenant.authenticatedUser);
            console.log("This is the getplan url " + url);
            return new Promise(function(resolve, reject) {
                rp.get(url, {
                    })
                    .then(function(response) {
                	let jsonresp = xmlParser.toJson(response);
                        tenant.plansforUser = jsonresp.plans;
                        resolve();
                    }).catch(function(err) {
                        reject(err);
                    })
            })
        }
        var planCall = getPlansByUser(tenant);
        planCall.then(function() {
                console.log("tenant plans added " + tenantToAdd.name);
                cb(null, tenant);
            })
            .catch(function(err) {
        	   console.log("error while getting plans");
                cb(null, tenant);
            })
    }

    /**
     * Check the user credentials based on the plans
     */
    const validateUserByPlans = function(tenant, cb) {


        return new Promise(function(resolve, reject) {
            let geUserAccessByPlans = function(plan) {
                var tenantWithResource = JSONALL.master.tenants.filter(function(el) {
                    console.log("t.n " + el.name + " " + tenant.name)
                    return el.name === tenant.name;
                });
                tenantWithResource = tenantWithResource[0];
                const url = 'https://' + tenantWithResource.admin_domain + '/admin/api/account_plans/' + plan.id + '/features.json?access_token=' + tenantWithResource.access_token;
                console.log("This is the get accounts url " + url);
                return new Promise(function(resolve, reject) {
                    rp.get(url, {
                            json: true
                        })
                        .then(function(response) {

                            var add = true;
                            var featureData = response;
                            if (featureData.features) {
                                featureData.features.forEach(function(element) {
                                    if (element.feature.visible) {
                                        if (element.feature.system_name === 'gc-internal') {
                                            console.log(" found an api that is restricted " + api.service.system_name);
                                            tenant.userGcInternal = true;
                                        }
                                        if (element.feature.system_name === tenant.name + '-internal') {
                                            console.log(" found an api that is restricted " + api.service.system_name);
                                            tenant.userTenantInternal = true;
                                        }
                                    }
                                })
                            }
                            resolve();
                        }).catch(function(err) {
                            reject(err);
                        })



                })
            }
            if (tenant.plansforUser) {
                let userAccessPromises = tenant.plansforUser.map(geUserAccessByPlans);

                Promise.all(userAccessPromises)
                    .then(function() {

                        // delete tenant.plansforUser;
                        // delete the authuser email tied to the tenant
                        cb(null, tenant);
                    })
                    .catch(function(err) {
                        console.log("error while getting accounts");
                        cb(null, tenant);
                    })
            } else {
                cb(null, tenant);
            }



        })

    }


    /**
     * Do a final validation to check if an API is eligible for display on the
     * portal
     */
    const validateApis = function(tenant, cb) {
        return new Promise(function(resolve, reject) {

            console.log("These are the apis");
            console.log(tenant.apis.services);
            let apis = [];

            let validateAPI = function(api) {
                var tenantWithResource = JSONALL.master.tenants.filter(function(el) {
                    console.log("t.n " + el.name + " " + tenant.name)
                    return el.name === tenant.name;
                });
                tenantWithResource = tenantWithResource[0];
                const url = 'https://' + tenantWithResource.admin_domain + '/admin/api/services/' + api.service.id + '/features.json?access_token=' + tenantWithResource.access_token;
                console.log("This is the url " + url);
                return new Promise(function(resolve, reject) {
                    rp.get(url, {
                            json: true
                        })
                        .then(function(response) {

                            var add = true;
                            var featureData = response;
                            if (featureData.features) {
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

                                for (var doc of tenant.docs.api_docs) {
                                    if (doc.api_doc.system_name === api.service.system_name + '-' + lang && doc.api_doc.published === true) {
                                        var apiToAdd = {};
                                        var swaggerbody = JSON.parse(doc.api_doc.body);
                                        apiToAdd.name = swaggerbody.info.title;
                                        apiToAdd.description = swaggerbody.info.description;
                                        apiToAdd.contact = {};
                                        if (checkApiValue(swaggerbody.info.contact)) {
                                            apiToAdd.contact.FN = swaggerbody.info.contact.name;
                                            apiToAdd.contact.email = swaggerbody.info.contact.email
                                        }
                                        apiToAdd.baseURL = 'https://' + swaggerbody.host + swaggerbody.basePath;
                                        apiToAdd.humanUrl = 'https://' + tenant.name + '.beta.api.canada.ca/' + lang + '/products/detail?api=' + api.service.system_name;
                                        apis.push(apiToAdd);
                                    }
                                }
                            }
                            resolve();
                        })
                })
            }

            let apiPromises = tenant.apis.services.map(validateAPI);

            Promise.all(apiPromises)
                .then(function() {
                    tenant.apis = apis;
                    delete tenant.docs;
                    cb(null, tenant);
                })
                .catch(function(err) {
                    console.log(err)
                })

        })
    }


    function checkApiValue(data) {
        if (data !== null && data !== undefined) {
            return true;
        } else {
            return false;
        }
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