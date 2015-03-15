var gulp = require('gulp');
var mocha = require('gulp-mocha');
var docco = require('gulp-docco');
var istanbul = require('gulp-istanbul');
var exit = require('gulp-exit');
var eslint = require('gulp-eslint');

// Help module
require('gulp-help')(gulp);

gulp.task('test', 'Run the application tests', function () {
    // Modules used in tests must be loaded in this task
    // var must = require('must');
    gulp.src(['./examples/**/test.js'])
        .pipe(mocha({
            reporter: 'spec'
        }))
        .pipe(exit());
});

gulp.task('coverage', 'Create istanbul code coverage report form tests', function (cb) {
    gulp.src(['lib/**/*.js', 'index.js'])
        .pipe(istanbul())
        .on('finish', function () {
            // var must = require('must');
            gulp.src(['./examples/**/*.test.js', './tests/**/*.test.js'])
                .pipe(mocha())
                .pipe(istanbul.writeReports())
                .on('end', cb);
        });
});

gulp.task('docs', 'Build the documentation', function () {
    gulp.src(['lib/virgilio-mongo.js'])
        .pipe(docco())
        .pipe(gulp.dest('./docs'));
});

gulp.task('lint', 'Lint all js files.', function() {
    return gulp.src([
        './**/*.js',
        '!./node_modules/**/*.js',
        '!./coverage/**/*.js',
        '!./report/**/*.js'
    ])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failOnError());
});
