'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var request = require('request');
var tenantsList = require('/data/serverdata.json');
var bluebird = require('bluebird');
var fs = require('fs');
var JSONALL = {};








//READ IN THE MASTERFILE (DB) TO GET THE TENANTS,
//TOKENS, AND SERVICE LIST
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

            var tenantToAdd = {};
            tenantToAdd.name = tenant.name;
            var idPromise = getClientIdForTenant(tenant, email);
            idPromise.then(function(payLoad) {
                if (JSON.parse(payLoad).status) {
                    // do nothing
                } else {
                    var userid = JSON.parse(payLoad).account.id;

                    var appPromise = getTenantSubscriptionKeysForUser(id);

                    idPromise.then(function(payLoad) {
                        tenantToAdd.applications = JSON.parse(payLoad);
                    })


                }

            });
            tenants.push(tenantToAdd);

        }
        subscriptions.tenantInfo = tenants;
        res.json(subscriptions);
    });



    function getClientIdForTenant(tenant, email) {

        return new Promise(function(resolve, reject) {
            var url = 'https://' + tenant.admin_domain + '/admin/api/accounts/find.json?access_token=' + tenant.access_token + '&email=' + encodeURIComponent(email);
            request(url, function(err, response, body) {
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

    function getTenantSubscriptionKeysForUser(id) {
        return new Promise(function(resolve, reject) {
            var url = 'https://' + tenant.admin_domain + '/admin/api/accounts/' + id + '?access_token=' + tenant.access_token;
            request(url, function(err, response, body) {
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


    return userinfo;
}
module.exports = userinfoRoute;