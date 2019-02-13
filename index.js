//-----------------------------------------------------------------------------#
// Imports
//-----------------------------------------------------------------------------#
var Args, PluginError, coffeelint, createPluginError, failOnWarningReporter, failReporter, fs, getConfig, isLiterate, loadReporter, plugin, reporter, reporterStream, through2;

Args = require('args-js');

PluginError = require('plugin-error');

fs = require('fs');

through2 = require('through2');

coffeelint = require('coffeelint');

({getConfig} = require('coffeelint/lib/configfinder'));

//-----------------------------------------------------------------------------#
// Create and return a plugin error specific to this plugin. Might be thrown,
// might be emitted, depending on the circumstances.
//-----------------------------------------------------------------------------#
createPluginError = function(message) {
  return new PluginError('gulp-coffeelint', message);
};

//-----------------------------------------------------------------------------#
// Return true if the provided file looks like it's a literate type, false
// otherwise.
//-----------------------------------------------------------------------------#
isLiterate = function(file) {
  return /\.(litcoffee|coffee\.md)$/.test(file);
};

//-----------------------------------------------------------------------------#
// Attempt to load and return the requested type of reporter. Can be a short
// name, e.g., 'raw', describing one of the standard coffeeelint reporters,
// or can be the name of a custom reporter. If a type isn't specified, then
// attempt to use the stylish reporter. Throws if despite our best attempts,
// we couldn't load the type of reporter requested.
//-----------------------------------------------------------------------------#
loadReporter = function(type) {
  if (typeof type === 'function') {
    return type;
  }
  if (type == null) {
    type = 'coffeelint-stylish';
  }
  try {
    return require(`coffeelint/lib/reporters/${type}`);
  } catch (error) {}
  try {
    return require(type);
  } catch (error) {}
  throw createPluginError(`${type} is not a valid reporter`);
};

//-----------------------------------------------------------------------------#
// Given a type of reporter loaded by loadReporter(), return a reporter
// stream that reports if there were errors or warnings.
//-----------------------------------------------------------------------------#
reporterStream = function(reporterType) {
  return through2.obj(function(file, enc, cb) {
    var c, ref;
    c = file.coffeelint;
    if (!c || (c.errorCount === (ref = c.warningCount) && ref === 0)) {
      this.push(file);
      return cb();
    }
    new reporterType(file.coffeelint.results).publish();
    this.push(file);
    return cb();
  });
};

//-----------------------------------------------------------------------------#
// Return a reporter stream that reports only on errors.
//-----------------------------------------------------------------------------#
failReporter = function() {
  return through2.obj(function(file, enc, cb) {
    if (!file.coffeelint || file.coffeelint.success) {
      this.push(file);
      return cb();
    }
    this.emit('error', createPluginError(`CoffeeLint failed for ${file.relative}`));
    return cb();
  });
};

//-----------------------------------------------------------------------------#
// Return a reporter stream that reports on errors or warnings.
//-----------------------------------------------------------------------------#
failOnWarningReporter = function() {
  return through2.obj(function(file, enc, cb) {
    var c, ref;
    c = file.coffeelint;
    if (!c || (c.errorCount === (ref = c.warningCount) && ref === 0)) {
      this.push(file);
      return cb();
    }
    this.emit('error', createPluginError(`CoffeeLint failed for ${file.relative}`));
    return cb();
  });
};

//-----------------------------------------------------------------------------#
// Return a reporter stream for the type requested. Can be one of 'fail',
// 'failOnWarning', one of the standard reporter types, e.g., 'raw', 'csv',
// etc., or a custom reporter, e.g., 'coffeelint-stylish'. If no type is
// provided, 'coffeelint-stylish' will be used.
//-----------------------------------------------------------------------------#
reporter = function(type) {
  switch (type) {
    case 'fail':
      return failReporter();
    case 'failOnWarning':
      return failOnWarningReporter();
    default:
      return reporterStream(loadReporter(type));
  }
};

//-----------------------------------------------------------------------------#
// Plugin
//-----------------------------------------------------------------------------#
plugin = function() {
  var e, literate, opt, optFile, rules;
  try {
    // parse arguments
    ({opt, optFile, literate, rules} = Args([
      {
        optFile: Args.STRING | Args.Optional
      },
      {
        opt: Args.OBJECT | Args.Optional
      },
      {
        literate: Args.BOOL | Args.Optional
      },
      {
        rules: Args.ARRAY | Args.Optional,
        _default: []
      }
    ], arguments));
  } catch (error) {
    e = error;
    throw createPluginError(e);
  }
  // sadly an `Args.OBJECT` maybe an `Array`
  // e.g. `coffeelintPlugin [-> myCustomRule]`
  if (Array.isArray(opt)) {
    rules = opt;
    opt = void 0;
  }
  // register custom rules
  rules.map(function(rule) {
    if (typeof rule !== 'function') {
      throw createPluginError(`Custom rules need to be of type function, not ${typeof rule}`);
    }
    return coffeelint.registerRule(rule);
  });
  if (toString.call(optFile) === '[object String]') {
    try {
      opt = JSON.parse(fs.readFileSync(optFile).toString());
    } catch (error) {
      e = error;
      throw createPluginError(`Could not load config from file: ${e}`);
    }
  }
  return through2.obj(function(file, enc, cb) {
    var errorReport, fileLiterate, fileOpt, summary;
    if (file.isNull()) {
      this.push(file);
      return cb();
    }
    if (file.isStream()) {
      this.emit('error', createPluginError('Streaming not supported'));
      return cb();
    }
    if ((fileOpt = opt) == null) {
      fileOpt = getConfig(file.path);
    }
    if ((fileLiterate = literate) == null) {
      fileLiterate = isLiterate(file.path);
    }
    // get results `Array`
    // see http://www.coffeelint.org/#api
    // for format
    errorReport = coffeelint.getErrorReport();
    errorReport.lint(file.relative, file.contents.toString(), fileOpt, fileLiterate);
    summary = errorReport.getSummary();
    file.coffeelint = {
      results: errorReport,
      success: summary.errorCount === 0,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
      opt: fileOpt,
      literate: fileLiterate
    };
    this.push(file);
    return cb();
  });
};

plugin.reporter = reporter;

//-----------------------------------------------------------------------------#
// Exports
//-----------------------------------------------------------------------------#
module.exports = plugin;

//-----------------------------------------------------------------------------#
