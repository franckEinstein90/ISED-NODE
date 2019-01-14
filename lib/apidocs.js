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
        getMasterJSON();
        lang =  req.query.lang;
        console.log(new Date(), 'Starting to process tenants-api.json gen for language ' + lang);
        var validTenants = JSONALL.master.tenants.filter(function(el) {
            return el.visible;
        })
        processTenants(validTenants);
        res.json(tenants);
    });

    /**
     * start processing tenants
     */
    async function processTenants(validTenants) {
        for (const tenant of validTenants) {
            await handle(tenant);
        }
    }

    /**
     * handle a single tenant
     */
    function handle(tenant) {
        var docsPromise = getActiveDocsForTenant(tenant.id,lang);
        docsPromise.then(function(payload) {
            var activeDocsBelongingToTenant = JSON.parse(payload).api_docs;
            processSingleTenant(tenant, activeDocsBelongingToTenant);
        });
    };


    /**
     * process a single tenant
     */
    function processSingleTenant(item, activeDocsBelongingToTenant) {
        var tenant = {};
        tenant.name = item.name;
        tenant.maintainers = {};
        tenant.maintainers.fn = "Don Vo, Andrew Pitt";
        tenant.maintainers.email = "don.vo@canada.ca";
        tenant.maintainers.url = "https://api.canada.ca";
        tenant.apis = [];
        var apiPromise = getAPISByTenant(item.id);
        apiPromise.then(function(payload) {
            var apisBelongingToTenant = JSON.parse(payload).services;
            apisBelongingToTenant.forEach(function(api) {
                var doc_localized = getAssociatedDoc(api.service.system_name + '-' + lang, activeDocsBelongingToTenant);
                if (doc_localized) {
                    addDoc(api,tenant,lang,doc_localized, tenant.apis);
                }
            });
            pushToMasterTenant(tenants, tenant);
        })
    };


    /**
     * Add the swagger content to the api
     */
    function addDoc(api, tenant , lang ,doc, apis) {
        var apiToAdd = {};
        var swaggerbody = JSON.parse(doc.api_doc.body);
        apiToAdd.name = swaggerbody.info.title;
        apiToAdd.description = swaggerbody.info.description;
        apiToAdd.contact = {};
        apiToAdd.contact.FN = swaggerbody.info.contact.name;
        apiToAdd.contact.email = swaggerbody.info.contact.email;
        apiToAdd.baseURL = 'https://' + swaggerbody.host + swaggerbody.basePath;
        apiToAdd.humanUrl = 'https://' + tenant.name +'.dev.api.canada.ca/' + lang +'/products/detail?api='+ api.service.system_name;
     
        apis.push(apiToAdd);
       
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
     * *************************************************************** 3scale api calls
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


    /** **************************** UTIL FUNCTIONS ************************************************************* */

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