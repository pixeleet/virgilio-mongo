/* global describe, it, before, after */
var assert = require('assert');
var virgilio = require('./');
var testData = require('./testData.json');
var COLLECTION_NAME = 'virgilio-mongo-tests';

describe('I can perform updates on mongo', function() {
    before(function(done) {
        virgilio.mongo(COLLECTION_NAME).remove()
            .then(function insertTestData() {
                virgilio.mongo(COLLECTION_NAME).insert(testData)
                    .then(done.bind(this, null))
                    .catch(done);
            });
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

    it('updates an array of items', function(done) {
        //Change a document.
        var doc = testData[0];
        doc.state = 'rotten';

        virgilio.mongo(COLLECTION_NAME)
            .update(doc)
            .then(function(result) {
                assert.deepEqual(result, doc);
                checkDataInMongo(done);
            })
            .catch(done);
            //done();
    });

});
