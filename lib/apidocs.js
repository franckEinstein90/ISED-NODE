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

// READ IN THE MASTERFILE (DB) TO GET THE TENANTS,
// TOKENS, AND SERVICE LIST
var getMasterJSON = function() {
  let rawdata = fs.readFileSync('/data/serverdata.json');
  let parsedata = JSON.parse(rawdata);
  JSONALL = parsedata
}

function apijsonRoute() {
  var apijson = new express.Router();
  apijson.use(cors());
  apijson.use(bodyParser());
  // TEST BASE URL - GET ENDPOINT - query params may or may not be populated
  apijson.get('/', function(req, res) {
    console.log(new Date(), 'In threescale route GET / req.query=', req.query);
    var world = req.query && req.query.hello ? req.query.hello : 'World';
    res.json({
      msg : 'Hello ' + world
    });
  });
  
  
  apijson.get('/api.json', function(req, res)
  {
    getMasterJSON();
    console.log(new Date(), 'Starting to process tenants-api.json gen');
    var validTenants = JSONALL.master.tenants.filter(function(el) {
      return el.name == 'ISED';
    })
    processTenants(validTenants);  
    res.json(tenants);
    
    
  });
  
  

  async function processTenants(validTenants)
  {
    for(const tenant of validTenants)
      {
        await handle(tenant);
      }
  }
  
  
  function handle(tenant)
      {
          console.log(new Date(), 'Starting to obtain active docs for tenant');
          var docsPromise = getActiveDocsForTenant(tenant.id);
          docsPromise.then(function (payload)
              {
                var activeDocsBelongingToTenant = JSON.parse(payload).api_docs;
                processSingleTenant(tenant,activeDocsBelongingToTenant);
              }
          );
      };

  
  
  /**
   * 
   */
  function processSingleTenant(item, activeDocsBelongingToTenant) {
    var tenant = {};
    tenant.name = item.name;
    tenant.apis = [];
    var apiPromise = getAPISByTenant(item.id);
    apiPromise.then(function(payload) {
    var apisBelongingToTenant =   JSON.parse(payload).services;
    apisBelongingToTenant.forEach(function(api){
    var doc_fr = getAssociatedDoc(api.service.system_name +"-fr", activeDocsBelongingToTenant);
    if(doc_fr)
          {
            var apiToAdd = {};
            var swaggerbody = JSON.parse(doc_fr.api_doc.body);
            apiToAdd.name = swaggerbody.info.title;
            apiToAdd.description =swaggerbody.info.description;
            tenant.apis.push(apiToAdd);
            console.log("This is the length of the  api array " + tenant.apis.length);
          }
      });
     pushToMasterTenant(tenants,tenant);
     console.log("This is the length og the the tenant array " + tenants.length);
    })
   
  };
  
  
  function getAssociatedDoc(system_name , activeDocsBelongingToTenant)
  {
    console.log(new Date(), 'checking for this name  ' + system_name );
    for(var doc of  activeDocsBelongingToTenant) 
        {
            if( doc.api_doc.system_name ===  system_name )
             {
               return doc;
               
             }
        }
  }
  
  
  
  // 3scale api calls

  /**
   * 
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
   * 
   */
  function getActiveDocsForTenant(tid) {
    return new Promise(function(resolve, reject) {
      var tenant = JSONALL.master.tenants.filter(function(el) {
        return el.id === tid;
      })
      // JUST MAKE IT AN OBJECT
      tenant = tenant[0];
      var url = 'https://' + tenant.admin_domain + '/admin/api/active_docs.json?access_token=' + tenant.access_token;
      console.log(new Date(), 'Making call to obtain active docs for tenant');
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
  
  
// util funcs //
  
  /**
   * 
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
