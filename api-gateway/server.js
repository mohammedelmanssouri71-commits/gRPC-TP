const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// ─── Auth Middleware ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.headers['x-api-key'] !== 'secret-key-123')
    return res.status(401).json({ error: 'API Key invalide' });
  next();
});

// ─── URLs internes des services (REST) ───────────────────────────────────────
const SERVICES = {
  user:   'http://localhost:3001',
  movie:  'http://localhost:3002',
  review: 'http://localhost:3000',
};

// ─── Helper : forwarder une requête REST vers un service interne ──────────────
async function forward(res, url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(503).json({ error: `Service indisponible : ${err.message}` });
  }
}

// ─── ROUTES USERS ─────────────────────────────────────────────────────────────

// GET /api/users → GET http://localhost:3001/users
app.get('/api/users', (req, res) => {
  forward(res, `${SERVICES.user}/users`);
});

// GET /api/users/:id → GET http://localhost:3001/users/:id
app.get('/api/users/:id', (req, res) => {
  forward(res, `${SERVICES.user}/users/${req.params.id}`);
});

// POST /api/users → POST http://localhost:3001/users
app.post('/api/users', (req, res) => {
  forward(res, `${SERVICES.user}/users`, {
    method: 'POST',
    body: JSON.stringify(req.body),
  });
});

// ─── ROUTES MOVIES ────────────────────────────────────────────────────────────

// GET /api/movies → GET http://localhost:3002/movies
app.get('/api/movies', (req, res) => {
  forward(res, `${SERVICES.movie}/movies`);
});

// GET /api/movies/:id → GET http://localhost:3002/movies/:id
app.get('/api/movies/:id', (req, res) => {
  forward(res, `${SERVICES.movie}/movies/${req.params.id}`);
});

// POST /api/movies → POST http://localhost:3002/movies
app.post('/api/movies', (req, res) => {
  forward(res, `${SERVICES.movie}/movies`, {
    method: 'POST',
    body: JSON.stringify(req.body),
  });
});

// ─── ROUTES REVIEWS ───────────────────────────────────────────────────────────

// GET /api/reviews → GET http://localhost:3000/reviews
app.get('/api/reviews', (req, res) => {
  forward(res, `${SERVICES.review}/reviews`);
});

// POST /api/reviews → POST http://localhost:3000/reviews
app.post('/api/reviews', (req, res) => {
  forward(res, `${SERVICES.review}/reviews`, {
    method: 'POST',
    body: JSON.stringify(req.body),
  });
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', gateway: 'running' }));

app.listen(8080, () => console.log('✅ API Gateway démarré sur http://localhost:8080'));
