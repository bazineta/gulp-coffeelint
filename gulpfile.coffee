#-----------------------------------------------------------------------------#
#
#  gulp-coffeelint Gulp configuration
#
#  Valid Targets:
#  -------------
#
#    default    - Compiles to Javascript and watches for changes; runs the
#                 test suite after any change.
#
#    test       - Compiles to Javascripot and runs the test suite once.
#
#    clean      - Removes the compiled Javascript and coverage output.
#
#    coffee     - Compiles to Javascript.
#
#    coffeelint - Lints the linter with itself. So meta....
#
#-----------------------------------------------------------------------------#

#-----------------------------------------------------------------------------#
# Imports
#-----------------------------------------------------------------------------#

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

#-----------------------------------------------------------------------------#
# Compile the linter to Javascript.
#-----------------------------------------------------------------------------#

compile = ->
    return src 'index.coffee'
        .pipe coffee bare: true
        .pipe dest './'

#-----------------------------------------------------------------------------#
# Delete the compiled Javascript and coverage output.
#-----------------------------------------------------------------------------#

clean = -> del ['index.js', 'coverage']

#-----------------------------------------------------------------------------#
# Run the test suite.
#-----------------------------------------------------------------------------#

test = -> spawn 'npm', ['test'], stdio: 'inherit'

#-----------------------------------------------------------------------------#
# Use the linter to lint the linter.
#-----------------------------------------------------------------------------#

coffeelint = ->
    return src 'index.coffee'
        .pipe lint()
        .pipe lint.reporter()

#-----------------------------------------------------------------------------#
# Watch for changes and run the test suite if anything changes.
#-----------------------------------------------------------------------------#

develop = -> watch ['./{,test/,test/fixtures/}*{.coffee,.json}'], test

#-----------------------------------------------------------------------------#
# Exports
#-----------------------------------------------------------------------------#

exports.default    = series compile, develop
exports.test       = series compile, test
exports.clean      = clean
exports.coffee     = compile
exports.coffeelint = coffeelint

#-----------------------------------------------------------------------------#
