import { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const TOKEN_KEY = 'grpc_tp_token';

async function request(path, options = {}, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Une erreur est survenue');
  }

  return data;
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '');
  const [login, setLogin] = useState({ username: 'admin', password: 'admin123' });
  const [reviewInput, setReviewInput] = useState({ userId: 1, movieId: 1, comment: '' });

  const [users, setUsers] = useState([]);
  const [movies, setMovies] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [usersRes, moviesRes, reviewsRes] = await Promise.all([
        request('/api/users', {}, token),
        request('/api/movies', {}, token),
        request('/api/reviews', {}, token),
      ]);

      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setMovies(Array.isArray(moviesRes) ? moviesRes : []);
      setReviews(Array.isArray(reviewsRes.reviews) ? reviewsRes.reviews : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const onLoginSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(login),
      });

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setMessage(`Connecté en tant que ${data.user.username}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const onLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setUsers([]);
    setMovies([]);
    setReviews([]);
    setMessage('Déconnecté');
  };

  const onCreateReview = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const payload = {
        userId: Number(reviewInput.userId),
        movieId: Number(reviewInput.movieId),
        comment: reviewInput.comment.trim(),
      };

      const data = await request('/api/reviews', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, token);

      setMessage(data.message || 'Avis créé avec succès');
      setReviewInput((prev) => ({ ...prev, comment: '' }));
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>gRPC TP – Client React</h1>
        <p>Interface client avec authentification JWT.</p>
      </header>

      {!isAuthenticated && (
        <section className="card">
          <h2>Connexion</h2>
          <form onSubmit={onLoginSubmit} className="form-grid">
            <label>
              Username
              <input
                value={login.username}
                onChange={(e) => setLogin((prev) => ({ ...prev, username: e.target.value }))}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={login.password}
                onChange={(e) => setLogin((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
            </label>
            <button type="submit">Se connecter</button>
          </form>
          <small>Identifiants par défaut : admin / admin123</small>
        </section>
      )}

      {isAuthenticated && (
        <>
          <section className="card row-between">
            <h2>Dashboard</h2>
            <div>
              <button onClick={loadData} disabled={loading}>Rafraîchir</button>
              <button onClick={onLogout} className="secondary">Se déconnecter</button>
            </div>
          </section>

          <section className="card">
            <h2>Ajouter un avis</h2>
            <form onSubmit={onCreateReview} className="form-grid form-inline">
              <label>
                Utilisateur
                <select
                  value={reviewInput.userId}
                  onChange={(e) => setReviewInput((prev) => ({ ...prev, userId: e.target.value }))}
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.id} - {user.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Film
                <select
                  value={reviewInput.movieId}
                  onChange={(e) => setReviewInput((prev) => ({ ...prev, movieId: e.target.value }))}
                >
                  {movies.map((movie) => (
                    <option key={movie.id} value={movie.id}>{movie.id} - {movie.title}</option>
                  ))}
                </select>
              </label>
              <label className="wide">
                Commentaire
                <input
                  value={reviewInput.comment}
                  onChange={(e) => setReviewInput((prev) => ({ ...prev, comment: e.target.value }))}
                  required
                />
              </label>
              <button type="submit">Publier</button>
            </form>
          </section>

          <section className="grid-columns">
            <article className="card">
              <h3>Utilisateurs</h3>
              <ul>{users.map((user) => <li key={user.id}>{user.id}. {user.name}</li>)}</ul>
            </article>
            <article className="card">
              <h3>Films</h3>
              <ul>{movies.map((movie) => <li key={movie.id}>{movie.id}. {movie.title}</li>)}</ul>
            </article>
            <article className="card">
              <h3>Avis</h3>
              <ul>
                {reviews.map((review, idx) => (
                  <li key={`${review.userId}-${review.movieId}-${idx}`}>
                    <b>{review.userName}</b> → <i>{review.movieTitle}</i> : {review.comment}
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </>
      )}

      {loading && <p>Chargement...</p>}
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
    </div>
  );
}
