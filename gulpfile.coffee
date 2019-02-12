'use strict'

coffee = require 'gulp-coffee'
colors = require 'ansi-colors'
del    = require 'del'
lint   = require './index.coffee'
{
    src,
    dest,
    series,
    watch
} = require 'gulp'
{
    spawn
} = require 'child_process'

# compile `index.coffee` and `lib/*.coffee` files

compile = ->
    return src ['{,lib/}*.coffee', '!gulpfile.coffee']
        .pipe coffee bare: true
        .pipe dest './'

# remove `index.js`, `lib/*.js` and `coverage` dir

clean = -> del ['index.js', 'lib/*.js', 'coverage']

# run tests

test = -> spawn 'npm', ['test'], stdio: 'inherit'

# run `gulp-coffeelint` for testing purposes

coffeelint = ->
    return src './{,lib/,test/,test/fixtures/}*.coffee'
        .pipe lint()
        .pipe lint.reporter()

# dev

dev = -> watch ['./{,lib/,test/,test/fixtures/}*{.coffee,.json}'], test

exports.default    = series compile, dev
exports.test       = series compile, test
exports.clean      = clean
exports.coffee     = compile
exports.coffeelint = coffeelint
