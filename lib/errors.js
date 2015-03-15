var InvalidObjectIdError = function InvalidObjectIdError(objectId) {
    this.message = 'Invalid ObjectID: ' + objectId;
};

var errors = [InvalidObjectIdError];

module.exports = errors;
