'use strict';
var Args, coffeelint, coffeelintPlugin, configfinder, createPluginError, formatOutput, fs, isLiterate, reporter, through2;

fs = require('fs');

through2 = require('through2');

Args = require('args-js'); // main entry missing in `args-js` package

coffeelint = require('coffeelint');

configfinder = require('coffeelint/lib/configfinder');

// `reporter`
reporter = require('./lib/reporter');

// common utils
({isLiterate, createPluginError, formatOutput} = require('./lib/utils'));

coffeelintPlugin = function() {
  var e, literate, opt, optFile, params, rules;
  // params for `args-js`
  params = [
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
  ];
  try {
    // parse arguments
    ({opt, optFile, literate, rules} = Args(params, arguments));
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
    var errorReport, fileLiterate, fileOpt, output, results;
    // `file` specific options
    fileOpt = opt;
    fileLiterate = literate;
    results = null;
    output = null;
    // pass along
    if (file.isNull()) {
      this.push(file);
      return cb();
    }
    if (file.isStream()) {
      this.emit('error', createPluginError('Streaming not supported'));
      return cb();
    }
    if (fileOpt === void 0) {
      // if `opt` is not already a JSON `Object`,
      // get config like `coffeelint` cli does.
      fileOpt = configfinder.getConfig(file.path);
    }
    if (fileLiterate === void 0) {
      // if `literate` is not given
      // check for file extension like
      // `coffeelint`cli does.
      fileLiterate = isLiterate(file.path);
    }
    // get results `Array`
    // see http://www.coffeelint.org/#api
    // for format
    errorReport = coffeelint.getErrorReport();
    errorReport.lint(file.relative, file.contents.toString(), fileOpt, fileLiterate);
    output = formatOutput(errorReport, fileOpt, fileLiterate);
    file.coffeelint = output;
    this.push(file);
    return cb();
  });
};

coffeelintPlugin.reporter = reporter;

module.exports = coffeelintPlugin;
