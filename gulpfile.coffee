coffee = require 'gulp-coffee'
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
    return src './{,lib/}*.coffee'
        .pipe lint()
        .pipe lint.reporter()

# development

develop = -> watch ['./{,lib/,test/,test/fixtures/}*{.coffee,.json}'], test

exports.default    = series compile, develop
exports.test       = series compile, test
exports.clean      = clean
exports.coffee     = compile
exports.coffeelint = coffeelint
