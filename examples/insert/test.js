/* global describe, it, before, after */
var assert = require('assert');
var virgilio = require('./');
var testData = require('./testData.json');
var COLLECTION_NAME = 'virgilio-mongo-tests';

describe('I can perform inserts on mongo', function() {

    before(function(done) {
        virgilio.mongo(COLLECTION_NAME).remove()
            .then(assert.bind(this, testData.length))
            .then(done.bind(this, null))
            .catch(done);
    });

    after(function() {
        virgilio.mongo().call('close');
    });

    function checkDataInMongo(done) {
        virgilio.mongo(COLLECTION_NAME).find()
            .then(function(result) {
                assert.deepEqual(result, testData);
                done();
            })
            .catch(done);
    }

    it('inserts an array of items', function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .insert(testData)
            .then(function(result) {
                assert.deepEqual(result, testData);
                return result;
            })
            .then(function() {
                checkDataInMongo(done);
            })
            .catch(done);
    });

});
