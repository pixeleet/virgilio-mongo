var errors = [{
    name: 'InvalidObjectIdError',
    init: function(objectId) {
        this.message = 'Invalid ObjectID: ' + objectId;
    }
}];

module.exports = errors;
