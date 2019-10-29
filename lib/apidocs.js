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
var xmlParser = require('xml2json');
var cache = require('memory-cache');




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
    apijson.get('/api.json', function(req, res) {
        res.header("Content-Type", "application/json; charset=utf-8");
        getMasterJSON();
        lang = req.query.lang;
        var email = req.query.email;
        var validTenants = JSONALL.master.tenants.filter(function(el) {
            return el.visible;
            // return el.name == 'esdc-edsc';
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
                console.log("this is the email " + email);
                async.waterfall([async.apply(getApis, tenant), addAPIDocs, getPlans, validateUserByPlans, validateApis],
                    function addTenant(err, tenant) {
                        if (err) {
                            res.json({
                                result: 'Error processing'
                            });
                        } else {
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
                            tenantToAdd.userGcInternal = false;
                            tenantToAdd.userTenantInternal = false;


                            resolve();
                        })
                })
            }
            var apiCall = getApisForTenant(tenant);
            apiCall.then(function() {
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
                return el.name === tenant.name;
            });
            tenantWithResource = tenantWithResource[0];
            const url = 'https://' + tenantWithResource.admin_domain + '/admin/api/active_docs.json?access_token=' + tenantWithResource.access_token;
            return new Promise(function(resolve, reject) {
                rp.get(url, {
                        json: true
                    })
                    .then(function(response) {
                        tenant.docs = response;

                        resolve();
                    })
            })
        }
        var apiCall = getActiveDocsForTenant(tenant);
        apiCall.then(function() {
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

                return el.name === tenant.name;
            });
            tenantWithResource = tenantWithResource[0];
            const url = 'https://' + tenantWithResource.admin_domain + '/admin/api/accounts/find?access_token=' + tenantWithResource.access_token + '&email=' + encodeURIComponent(tenant.authenticatedUser);
            console.log("this is the url we are hitting " + url);
            return new Promise(function(resolve, reject) {
                rp.get(url)
                    .then(function(response) {
                        var jsonresp = xmlParser.toJson(response);
                        var jsonObj = JSON.parse(jsonresp);
                        tenant.plansforUser = jsonObj.account.plans.plan;
                        /*  console.log("these are the plans " );
                           console.log( jsonObj.account.plans.plan );
                          */

                        resolve();
                    }).catch(function(err) {
                        console.log("error while getting plans");
                        reject(err);
                    })
            })
        }
        var planCall = getPlansByUser(tenant);
        planCall.then(function() {
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

                    return el.name === tenant.name;
                });
                tenantWithResource = tenantWithResource[0];
                const url = 'https://' + tenantWithResource.admin_domain + '/admin/api/account_plans/' + plan.id + '/features.json?access_token=' + tenantWithResource.access_token;
                console.log("getting the features " + url);
                return new Promise(function(resolve, reject) {
                    rp.get(url, {
                            json: true
                        })
                        .then(function(response) {

                            var add = true;
                            var featureData = response;
                            console.log("features returned");
                            console.log(featureData);
                            if (featureData.features) {
                                featureData.features.forEach(function(element) {
                                    if (element.feature.visible) {
                                        if (element.feature.system_name === 'gc-internal') {

                                            tenant.userGcInternal = true;
                                        }
                                        if (element.feature.system_name === tenant.name + '-internal') {

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
                if (Array.isArray(tenant.plansforUser)) {
                    let userAccessPromises = tenant.plansforUser.map(geUserAccessByPlans);

                    Promise.all(userAccessPromises)
                        .then(function() {
                            delete tenant.plansforUser;
                            cb(null, tenant);
                        })
                        .catch(function(err) {
                            console.log("error while getting accounts");
                            cb(null, tenant);
                        })
                } else {
                    var planCall = geUserAccessByPlans(tenant.plansforUser);
                    planCall.then(function() {
                            delete tenant.plansforUser;
                            cb(null, tenant);
                        })
                        .catch(function(err) {
                            console.log("error while getting accounts");
                            cb(null, tenant);
                        })
                }
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



            let apis = [];

            let validateAPI = function(api) {
                var tenantWithResource = JSONALL.master.tenants.filter(function(el) {

                    return el.name === tenant.name;
                });
                tenantWithResource = tenantWithResource[0];
                if (cache.get(tenant.name + '-' + api.service.id + '-default') == null) {
                   cache.put(tenant.name + '-' + api.service.id + '-default', api.service.name, 1500 * 60000);
                }                
                const url = 'https://' + tenantWithResource.admin_domain + '/admin/api/services/' + api.service.id + '/features.json?access_token=' + tenantWithResource.access_token;
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
                                        if ((element.feature.system_name === 'gc-internal' && tenant.userGcInternal === false) || (element.feature.system_name === tenant.name + '-internal' && tenant.userTenantInternal === false)) {
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
                                        
/*this is how the name of the apis are made billingual*/
apiToAdd.name = swaggerbody.info.title;

                                        if (cache.get(tenant.name + '-' + api.service.id + '-' + lang) == null) {

                                            cache.put(tenant.name + '-' + api.service.id + '-' + lang, swaggerbody.info.title, 1500 * 60000);
                                        }
apiToAdd.description = swaggerbody.info.description;
apiToAdd.contact = {};
if (checkApiValue(swaggerbody.info.contact)) {
apiToAdd.contact.FN = swaggerbody.info.contact.name;
apiToAdd.contact.email = swaggerbody.info.contact.email
}
apiToAdd.baseURL = 'https://' + swaggerbody.host + swaggerbody.basePath;
if(JSONALL.master.env === 'prod')
{
apiToAdd.humanUrl = 'https://' + tenant.name + '.api.canada.ca/' + lang 
    + '/detail?api=' + api.service.system_name;
 }
 else
 {
 apiToAdd.humanUrl = 'https://' + tenant.name + '.dev.api.canada.ca/' + lang + '/detail?api=' + api.service.system_name;
 }
                                        
                                        apis.push(apiToAdd);
                                    }
                                }
                            }
                            resolve();
                        })
                })
            }


            if (tenant.apis.services) {
                if (Array.isArray(tenant.apis.services)) {
                    let apiPromises = tenant.apis.services.map(validateAPI);
                    Promise.all(apiPromises)
                        .then(function() {
                            tenant.apis = apis;
                            delete tenant.docs;
                            cb(null, tenant);
                        })
                        .catch(function(err) {
                            console.log(err);
                            cb(null, tenant);

                        })


                } else {
                    var planCall = validateAPI(tenant.apis.services);
                    planCall.then(function() {
                            delete tenant.docs;
                            cb(null, tenant);
                        })
                        .catch(function(err) {
                            console.log("error while getting accounts");
                            cb(null, tenant);
                        })
                }
            } else {
                cb(null, tenant);
            }




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
