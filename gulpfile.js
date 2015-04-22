var browserify = require('browserify');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var jshint = require('gulp-jshint');
var packageJSON  = require('./package');
var jshintConfig = packageJSON.jshintConfig;

jshintConfig.lookup = false;

gulp.task('browserify', function() {
    return browserify('./src/background.js')
        .bundle()
        .pipe(source('background.js'))
        .pipe(gulp.dest('./build/'));
});

gulp.task('lint', function() {
    return gulp.src(['src/**/*.js', 'gulpfile.js'])
        .pipe(jshint(jshintConfig))
        .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('watch', function() {
    return gulp.watch(['src/**/*.js', 'gulpfile.js', 'package.json'], ['lint', 'browserify']);
});
