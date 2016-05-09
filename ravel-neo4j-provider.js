'use strict';

const Agent = require('http').Agent;
const neo4j = require('neo4j');
const Ravel = require('ravel');

/**
 * Default options for neo4j
 */
const DEFAULT_OPTIONS = {
  name: 'neo4j',
  url: 'http://localhost:7474',
  auth: {username: 'neo4j', password: 'neo4j'},
  agent: {}
};

/**
 * A Ravel DatabaseProvider for Neo4j
 */
class Neo4jProvider extends Ravel.DatabaseProvider {
  /**
   * @param ${String} instanceName the name to alias this Neo4j provider under. 'neo4j' by default.
   */
  constructor(instanceName) {
    super(instanceName);
  }

  start(ravelInstance) {
    // overlay user options onto defaults
    const ops = {};
    Object.assign(ops, DEFAULT_OPTIONS);
    Object.assign(ops, ravelInstance.get(`${this.name} options`));
    ops.agent = new Agent(ops.agent);
    this.neoDb = new neo4j.GraphDatabase(ops);
  }

  getTransactionConnection() {
    return new Promise(function(resolve) { 
      resolve(this.neoDb.beginTransaction());
    });
  }

  exitTransaction(connection, shouldCommit) {
    const log = this.log;
    return new Promise(function(resolve, reject) {
      if (!shouldCommit) {
        connection.rollback(function(rollbackErr) {
          if (rollbackErr) {
            reject(rollbackErr);
          } else  {
            resolve();
          }
        });
      } else {
        connection.commit(function(commitErr) {
          if (commitErr) {
            connection.rollback(function(rollbackErr) {
              log.error(commitErr);
              reject(rollbackErr?rollbackErr:commitErr);
            });
          } else {
            resolve();
          }
        });
      }
    });
  }
}

/**
 * Add a new Neo4jProvider to a Ravel instance
 * More than one can be used at the same time, via the instance argument
 * @param {Object} ravelInstance a reference to a Ravel instance
 * @param {String | undefined} a unique name for this Neo4jProvider, if you intend to use more than one simultaneously
 *
 */
module.exports = function(ravelInstance, name) {
  const instance = name ? name.trim() : 'neo4j';
  const neo4jProvider = new Neo4jProvider(instance);
  // register neo4j as a database provider
  const providers = ravelInstance.get('database providers');
  providers.push(neo4jProvider);
  ravelInstance.set('database providers', providers);

  // required neo4j parameters
  ravelInstance.registerSimpleParameter(`${instance} options`, true, DEFAULT_OPTIONS);

  ravelInstance.once('pre listen', () => {
    ravelInstance.log.debug(`Using neo4j database provider, alias: ${instance}`);
    try {
      neo4jProvider.start(ravelInstance);
    } catch (err) {
      // EventEmitter swallows error otherwise
      console.error(err.stack);
      process.exit(1);
    }
  });
};
