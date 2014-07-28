var util = require('util');
var url = require('url');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var chainArgs = require('chain-args');

module.exports = function virgilioMongo(options) {
    var virgilio = this.namespace('mongo');
    var Promise = virgilio.Promise;
    Promise.promisifyAll(MongoClient);

    //Mongo options.
    var mongoOptions = options.mongo || {};
    var hostname = mongoOptions.hostname || 'localhost';
    var port = mongoOptions.port || 27017;
    var dbName = mongoOptions.dbName || 'test';
    var connectionString = url.format({
        protocol: 'mongodb',
        slashes: true,
        hostname: hostname,
        port: port,
        pathname: dbName
    });

    //Set up the chaining API.
    virgilio.baseVirgilio$.mongo = function mongo() {
        var virgilio = this;
        var chain = chainArgs()
            .property('from')
            .property('into')
            .args('where', 'plural')
            .args('orderBy', 'plural')
            .args('select', null, 'end')
            .property('insert', null, 'end')
            .property('update', null, 'end')
            .callback(function(err, query) {
                if (err) {
                    return Promise.reject(err);
                }
                return this.execute('mongo.query', query);
            }.bind(virgilio));
        return chain();
    };

    //Connect to the database.
    var dbPromise = MongoClient.connectAsync(connectionString)
        .bind(virgilio)
        .then(function(db) {
            var virgilio = this;
            virgilio.log.info(util.format('Connected to: %s'),
                                connectionString);
            Promise.promisifyAll(db);
            return db;
        })
        .catch(function(err) {
            var virgilio = this;
            virgilio.log.error(util.format(
                'Connecting to mongo failed. Error: %s',
                err
            ));
            //Throw the error again, to make any consecutive requests to the
            //db fail.
            throw err;
        });

    //Add virgilio action for querying mongo.
    virgilio.defineAction('query', queryMongo);
    function queryMongo(request) {
        //We're passing request as this, to prevent creating a closure.
        return dbPromise
            .bind(request)
            .then(function(db) {
                var request = this;
                var collectionName = getCollectionName(request);
                var mongoMethod = getMongoMethod(request);
                var collection = db.collection(collectionName);
                return mongoMethod(collection, request);
            });
    }

    /**
     * Our linq-like syntax allows a number of commands (select, insert, ...).
     * This map contains functions that take a collection and a query object,
     * and performs the correct mongo operation on that collection for each
     * command.
     */
    var MONGO_COMMAND_MAP = {
        select: function mongoSelect(collection, request) {
            var query = getQuery(request);
            var fields = getFields(request);
            var options = {
                limit: request.take,
                skip: request.skip,
                sort: getSort(request)
            };
            return new Promise(function(resolve, reject) {
                collection
                    .find(query, fields, options)
                    .toArray(function(err, result) {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(result);
                    });
            });
        },
        insert: function mongoInsert(collection, request) {
            var docs = request.insert;
            if (!docs) {
                throw new Error('Cannot insert empty object');
            }
            return new Promise(function(resolve, reject) {
                collection.insert(docs, function(err, result) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });
        },
        update: function mongoUpdate(collection, request) {
            var doc = request.update;
            doc._id = processValue(doc._id);
            if (!doc) {
                throw new Error('Cannot update empty object');
            }
            return new Promise(function(resolve, reject) {
                collection.save(doc, function(err, result) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });
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
    var MONGO_WHERE_OPERATOR_MAP = {
        '==': function equals(value) {
            return value;
        },
        'contains': function contains(value) {
            return value;
        }
        //TODO: add more operators.
        // '<': function smallerThan(value) {},
        // '>': function greaterThan(value) {},
        // '<=': function smallerThanEqual(value) {},
        // '>=': function greaterThanEqual(value) {}
    };

    function getCollectionName(request) {
        //Get the collection.
        var collectionName = request.from || request.into;
        if (!collectionName) {
            virgilio.log.error(util.format(
                'Invalid mongo request:\n%s',
                JSON.stringify(request, null, 4)
            ));
            throw new Error('Request must contain `from` property');
        }
        return collectionName;
    }

    function getMongoMethod(request) {
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
        return mongoMethod;
    }

    function getQuery(request) {
        //Build the query object out of the `where` clause(s).
        return (request.where || []).reduce(function(query, whereItem) {
            var field = whereItem[0];
            var operator = whereItem[1];
            var operatorMethod = MONGO_WHERE_OPERATOR_MAP[operator];
            var value = processValue(whereItem[2]);
            if (!(field && operatorMethod && value)) {
                throw new Error('Invalid where clause: ' + whereItem);
            }
            query[field] = operatorMethod(value);
            return query;
        }, {});
    }

    function processValue(value) {
        if (typeof value === 'string' && value.indexOf('ObjectId("') === 0) {
            value = value.substring(10, value.length - 2);
            value = new ObjectID(value);
        }

        return value;
    }

    function getSort(request) {
        return (request.orderBy || []).map(function(sortItem) {
            var field = sortItem[0];
            if (!field) {
                throw new Error('Invalid sort clause: ' + sortItem);
            }
            var direction = (sortItem[1] === 'desc') ? -1 : 1;
            return [field, direction];
        });
    }

    function getFields(request) {
        return (request.select || []).reduce(function(fields, field) {
            fields[field] = 1;
            return fields;
        }, {});
    }
};
