var util = require('util');
var url = require('url');
var MongoClient = require('mongodb').MongoClient;

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

    /**
     * Our linq-like syntax allows a number of commands (select, insert, ...).
     * This map contains functions that take a collection and a query object,
     * and performs the correct mongo operation on that collection for each
     * command.
     */
    var MONGO_COMMAND_MAP = {
        select: function mongoSelect(collection, query) {
            return collection
                .findAsync(query.query, query.fields, query.options)
                .then(function(cursor) {
                    //Sadly, promisifying the Scope prototype does not work.
                    //Its constructor sets relevant methods to scope instances.
                    Promise.promisifyAll(cursor);
                    return cursor;
                })
                .call('toArrayAsync');
        },
        insert: function mongoInsert(collection, query) {
            return collection.insertAsync(query.docs, query.options);
        }
    };

    /**
     * A mongo query object passed to `collection.find()` has properties:
     *     <fieldName>: <queryObject>
     * Our where statements have the form:
     *     [ <fieldName>, <operator>, <value> ]
     * This map contains a function for each valid operator, which takes
     * the `<value>` and returns a `<queryObject>`.
     */
    MONGO_WHERE_OPERATOR_MAP = {
        '==': function equals(value) {
            return value;
        }
    };

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
                return query.mongoMethod(collection, query);
            });
    }


    function interpretRequest(request) {
        var virgilio = this;

        //Get the collection.
        var collection = request.from || request.into;
        if (!collection) {
            virgilio.log.error(util.format(
                'Invalid mongo request:\n%s',
                JSON.stringify(request, null, 4)
            ));
            throw new Error('Request must contain `from` property');
        }

        //Select the mongoMethod we're going to use based on whether the user
        //did a select, insert, etc.
        var commands = Object.keys(MONGO_COMMAND_MAP);
        var mongoMethod = commands.reduce(function(previous, command) {
            return request[command] ? MONGO_COMMAND_MAP[command] : previous;
        }, null);
        if (!mongoMethod) {
            virgilio.log.error(util.format(
                'Invalid mongo request:\n%s',
                JSON.stringify(request, null, 4)
            ));
            throw new Error(util.format(
                'Request must contain one of the following commands: %s',
                commands
            ));
        }

        //Build the query object out of the `where` clause(s).
        var query = (request.where || []).reduce(function(query, whereItem) {
            var field = whereItem[0];
            var operator = whereItem[1];
            var operatorMethod = MONGO_WHERE_OPERATOR_MAP[operator];
            var value = whereItem[2];
            if (!(field && operatorMethod && value)) {
                throw new Error('Invalid where clause: ' + whereItem);
            }
            query[field] = operatorMethod(value);
            return query;
        }, {});

        //Create the docs property, for insert.
        var docs = request.insert;

        //Create the fields property. We receive it as an array of field names,
        //mongo expectes an object like so: `{ fieldName1: 1, fieldName2: 1 }`
        var fields = (request.select || []).reduce(function(fields, field) {
            fields[field] = 1;
            return fields;
        }, {});

        //Generate the options object out of additional optional properties.
        var options = {
            limit: request.take,
            skip: request.skip
        };

        return {
            collection: collection,
            mongoMethod: mongoMethod,
            query: query,
            docs: docs,
            options: options,
            fields: fields
        };
    }
};
