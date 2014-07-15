var Virgilio = require('virgilio');
var options = {
    mongo: {
        dbName: 'test'
    },
    //Don't log anything (it's annoying when runnig tests).
    // logger: {
    //     name: 'virgilio',
    //     streams: []
    // }
};
var virgilio = new Virgilio(options);
virgilio.loadModule(require('../../lib/virgilio-mongo'));

module.exports = virgilio;
