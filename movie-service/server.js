// ============================================================
// MOVIE SERVICE
// - gRPC  :50052 → pour que ReviewService puisse l'appeler
// - REST  :3002  → pour que l'API Gateway puisse l'appeler
// - MongoDB      → persistance des données
// ============================================================

const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const express = require('express')
const mongoose = require('mongoose')
const path = require('path')

// ─── Connexion MongoDB ────────────────────────────────────────
mongoose.connect('mongodb+srv://simoxx230_db_user:HtyS9IT43VWG2sBU@cluster0.bnxtwql.mongodb.net/movies_db')
  .then(() => console.log('[MovieService] ✅ MongoDB connecté'))
  .catch(err => console.error('[MovieService] ❌ MongoDB erreur :', err))

// ─── Schéma et modèle ─────────────────────────────────────────
const MovieSchema = new mongoose.Schema({
  id:    { type: Number, unique: true },
  title: { type: String, required: true }
})
const Movie = mongoose.model('Movie', MovieSchema)

// ─── Seed initial ─────────────────────────────────────────────
async function seedMovies() {
  const count = await Movie.countDocuments()
  if (count === 0) {
    await Movie.insertMany([
      { id: 1, title: 'Inception' },
      { id: 2, title: 'Interstellar' },
      { id: 3, title: 'The Dark Knight' },
      { id: 4, title: 'Parasite' }
    ])
    console.log('[MovieService] Base de données initialisée')
  }
}
seedMovies()

// ─── Chargement du proto ──────────────────────────────────────
const packageDefinition = protoLoader.loadSync(
  path.join(__dirname, '../proto/movie.proto'),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
)
const movieProto = grpc.loadPackageDefinition(packageDefinition).movie

// ─── Implémentation gRPC ──────────────────────────────────────
async function GetMovie(call, callback) {
  console.log(`[MovieService] gRPC GetMovie id=${call.request.id}`)
  const movie = await Movie.findOne({ id: call.request.id })
  if (!movie) {
    return callback({
      code: grpc.status.NOT_FOUND,
      message: `Film id=${call.request.id} introuvable`
    })
  }
  callback(null, { id: movie.id, title: movie.title })
}

// ─── Démarrage serveur gRPC ───────────────────────────────────
const grpcServer = new grpc.Server()
grpcServer.addService(movieProto.MovieService.service, { GetMovie })
grpcServer.bindAsync(
  '0.0.0.0:50052',
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) return console.error('[MovieService] ❌ gRPC erreur :', err)
    console.log(`[MovieService] ✅ Serveur gRPC démarré sur le port ${port}`)
  }
)

// ─── API REST (pour l'API Gateway) ───────────────────────────
const app = express()
app.use(express.json())

// GET /movies → liste tous les films
app.get('/movies', async (req, res) => {
  try {
    const movies = await Movie.find({}, { _id: 0, __v: 0 })
    res.json(movies)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /movies/:id → récupère un film par id
app.get('/movies/:id', async (req, res) => {
  try {
    const movie = await Movie.findOne({ id: Number(req.params.id) }, { _id: 0, __v: 0 })
    if (!movie) return res.status(404).json({ error: 'Film non trouvé' })
    res.json(movie)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /movies → crée un nouveau film
app.post('/movies', async (req, res) => {
  try {
    const last = await Movie.findOne().sort({ id: -1 })
    const newId = last ? last.id + 1 : 1
    const movie = new Movie({ id: newId, title: req.body.title })
    await movie.save()
    res.status(201).json({ id: movie.id, title: movie.title })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /health → santé du service
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'movie-service' })
})

app.listen(3002, () => {
  console.log('[MovieService] ✅ API REST démarrée sur http://localhost:3002')
})