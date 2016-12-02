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
   * @param {Ravel} ravelInstance an instance of a Ravel application
   * @param {String} instanceName the name to alias this Neo4j provider under. 'neo4j' by default.
   */
  constructor(ravelInstance, instanceName = 'neo4j') {
    super(instanceName);

    // required neo4j parameters
    ravelInstance.registerParameter(`${instanceName} options`, true, DEFAULT_OPTIONS);
  }

  prelisten(ravelInstance) {
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

module.exports = Neo4jProvider;
