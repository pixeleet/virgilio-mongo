/* global describe, it, before, after */
var assert = require('assert');
var virgilio = require('./');
var testData = require('./testData.json');
var COLLECTION_NAME = 'virgilio-mongo-tests';

describe('I can perform remove operations on mongo', function() {
    before(function(done) {
        virgilio.mongo(COLLECTION_NAME).remove().where('*')
            .then(function insertTestData() {
                virgilio.mongo(COLLECTION_NAME).insert(testData)
                    .then(done.bind(this, null))
                    .catch(done);
            });
    });

    after(function() {
        virgilio.mongo().call('close');
    });

    it('removes them all', function(done) {
        virgilio.mongo(COLLECTION_NAME)
            .remove()
            .then(function(removedItemCount) {
                assert.deepEqual(removedItemCount, 3);
                done();
            })
            .catch(done);
    });

});
