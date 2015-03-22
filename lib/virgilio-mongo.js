var util = require('util');
var url = require('url');
var _ = require('underscore');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var chainArgs = require('chain-args');

module.exports = function virgilioMongo(options) {
    var virgilio = this.namespace$('mongo');
    virgilio.loadModule$(require('./register-errors'));
    var Promise = virgilio.Promise;
    Promise.promisifyAll(MongoClient);

    //Mongo options.
    //Allow the connectionString to be supplied directly, or as a set of props.
    var mongoOptions = options.mongo || {};
    var connectionString = mongoOptions.connect;
    if (!connectionString) {
        var hostname = mongoOptions.hostname || 'localhost';
        var port = mongoOptions.port || 27017;
        var dbName = mongoOptions.dbName || 'development';
        connectionString = url.format({
            protocol: 'mongodb',
            slashes: true,
            hostname: hostname,
            port: port,
            pathname: dbName
        });
    }

    function getChain() {
        var chain = chainArgs()
            .property('collection')
            .args('where', 'plural')
            .args('orderBy', 'plural')
            .args('find', null)
            .args('list', null)
            .property('insert', null)
            .property('insertMany', null)
            .property('update', null)
            .property('updateMany', null)
            .args('remove', null)
            .args('removeMany', null)
            .resolver('then', resolveThen, 'end')
            .resolver('catch', resolveCatch, 'end')
            .callback(function(err, query) {
                if (err) {
                    return Promise.reject(err);
                }
                return this.query(query);
            }.bind(virgilio));
        return chain();
    }

    function resolveThen(handler) {
        var self = this;
        return process.nextTick(function resolveOnNextTick() {
            return self._resolution.then(handler);
        });
    }

    function resolveCatch(errInstance, handler) {
        if (typeof handler !== 'function') {
            handler = errInstance;
            errInstance = Error;
        }
        var self = this;
        return process.nextTick(function catchOnNextTick() {
            return self._resolution.catch(errInstance, handler);
        });
    }

    //Connect to the database.
    var dbPromise = MongoClient.connectAsync(connectionString)
        .bind(virgilio)
        .then(function(db) {
            var virgilio = this;
            virgilio.log$.info(util.format('Connected to: %s'), connectionString);
            Promise.promisifyAll(db);
            return db;
        })
        .catch(function(err) {
            var virgilio = this;
            virgilio.log$.error(util.format('Connecting to mongo failed. Error: %s', err));
            //Throw the error again, to make any consecutive requests to the
            //db fail.
            throw err;
        });

    //Set up the chaining API.
    virgilio.baseVirgilio$.mongo = mongo;

    function mongo(collection) {
        if (collection) {
            return getChain.call(this).collection(collection);
        }
        return dbPromise.then(function (db) { return db; });
    }

    //Add virgilio action for querying mongo.
    virgilio.defineAction$('query', queryMongo);

    function queryMongo(request) {
        //We're passing request as this, to prevent creating a closure.
        return dbPromise
            .bind(request)
            .then(function(db) {
                var request = this;
                var collectionName = request.collection;
                var mongoMethod = getMongoMethod(request);
                var collection = db.collection(collectionName);
                // nice promisified collection for the masses
                Promise.promisifyAll(collection);
                return mongoMethod(collection, request);
            });
    }

    /**
     * Our linq-like syntax allows a number of commands (list, insert, ...).
     * This map contains functions that take a collection and a query object,
     * and performs the correct mongo operation on that collection for each
     * command.
     */

    var MONGO_COMMAND_MAP = {
        find: function mongoFindOne(collection, request) {
            var query = getQuery(request);
            var fields = getFields(request);
            var options = {
                sort: getSort(request)
            };
            return collection.findAsync(query, fields, options)
                .then(Promise.promisifyAll)
                .call('toArrayAsync');
        },
        list: function mongoFindMany(collection, request) {
            var query = getQuery(request);
            var fields = getFields(request);
            var options = {
                limit: request.take,
                skip: request.skip,
                sort: getSort(request)
            };
            return collection.findAsync(query, fields, options)
                .then(Promise.promisifyAll)
                .call('toArrayAsync');
        },
        insert: function mongoInsert(collection, request) {
            // console.log("_IINSERT CALLED ------", i++);
            // if(i%2 ==1) throw new Error('asd');
            var docs = request.insert;
            if (!docs) {
                throw new Error('Cannot insert empty object');
            }
            return collection.insertAsync(docs)
                .catch(isDuplicateKeyError, function handleDuplicateKeyError() {
                    throw new virgilio.DuplicateKeyError('You\'ve tried to insert an item with the same id twice :/');
                });
        },
        update: function mongoUpdate(collection, request) {
            var doc = request.update;
            var id = doc._id = processValue(doc._id);
            if (!doc) {
                throw new Error('Cannot update empty object');
            }
            return collection.saveAsync(doc)
                .then(function getItem() {
                    return collection.findOneAsync({ _id: id });
                });
        },
        remove: function mongoRemove(collection, request) {
            // console.log("remove CALLED ------", i++);
            var query = getQuery(request);
            virgilio.log$.info({query: query}, 'REMOVE QUERY');
            return collection.removeAsync(query).get(0);
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
        '!=': function notEquals(value) {
            return { $ne: value };
        },
        'contains': function contains(value) {
            return value;
        },
        'in': function within(array) {
            return { $in: array };
        },
        '>': function greaterThan(value) {
            return { $gt: value };
        },
        '<': function smallerThen(value) {
            return { $lt: value };
        },
        '>=': function greaterThan(value) {
            return { $gte: value };
        },
        '<=': function smallerThen(value) {
            return { $lte: value };
        }
    };

    function getMongoMethod(request) {
        //Select the mongoMethod we're going to use based on whether the user
        //did a list, insert, etc.
        var commands = Object.keys(MONGO_COMMAND_MAP);
        var mongoMethod = commands.reduce(function(previous, command) {
            return request[command] ? MONGO_COMMAND_MAP[command] : previous;
        }, null);
        if (!mongoMethod) {
            virgilio.log$.error(util.format('Invalid mongo request:\n%s', JSON.stringify(request, null, 4)));
            throw new Error(util.format('Request must contain one of the following commands: %s', commands));
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

            if (!(field && operatorMethod && !_.isUndefined(value))) {
                throw new Error('Invalid where clause: ' + whereItem);
            }
            var queryValue = operatorMethod(value);
            var oldQueryValue = query[field];
            var doesOldQueryValueExist = (typeof oldQueryValue !== 'undefined');
            //Check if we need to merge with an already existing query value.
            if (doesOldQueryValueExist) {
                var isQueryValueObject = (typeof queryValue === 'object');
                var isOldQueryValueObject = (typeof oldQueryValue === 'object');
                //Check that the old and new queryValues are objects.
                if (!isQueryValueObject || !isOldQueryValueObject) {
                    throw new Error('Invalid combination of where clauses.');
                }
                query[field] = _.extend(query[field], operatorMethod(value));
            } else {
                query[field] = queryValue;
            }
            return query;
        }, {});
    }

    function processValue(value) {
        if (value instanceof Array) {
            value = value.map(function(element) {
                return _processObjectId(element);
            });
        } else if (typeof value === 'string') {
            value = _processObjectId(value);
        }
        return value;
    }

    function _processObjectId(value) {
        if (typeof value === 'string' && value.indexOf('ObjectId("') === 0) {
            value = value.substring(10, value.length - 2);
            value = getObjectID(value);
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
        return (request.list || []).reduce(function(fields, field) {
            fields[field] = 1;
            return fields;
        }, {});
    }

    function getObjectID(value) {
        try {
            return new ObjectID(value);
        } catch(err) {
            throw new virgilio.InvalidObjectIdError(value);
        }
    }

    function isDuplicateKeyError(err) {
        return (err.code === 11000);
    }
};
