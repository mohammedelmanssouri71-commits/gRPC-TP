// ============================================================
// REVIEW SERVICE
// - gRPC  :50053 → reçoit CreateReview (serveur)
// - gRPC client  → appelle UserService :50051 et MovieService :50052
// - REST  :3000  → pour que l'API Gateway puisse l'appeler
// - MongoDB      → persistance des avis
// ============================================================

const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const express = require('express')
const mongoose = require('mongoose')
const path = require('path')

// ─── Connexion MongoDB ────────────────────────────────────────
mongoose.connect('mongodb+srv://simoxx230_db_user:HtyS9IT43VWG2sBU@cluster0.bnxtwql.mongodb.net/reviews_db')
  .then(() => console.log('[ReviewService] ✅ MongoDB connecté'))
  .catch(err => console.error('[ReviewService] ❌ MongoDB erreur :', err))

// ─── Schéma et modèle ─────────────────────────────────────────
const ReviewSchema = new mongoose.Schema({
  userId:     { type: Number, required: true },
  userName:   { type: String, required: true },
  movieId:    { type: Number, required: true },
  movieTitle: { type: String, required: true },
  comment:    { type: String, required: true },
  createdAt:  { type: Date, default: Date.now }
})
const Review = mongoose.model('Review', ReviewSchema)

// ─── Chargement des protos ────────────────────────────────────
const opts = { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }

const reviewProto = grpc.loadPackageDefinition(
  protoLoader.loadSync(path.join(__dirname, '../proto/review.proto'), opts)
).review

const userProto = grpc.loadPackageDefinition(
  protoLoader.loadSync(path.join(__dirname, '../proto/user.proto'), opts)
).user

const movieProto = grpc.loadPackageDefinition(
  protoLoader.loadSync(path.join(__dirname, '../proto/movie.proto'), opts)
).movie

// ─── Clients gRPC vers les autres services ────────────────────
const userClient = new userProto.UserService(
  'localhost:50051',
  grpc.credentials.createInsecure()
)
const movieClient = new movieProto.MovieService(
  'localhost:50052',
  grpc.credentials.createInsecure()
)

// ─── Implémentation gRPC CreateReview ─────────────────────────
function CreateReview(call, callback) {
  const { userId, movieId, comment } = call.request
  console.log(`\n[ReviewService] 📝 CreateReview userId=${userId} movieId=${movieId}`)

  // Appel 1 : vérifier l'utilisateur via gRPC
  userClient.GetUser({ id: userId }, async (userErr, user) => {
    if (userErr || !user || !user.id) {
      console.log(`[ReviewService] ❌ Utilisateur id=${userId} non trouvé`)
      return callback(null, { message: `❌ Utilisateur id=${userId} non trouvé` })
    }
    console.log(`[ReviewService] ✅ Utilisateur vérifié : ${user.name}`)

    // Appel 2 : vérifier le film via gRPC
    movieClient.GetMovie({ id: movieId }, async (movieErr, movie) => {
      if (movieErr || !movie || !movie.id) {
        console.log(`[ReviewService] ❌ Film id=${movieId} non trouvé`)
        return callback(null, { message: `❌ Film id=${movieId} non trouvé` })
      }
      console.log(`[ReviewService] ✅ Film vérifié : ${movie.title}`)

      // Sauvegarder en MongoDB
      const review = new Review({
        userId:     user.id,
        userName:   user.name,
        movieId:    movie.id,
        movieTitle: movie.title,
        comment
      })
      await review.save()
      console.log(`[ReviewService] ✅ Avis sauvegardé en base`)

      callback(null, {
        message: `✅ ${user.name} a commenté "${movie.title}" : "${comment}"`
      })
    })
  })
}

// ─── Démarrage serveur gRPC ───────────────────────────────────
const grpcServer = new grpc.Server()
grpcServer.addService(reviewProto.ReviewService.service, { CreateReview })
grpcServer.bindAsync(
  '0.0.0.0:50053',
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) return console.error('[ReviewService] ❌ gRPC erreur :', err)
    console.log(`[ReviewService] ✅ Serveur gRPC démarré sur le port ${port}`)
  }
)

// ─── API REST (pour l'API Gateway) ───────────────────────────
const app = express()
app.use(express.json())

// POST /reviews → crée un avis (déclenche les appels gRPC internes)
app.post('/reviews', (req, res) => {
  const { userId, movieId, comment } = req.body

  if (!userId || !movieId || !comment) {
    return res.status(400).json({ error: 'userId, movieId et comment sont requis' })
  }

  // Appel 1 : vérifier l'utilisateur via gRPC
  userClient.GetUser({ id: parseInt(userId) }, async (userErr, user) => {
    if (userErr || !user || !user.id) {
      return res.status(404).json({ error: `Utilisateur id=${userId} non trouvé` })
    }

    // Appel 2 : vérifier le film via gRPC
    movieClient.GetMovie({ id: parseInt(movieId) }, async (movieErr, movie) => {
      if (movieErr || !movie || !movie.id) {
        return res.status(404).json({ error: `Film id=${movieId} non trouvé` })
      }

      // Sauvegarder en MongoDB
      const review = new Review({
        userId:     user.id,
        userName:   user.name,
        movieId:    movie.id,
        movieTitle: movie.title,
        comment
      })
      await review.save()

      res.status(201).json({
        message: 'Avis créé avec succès !',
        review: {
          userId:     review.userId,
          userName:   review.userName,
          movieId:    review.movieId,
          movieTitle: review.movieTitle,
          comment:    review.comment,
          createdAt:  review.createdAt
        }
      })
    })
  })
})

// GET /reviews → liste tous les avis
app.get('/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({}, { _id: 0, __v: 0 }).sort({ createdAt: -1 })
    res.json({ total: reviews.length, reviews })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /health → santé du service
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'review-service',
    connectedTo: ['user-service:50051', 'movie-service:50052']
  })
})

app.listen(3000, () => {
  console.log('[ReviewService] ✅ API REST démarrée sur http://localhost:3000')
})