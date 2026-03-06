const express = require('express');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const crypto = require('crypto');

const app = express();

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-me';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173';
const ALLOWED_ORIGINS = new Set(
  CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
);
const JWT_EXPIRES_IN_SECONDS = 2 * 60 * 60;

app.use(morgan('dev'));
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const allowOrigin = requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)
    ? requestOrigin
    : null;

  if (allowOrigin) {
    res.header('Access-Control-Allow-Origin', allowOrigin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

const DEMO_USER = {
  username: process.env.DEMO_USERNAME || 'admin',
  password: process.env.DEMO_PASSWORD || 'admin123',
  role: 'admin',
};

const SERVICES = {
  user: 'http://localhost:3001',
  movie: 'http://localhost:3002',
  review: 'http://localhost:3000',
};

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function signJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyJwt(token) {
  const [encodedHeader, encodedPayload, signature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !signature) throw new Error('Malformed token');

  const data = `${encodedHeader}.${encodedPayload}`;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');

  if (signature !== expected) throw new Error('Invalid signature');

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('Token expired');

  return payload;
}

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token JWT manquant' });
  }

  try {
    req.user = verifyJwt(token);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token JWT invalide ou expiré' });
  }
}

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

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (username !== DEMO_USER.username || password !== DEMO_USER.password) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: DEMO_USER.username,
    role: DEMO_USER.role,
    iat: now,
    exp: now + JWT_EXPIRES_IN_SECONDS,
  };

  const token = signJwt(payload);

  return res.json({
    token,
    user: {
      username: DEMO_USER.username,
      role: DEMO_USER.role,
    },
    expiresIn: JWT_EXPIRES_IN_SECONDS,
  });
});

app.get('/auth/me', authenticateJWT, (req, res) => {
  res.json({ user: { username: req.user.sub, role: req.user.role } });
});

app.use('/api', authenticateJWT);

app.get('/api/users', (req, res) => {
  forward(res, `${SERVICES.user}/users`);
});

app.get('/api/users/:id', (req, res) => {
  forward(res, `${SERVICES.user}/users/${req.params.id}`);
});

app.post('/api/users', (req, res) => {
  forward(res, `${SERVICES.user}/users`, {
    method: 'POST',
    body: JSON.stringify(req.body),
  });
});

app.get('/api/movies', (req, res) => {
  forward(res, `${SERVICES.movie}/movies`);
});

app.get('/api/movies/:id', (req, res) => {
  forward(res, `${SERVICES.movie}/movies/${req.params.id}`);
});

app.post('/api/movies', (req, res) => {
  forward(res, `${SERVICES.movie}/movies`, {
    method: 'POST',
    body: JSON.stringify(req.body),
  });
});

app.get('/api/reviews', (req, res) => {
  forward(res, `${SERVICES.review}/reviews`);
});

app.post('/api/reviews', (req, res) => {
  forward(res, `${SERVICES.review}/reviews`, {
    method: 'POST',
    body: JSON.stringify(req.body),
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', gateway: 'running' }));

app.listen(PORT, () => console.log(`✅ API Gateway démarré sur http://localhost:${PORT}`));
