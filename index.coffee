#-----------------------------------------------------------------------------#
# Imports
#-----------------------------------------------------------------------------#

Args        = require 'args-js'
PluginError = require 'plugin-error'
fs          = require 'fs'
through2    = require 'through2'
coffeelint  = require 'coffeelint'
{getConfig} = require 'coffeelint/lib/configfinder'

#-----------------------------------------------------------------------------#
# Create and return a plugin error specific to this plugin. Might be thrown,
# might be emitted, depending on the circumstances.
#-----------------------------------------------------------------------------#

createPluginError = (message) -> new PluginError 'gulp-coffeelint', message

#-----------------------------------------------------------------------------#
# Return true if the provided file looks like it's a literate type, false
# otherwise.
#-----------------------------------------------------------------------------#

isLiterate = (file) -> /\.(litcoffee|coffee\.md)$/.test file

#-----------------------------------------------------------------------------#
# Attempt to load and return the requested type of reporter. Can be a short
# name, e.g., 'raw', describing one of the standard coffeeelint reporters,
# or can be the name of a custom reporter. If a type isn't specified, then
# attempt to use the stylish reporter. Throws if despite our best attempts,
# we couldn't load the type of reporter requested.
#-----------------------------------------------------------------------------#

loadReporter = (type) ->

    return type if typeof type is 'function'

    type ?= 'coffeelint-stylish'

    try return require "coffeelint/lib/reporters/#{type}"
    try return require type

    return throw createPluginError "#{type} is not a valid reporter"

#-----------------------------------------------------------------------------#
# Given a type of reporter loaded by loadReporter(), return a reporter
# stream that reports if there were errors or warnings.
#-----------------------------------------------------------------------------#

reporterStream = (reporterType) ->
    return through2.obj (file, enc, cb) ->
        c = file.coffeelint
        if not c or c.errorCount is c.warningCount is 0
            @push file
            return cb()
        new reporterType(file.coffeelint.results).publish()
        @push file
        cb()

#-----------------------------------------------------------------------------#
# Return a reporter stream that reports only on errors.
#-----------------------------------------------------------------------------#

failReporter = ->
    return through2.obj (file, enc, cb) ->
        if not file.coffeelint or file.coffeelint.success
            @push file
            return cb()
        @emit 'error', createPluginError "CoffeeLint failed for #{file.relative}"
        cb()

#-----------------------------------------------------------------------------#
# Return a reporter stream that reports on errors or warnings.
#-----------------------------------------------------------------------------#

failOnWarningReporter = ->
    return through2.obj (file, enc, cb) ->
        c = file.coffeelint
        if not c or c.errorCount is c.warningCount is 0
            @push file
            return cb()
        @emit 'error', createPluginError "CoffeeLint failed for #{file.relative}"
        cb()

#-----------------------------------------------------------------------------#
# Return a reporter stream for the type requested. Can be one of 'fail',
# 'failOnWarning', one of the standard reporter types, e.g., 'raw', 'csv',
# etc., or a custom reporter, e.g., 'coffeelint-stylish'. If no type is
# provided, 'coffeelint-stylish' will be used.
#-----------------------------------------------------------------------------#

reporter = (type) ->
    return switch type
        when 'fail'          then failReporter()
        when 'failOnWarning' then failOnWarningReporter()
        else                      reporterStream loadReporter type

#-----------------------------------------------------------------------------#
# Plugin
#-----------------------------------------------------------------------------#

plugin = ->

    # parse arguments
    try
        {opt, optFile, literate, rules} = Args [
            {optFile:  Args.STRING | Args.Optional}
            {opt:      Args.OBJECT | Args.Optional}
            {literate: Args.BOOL   | Args.Optional}
            {rules:    Args.ARRAY  | Args.Optional, _default: []}
        ], arguments
    catch e
        throw createPluginError e

    # sadly an `Args.OBJECT` maybe an `Array`
    # e.g. `coffeelintPlugin [-> myCustomRule]`
    if Array.isArray opt
        rules = opt
        opt   = undefined

    # register custom rules
    rules.map (rule) ->
        if typeof rule isnt 'function'
            throw createPluginError(
                "Custom rules need to be of type function, not #{typeof rule}"
            )
        coffeelint.registerRule rule

    if toString.call(optFile) is '[object String]'
        try
            opt = JSON.parse fs.readFileSync(optFile).toString()
        catch e
            throw createPluginError "Could not load config from file: #{e}"

    through2.obj (file, enc, cb) ->

        if file.isNull()
            @push file
            return cb()

        if file.isStream()
            @emit 'error', createPluginError 'Streaming not supported'
            return cb()

        fileOpt      = getConfig  file.path unless (fileOpt      = opt     )?
        fileLiterate = isLiterate file.path unless (fileLiterate = literate)?

        # get results `Array`
        # see http://www.coffeelint.org/#api
        # for format

        errorReport = coffeelint.getErrorReport()
        errorReport.lint(
            file.relative,
            file.contents.toString(),
            fileOpt,
            fileLiterate
        )
        summary = errorReport.getSummary()

        file.coffeelint =
            results:      errorReport
            success:      summary.errorCount is 0
            errorCount:   summary.errorCount
            warningCount: summary.warningCount
            opt:          fileOpt
            literate:     fileLiterate

        @push file
        cb()

plugin.reporter = reporter

#-----------------------------------------------------------------------------#
# Exports
#-----------------------------------------------------------------------------#

module.exports = plugin

#-----------------------------------------------------------------------------#
