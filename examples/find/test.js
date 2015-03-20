/* global describe, it, before */
var assert = require('assert');
var MongoClient = require('mongodb').MongoClient;
var virgilio = require('./');
var _ = require('underscore');
var async = require('async');
var testData = require('./testData.json');
var COLLECTION_NAME = 'virgilio-mongo-tests';

describe('I can perform lists on mongo', function() {

    before(function(done) {
        //Add some test data to mongo to query against.
        var db = null;
        var collection = null;
        async.waterfall([
            function connectToMongo(callback) {
                MongoClient.connect(
                    'mongodb://localhost:27017/test',
                    callback
                );
            },
            function dropDocument(newDb, callback) {
                db = newDb;
                collection = db.collection(COLLECTION_NAME);
                collection.remove({}, function() {
                    callback();
                });
            },
            function insertTestData(callback) {
                collection.insert(testData, callback);
            }
        ], function(err) {
            db.close();
            done(err);
        });
    });

    it('gets the complete data', function(done) {
        virgilio.mongo(COLLECTION_NAME)
        .find()
        .then(function(result) {
            assert.deepEqual(result, testData);
            done();
        })
        .catch(done);
        //done();
    });

    it('gets only certain fields', function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .list('name', 'table')
            .then(function(result) {
                var expected = testData.map(function(person) {
                    return {
                        _id: person._id,
                        name: person.name,
                        table: person.table
                    };
                });
                assert.deepEqual(result, expected);
                done();
            })
            .catch(done);
            //done();
    });

    it('allows where statements with an `==` operator', function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .where('name', '==', 'jasper')
            .list()
            .then(function(result) {
                var expected = _.where(testData, { name: 'jasper' });
                assert.deepEqual(result, expected);
                done();
            })
            .catch(done);
            //done();
    });

    it('allows where statements with an `>=` operator', function(done) {
        var valueToCheckAgainst = 3;
        virgilio.mongo(COLLECTION_NAME)
            .where('integerValue', '>=', valueToCheckAgainst)
            .list()
            .then(function(result) {
                var expected = _.filter(testData, function(record) {
                    return (record.integerValue >= valueToCheckAgainst);
                });
                assert.deepEqual(result, expected);
                done();
            })
            .catch(done);
            //done();
    });

    it('allows where statement to search for a specific document id',
    function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .list()
            .then(function(result) {
                result = result[0];
                var searchId = result._id;

                virgilio.mongo(COLLECTION_NAME)
                    .where('_id', '==', 'ObjectId("' + searchId + '")')
                    .list()
                    .then(function(foundObjects) {
                        var foundObj = foundObjects[0];
                        assert.deepEqual(foundObj, result);

                        done();
                    });
            })
            .catch(done);
            //done();
    });

    it('allows where statements with a `contains` operator', function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .where('nationalities', 'contains', 'dutch')
            .list()
            .then(function(result) {
                var expected = _.filter(testData, function(person) {
                    return (person.nationalities.indexOf('dutch') !== -1);
                });
                assert.deepEqual(result, expected);
                done();
            })
            .catch(done);
            //done();
    });

    it('allows where statements with a `!=` operator', function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .where('table', '!=', 1)
            .list()
            .then(function(result) {
                var expected = _.filter(testData, function(person) {
                    var isTable1 = (person.table === 1);
                    return !isTable1;
                });
                assert.deepEqual(result, expected);
                done();
            })
            .catch(done);
            //done();
    });

    it('allows where statements with a `in` operator', function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .where('name', 'in', ['rolf', 'daphne'])
            .list()
            .then(function(result) {
                var expected = _.filter(testData, function(person) {
                    var isDaphne = (person.name === 'daphne');
                    var isRolf = (person.name === 'rolf');
                    return isDaphne || isRolf;
                });
                assert.deepEqual(result, expected);
                done();
            })
            .catch(done);
            //done();
    });

    it('allows multiple where statements', function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .where('nationalities', 'contains', 'swiss')
            .where('table', '==', 2)
            .list()
            .then(function(result) {
                var expected = _.filter(testData, function(person) {
                    return (
                        person.nationalities.indexOf('swiss') !== -1 &&
                        person.table === 2
                    );
                });
                assert.deepEqual(result, expected);
                done();
            })
            .catch(done);
            //done();
    });

    it('allows sorting of results', function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .list()
            .orderBy('name')
            .then(function(result) {
                var expected = _.sortBy(testData, 'name');
                assert.deepEqual(result, expected);
                done();
            })
            .catch(done);
            //done();
    });

    it('allows descending sorting of results', function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .orderBy('name', 'desc')
            .list()
            .then(function(result) {
                var expected = _.sortBy(testData, 'name').reverse();
                assert.deepEqual(result, expected);
                done();
            })
            .catch(done);
            //done();
    });

    it('allows multiple sorting', function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .orderBy('table')
            .orderBy('name')
            .list()
            .then(function(result) {
                var expected = _.sortBy(testData, function(person) {
                    return person.table + person.name;
                });
                assert.deepEqual(result, expected);
                done();
            })
            .catch(done);
            //done();
    });

    it('throws an error when an invalid ObjectId is used.', function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .where('_id', '==', 'ObjectId("foo")')
            .list()
            .catch(virgilio.InvalidObjectIdError, function() {
                done();
            });
            //done();
    });
});
