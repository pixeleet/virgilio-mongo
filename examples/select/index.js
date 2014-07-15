var Virgilio = require('virgilio');
var options = {
    mongo: {
        dbName: 'test'
    }
};
var virgilio = new Virgilio(options);
virgilio.loadModule(require('../../lib/virgilio-mongo'));

module.exports = virgilio;
