/* global describe, it, before, after */
var assert = require('assert');
var MongoClient = require('mongodb').MongoClient;
var virgilio = require('./');
var async =  require('async');
var testData = require('./testData.json');
var COLLECTION_NAME = 'virgilio-mongo-tests';

describe('I can perform updates on mongo', function() {
    var db = null;
    var collection = null;

    before(function(done) {
        //Add some test data to mongo to query against.
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
                collection.remove({}, callback);
            },
            function insertTestData(number, result, callback) {
                collection.insert(testData, callback);
            }
        ], function(err, result) {
            done(err);
        });
    });

    after(function() {
        db.close();
    });

    function checkDataInMongo(done) {
        collection.find().toArray(function(err, result) {
            if (err) {
                return done(err);
            }
            assert.deepEqual(result, testData);
            done();
        });
    }

    it('updates an array of items', function(done) {
        //Change a document.
        var doc = testData[0];
        doc.state = 'rotten';

        virgilio.mongo()
            .into(COLLECTION_NAME)
            .update(doc)
            .then(function(result) {
                checkDataInMongo(done);
            })
            .catch(done)
            .done();
    });

});
