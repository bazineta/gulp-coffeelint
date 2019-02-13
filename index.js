//-----------------------------------------------------------------------------#
// Imports
//-----------------------------------------------------------------------------#
var Args, PluginError, coffeelint, createPluginError, failOnWarningReporter, failReporter, formatOutput, fs, getConfig, isLiterate, loadReporter, plugin, reporter, reporterStream, through2;

Args = require('args-js');

PluginError = require('plugin-error');

fs = require('fs');

through2 = require('through2');

coffeelint = require('coffeelint');

({getConfig} = require('coffeelint/lib/configfinder'));

//-----------------------------------------------------------------------------#
// Locals
//-----------------------------------------------------------------------------#
createPluginError = function(message) {
  return new PluginError('gulp-coffeelint', message);
};

isLiterate = function(file) {
  return /\.(litcoffee|coffee\.md)$/.test(file);
};

formatOutput = function(errorReport, opt, literate) {
  var errorCount, warningCount;
  ({errorCount, warningCount} = errorReport.getSummary());
  return {
    errorCount,
    warningCount,
    opt,
    literate,
    success: errorCount === 0,
    results: errorReport
  };
};

reporterStream = function(reporterType) {
  return through2.obj(function(file, enc, cb) {
    var c, ref;
    c = file.coffeelint;
    // nothing to report or no errors AND no warnings
    if (!c || (c.errorCount === (ref = c.warningCount) && ref === 0)) {
      this.push(file);
      return cb();
    }
    // report
    new reporterType(file.coffeelint.results).publish();
    // pass along
    this.push(file);
    return cb();
  });
};

failReporter = function() {
  return through2.obj(function(file, enc, cb) {
    // nothing to report or no errors
    if (!file.coffeelint || file.coffeelint.success) {
      this.push(file);
      return cb();
    }
    // fail
    this.emit('error', createPluginError(`CoffeeLint failed for ${file.relative}`));
    return cb();
  });
};

failOnWarningReporter = function() {
  return through2.obj(function(file, enc, cb) {
    var c, ref;
    c = file.coffeelint;
    // nothing to report or no errors AND no warnings
    if (!c || (c.errorCount === (ref = c.warningCount) && ref === 0)) {
      this.push(file);
      return cb();
    }
    // fail
    this.emit('error', createPluginError(`CoffeeLint failed for ${file.relative}`));
    return cb();
  });
};

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
    var errorReport, fileLiterate, fileOpt;
    // `file` specific options
    fileOpt = opt;
    fileLiterate = literate;
    // pass along
    if (file.isNull()) {
      this.push(file);
      return cb();
    }
    if (file.isStream()) {
      this.emit('error', createPluginError('Streaming not supported'));
      return cb();
    }
    // if `opt` is not already a JSON `Object`,
    // get config like `coffeelint` cli does.
    if (fileOpt == null) {
      fileOpt = getConfig(file.path);
    }
    // if `literate` is not given
    // check for file extension like
    // `coffeelint`cli does.
    if (fileLiterate == null) {
      fileLiterate = isLiterate(file.path);
    }
    // get results `Array`
    // see http://www.coffeelint.org/#api
    // for format
    errorReport = coffeelint.getErrorReport();
    errorReport.lint(file.relative, file.contents.toString(), fileOpt, fileLiterate);
    file.coffeelint = formatOutput(errorReport, fileOpt, fileLiterate);
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
