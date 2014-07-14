var util = require('util');
var url = require('url');
var MongoClient = require('mongodb').MongoClient;

var MONGO_COMMAND_MAP = {
    select: function mongoSelect(collection, query) {
        return collection.findAsync(query.query, query.fields, query.options);
    },
    insert: function mongoInsert(collection, query) {
        return collection.insert(query.docs, query.options);
    }
};

module.exports = function virgilioMongo(options) {
    var virgilio = this.namespace('mongo');
    var Promise = virgilio.Promise;
    Promise.promisifyAll(MongoClient);

    //We would like to call collections over a promise interface.
    //Because we don't want to promisifyAll every collection instance, we
    //do the prototype instead.
    var MongoCollection = require('mongodb/lib/mongodb/collection').Collection;
    Promise.promisifyAll(MongoCollection.prototype);

    //Mongo options.
    var mongoOptions = options.mongo || {};
    var hostname = mongoOptions.hostname || 'localhost';
    var port = mongoOptions.port || 27017;
    // var dbName = mongoOptions.dbName || 'test';
    var dbName = mongoOptions.dbName || 'bsos';
    var connectionString = url.format({
        protocol: 'mongodb',
        slashes: true,
        hostname: hostname,
        port: port,
        pathname: dbName
    });

    //Connect to the database.
    var dbPromise = MongoClient.connectAsync(connectionString)
                .then(function(db) {
                    virgilio.log.info(util.format('Connected to: %s'),
                                      connectionString);
                    Promise.promisifyAll(db);
                    return db;
                });

    //Add virgilio action for querying mongo.
    virgilio.defineAction('query', queryMongo);
    function queryMongo(request) {
        var virgilio = this;
        var query = interpretRequest.call(virgilio, request);
        return dbPromise
            .call('collectionAsync', query.collection)
            .then(function(collection) {
                var mongoMethod = MONGO_COMMAND_MAP[request.command];
                return mongoMethod(collection, query);
            })
            .then(function(cursor) {
                Promise.promisifyAll(cursor);
                return cursor;
            })
            .call('toArrayAsync');
    }


    function interpretRequest(request) {
        var virgilio = this;
        var collection = request.from || request.into;
        if (!collection) {
            virgilio.log.error(util.format(
                'Invalid mongo request:\n%s',
                JSON.stringify(request, null, 4)
            ));
            throw new Error('Request must contain `from` property');
        }
        var commands = Object.keys(MONGO_COMMAND_MAP);
        var command = commands.reduce(function(previous, command) {
            return request[command] ? command : previous;
        });
        if (!command) {
            virgilio.log.error(util.format(
                'Invalid mongo request:\n%s',
                JSON.stringify(request, null, 4)
            ));
            throw new Error(util.format(
                'Request must contain one of the following commands: %s',
                commands
            ));
        }
        var query = {};
        var docs = request.insert;
        var fields = request.select;
        var options = {
            limit: request.take,
            skip: request.skip
        };
        return {
            collection: collection,
            command: command,
            query: query,
            options: options,
            fields: fields
        };
    }
//     //TEST TEST TEST
//     var query = {
//         nationality: 'italian'
//     };
//     var queryOptions = {
//         fields: ['name'],
//         sort: ['name']
//     };

//     dbPromise
//     .call('collectionAsync', 'people')
//     .call('findAsync', query, queryOptions)
//     .then(function(cursor) {
//         Promise.promisifyAll(cursor);
//         return cursor;
//     })
//     .call('toArrayAsync')
//     .then(function(result) {
//         console.log('RESULTS ARE IN!');
//         console.log(result);
//     })
//     .done();
};
