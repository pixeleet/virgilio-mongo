var errors = require('./errors');

module.exports = function registerErrors() {
    var virgilio = this;
    virgilio.registerError$('DuplicateKeyError');
    errors.map(function (error) {
        virgilio.registerError$(error);
    });
};
