# ISED NODE SERVER

### This NODE server is an example of middleware service that acts as a proxy between the client portal interface (see ISED-PORTAL) and a multi-tenant 3Scale server.

### The purpose of this tier is to abstract the 3Scale API compliexity from the UI developer while mainting some level of security by hiding the 3Scale 'access-tokens'.

### Having a middle tier also enables some level of data caching, filtering, shared resources, etc, resulting in better performance.

NOTES:
* Assumes NODE has been installed
* Uses 'cors', 'body-parser', 'express', 'bluebird' node packages
* This server runs on port 8001
* The tokens 'serverdata.json' have been removed from this public file. 

#### From the command line type:
$ node application.js

#### You should see a line as similar to the following:
App started at: Tue Aug 28 2018 07:09:34 GMT-0500 (Central Daylight Time) on port: 8001