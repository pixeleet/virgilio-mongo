var Virgilio = require('virgilio');
var options = {
    mongo: {
        dbName: 'bsos'
    }
};
var virgilio = new Virgilio(options);
virgilio.loadModule(require('./lib/virgilio-mongo'));

virgilio.execute('mongo.query', {
    from: 'people',
    where: [
        ['nationality', '==', 'dutch']
    ],
    select: ['name']
})
.then(function(response) {
    console.log('RESPONSE');
    console.log(response);
    process.exit();
})
.done();

// virgilio.execute('mongo.query', {
//     into: 'frameworks',
//     insert: [
//         { name: 'virgilio', state: 'awesome' }
//     ]
// })
// .then(function(response) {
//     console.log('RESPONSE');
//     console.log(response);
// })
// .done();



// //1
// virgilio.mongo
//     .from('people')
//     .where('nationality', '==', 'italian')
//     .orderBy('name')
//     .select('name')
//     .then(function(italians) {
//         console.log(italians); //Gabriele, Luca, Valerio
//     });

// //2
// virgilio.execute('mongo', {
//     from: 'people',
//     where: ['nationality', '==', 'italian'],
//     select: 'name',
//     orderBy: 'name'
// });

// //3
// var db = {}; //Mongo client created using NPM mongo-db
// var query = {
//     fields: ['name'],
//     sort: ['name']
// };

// db.collectionAsync('people')
//     .call('findAsync', query)
//     .call('toArrayAsync');
