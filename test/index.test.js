const
  should = require('should'),
  sinon = require('sinon');

describe('#Testing index file', () => {
  let
    sandbox;

  before(() => {
    sandbox = sinon.sandbox.create();
  });

  beforeEach(() => {
    sandbox.reset();
  });

  it('should ...', done => {
    done();
  });
});
