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
const AWS = require('aws-sdk');
var cache = require('memory-cache');

let memCache = new cache.Cache();
let cacheMiddleware = (duration) => {
    return (req, res, next) => {
        let key = '__express__' + req.originalUrl || req.url
        console.log("this is the cahce key " + key);
        let cacheContent = memCache.get(key);
        if (cacheContent) {
            console.log("returning cached data");
            res.send(cacheContent);
            return
        } else {
            console.log("returning fresh hit");
            res.sendResponse = res.send
            res.send = (body) => {

                memCache.put(key, body, duration * 1000);
                res.sendResponse(body)
            }
            next()
        }
    }
}


// READ IN THE MASTERFILE (DB) TO GET THE TENANTS,
// TOKENS, AND SERVICE LIST
var getMasterJSON = function() {
    let rawdata = fs.readFileSync('/data/serverdata.json');
    let parsedata = JSON.parse(rawdata);
    JSONALL = parsedata
}

function uploadToS3(data, key) {

    let cacheContent = memCache.get(key);
    if (!cacheContent) {
        console.log('pushing to aws');
        let s3bucket = new AWS.S3({
            accessKeyId: JSONALL.master.aws_key,
            secretAccessKey: JSONALL.master.aws_secret,
            Bucket: 'gc-api-store-dev',
        });
        s3bucket.createBucket(function() {
            var params = {
                Bucket: 'gc-api-store-dev',
                Key: key,
                Body: JSON.stringify(data, null, 2)
            };
            s3bucket.upload(params, function(err, data) {
                if (err) {
                    console.log('error in callback');
                    console.log(err);
                }
                console.log('success..data uploaded');
            });
        });
        memCache.put(key, "tenant-" + key, 30 * 60000);
    } else {
        console.log('not pushing to aws..cache has not expired');
    }
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
        email = req.query.email;
        if(!email)
        {
            
        
        var validTenants = JSONALL.master.tenants.filter(function(el) {
            return el.visible;
            // return el.name == 'ised-isde';
        })
        console.log('handling ' + validTenants.length);
        var tenants = [];
        async.each(validTenants, function(tenant, callback) {
            console.log('handling ' + tenant.name);
            var docsPromise = getActiveDocsForTenant(tenant.id, lang);
            docsPromise.then(function(payload) {
                var activeDocsBelongingToTenant = JSON.parse(payload).api_docs;

                var tenantToAdd = {};
                tenantToAdd.name = tenant.name;
                if (lang === 'en') {
                    tenantToAdd.description = tenant.description_en;
                } else {
                    tenantToAdd.description = tenant.description_fr;
                }
                tenantToAdd.maintainers = {};
                tenantToAdd.maintainers.fn = "GC API Store Team";
                tenantToAdd.maintainers.email = "ic.api_store-magasin_des_apis.ic@canada.ca";
                tenantToAdd.maintainers.url = "https://api.canada.ca";
                tenantToAdd.apis = [];
                var apiPromise = getAPISByTenant(tenant.id);
                apiPromise.then(function(payload) {
                    var apisBelongingToTenant = JSON.parse(payload).services;
                    apisBelongingToTenant.forEach(function(api) {
                        var doc_localized = getAssociatedDoc(api.service.system_name + '-' + lang, activeDocsBelongingToTenant);
                        if (doc_localized) {
                            addDoc(api, tenantToAdd, lang, doc_localized, tenantToAdd.apis);
                        }
                    });
                    pushToMasterTenant(tenants, tenantToAdd);
                    callback(null);

                }, function(err) {
                    callback(null);
                })
            }, function(err) {
                callback(null);
            });


        }, function(err) {
         
            if (err) {
                // One of the iterations produced an error.
                // All processing will now stop.
                console.log('Failed to add a tenant..bailing out');
            } else {
                res.json(tenants);
            }
        });


        }
        else
            {
               var restriction = {};
               restriction.message  = "This user has no subscriptions";
               res.json(restriction);
            }
    });


  

    /**
     * Add the swagger content to the api
     */
    function addDoc(api, tenant, lang, doc, apis) {
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
    function getAssociatedDoc(system_name, activeDocsBelongingToTenant) {


        for (var doc of activeDocsBelongingToTenant) {
            if (doc.api_doc.system_name === system_name) {
                return doc;
            }
        }
    }



    /**
     * *************************************************************** 3scale
     * api calls
     * ******************************************************************************
     */

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