//-----------------------------------------------------------------------------#
// Imports
//-----------------------------------------------------------------------------#
var Args, PluginError, coffeelint, createPluginError, failOnWarningReporter, failReporter, failTest, fs, getConfig, isLiterate, loadReporter, plugin, reporterStream, through;

Args = require('args-js');

PluginError = require('plugin-error');

fs = require('fs');

through = require('through2');

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
  } catch (error1) {}
  try {
    return require(type);
  } catch (error1) {}
  throw createPluginError(`${type} is not a valid reporter`);
};

//-----------------------------------------------------------------------------#
// Given a type of reporter loaded by loadReporter(), return a reporter
// stream that reports if there were errors or warnings.
//-----------------------------------------------------------------------------#
reporterStream = function(reporterType) {
  return through.obj(function(file, enc, cb) {
    var lint, ref;
    lint = file.coffeelint;
    if (!lint || (lint.errorCount === (ref = lint.warningCount) && ref === 0)) {
      this.push(file);
      return cb();
    }
    new reporterType(lint.results).publish();
    this.push(file);
    return cb();
  });
};

//-----------------------------------------------------------------------------#
// Common bound function for the fail and failOnWarning reporters that follow;
// if there's no lint for the provided file or there is lint but the provided
// test is willing to call it good, then push the file and move on, otherwise
// emit an error for the file.
//-----------------------------------------------------------------------------#
failTest = function(file, cb, test) {
  var lint;
  if (!(lint = file.coffeelint) || test(lint)) {
    this.push(file);
  } else {
    this.emit('error', createPluginError(`CoffeeLint failed for ${file.relative}`));
  }
  return cb();
};

//-----------------------------------------------------------------------------#
// Return a reporter stream that reports only on errors.
//-----------------------------------------------------------------------------#
failReporter = function() {
  return through.obj(function(file, enc, cb) {
    return failTest.bind(this)(file, cb, function(lint) {
      return lint.success;
    });
  });
};

//-----------------------------------------------------------------------------#
// Return a reporter stream that reports on errors or warnings.
//-----------------------------------------------------------------------------#
failOnWarningReporter = function() {
  return through.obj(function(file, enc, cb) {
    return failTest.bind(this)(file, cb, function(lint) {
      return (lint.errorCount === 0) && (lint.warningCount === 0);
    });
  });
};

//-----------------------------------------------------------------------------#
// Plugin
//-----------------------------------------------------------------------------#
plugin = function() {
  var error, literate, opt, optFile, rules;
  try {
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
  } catch (error1) {
    // istanbul ignore next
    error = error1;
    // istanbul ignore next
    throw createPluginError(error);
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
    } catch (error1) {
      error = error1;
      throw createPluginError(`Could not load config from file: ${error}`);
    }
  }
  return through.obj(function(file, enc, cb) {
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

//-----------------------------------------------------------------------------#
// Return a reporter stream for the type requested. Can be one of 'fail',
// 'failOnWarning', one of the standard reporter types, e.g., 'raw', 'csv',
// etc., or a custom reporter, e.g., 'coffeelint-stylish'. If no type is
// provided, 'coffeelint-stylish' will be used.
//-----------------------------------------------------------------------------#
plugin.reporter = function(type) {
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
// Exports
//-----------------------------------------------------------------------------#
module.exports = plugin;

//-----------------------------------------------------------------------------#
