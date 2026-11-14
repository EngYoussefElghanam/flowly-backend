const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

process.env.JWT_SECRET = 'local-test-secret-not-for-deployment';
const app = require('../app');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(
  () =>
    new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    ),
);

test('app can serve its root without a database connection', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: 'Seller App Backend is Running!',
  });
});

test('all protected route groups reject unauthenticated requests', async () => {
  const routes = [
    ['GET', '/api/products'],
    ['POST', '/api/products'],
    ['PUT', '/api/products/1'],
    ['DELETE', '/api/products/1'],
    ['GET', '/api/orders'],
    ['POST', '/api/orders'],
    ['GET', '/api/orders/1'],
    ['PATCH', '/api/orders/1'],
    ['GET', '/api/customers'],
    ['POST', '/api/customers'],
    ['GET', '/api/customers/1'],
    ['GET', '/api/customers/1/stats'],
    ['GET', '/api/dashboard'],
    ['GET', '/api/settings'],
    ['PUT', '/api/settings'],
    ['POST', '/api/signup/invite'],
    ['GET', '/api/users/employees'],
    ['DELETE', '/api/users/1'],
    ['GET', '/marketing/opportunities'],
    ['POST', '/marketing/action/1'],
  ];
  for (const [method, path] of routes) {
    const response = await fetch(baseUrl + path, { method });
    assert.equal(response.status, 401, `${method} ${path}`);
    await response.arrayBuffer();
  }
});

test('invalid and expired JWTs are rejected', async () => {
  const expired = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, {
    expiresIn: -1,
  });
  for (const token of ['invalid-token', expired]) {
    const response = await fetch(baseUrl + '/api/products', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 401);
    await response.arrayBuffer();
  }
});

test('settings database failures return JSON instead of a ReferenceError', async (t) => {
  t.mock.method(User, 'findByPk', async () => {
    throw new Error('simulated database failure');
  });
  t.mock.method(console, 'error', () => {});
  const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
  const response = await fetch(baseUrl + '/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    message: 'Failed to fetch settings',
  });
});
