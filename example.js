var Virgilio = require('virgilio');
var options = {
    mongo: {
        dbName: 'bsos'
    }
};
var virgilio = new Virgilio(options);
virgilio.loadModule(require('./lib/virgilio-mongo'));

virgilio.mongo()
    .from('people')
    .where('nationality', '==', 'dutch')
    .orderBy('name', 'desc')
    .select('name')
    .then(function(response) {
        console.log('RESPONSE');
        console.log(response);
        process.exit();
    })
    .done();
