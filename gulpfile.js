var browserify = require('browserify');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var jshint = require('gulp-jshint');
var packageJSON  = require('./package');
var bump = require('gulp-bump');
var zip = require('gulp-zip');

var jshintConfig = packageJSON.jshintConfig;
var versionedFiles = ['manifest.json', 'package.json'];

jshintConfig.lookup = false;

gulp.task('build', ['lint', 'browserify', 'copyAssets', 'copyManifest', 'zip']);

gulp.task('browserify', function() {
    return browserify('./src/background.js')
        .bundle()
        .pipe(source('background.js'))
        .pipe(gulp.dest('./dist/'));
});

gulp.task('lint', function() {
    return gulp.src(['src/**/*.js', 'gulpfile.js'])
        .pipe(jshint(jshintConfig))
        .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('watch', function() {
    return gulp.watch(['src/**/*.js', 'gulpfile.js', 'package.json'], ['build']);
});

gulp.task('copyAssets', function() {
    return gulp.src('src/images/**/*')
        .pipe(gulp.dest('dist/images'));
});

gulp.task('bumpPatch', function () {
    return gulp.src(versionedFiles)
        .pipe(bump({type: 'patch'}))
        .pipe(gulp.dest('./'));
});

gulp.task('bumpMinor', function () {
    return gulp.src(versionedFiles)
        .pipe(bump({type: 'minor'}))
        .pipe(gulp.dest('./'));
});

gulp.task('bumpMajor', function () {
    return gulp.src(versionedFiles)
        .pipe(bump({type: 'major'}))
        .pipe(gulp.dest('./'));
});

gulp.task('zip', function() {
    return gulp.src('dist/**/*')
        .pipe(zip('keepkey-proxy-test.zip'))
        .pipe(gulp.dest('.'));
});

gulp.task('copyManifest', function() {
    return gulp.src('manifest.json')
        .pipe(gulp.dest('dist'));
});


