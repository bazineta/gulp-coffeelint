var PluginError;

PluginError = require('plugin-error');

exports.isLiterate = function(file) {
  return /\.(litcoffee|coffee\.md)$/.test(file);
};

exports.createPluginError = function(message) {
  return new PluginError('gulp-coffeelint', message);
};

exports.formatOutput = function(errorReport, opt, literate) {
  var errorCount, warningCount;
  ({errorCount, warningCount} = errorReport.getSummary());
  return {
    // output
    success: errorCount === 0,
    results: errorReport,
    errorCount: errorCount,
    warningCount: warningCount,
    opt: opt,
    literate: literate
  };
};
