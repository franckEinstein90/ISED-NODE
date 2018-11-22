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
  apijson.get('/apidocs', function(req, res) {
    console.log(new Date(), 'In threescale route GET / req.query=', req.query);
    var world = req.query && req.query.hello ? req.query.hello : 'World';
    res.json({
      msg : 'Hello ' + world
    });
  });
  
  
  apijson.get('/api.json', function(req, res)
  {
    getMasterJSON();
    // FILTER BASED ON VISIBLE ATTRIBUTE ==> TRUE
    var validTenants = JSONALL.master.tenants.filter(function(el) {
      return el.visible;
    })
    processTenants(validTenants);  
    res.json(tenants);
    
    
  });
  
  

  async function processTenants(validTenants)
  {
    for(const tenant of validTenants)
      {
        var docsPromise = getActiveDocsForTenant(tenant.id);
        docsPromise.then(function (payload)
            {
              var activeDocsBelongingToTenant = JSON.parse(payload);
              await processSingleTenant(tenant,activeDocsBelongingToTenant);
            }
        );
      }
  }

  
  
  /**
   * 
   */
  function processSingleTenant(item, activeDocsBelongingToTenant) {
    var tenant = {};
    tenant.name = item.name;
    tenant.apis = [];
    var apiPromise = getAPISByTenant(item.id);
    apiPromise.then(function(payload) {
      var apisBelongingToTenant =   JSON.parse(payload);
      apisBelongingToTenant.forEach(function(api){
        activeDocsBelongingToTenant.forEach(function(doc)
        {
            if( doc.system_name === api.system_name +"-fr" || doc.system_name === api.system_name +"-en")
             {
               var api = new Object();
               api.name = doc.body.info.title;
               api.description = doc.body.info.description;
               pushToArray(tenant.apis, api);
             }
        })
      });
    })
    pushToArray(tenants, tenant);
  };
  
  
  
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
          resolve(JSON.parse(body));
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
      request(url, function(err, response, body) {
        // in addition to parsing the value, deal with possible errors
        if (err)
          return reject(err);
        try {
          resolve(JSON.parse(body));
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
  function pushToArray(arr, obj) {
    const index = arr.findIndex((e) => e.id === obj.id);

    if (index === -1) {
        arr.push(obj);
    } else {
        arr[index] = obj;
    }
}

  



module.exports = apijsonRoute;
}
