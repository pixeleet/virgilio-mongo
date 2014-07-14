var Virgilio = require('virgilio');
var virgilio = new Virgilio();
virgilio.loadModule(require('./lib/virgilio-mongo'));



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
