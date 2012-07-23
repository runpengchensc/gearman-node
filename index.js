require('coffee-script');

if (process.env.COV_GEARMAN) {
  module.exports = {
    Gearman: require('./lib-js-cov/gearman'),
    Client: require('./lib-js-cov/client'),
    Worker: require('./lib-js-cov/worker')
  };
} else {
  module.exports = {
    Gearman: require('./lib/gearman'),
    Client: require('./lib/client'),
    Worker: require('./lib/worker')
  };
}