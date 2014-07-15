/* global describe, it, before, after */
var assert = require('assert');
var MongoClient = require('mongodb').MongoClient;
var virgilio = require('./');
var async =  require('async');
var testData = require('./testData.json');
var COLLECTION_NAME = 'virgilio-mongo-tests';

describe('I can perform inserts on mongo', function() {
    var db = null;
    var collection = null;

    before(function(done) {
        //Clear a document for us to use.
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
            }
        ], function(err) {
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

    it('gets the complete data', function(done) {
        virgilio.mongo()
            .into(COLLECTION_NAME)
            .insert(testData)
            .then(function(result) {
                checkDataInMongo(done);
            })
            .catch(done)
            .done();
    });
});
