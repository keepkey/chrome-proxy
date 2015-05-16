var browserify = require('browserify');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var jshint = require('gulp-jshint');
var packageJSON  = require('./package');
var bump = require('gulp-bump');
var zip = require('gulp-zip');
var args = require('yargs').argv;
var yaml = require('gulp-yaml');
var rename = require('gulp-rename');
var del = require('del');
var mocha = require('gulp-mocha');
var replace = require('gulp-replace');
var pbjs = require('gulp-pbjs');

var jshintConfig = packageJSON.jshintConfig;
var versionedFiles = ['manifest.json', 'package.json'];
var environment = args.environment || 'local';
var firmwareFilename = args.firmware || 'bin/keepkey_main.bin';

var fileMetaData2Json = require('./gulp-fileMetaData2Json');

jshintConfig.lookup = false;

gulp.task('build', ['zip']);

gulp.task('clean', function (cb) {
    del(['dist', '*.zip', 'tmp'], cb);
});

gulp.task('buildConfig', function() {
    return gulp.src('config/' + environment + '.json')
        .pipe(rename('config.json'))
        .pipe(gulp.dest('dist'));
});

gulp.task('browserify', ['lint', 'protocolBuffers', 'buildConfig', 'bin2js'], function() {
    return browserify('./src/background.js')
        .bundle()
        .pipe(source('background.js'))
        .pipe(gulp.dest('dist'));
});

gulp.task('lint', function() {
    return gulp.src(['src/**/*.js', 'gulpfile.js'])
        .pipe(jshint(jshintConfig))
        .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('watch', function() {
    return gulp.watch(['src/**/*', 'gulpfile.js', 'package.json', 'manifest.json', 'config'], ['build']);
});

gulp.task('copyAssets', function() {
    return gulp.src('src/images/**/*')
        .pipe(gulp.dest('dist/images'));
});

gulp.task('copyFirmwareImage', function() {
    return gulp.src(firmwareFilename)
        .pipe(gulp.dest('dist'));
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

gulp.task('zip', ['browserify', 'copyAssets', 'copyManifest', 'buildConfig', 'copyFirmwareImage', 'copyHtml'], function() {
    return gulp.src('dist/**/*')
        .pipe(zip('keepkey-proxy-test.zip'))
        .pipe(gulp.dest('.'));
});

gulp.task('copyManifest', function() {
    return gulp.src('manifest.json')
        .pipe(gulp.dest('dist'));
});

gulp.task('copyHtml', ['buildConfig'], function() {
    var config = require('./config/' + environment + '.json');

    return gulp.src('src/*.html')
        .pipe(replace(/\{\{WalletAppId\}\}/g, config.keepkeyWallet.applicationId))
        .pipe(gulp.dest('dist'));
});

gulp.task('test', function () {
    return gulp.src('src/**/*.spec.js', {read: false})
        .pipe(mocha());
});

gulp.task('protocolBuffers', function() {
    return gulp.src('node_modules/device-protocol/messages.proto')
        .pipe(pbjs())
        .pipe(gulp.dest('tmp/keepkey'));
});

gulp.task('bin2js', function() {
    return gulp.src(firmwareFilename)
        .pipe(fileMetaData2Json())
        .pipe(gulp.dest('tmp'));
});

module.exports = gulp;