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
# Locals
#-----------------------------------------------------------------------------#

createPluginError = (message) -> new PluginError 'gulp-coffeelint', message

isLiterate = (file) -> /\.(litcoffee|coffee\.md)$/.test file

formatOutput = (errorReport, opt, literate) ->

    {errorCount, warningCount} = errorReport.getSummary()

    return {
        errorCount
        warningCount
        opt
        literate
        success: errorCount is 0
        results: errorReport
    }

reporterStream = (reporterType) ->
    return through2.obj (file, enc, cb) ->
        c = file.coffeelint
        # nothing to report or no errors AND no warnings
        if not c or c.errorCount is c.warningCount is 0
            @push file
            return cb()

        # report
        new reporterType(file.coffeelint.results).publish()

        # pass along
        @push file
        cb()

failReporter = ->
    return through2.obj (file, enc, cb) ->
        # nothing to report or no errors
        if not file.coffeelint or file.coffeelint.success
            @push file
            return cb()

        # fail
        @emit 'error', createPluginError "CoffeeLint failed for #{file.relative}"
        cb()

failOnWarningReporter = ->
    return through2.obj (file, enc, cb) ->
        c = file.coffeelint
        # nothing to report or no errors AND no warnings
        if not c or c.errorCount is c.warningCount is 0
            @push file
            return cb()

        # fail
        @emit 'error', createPluginError "CoffeeLint failed for #{file.relative}"
        cb()

loadReporter = (type) ->

    return type if typeof type is 'function'

    type ?= 'coffeelint-stylish'

    try return require "coffeelint/lib/reporters/#{type}"
    try return require type

    return throw createPluginError "#{type} is not a valid reporter"

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
        # `file` specific options
        fileOpt      = opt
        fileLiterate = literate

        # pass along
        if file.isNull()
            @push file
            return cb()

        if file.isStream()
            @emit 'error', createPluginError 'Streaming not supported'
            return cb()

        # if `opt` is not already a JSON `Object`,
        # get config like `coffeelint` cli does.
        fileOpt ?= getConfig file.path

        # if `literate` is not given
        # check for file extension like
        # `coffeelint`cli does.
        fileLiterate ?= isLiterate file.path

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

        file.coffeelint = formatOutput errorReport, fileOpt, fileLiterate

        @push file
        cb()

plugin.reporter = reporter

#-----------------------------------------------------------------------------#
# Exports
#-----------------------------------------------------------------------------#

module.exports = plugin

#-----------------------------------------------------------------------------#
