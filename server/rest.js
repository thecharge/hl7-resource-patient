JsonRoutes.Middleware.use(
  '/api/*',
  oAuth2Server.oauthserver.authorise()   // OAUTH FLOW - A7.1
);



// this is temporary fix until PR 132 can be merged in
// https://github.com/stubailo/meteor-rest/pull/132

JsonRoutes.sendResult = function (res, options) {
  options = options || {};

  // Set status code on response
  res.statusCode = options.code || 200;

  // Set response body
  if (options.data !== undefined) {
    var shouldPrettyPrint = (process.env.NODE_ENV === 'development');
    var spacer = shouldPrettyPrint ? 2 : null;
    res.setHeader('Content-type', 'application/fhir+json');
    res.write(JSON.stringify(options.data, null, spacer));
  }

  // We've already set global headers on response, but if they
  // pass in more here, we set those.
  if (options.headers) {
    //setHeaders(res, options.headers);
    options.headers.forEach(function(value, key){
      res.setHeader(key, value);
    });
  }

  // Send the response
  res.end();
};

JsonRoutes.setResponseHeaders({
  "content-type": "application/fhir+json"
});


JsonRoutes.add("get", "/fhir-1.6.0/Patient/:id", function (req, res, next) {
  process.env.DEBUG && console.log('GET /fhir-1.6.0/Patient/' + req.params.id);

  res.setHeader("Access-Control-Allow-Origin", "*");

  var accessTokenStr = (req.params && req.params.access_token) || (req.query && req.query.access_token);
  var accessToken = oAuth2Server.collections.accessToken.findOne({accessToken: accessTokenStr});

  if (accessToken || process.env.NOAUTH || Meteor.settings.private.disableOauth) {

    if (accessToken) {
      process.env.TRACE && console.log('accessToken', accessToken);
      process.env.TRACE && console.log('accessToken.userId', accessToken.userId);
    }

    // if (typeof SiteStatistics === "object") {
    //   SiteStatistics.update({_id: "configuration"}, {$inc:{
    //     "Patients.count.read": 1
    //   }});
    // }

    var patientData = Patients.findOne({_id: req.params.id});
    if (patientData) {
      patientData.id = patientData._id;

      delete patientData._document;
      delete patientData._id;

      process.env.TRACE && console.log('patientData', patientData);

      JsonRoutes.sendResult(res, {
        code: 200,
        data: Patients.prepForFhirTransfer(patientData)
      });
    } else {
      JsonRoutes.sendResult(res, {
        code: 410
      });
    }
  } else {
    JsonRoutes.sendResult(res, {
      code: 401
    });
  }
});


JsonRoutes.add("get", "/fhir-1.6.0/Patient/:id/_history", function (req, res, next) {
  process.env.DEBUG && console.log('GET /fhir-1.6.0/Patient/' + req.params.id);
  process.env.DEBUG && console.log('GET /fhir-1.6.0/Patient/' + req.query._count);

  res.setHeader("Access-Control-Allow-Origin", "*");

  var accessTokenStr = (req.params && req.params.access_token) || (req.query && req.query.access_token);
  var accessToken = oAuth2Server.collections.accessToken.findOne({accessToken: accessTokenStr});

  if (accessToken || process.env.NOAUTH || Meteor.settings.private.disableOauth) {

    if (accessToken) {
      process.env.TRACE && console.log('accessToken', accessToken);
      process.env.TRACE && console.log('accessToken.userId', accessToken.userId);
    }

    // if (typeof SiteStatistics === "object") {
    //   SiteStatistics.update({_id: "configuration"}, {$inc:{
    //     "Patients.count.read": 1
    //   }});
    // }

    var patients = Patients.find({_id: req.params.id});
    var payload = [];

    patients.forEach(function(record){
      payload.push(Patients.prepForFhirTransfer(record));
    });

    JsonRoutes.sendResult(res, {
      code: 200,
      data: Bundle.generate(payload, 'history')
    });
  } else {
    JsonRoutes.sendResult(res, {
      code: 401
    });
  }
});

JsonRoutes.add("put", "/fhir-1.6.0/Patient/:id", function (req, res, next) {
  process.env.DEBUG && console.log('PUT /fhir-1.6.0/Patient/' + req.params.id);
  process.env.DEBUG && console.log('PUT /fhir-1.6.0/Patient/' + req.query._count);

  res.setHeader("Access-Control-Allow-Origin", "*");

  var accessTokenStr = (req.params && req.params.access_token) || (req.query && req.query.access_token);
  var accessToken = oAuth2Server.collections.accessToken.findOne({accessToken: accessTokenStr});

  if (accessToken || process.env.NOAUTH || Meteor.settings.private.disableOauth) {

    if (accessToken) {
      process.env.TRACE && console.log('accessToken', accessToken);
      process.env.TRACE && console.log('accessToken.userId', accessToken.userId);
    }

    // if (typeof SiteStatistics === "object") {
    //   SiteStatistics.update({_id: "configuration"}, {$inc:{
    //     "Patients.count.read": 1
    //   }});
    // }

    if (req.body) {
      patientUpdate = req.body;

      // remove id and meta, if we're recycling a resource
      delete req.body.id;
      delete req.body.meta;

      patientUpdate.resourceType = "Patient";
      patientUpdate = Patients.toMongo(patientUpdate);
      patientUpdate = Patients.prepForUpdate(patientUpdate);


      process.env.DEBUG && console.log('-----------------------------------------------------------');
      process.env.DEBUG && console.log('patientUpdate', JSON.stringify(patientUpdate, null, 2));
      // process.env.DEBUG && console.log('newPatient', newPatient);

      var patientId = Patients.update({_id: req.params.id}, {$set: patientUpdate },  function(error, result){
        if (error) {
          //console.log('PUT /fhir/Patient/' + req.params.id + "[error]", error);
          JsonRoutes.sendResult(res, {
            code: 400
          });
        }
        if (result) {
          process.env.TRACE && console.log('result', result);
          res.setHeader("Location", "fhir/Patient/" + result);
          res.setHeader("Last-Modified", new Date());
          res.setHeader("ETag", "1.6.0");

          var patients = Patients.find({_id: req.params.id});
          var payload = [];

          patients.forEach(function(record){
            payload.push(Patients.prepForFhirTransfer(record));
          });

          console.log("payload", payload);

          JsonRoutes.sendResult(res, {
            code: 200,
            data: Bundle.generate(payload)
          });
        }
      });
    } else {
      JsonRoutes.sendResult(res, {
        code: 422
      });

    }



  } else {
    JsonRoutes.sendResult(res, {
      code: 401
    });
  }
});


generateDatabaseQuery = function(query){
  console.log("generateDatabaseQuery", query);

  var databaseQuery = {};

  if (query.family) {
    databaseQuery['name'] = {
      $elemMatch: {
        'family': query.family
      }
    };
  }
  if (query.given) {
    databaseQuery['name'] = {
      $elemMatch: {
        'given': query.given
      }
    };
  }
  if (query.name) {
    databaseQuery['name'] = {
      $elemMatch: {
        'text': {
          $regex: query.name,
          $options: 'i'
        }
      }
    };
  }
  if (query.identifier) {
    databaseQuery['identifier'] = {
      $elemMatch: {
        'value': query.identifier
      }
    };
  }
  if (query.gender) {
    databaseQuery['gender'] = query.gender;
  }
  if (query.birthdate) {
    var dateArray = query.birthdate.split("-");
    var minDate = dateArray[0] + "-" + dateArray[1] + "-" + (parseInt(dateArray[2])) + 'T00:00:00.000Z';
    var maxDate = dateArray[0] + "-" + dateArray[1] + "-" + (parseInt(dateArray[2]) + 1) + 'T00:00:00.000Z';
    console.log("minDateArray", minDate, maxDate);

    databaseQuery['birthDate'] = {
      "$gte" : new Date(minDate),
      "$lt" :  new Date(maxDate)
    };
  }

  process.env.DEBUG && console.log('databaseQuery', databaseQuery);
  return databaseQuery;
}

JsonRoutes.add("get", "/fhir-1.6.0/Patient", function (req, res, next) {
  process.env.DEBUG && console.log('GET /fhir-1.6.0/Patient', req.query);
  // console.log('GET /fhir/Patient', req.query);
  // console.log('process.env.DEBUG', process.env.DEBUG);

  res.setHeader("Access-Control-Allow-Origin", "*");

  var accessTokenStr = (req.params && req.params.access_token) || (req.query && req.query.access_token);
  var accessToken = oAuth2Server.collections.accessToken.findOne({accessToken: accessTokenStr});

  if (accessToken || process.env.NOAUTH || Meteor.settings.private.disableOauth) {

    if (accessToken) {
      process.env.TRACE && console.log('accessToken', accessToken);
      process.env.TRACE && console.log('accessToken.userId', accessToken.userId);
    }

    // if (typeof SiteStatistics === "object") {
    //   SiteStatistics.update({_id: "configuration"}, {$inc:{
    //     "Patients.count.search-type": 1
    //   }});
    // }

    var databaseQuery = generateDatabaseQuery(req.query);

    //process.env.DEBUG && console.log('Patients.find(id)', Patients.find(databaseQuery).fetch());

    // var searchLimit = 1;
    // var patientData = Patients.fetchBundle(databaseQuery);

    var payload = [];
    var patients = Patients.find(databaseQuery);

    patients.forEach(function(record){
      payload.push(Patients.prepForFhirTransfer(record));
    });


    JsonRoutes.sendResult(res, {
      code: 200,
      data: Bundle.generate(payload)
    });
  } else {
    JsonRoutes.sendResult(res, {
      code: 401
    });
  }
});

// This is actually a search function
JsonRoutes.add("post", "/fhir-1.6.0/Patient/:param", function (req, res, next) {
  process.env.DEBUG && console.log('POST /fhir-1.6.0/Patient/' + JSON.stringify(req.query));

  res.setHeader("Access-Control-Allow-Origin", "*");

  var accessTokenStr = (req.params && req.params.access_token) || (req.query && req.query.access_token);
  var accessToken = oAuth2Server.collections.accessToken.findOne({accessToken: accessTokenStr});

  if (accessToken || process.env.NOAUTH || Meteor.settings.private.disableOauth) {

    if (accessToken) {
      process.env.TRACE && console.log('accessToken', accessToken);
      process.env.TRACE && console.log('accessToken.userId', accessToken.userId);
    }

    var patients = [];

    if (req.params.param.includes('_search')) {
      var searchLimit = 1;
      if (req && req.query && req.query._count) {
        searchLimit = parseInt(req.query._count);
      }

      var databaseQuery = generateDatabaseQuery(req.query);
      process.env.DEBUG && console.log('databaseQuery', databaseQuery);

      patients = Patients.find(databaseQuery, {limit: searchLimit});

      var payload = [];

      patients.forEach(function(record){
        payload.push(Patients.prepForFhirTransfer(record));
      });
    }

    //process.env.TRACE && console.log('patients', patients);

    JsonRoutes.sendResult(res, {
      code: 200,
      data: Bundle.generate(payload)
    });
  } else {
    JsonRoutes.sendResult(res, {
      code: 401
    });
  }
});



JsonRoutes.add("post", "/fhir-1.6.0/Patient", function (req, res, next) {
  //process.env.DEBUG && console.log('POST /fhir/Patient/', JSON.stringify(req.body, null, 2));

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("content-type", "application/fhir+json");

  var accessTokenStr = (req.params && req.params.access_token) || (req.query && req.query.access_token);
  var accessToken = oAuth2Server.collections.accessToken.findOne({accessToken: accessTokenStr});

  if (accessToken || process.env.NOAUTH || Meteor.settings.private.disableOauth) {

    if (accessToken) {
      process.env.TRACE && console.log('accessToken', accessToken);
      process.env.TRACE && console.log('accessToken.userId', accessToken.userId);
    }

    var patientId;
    var newPatient;

    if (req.body) {
      newPatient = req.body;

      // remove id and meta, if we're recycling a resource
      delete newPatient.id;
      delete newPatient.meta;

      if (newPatient.birthDate) {
        newPatient.birthDate = moment(newPatient.birthDate);
      }

      newPatient = Patients.toMongo(newPatient);

      process.env.DEBUG && console.log('newPatient', JSON.stringify(newPatient, null, 2));
      // process.env.DEBUG && console.log('newPatient', newPatient);

      var patientId = Patients.insert(newPatient,  function(error, result){
        if (error) {
          JsonRoutes.sendResult(res, {
            code: 400
          });
        }
        if (result) {
          process.env.TRACE && console.log('result', result);
          res.setHeader("Location", "fhir-1.6.0/Patient/" + result);
          res.setHeader("Last-Modified", new Date());
          res.setHeader("ETag", "1.6.0");

          var patients = Patients.find({_id: result});
          var payload = [];

          patients.forEach(function(record){
            payload.push(Patients.prepForFhirTransfer(record));
          });

          //console.log("payload", payload);

          JsonRoutes.sendResult(res, {
            code: 201,
            data: Bundle.generate(payload)
          });
        }
      });
    } else {
      JsonRoutes.sendResult(res, {
        code: 422
      });

    }

  } else {
    JsonRoutes.sendResult(res, {
      code: 401
    });
  }
});



JsonRoutes.add("delete", "/fhir-1.6.0/Patient/:id", function (req, res, next) {
  process.env.DEBUG && console.log('DELETE /fhir-1.6.0/Patient/' + req.params.id);

  res.setHeader("Access-Control-Allow-Origin", "*");

  var accessTokenStr = (req.params && req.params.access_token) || (req.query && req.query.access_token);
  var accessToken = oAuth2Server.collections.accessToken.findOne({accessToken: accessTokenStr});

  if (accessToken || process.env.NOAUTH || Meteor.settings.private.disableOauth) {

    if (accessToken) {
      process.env.TRACE && console.log('accessToken', accessToken);
      process.env.TRACE && console.log('accessToken.userId', accessToken.userId);
    }

    if (Patients.find({_id: req.params.id}).count() === 0) {
      JsonRoutes.sendResult(res, {
        code: 410
      });
    } else {
      Patients.remove({_id: req.params.id}, function(error, result){
        if (result) {
          JsonRoutes.sendResult(res, {
            code: 204
          });
        }
        if (error) {
          JsonRoutes.sendResult(res, {
            code: 409
          });
        }
      });
    }


  } else {
    JsonRoutes.sendResult(res, {
      code: 401
    });
  }
});





// WebApp.connectHandlers.use("/fhir/Patient", function(req, res, next) {
//   res.setHeader("Access-Control-Allow-Origin", "*");
//   return next();
// });
